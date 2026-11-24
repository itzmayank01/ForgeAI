"""F1: intake interviewer.

Resolves the brief's own contradiction - "asks at most 5 clarifying questions"
vs "runs unattended in front of us" - by supporting both from one code path.
Unattended mode asks the same questions, answers them itself, and records every
answer as an explicit Assumption. Surfacing assumptions beats skipping them.
"""
from __future__ import annotations

from ..ingest.index import ChunkIndex
from ..llm.client import LLMClient
from pydantic import BaseModel, Field

from ..llm.structured import structured
from ..models.agent_def import RetrievalConfig
from ..models.common import CorpusSummary
from ..models.requirements import MAX_QUESTIONS, Assumption, RequirementsDoc, Topic
from ..prompts import intake as P


def describe_corpus(summary: CorpusSummary) -> str:
    lines = [f"{len(summary.documents)} documents, {summary.total_chars:,} characters."]
    for d in summary.documents:
        lines.append(f"- {d.filename} ({d.kind}, {d.n_chars:,} chars)")
    if summary.sample_excerpts:
        lines.append("\nExcerpts:")
        lines += [f'  "{e[:220]}..."' for e in summary.sample_excerpts[:4]]
    return "\n".join(lines)


class _Basics(BaseModel):
    scope: str
    audience: str
    tone: str


class _SimpleTopic(BaseModel):
    name: str
    description: str = ""


class _Topics(BaseModel):
    topics: list[_SimpleTopic] = Field(default_factory=list)


class _Questions(BaseModel):
    questions: list[str] = Field(default_factory=list)


def _fallback(brief: str, summary: CorpusSummary, mode: str) -> RequirementsDoc:
    """The pipeline must finish even when the model returns nothing usable."""
    return RequirementsDoc(
        brief=brief,
        scope=brief.strip()[:300],
        audience="unspecified",
        tone="professional and concise",
        must_answer=[
            Topic(name=d.filename.rsplit(".", 1)[0].replace("_", " "),
                  description=f"Questions answerable from {d.filename}.")
            for d in summary.documents[:5]
        ],
        must_refuse=[
            Topic(name="legal advice", description="Anything requiring a lawyer."),
            Topic(name="out-of-corpus questions",
                  description="Anything the supplied documents do not cover."),
        ],
        corpus_manifest=summary.documents,
        mode=mode,  # type: ignore[arg-type]
    )


def run_intake(
    client: LLMClient,
    brief: str,
    summary: CorpusSummary,
    *,
    interactive: bool = False,
    index: ChunkIndex | None = None,
    ask=input,
    log=print,
) -> RequirementsDoc:
    mode = "interactive" if interactive else "unattended"
    corpus = describe_corpus(summary)

    # Decomposed deliberately. Asking a 20B model for the WHOLE RequirementsDoc
    # in one call - nested topic lists, assumptions, a corpus manifest - failed
    # every repair attempt on three consecutive live runs and fell back to the
    # deterministic doc, costing the requirements artifact entirely. Four small
    # single-purpose calls each succeed where the one big one does not.
    basics, _ = structured(
        client, model_cls=_Basics, temperature=0.2,
        instruction=P.BASICS.format(brief=brief, corpus=corpus))

    answer_topics, _ = structured(
        client, model_cls=_Topics, temperature=0.2,
        instruction=P.MUST_ANSWER.format(brief=brief, corpus=corpus))

    refuse_topics, _ = structured(
        client, model_cls=_Topics, temperature=0.1,
        instruction=P.MUST_REFUSE.format(brief=brief))

    questions, _ = structured(
        client, model_cls=_Questions, temperature=0.3,
        instruction=P.QUESTIONS.format(brief=brief, corpus=corpus))

    fallback = _fallback(brief, summary, mode)
    if basics is None and answer_topics is None:
        log("  intake: model failed on every field; using deterministic fallback")
        doc = fallback
    else:
        def _topics(result, default):
            if result is None or not result.topics:
                return default
            return [Topic(name=t.name, description=t.description or t.name)
                    for t in result.topics]

        doc = RequirementsDoc(
            brief=brief,
            scope=basics.scope if basics else fallback.scope,
            audience=basics.audience if basics else fallback.audience,
            tone=basics.tone if basics else fallback.tone,
            must_answer=_topics(answer_topics, fallback.must_answer),
            must_refuse=_topics(refuse_topics, fallback.must_refuse),
            questions_asked=(questions.questions[:MAX_QUESTIONS] if questions else []),
            mode=mode,  # type: ignore[arg-type]
        )
        missing = [n for n, v in (("basics", basics), ("must_answer", answer_topics),
                                  ("must_refuse", refuse_topics), ("questions", questions))
                   if v is None]
        if missing:
            log(f"  intake: fell back on {', '.join(missing)}; rest came from the model")

    doc.brief = brief
    doc.mode = mode  # type: ignore[assignment]
    doc.corpus_manifest = summary.documents
    doc.questions_asked = doc.questions_asked[:MAX_QUESTIONS]

    if not doc.questions_asked:
        return doc

    if interactive:
        for q in doc.questions_asked:
            answer = ask(f"  ? {q}\n  > ").strip()
            if answer:
                doc.assumptions.append(Assumption(
                    question=q, assumed_answer=answer,
                    confidence="high", basis="answered by requester",
                ))
        return doc

    # Unattended: answer each question from RETRIEVED TEXT, not just the file
    # listing. Without this the model concludes "the policy does not specify a
    # carry-over limit" about a policy whose clause 2.1 states it plainly.
    cfg = RetrievalConfig(top_k=4, min_score=0.0)
    for q in doc.questions_asked:
        context = corpus
        if index is not None:
            hits = index.search(q, cfg)
            if hits:
                context = "\n\n".join(f"[{h.chunk_id}] {h.text}" for h in hits)

        a, _ = structured(
            client,
            instruction=P.SELF_ANSWER.format(brief=brief, context=context, question=q),
            model_cls=Assumption,
            temperature=0.1,
        )
        doc.assumptions.append(a or Assumption(
            question=q, assumed_answer="could not infer; treated as out of scope",
            confidence="low", basis="model produced no usable answer",
        ))
    return doc
