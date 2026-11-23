"""Requirements + groundability artifacts (core requirements F1, F2)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .common import DocumentRef

MAX_QUESTIONS = 5


class Assumption(BaseModel):
    """Unattended mode answers its own clarifying questions - and records every one.

    The brief says "at most 5 clarifying questions" but also "runs unattended in
    front of us". Surfacing the assumptions is how we honour both.
    """

    question: str
    assumed_answer: str
    confidence: Literal["high", "medium", "low"]
    basis: str


class Topic(BaseModel):
    name: str
    description: str
    support_score: float | None = None
    supporting_chunks: list[str] = Field(default_factory=list)
    verdict: Literal["supported", "weak", "unsupported"] | None = None


class RequirementsDoc(BaseModel):
    brief: str
    scope: str
    audience: str
    tone: str
    must_answer: list[Topic]
    must_refuse: list[Topic]
    questions_asked: list[str] = Field(default_factory=list)
    assumptions: list[Assumption] = Field(default_factory=list)
    corpus_manifest: list[DocumentRef] = Field(default_factory=list)
    mode: Literal["interactive", "unattended"] = "unattended"

    @field_validator("questions_asked")
    @classmethod
    def _cap_questions(cls, v: list[str]) -> list[str]:
        if len(v) > MAX_QUESTIONS:
            raise ValueError(f"intake asked {len(v)} questions; the brief caps it at {MAX_QUESTIONS}")
        return v


class GroundabilityReport(BaseModel):
    """F2. If the brief asks for what the documents cannot support, say so HERE -
    before any agent exists to hallucinate the gap away."""

    topics: list[Topic]
    unsupported: list[str] = Field(default_factory=list)
    moved_to_refuse: list[str] = Field(default_factory=list)
    unsupported_ratio: float = 0.0
    aborted: bool = False
    abort_reason: str | None = None
