"""Prompt tournament (stretch goal).

The generator proposes several candidate system prompts and the eval set picks
the winner. Two rules make the result mean something:

  - Candidates are scored INDEPENDENTLY against the same cases, never compared
    to each other. There is no ordering for position bias to act on, and the
    judge never learns which candidate it is scoring.
  - The margin is reported. Picking a winner that beat the runner-up by one
    case out of twelve is noise dressed as a decision, so the report says when
    the result is within noise rather than presenting it as a finding.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from ..llm.client import LLMClient
from ..llm.structured import structured
from ..models.agent_def import AgentDefinition

CANDIDATES = """Write {n} genuinely different system prompts for the same assistant.

REQUIREMENTS
  Scope:    {scope}
  Audience: {audience}
  Tone:     {tone}
  Must answer: {must_answer}
  Must refuse: {must_refuse}

Each must contain ROLE, SCOPE, REFUSAL, GROUNDING, FORMAT and TONE sections and
instruct JSON output with answer, citations, refused and confidence.

Make them differ in STRATEGY, not wording. For example: one terse and rule-based,
one that explains its reasoning before answering, one that leads with when to
refuse. Returning three paraphrases of the same prompt wastes the comparison.

Return a list of {n} prompt strings under `prompts`.
"""


class _Candidates(BaseModel):
    prompts: list[str] = Field(default_factory=list)


class CandidateResult(BaseModel):
    index: int
    label: str
    pass_rate: float
    passed: int
    total: int
    prompt_chars: int


class TournamentResult(BaseModel):
    candidates: list[CandidateResult] = Field(default_factory=list)
    winner: int = 0
    margin: float = 0.0
    decisive: bool = False
    note: str = ""

    def summary(self) -> str:
        lines = ["| candidate | pass rate | passed |", "|---|---|---|"]
        for c in self.candidates:
            mark = " **(winner)**" if c.index == self.winner else ""
            lines.append(f"| {c.label}{mark} | {c.pass_rate:.0%} | {c.passed}/{c.total} |")
        lines.append("")
        lines.append(self.note)
        return "\n".join(lines)


def propose(
    client: LLMClient, definition: AgentDefinition, req, *, n: int = 3, log=print
) -> list[str]:
    """Candidate prompts, always including the one already generated as a baseline."""
    out, _ = structured(
        client, model_cls=_Candidates, temperature=0.6,
        instruction=CANDIDATES.format(
            n=n - 1,
            scope=req.scope, audience=req.audience, tone=req.tone,
            must_answer=", ".join(t.name for t in req.must_answer) or "(none)",
            must_refuse=", ".join(t.name for t in req.must_refuse) or "(none)",
        ),
    )
    extra = [p for p in (out.prompts if out else []) if len(p.strip()) > 120]
    log(f"  tournament: {len(extra) + 1} candidates (baseline + {len(extra)} proposed)")
    return [definition.system_prompt, *extra[: n - 1]]


def decide(results: list[CandidateResult], *, min_margin: float = 0.08) -> TournamentResult:
    """Pick the best, and say plainly when the margin is within noise."""
    if not results:
        return TournamentResult(note="No candidates scored.")

    ranked = sorted(results, key=lambda c: -c.pass_rate)
    best, runner = ranked[0], (ranked[1] if len(ranked) > 1 else None)
    margin = round(best.pass_rate - runner.pass_rate, 3) if runner else 0.0
    decisive = margin >= min_margin

    if runner is None:
        note = "Only one candidate was produced, so there was no comparison to make."
    elif decisive:
        note = (f"{best.label} wins by {margin:.0%} over {runner.label}. "
                f"That margin is wider than a single case, so the choice is "
                f"supported by the evidence.")
    else:
        note = (f"{best.label} scored highest but only {margin:.0%} above "
                f"{runner.label} — within noise on {best.total} cases. The "
                f"baseline prompt is kept: a difference this small is not a "
                f"finding, and treating it as one would be exactly the kind of "
                f"false precision this factory is built to avoid.")

    return TournamentResult(
        candidates=results,
        winner=best.index if decisive else 0,
        margin=margin,
        decisive=decisive,
        note=note,
    )
