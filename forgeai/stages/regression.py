"""Regression mode (stretch goal).

Documents change, the agent is regenerated, and the OLD eval set is replayed
against it. The question is not "is the new agent good" but "what did this
change break" - a case that passed before and fails now is a regression
regardless of the headline score, and a headline that improves can still hide
one.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from ..models.evals import CaseVerdict, EvalCase


class CaseDelta(BaseModel):
    case_id: str
    question: str
    before: bool
    after: bool

    @property
    def kind(self) -> str:
        if self.before and not self.after:
            return "broke"
        if not self.before and self.after:
            return "fixed"
        return "unchanged"


class RegressionReport(BaseModel):
    baseline_run: str
    corpus_hash_before: str
    corpus_hash_after: str
    pass_rate_before: float
    pass_rate_after: float
    broke: list[CaseDelta] = Field(default_factory=list)
    fixed: list[CaseDelta] = Field(default_factory=list)
    unchanged: int = 0

    @property
    def regressed(self) -> bool:
        return bool(self.broke)


def compare(
    cases: list[EvalCase],
    before: list[CaseVerdict],
    after: list[CaseVerdict],
    *,
    baseline_run: str,
    corpus_before: str,
    corpus_after: str,
) -> RegressionReport:
    q = {c.id: c.question for c in cases}
    b = {v.case_id: v.passed for v in before}
    a = {v.case_id: v.passed for v in after}

    deltas = [
        CaseDelta(case_id=cid, question=q.get(cid, ""), before=b[cid], after=a[cid])
        for cid in b.keys() & a.keys()
    ]
    report = RegressionReport(
        baseline_run=baseline_run,
        corpus_hash_before=corpus_before,
        corpus_hash_after=corpus_after,
        pass_rate_before=round(sum(b.values()) / len(b), 3) if b else 0.0,
        pass_rate_after=round(sum(a.values()) / len(a), 3) if a else 0.0,
        broke=[d for d in deltas if d.kind == "broke"],
        fixed=[d for d in deltas if d.kind == "fixed"],
        unchanged=sum(1 for d in deltas if d.kind == "unchanged"),
    )
    return report


def render(report: RegressionReport) -> str:
    L = [f"# Regression against `{report.baseline_run}`\n"]
    L.append(f"Corpus `{report.corpus_hash_before}` → `{report.corpus_hash_after}`\n")
    L.append(f"Pass rate {report.pass_rate_before:.0%} → {report.pass_rate_after:.0%} "
             f"({report.pass_rate_after - report.pass_rate_before:+.0%})\n")

    if report.broke:
        L.append(f"## Broke ({len(report.broke)})\n")
        L.append("Passed before this change and fails now. A rising headline score "
                 "does not excuse these.\n")
        for d in report.broke:
            L.append(f"- `{d.case_id}` — {d.question}")
        L.append("")
    else:
        L.append("## Broke\n\nNothing. No case that passed before fails now.\n")

    if report.fixed:
        L.append(f"## Fixed ({len(report.fixed)})\n")
        for d in report.fixed:
            L.append(f"- `{d.case_id}` — {d.question}")
        L.append("")

    L.append(f"{report.unchanged} cases unchanged.")
    return "\n".join(L)
