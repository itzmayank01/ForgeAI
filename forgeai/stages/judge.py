"""F5: the judge. Deterministic first, model last.

Bias defenses, as the brief demands:

  position bias    - no pairwise comparison anywhere in the loop. Every case is
                     scored against a rubric in isolation, so there is no order
                     to be biased by.
  self-preference  - runs settings.judge_model, a DIFFERENT open family from the
                     generator, and never sees the system prompt that produced
                     the answer.
  verbosity bias   - the score is fact_recall (length-independent) and
                     unsupported_claim_rate (which penalises padding). Answer
                     length is recorded as metadata and never enters the verdict.

Most cases never reach the model at all: refusal is a boolean in the output
contract, and citation validity is set arithmetic.
"""
from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from pydantic import BaseModel

from ..config import settings
from ..ingest.embedder import embed
from ..llm.client import LLMClient
from ..llm.structured import structured
from ..models.evals import CaseVerdict, EvalCase
from ..prompts import judge as P
from ..runtime.agent import AgentResponse

FACT_SIM = 0.74       # embedding match before falling through to the model
CLAIM_SIM = 0.58      # claim-vs-context floor before escalating
_SENT = re.compile(r"(?<=[.!?])\s+")
# Quantities only: a number flanked by letters, digits or hyphens belongs to an
# identifier (FIL-1210, doc_01_c000) and is not a fact to verify. Matching those
# scored correct answers as failures on every tabular case in the spares demo.
_NUM = re.compile(r"(?<![A-Za-z0-9_-])\d+(?:[.,]\d+)?(?![A-Za-z0-9_-])")


class _Entailed(BaseModel):
    entailed: bool
    reason: str = ""


class _Supported(BaseModel):
    supported: bool
    reason: str = ""


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", s.lower()).strip()


def fact_present(fact: str, answer: str, client: LLMClient) -> tuple[bool, bool]:
    """Return (present, used_llm). Three tiers, cheapest first.

    Numeric agreement is treated as strong positive evidence but NOT as a final
    negative: an expected "stock_qty 0" is genuinely satisfied by "there is no
    stock", which carries no digits at all. So a numeric miss falls through to
    the semantic tiers UNLESS the answer states different numbers, which is the
    real error case ("20 days" against an expected "22 days").
    """
    f, a = _norm(fact), _norm(answer)

    fact_nums = _NUM.findall(fact)
    if fact_nums:
        answer_nums = set(_NUM.findall(answer))
        if all(n in answer_nums for n in fact_nums):
            return True, False
        if answer_nums:
            # The answer commits to different figures: that is a wrong answer,
            # not an ambiguous one, and no amount of similarity should rescue it.
            return False, False

    if f and f in a:
        return True, False

    v = embed([fact, answer])
    if float(v[0] @ v[1]) >= FACT_SIM:
        return True, False

    out, _ = structured(
        client, model_cls=_Entailed, model=settings.judge_model, temperature=0.0,
        instruction=P.ENTAILMENT.format(fact=fact, answer=answer),
    )
    return (out.entailed if out else False), True


def _token_overlap(a: str, b: str) -> float:
    wa = {w for w in a.split() if len(w) > 3}
    if not wa:
        return 1.0
    return len({w for w in wa if w in b}) / len(wa)


def grounding(answer: str, context: str, client: LLMClient) -> tuple[float, bool]:
    """Fraction of claims unsupported by context. Length-independent by design."""
    claims = [s.strip() for s in _SENT.split(answer) if len(s.strip()) > 25]
    if not claims:
        return 0.0, False

    ctx_chunks = [c for c in _SENT.split(context) if c.strip()]
    if not ctx_chunks:
        return 1.0, False

    cv = embed(ctx_chunks)
    qv = embed(claims)
    best = (qv @ cv.T).max(axis=1)

    unsupported, used_llm = 0, False
    for claim, score in zip(claims, best):
        if score >= CLAIM_SIM:
            continue
        used_llm = True
        out, _ = structured(
            client, model_cls=_Supported, model=settings.judge_model, temperature=0.0,
            instruction=P.GROUNDED.format(context=context[:3000], claim=claim),
        )
        if not (out and out.supported):
            unsupported += 1
    return round(unsupported / len(claims), 3), used_llm


def judge_case(case: EvalCase, response: AgentResponse, client: LLMClient) -> CaseVerdict:
    retrieved_ids = [c.chunk_id for c in response.retrieved]
    valid_ids = set(retrieved_ids)
    used_llm = False

    # Citations: pure set arithmetic. A cited id the agent never retrieved is a
    # fabricated citation, which no amount of fluent prose excuses.
    citations_valid = (
        not response.citations or all(c in valid_ids for c in response.citations)
    )

    if case.should_refuse:
        passed = response.refused
        return CaseVerdict(
            case_id=case.id, answer=response.answer, refused=response.refused,
            grounded=True, correct=response.refused, citations_valid=True,
            fact_recall=1.0 if response.refused else 0.0,
            retrieved_chunks=retrieved_ids, passed=passed,
            judge_path="deterministic", answer_length=len(response.answer),
            tool_calls=response.tool_calls,
            notes="" if passed else "answered a question it should have refused",
        )

    if response.refused:  # refused something answerable
        return CaseVerdict(
            case_id=case.id, answer=response.answer, refused=True, grounded=True,
            correct=False, citations_valid=True, fact_recall=0.0,
            retrieved_chunks=retrieved_ids, passed=False,
            judge_path="deterministic", answer_length=len(response.answer),
            tool_calls=response.tool_calls,
            notes="refused an answerable question",
        )

    hits = 0
    for fact in case.expected_facts:
        present, llm = fact_present(fact, response.answer, client)
        used_llm |= llm
        hits += present
    recall = round(hits / len(case.expected_facts), 3) if case.expected_facts else 0.0

    context = "\n".join(c.text for c in response.retrieved)
    unsupported_rate, llm2 = grounding(response.answer, context, client)
    used_llm |= llm2

    correct = recall >= 0.99          # every expected fact, not most of them
    grounded = unsupported_rate <= 0.2
    passed = correct and grounded and citations_valid

    notes = []
    if not correct:
        notes.append(f"fact recall {recall}")
    if not grounded:
        notes.append(f"unsupported claims {unsupported_rate}")
    if not citations_valid:
        notes.append("cited chunks it never retrieved")

    return CaseVerdict(
        case_id=case.id, answer=response.answer, refused=False, grounded=grounded,
        correct=correct, citations_valid=citations_valid, fact_recall=recall,
        unsupported_claim_rate=unsupported_rate, retrieved_chunks=retrieved_ids,
        passed=passed, judge_path="llm_escalation" if used_llm else "deterministic",
        answer_length=len(response.answer), tool_calls=response.tool_calls,
        notes="; ".join(notes),
    )


def judge_all(cases: list[EvalCase], responses: dict[str, AgentResponse],
              client: LLMClient) -> list[CaseVerdict]:
    def one(c: EvalCase) -> CaseVerdict:
        return judge_case(c, responses[c.id], client)

    with ThreadPoolExecutor(max_workers=settings.max_concurrency) as ex:
        return list(ex.map(one, cases))
