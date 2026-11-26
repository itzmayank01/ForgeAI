"""F4: eval generator.

Derives a test set from the documents alone - this module deliberately does not
import AgentDefinition, so tests cannot be tuned to the prompt we just wrote.

The deterministic quality gate afterwards is the point: 20 trivially-passable
questions are self-deception, so cases that fail the gate are dropped and
reported rather than silently kept.
"""
from __future__ import annotations

import random
import re
from concurrent.futures import ThreadPoolExecutor

from pydantic import BaseModel, Field

from ..config import settings
from ..ingest.index import ChunkIndex
from ..llm.client import LLMClient
from ..llm.structured import structured
from ..models.agent_def import RetrievalConfig
from ..models.common import Chunk
from ..models.evals import MIN_CASES, EvalCase, EvalSuite
from ..models.requirements import RequirementsDoc
from ..prompts import evalgen as P


class _Fact(BaseModel):
    fact: str
    chunk_id: str


class _Facts(BaseModel):
    facts: list[_Fact] = Field(default_factory=list)


class _Question(BaseModel):
    question: str
    difficulty: str = "medium"


class _Questions(BaseModel):
    questions: list[str] = Field(default_factory=list)


class _Computation(BaseModel):
    question: str
    expected: str = ""
    difficulty: str = "hard"


_NUM_IN_TEXT = re.compile(r"(?<![A-Za-z0-9_-])\d+(?:[.,]\d+)?(?![A-Za-z0-9_-])")

_STOPWORDS = {
    "which", "there", "these", "those", "their", "other", "within", "after",
    "before", "where", "while", "shall", "must", "every", "above", "below",
}


def _difficulty(v: str) -> str:
    return v if v in {"easy", "medium", "hard"} else "medium"


def generate_suite(
    client: LLMClient, chunks: list[Chunk], req: RequirementsDoc,
    index: ChunkIndex, *, target: int = MIN_CASES, log=print,
) -> EvalSuite:
    # Over-generate, because the gate exists to drop weak cases and generating
    # exactly `target` guarantees finishing under it. 1.9x was set before the
    # top-up pass existed and produced 34- and 31-case suites against a floor of
    # 20 - every extra case costs a model call per iteration, which on an
    # unattended demo is time the reviewer spends watching. The top-up now
    # covers any shortfall, so this only needs to cover the usual gate loss.
    OVERSHOOT = 1.4
    want = int(target * OVERSHOOT)
    rng = random.Random(7)
    pool = rng.sample(chunks, min(len(chunks), max(10, want)))

    def facts_for(c: Chunk) -> list[_Fact]:
        out, _ = structured(
            client, model_cls=_Facts, temperature=0.1, model=settings.evalgen_model,
            instruction=P.EXTRACT_FACTS.format(
                filename=c.filename, chunk_id=c.chunk_id, text=c.text[:1800]),
        )
        return [f for f in (out.facts if out else []) if f.fact.strip()]

    with ThreadPoolExecutor(max_workers=settings.max_concurrency) as ex:
        harvested = [f for fs in ex.map(facts_for, pool) for f in fs]
    log(f"  extracted {len(harvested)} atomic facts from {len(pool)} chunks")

    by_chunk = {c.chunk_id: c for c in chunks}
    cases: list[EvalCase] = []

    # --- answerable ---------------------------------------------------------
    def answerable(i_f: tuple[int, _Fact]) -> EvalCase | None:
        i, f = i_f
        c = by_chunk.get(f.chunk_id)
        if c is None:
            return None
        q, _ = structured(
            client, model_cls=_Question, temperature=0.4, model=settings.evalgen_model,
            instruction=P.FACT_TO_QUESTION.format(
                fact=f.fact, filename=c.filename, audience=req.audience),
        )
        if q is None:
            return None
        return EvalCase(
            id=f"ans_{i:03d}", question=q.question, kind="answerable",
            expected_facts=[f.fact], source_documents=[c.doc_id],
            source_chunks=[c.chunk_id], should_refuse=False,
            difficulty=_difficulty(q.difficulty),
        )

    n_ans = max(14, int(want * 0.55))
    with ThreadPoolExecutor(max_workers=settings.max_concurrency) as ex:
        cases += [c for c in ex.map(answerable, enumerate(harvested[:n_ans])) if c]

    # --- edge: multi-document ----------------------------------------------
    # Pair facts only when they share a content word. Calibration found the
    # unconstrained version pairing grievance-record confidentiality with
    # per-diem rates, producing questions nobody could answer - and the agent
    # was then marked down for correctly refusing them.
    def _content(text: str) -> set[str]:
        return {w for w in re.findall(r"[a-z]{5,}", text.lower())
                if w not in _STOPWORDS}

    cross = [
        (a, b) for a in harvested for b in harvested
        if by_chunk.get(a.chunk_id) and by_chunk.get(b.chunk_id)
        and by_chunk[a.chunk_id].doc_id != by_chunk[b.chunk_id].doc_id
        and _content(a.fact) & _content(b.fact)
    ]
    rng.shuffle(cross)
    for i, (a, b) in enumerate(cross[:4]):
        ca, cb = by_chunk[a.chunk_id], by_chunk[b.chunk_id]
        q, _ = structured(
            client, model_cls=_Question, temperature=0.4, model=settings.evalgen_model,
            instruction=P.MULTI_DOC.format(
                file_a=ca.filename, fact_a=a.fact, file_b=cb.filename, fact_b=b.fact),
        )
        if q and q.question.strip().upper() != "SKIP":
            cases.append(EvalCase(
                id=f"edge_multi_{i:02d}", question=q.question, kind="edge",
                edge_type="multi_document", expected_facts=[a.fact, b.fact],
                source_documents=[ca.doc_id, cb.doc_id],
                source_chunks=[ca.chunk_id, cb.chunk_id],
                should_refuse=False, difficulty="hard",
            ))

    # --- edge: ambiguous ----------------------------------------------------
    for i, base in enumerate([c for c in cases if c.kind == "answerable"][:4]):
        q, _ = structured(
            client, model_cls=_Question, temperature=0.5, model=settings.evalgen_model,
            instruction=P.AMBIGUOUS.format(question=base.question),
        )
        if q:
            cases.append(EvalCase(
                id=f"edge_amb_{i:02d}", question=q.question, kind="edge",
                edge_type="ambiguous", expected_facts=base.expected_facts,
                source_documents=base.source_documents,
                source_chunks=base.source_chunks,
                should_refuse=False, difficulty="hard",
            ))

    # --- edge: arithmetic over document figures ------------------------------
    # Derived from the documents like everything else - this module still never
    # sees the agent definition. But a suite that only ever asks for lookups
    # cannot tell whether an agent can actually compute, and an attached
    # calculator stays untested however many cases there are.
    numeric = [c for c in pool if len(_NUM_IN_TEXT.findall(c.text)) >= 3]
    for i, chunk in enumerate(numeric[:3]):
        comp, _ = structured(
            client, model_cls=_Computation, temperature=0.3,
            model=settings.evalgen_model,
            instruction=P.COMPUTATION.format(
                filename=chunk.filename, chunk_id=chunk.chunk_id,
                text=chunk.text[:1500]),
        )
        if comp and comp.question.strip().upper() != "SKIP" and comp.expected.strip():
            cases.append(EvalCase(
                id=f"edge_calc_{i:02d}", question=comp.question, kind="edge",
                edge_type="ambiguous", expected_facts=[comp.expected.strip()],
                source_documents=[chunk.doc_id], source_chunks=[chunk.chunk_id],
                should_refuse=False, difficulty="hard",
            ))

    # --- out of scope -------------------------------------------------------
    n_oos = max(7, int(want * 0.25))
    oos, _ = structured(
        client, model_cls=_Questions, temperature=0.6, model=settings.evalgen_model,
        instruction=P.OUT_OF_SCOPE.format(
            corpus=", ".join(sorted({c.filename for c in chunks})),
            scope=req.scope, n=n_oos),
    )
    for i, q in enumerate((oos.questions if oos else [])[:n_oos]):
        cases.append(EvalCase(
            id=f"oos_{i:02d}", question=q, kind="out_of_scope",
            should_refuse=True, difficulty="medium",
        ))

    kept, gate = quality_gate(cases, index)
    log(f"  gate: kept {len(kept)}/{len(cases)} -> {gate}")

    # The gate is strict by design, so a thin corpus can finish under the floor
    # the brief sets. A cold run on an unseen three-document corpus generated 19
    # and kept 17. Top up from the unused facts rather than shipping a suite
    # that fails the requirement.
    if len(kept) < MIN_CASES and len(harvested) > n_ans:
        shortfall = MIN_CASES - len(kept)
        log(f"  only {len(kept)} survived the gate; generating {shortfall} more")
        with ThreadPoolExecutor(max_workers=settings.max_concurrency) as ex:
            extra = [c for c in ex.map(
                answerable,
                enumerate(harvested[n_ans:n_ans + shortfall * 2], start=n_ans))
                if c]
        more, more_gate = quality_gate(extra, index)
        seen_q = {c.question.strip().lower() for c in kept}
        kept += [c for c in more if c.question.strip().lower() not in seen_q][:shortfall]
        gate["top_up_generated"] = len(extra)
        gate["kept"] = len(kept)
        log(f"  after top-up: {len(kept)} cases")

    if len(kept) < MIN_CASES:
        gate["warning"] = (f"only {len(kept)} cases; the brief requires "
                           f">= {MIN_CASES}. The corpus may be too thin.")
    return EvalSuite(
        cases=kept,
        generated_by=settings.gen_model,
        generation_prompts=[
            P.EXTRACT_FACTS, P.FACT_TO_QUESTION, P.MULTI_DOC, P.AMBIGUOUS, P.OUT_OF_SCOPE,
        ],
        gate_report=gate,
    )


def quality_gate(cases: list[EvalCase], index: ChunkIndex) -> tuple[list[EvalCase], dict]:
    """Deterministic. Drops cases that would make the suite a rubber stamp.

    The decisive check is the third: an "out of scope" question that actually
    retrieves strong context is secretly answerable, and keeping it would score
    a correct answer as a failure - teaching the optimizer to make the agent
    refuse everything.
    """
    kept: list[EvalCase] = []
    dropped = {"empty": 0, "no_expected_facts": 0, "oos_is_answerable": 0,
               "fact_not_in_source": 0, "duplicate": 0, "bundled_fact": 0,
               "dangling_referent": 0, "metadata_fact": 0,
               "invented_identifier": 0}
    seen: list[str] = []
    corpus_text = " ".join(ch.text.lower() for ch in index.chunks)

    for c in cases:
        q = c.question.strip()
        if len(q) < 10:
            dropped["empty"] += 1
            continue
        if _has_dangling_referent(q):
            dropped["dangling_referent"] += 1
            continue
        norm = " ".join(q.lower().split())
        if any(norm == s or (len(norm) > 25 and norm in s) for s in seen):
            dropped["duplicate"] += 1
            continue

        if c.kind in {"answerable", "edge"}:
            if not c.expected_facts:
                dropped["no_expected_facts"] += 1
                continue
            # A fact that bundles several claims fails an answer that correctly
            # addresses the one actually asked about.
            if any(_is_bundled(f) for f in c.expected_facts):
                dropped["bundled_fact"] += 1
                continue
            # Front matter is not a fact about the policy. Calibration found
            # "What does HR-09 say about how to file a grievance?" with a single
            # expected fact of "Policy reference: HR-09" - so a correct, validly
            # cited answer describing form HR-09a failed for not echoing a
            # header. The judge requires every expected fact, which makes one
            # unanswerable fact enough to sink an otherwise good case.
            if all(_is_document_metadata(f) for f in c.expected_facts):
                dropped["metadata_fact"] += 1
                continue
            # A question naming an identifier the corpus does not contain has
            # no answer, and an expected fact for it is invented. ship_spares
            # shipped "What is the current stock quantity for part PN-9876?"
            # expecting "stock_qty: 60"; no part number in that catalogue even
            # uses a PN- prefix. The agent refused, correctly, and the case
            # scored it a failure - which is exactly the pressure that teaches
            # an optimizer to stop refusing.
            invented = _invented_identifier(q, corpus_text)
            if invented:
                dropped["invented_identifier"] += 1
                continue
            # A computed answer is derived from the source, not quoted from it:
            # "48977.98" is the correct total for two stock lines and appears
            # nowhere in the text. Checking it the same way dropped every
            # arithmetic case the generator produced - three of them on the
            # spares corpus - which is why an attached calculator stayed
            # untested.
            if not c.id.startswith("edge_calc"):
                texts = " ".join(
                    ch.text.lower() for ch in index.chunks
                    if ch.chunk_id in c.source_chunks
                )
                if texts and not any(
                    _overlap(f.lower(), texts) for f in c.expected_facts
                ):
                    dropped["fact_not_in_source"] += 1
                    continue
        else:
            hits = index.search(q, RetrievalConfig(top_k=1, min_score=0.0))
            if hits and hits[0].score >= 0.72:
                dropped["oos_is_answerable"] += 1
                continue

        seen.append(norm)
        kept.append(c)

    report: dict = {k: v for k, v in dropped.items() if v}
    report["kept"] = len(kept)
    report["generated"] = len(cases)
    if len(kept) < MIN_CASES:
        report["warning"] = f"only {len(kept)} cases survived; brief requires >= {MIN_CASES}"
    return kept, report


_BUNDLE_MARKERS = re.compile(r",\s*(which|and must|and is|and the)\b|;", re.I)

_DANGLING = re.compile(
    r"\b(this|that|the|its|their)\s+(part|item|product|policy|supplier|clause|"
    r"document|agreement|component)\b", re.I)
_NAMED = re.compile(r"[A-Z]{2,}-\d+|\b[A-Z][a-z]+\s+[A-Z][a-z]+\b|\.(md|csv|pdf)\b")


def _has_dangling_referent(question: str) -> bool:
    """A question about "this part" with no part named has no answer.

    Calibration found the agent correctly refusing five such questions and the
    judge marking every one a failure - kappa 0.00 on that corpus. The subject
    must be named for the question to be gradeable at all.
    """
    return bool(_DANGLING.search(question)) and not _NAMED.search(question)


def _is_bundled(fact: str) -> bool:
    """Two claims wearing one coat.

    Calibration caught "4 weeks of parental leave, which must be taken within
    12 months" being scored against an answer that correctly said "4 weeks".
    """
    return bool(_BUNDLE_MARKERS.search(fact))


_METADATA_FIELD = re.compile(
    r"^[*_\s#]*(policy\s+reference|policy\s+no|reference|ref|effective|"
    r"review(?:ed)?|version|revision|document(?:\s+(?:id|number))?|issued|"
    r"supersedes|approved\s+by|owner|author|page|last\s+updated)\b[*_\s]*[:\-]",
    re.IGNORECASE)


_IDENTIFIER = re.compile(r"\b[A-Z]{2,}[-_]\d{2,}[A-Za-z0-9-]*\b")


def _invented_identifier(question: str, corpus_text: str) -> str | None:
    """An identifier the question names that appears nowhere in the documents.

    Part numbers, policy references and form codes are the things a question
    can be most confidently wrong about: either the corpus contains the token
    or it does not, with no judgement involved.
    """
    for ident in _IDENTIFIER.findall(question):
        if ident.lower() not in corpus_text:
            return ident
    return None


def _is_document_metadata(fact: str) -> bool:
    """A front-matter field masquerading as a fact.

    Policy documents open with "Policy reference: HR-09 - Effective: 1 January
    2026", and the extractor happily harvests those lines. They are not claims a
    user asks about, and an answer is not wrong for omitting them - but the
    judge requires EVERY expected fact, so one of these fails a case no answer
    could pass.
    """
    return bool(_METADATA_FIELD.match(fact.strip()))


def _overlap(fact: str, source: str, threshold: float = 0.5) -> bool:
    words = {w for w in fact.split() if len(w) > 3}
    if not words:
        return True
    return len({w for w in words if w in source}) / len(words) >= threshold
