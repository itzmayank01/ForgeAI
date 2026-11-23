"""Generated eval suite and judge verdicts (F4, F5).

The eval generator NEVER imports AgentDefinition. Tests are derived from the
documents alone, so they cannot be tuned to the prompt we just wrote.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

CaseKind = Literal["answerable", "out_of_scope", "edge"]
EdgeType = Literal["ambiguous", "multi_document"]
Difficulty = Literal["easy", "medium", "hard"]
MIN_CASES = 20


class EvalCase(BaseModel):
    id: str
    question: str
    kind: CaseKind
    edge_type: EdgeType | None = None
    expected_facts: list[str] = Field(default_factory=list)
    source_documents: list[str] = Field(default_factory=list)
    source_chunks: list[str] = Field(default_factory=list)
    should_refuse: bool = False
    difficulty: Difficulty = "medium"


class EvalSuite(BaseModel):
    cases: list[EvalCase]
    generated_by: str
    generation_prompts: list[str] = Field(default_factory=list)
    gate_report: dict[str, int | str] = Field(default_factory=dict)

    def counts(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for c in self.cases:
            out[c.kind] = out.get(c.kind, 0) + 1
        return out


class CaseVerdict(BaseModel):
    case_id: str
    answer: str
    refused: bool
    grounded: bool
    correct: bool
    citations_valid: bool
    fact_recall: float = 0.0
    unsupported_claim_rate: float = 0.0
    retrieved_chunks: list[str] = Field(default_factory=list)
    passed: bool = False
    judge_path: Literal["deterministic", "llm_escalation"] = "deterministic"
    notes: str = ""
    answer_length: int = 0  # reported, NEVER scored - verbosity-bias defense


class Scorecard(BaseModel):
    iteration: int
    total: int
    passed: int
    pass_rate: float
    by_kind: dict[str, float] = Field(default_factory=dict)
    by_difficulty: dict[str, float] = Field(default_factory=dict)
    mean_answer_length: int = 0
    llm_escalation_rate: float = 0.0

    @classmethod
    def from_verdicts(cls, iteration: int, verdicts: list[CaseVerdict],
                      cases: list[EvalCase]) -> "Scorecard":
        by_id = {c.id: c for c in cases}
        total = len(verdicts)
        passed = sum(v.passed for v in verdicts)

        def rate(pred) -> dict[str, float]:
            buckets: dict[str, list[bool]] = {}
            for v in verdicts:
                c = by_id.get(v.case_id)
                if c is None:
                    continue
                buckets.setdefault(pred(c), []).append(v.passed)
            return {k: round(sum(x) / len(x), 3) for k, x in buckets.items() if x}

        return cls(
            iteration=iteration,
            total=total,
            passed=passed,
            pass_rate=round(passed / total, 3) if total else 0.0,
            by_kind=rate(lambda c: c.kind),
            by_difficulty=rate(lambda c: c.difficulty),
            mean_answer_length=int(sum(v.answer_length for v in verdicts) / total) if total else 0,
            llm_escalation_rate=round(
                sum(v.judge_path == "llm_escalation" for v in verdicts) / total, 3
            ) if total else 0.0,
        )
