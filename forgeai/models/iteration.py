"""Critic -> optimizer loop, budget, and the final run report (F6, F7)."""
from __future__ import annotations

import time
from typing import Any, Literal

from pydantic import BaseModel, Field

from .evals import Scorecard

FailureCategory = Literal[
    "retrieval_miss",     # expected source chunk never reached the model
    "prompt_defect",      # right context, wrong answer/format
    "hallucination",      # claims unsupported by retrieved context
    "wrong_refusal",      # refused an answerable question
]

# One rung per iteration, so every change is attributable to a measured delta.
FIX_LADDER: dict[str, list[str]] = {
    "retrieval_miss": ["raise_top_k", "shrink_chunks", "enable_hybrid", "enable_query_rewrite"],
    "prompt_defect": ["patch_format_block", "patch_scope_block", "add_worked_example"],
    "hallucination": ["add_grounding_clause", "force_citations", "drop_temperature", "raise_min_score"],
    "wrong_refusal": ["lower_min_score", "widen_scope_statement", "soften_refusal_clause"],
}


class FailureDiagnosis(BaseModel):
    case_id: str
    category: FailureCategory
    evidence: str
    classified_by: Literal["deterministic", "llm"] = "deterministic"


class FixAction(BaseModel):
    category: FailureCategory
    rung: str
    rationale: str
    targets_case_ids: list[str] = Field(default_factory=list)
    diff: dict[str, Any] = Field(default_factory=dict)


class IterationLog(BaseModel):
    """F6 demands: what changed, why, which failures it addressed, score before/after."""

    iteration: int
    failures_by_category: dict[str, int] = Field(default_factory=dict)
    diagnoses: list[FailureDiagnosis] = Field(default_factory=list)
    fix: FixAction | None = None
    score_before: float = 0.0
    score_after: float = 0.0
    kept: bool = True
    revert_reason: str | None = None
    seconds: float = 0.0
    tokens: int = 0

    @property
    def delta(self) -> float:
        return round(self.score_after - self.score_before, 3)


class Budget(BaseModel):
    """Running out is a normal, reported outcome - not a crash.

    The overview defines the loop as running "until the evals pass or a budget
    runs out", so this is core, not the stretch goal the brief files it under.
    """

    max_tokens: int = 500_000
    max_seconds: int = 900
    max_iterations: int = 3
    tokens_used: int = 0
    started_at: float = Field(default_factory=time.time)

    @property
    def seconds_used(self) -> float:
        return round(time.time() - self.started_at, 1)

    def exhausted(self) -> str | None:
        if self.tokens_used >= self.max_tokens:
            return f"token budget exhausted ({self.tokens_used}/{self.max_tokens})"
        if self.seconds_used >= self.max_seconds:
            return f"time budget exhausted ({self.seconds_used}s/{self.max_seconds}s)"
        return None

    def spend(self, tokens: int) -> None:
        self.tokens_used += tokens


class JudgeCalibration(BaseModel):
    """Judge-vs-human agreement on a hand-labelled gold set.

    Reporting this number is the point: a judge nobody has checked is not evidence.
    """

    n_cases: int = 0
    agreements: int = 0
    agreement_rate: float = 0.0
    cohens_kappa: float = 0.0
    disagreements: list[dict[str, Any]] = Field(default_factory=list)
    # Labels dropped because the answer they were written against is no longer
    # the answer the judge scored. Recorded rather than silently discarded: a
    # kappa over 4 surviving pairs is a much weaker claim than one over 12.
    stale_labels_dropped: int = 0


class RunReport(BaseModel):
    run_id: str
    brief: str
    corpus_hash: str
    final_pass_rate: float
    scorecards: list[Scorecard] = Field(default_factory=list)
    iterations: list[IterationLog] = Field(default_factory=list)
    residual_failures: list[dict[str, str]] = Field(default_factory=list)
    calibration: JudgeCalibration | None = None
    stop_reason: str = ""
    budget: Budget | None = None
    best_version: int = 0
    evaluated: bool = True
    """False when no eval pass completed. A run that measured nothing has no
    pass rate - reporting 0% would be a fabricated number, which is precisely
    what this project exists not to do."""
