"""F7: honest reporting.

"A factory that claims 100% is suspicious; a factory that explains its 78% is
hired." So the report leads with what still fails and why, and surfaces the
judge's own agreement rate - a judge nobody has checked is not evidence.
"""
from __future__ import annotations

from ..models.agent_def import AgentDefinition
from ..models.iteration import RunReport


def render(report: RunReport, definition: AgentDefinition) -> str:
    L: list[str] = []
    a = L.append

    a(f"# ForgeAI run report - {report.run_id}\n")
    a(f"**Brief.** {report.brief}\n")
    if not report.evaluated:
        a("> **Not scored.** No evaluation pass completed, so this run has no "
          f"pass rate. Stopped because: {report.stop_reason}.\n")
        a("> Reporting 0% here would be a fabricated number. Re-run with "
          "`--resume` to finish the suite.\n")
    else:
        a(f"**Final pass rate: {report.final_pass_rate:.0%}** "
          f"(agent v{report.best_version}, stopped because: {report.stop_reason})\n")

    if report.budget:
        b = report.budget
        a(f"Budget: {b.tokens_used:,}/{b.max_tokens:,} tokens, "
          f"{b.seconds_used}s/{b.max_seconds}s, "
          f"{len(report.iterations)}/{b.max_iterations} iterations.\n")

    a("## Per-iteration scorecard\n")
    a("| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |")
    a("|---|---|---|---|---|---|---|")
    for c in report.scorecards:
        k = c.by_kind
        a(f"| {c.iteration} | {c.pass_rate:.0%} | {c.passed}/{c.total} | "
          f"{k.get('answerable', 0):.0%} | {k.get('out_of_scope', 0):.0%} | "
          f"{k.get('edge', 0):.0%} | {c.llm_escalation_rate:.0%} |")
    a("")

    if report.iterations:
        a("## What changed, and whether it helped\n")
        if report.best_version == 0 and not any(i.kept is True for i in report.iterations):
            a("> No fix beat the baseline. Every attempted change was reverted and the "
              "shipped agent is the one the generator produced first. That is a real "
              "result: on this corpus the generated definition was already at its best, "
              "and the loop's job was to establish that rather than to improve on it.\n")
        for it in report.iterations:
            if it.fix is None:
                continue
            # kept is None when the run stopped before this fix was re-scored.
            # Calling that "kept" claims a validation that never ran; calling it
            # "REVERTED" claims a measurement that never happened.
            if it.kept is None:
                verdict = "NOT MEASURED - the run stopped before re-scoring it"
            elif it.kept:
                verdict = "kept"
            else:
                verdict = f"REVERTED - {it.revert_reason}"
            a(f"**Iteration {it.iteration}: `{it.fix.category}` -> `{it.fix.rung}`** ({verdict})\n")
            a(f"- Diagnosed: {it.failures_by_category}")
            a(f"- Rationale: {it.fix.rationale}")
            if it.fix.diff.get("before"):
                a(f"- Changed: `{it.fix.diff['before']}` -> `{it.fix.diff['after']}`")
            a(f"- Targeted: {', '.join(it.fix.targets_case_ids[:6]) or 'n/a'}")
            if it.score_after is None:
                a(f"- Score: {it.score_before:.0%} -> not measured\n")
            else:
                a(f"- Score: {it.score_before:.0%} -> {it.score_after:.0%} "
                  f"(delta {it.delta:+.0%})\n")

    a("## What still fails\n")
    if not report.residual_failures:
        a("No residual failures. Treat a 100% score with suspicion: check the "
          "eval suite's gate report for how many cases were dropped, and the "
          "judge calibration below before believing it.\n")
    else:
        a(f"{len(report.residual_failures)} of {report.scorecards[-1].total if report.scorecards else 0} "
          f"cases still fail:\n")
        a("| case | question | why |")
        a("|---|---|---|")
        for r in report.residual_failures:
            q = r["question"][:70].replace("|", "/")
            a(f"| `{r['case_id']}` | {q} | {r['why']} |")
        a("")

    a("## Judge calibration\n")
    if report.calibration and report.calibration.n_cases:
        c = report.calibration
        a(f"Agreement with hand labels: **{c.agreement_rate:.0%}** "
          f"({c.agreements}/{c.n_cases}), Cohen's kappa {c.cohens_kappa:.2f}.\n")
        if c.disagreements:
            a("Disagreements:\n")
            for d in c.disagreements:
                a(f"- `{d.get('case_id')}`: judge said {d.get('judge')}, "
                  f"human said {d.get('human')}")
            a("")
    else:
        a("Not calibrated. Every number above is unverified - run "
          "`forgeai calibrate` against a hand-labelled gold set before trusting "
          "this report.\n")

    a("## Final agent definition\n")
    a(f"- Tools: {', '.join(definition.tool_names) or 'none'}")
    if definition.provenance.get("tools_rejected"):
        a(f"- Tools rejected by audit: {definition.provenance['tools_rejected']}")
    r = definition.retrieval
    a(f"- Retrieval: {r.strategy}, chunk {r.chunk_size}/{r.chunk_overlap}, "
      f"top_k {r.top_k}, min_score {r.min_score}")
    a(f"- Temperature: {definition.temperature}")
    return "\n".join(L)
