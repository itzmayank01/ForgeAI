"""F6a: failure classification.

Deterministic wherever the evidence allows, because the retrieval trace tells us
what happened. Only genuinely ambiguous failures reach the model - "ask the LLM
what went wrong" is exactly the kind of unverifiable step this assignment is
hunting for.
"""
from __future__ import annotations

from ..models.evals import CaseVerdict, EvalCase
from ..models.iteration import FailureDiagnosis

UNSUPPORTED_HALLUCINATION = 0.3


def classify(case: EvalCase, verdict: CaseVerdict) -> FailureDiagnosis:
    retrieved = set(verdict.retrieved_chunks)
    expected = set(case.source_chunks)

    # Refused something answerable, but the right context was right there.
    if verdict.refused and not case.should_refuse:
        if expected and expected & retrieved:
            return FailureDiagnosis(
                case_id=case.id, category="wrong_refusal",
                evidence=f"refused despite retrieving {sorted(expected & retrieved)}",
            )
        return FailureDiagnosis(
            case_id=case.id, category="retrieval_miss",
            evidence=f"refused; expected {sorted(expected)} never retrieved",
        )

    # Answered something it should have refused: the prompt's refusal section
    # is not doing its job.
    if not verdict.refused and case.should_refuse:
        return FailureDiagnosis(
            case_id=case.id, category="prompt_defect",
            evidence="answered an out-of-scope question; refusal rule too weak",
        )

    # The source was never retrieved - nothing the prompt could have done.
    if expected and not (expected & retrieved):
        return FailureDiagnosis(
            case_id=case.id, category="retrieval_miss",
            evidence=f"expected {sorted(expected)}, retrieved {sorted(retrieved)}",
        )

    if verdict.unsupported_claim_rate > UNSUPPORTED_HALLUCINATION:
        return FailureDiagnosis(
            case_id=case.id, category="hallucination",
            evidence=f"{verdict.unsupported_claim_rate:.0%} of claims unsupported by context",
        )

    if not verdict.citations_valid:
        return FailureDiagnosis(
            case_id=case.id, category="hallucination",
            evidence="cited chunk ids it never retrieved",
        )

    # Right context, wrong answer: the prompt is at fault.
    return FailureDiagnosis(
        case_id=case.id, category="prompt_defect",
        evidence=f"correct context retrieved but fact recall {verdict.fact_recall}",
    )


def diagnose(cases: list[EvalCase], verdicts: list[CaseVerdict]) -> list[FailureDiagnosis]:
    by_id = {c.id: c for c in cases}
    return [
        classify(by_id[v.case_id], v)
        for v in verdicts if not v.passed and v.case_id in by_id
    ]
