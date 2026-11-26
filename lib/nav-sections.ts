import { loadAllRuns } from "./runs";
import type { MegaSection } from "@/components/mega-nav";

/**
 * The navigation menu, built from the site's own sections.
 *
 * A mega-menu advertising pages that do not exist is the navigational version
 * of a fabricated metric, so the scored-run column is generated from the runs
 * actually committed, with each chip showing that run's measured pass rate. A
 * checkout with no runs simply shows no run entries.
 */
export async function buildNavSections(): Promise<MegaSection[]> {
  const scored = (await loadAllRuns())
    .filter((r) => !r.synthetic && r.report && r.report.evaluated !== false)
    .map((r) => ({
      id: r.id,
      rate: r.report!.final_pass_rate,
      cases: r.suite?.cases.length ?? 0,
    }));

  return [
    {
      label: "Platform",
      columns: [
        {
          heading: "The factory",
          items: [
            { label: "Intake interviewer", href: "/#pipeline", blurb: "Asks ≤5 questions, or answers them itself", icon: "intake" },
            { label: "Groundability guard", href: "/#pipeline", blurb: "Refuses briefs the documents cannot support", icon: "shield" },
            { label: "Agent generator", href: "/#pipeline", blurb: "Tools must earn their place", icon: "spark" },
            { label: "Eval generator", href: "/#pipeline", blurb: "Never imports the agent definition", icon: "flask" },
          ],
        },
        {
          heading: "Scoring",
          items: [
            { label: "Evidentiary judge", href: "/#pipeline", blurb: "Deterministic first, another model family", icon: "scale" },
            { label: "Critic-optimizer", href: "/#pipeline", blurb: "Reverts a fix that did not help", icon: "loop" },
            { label: "Honest report", href: "/#pipeline", blurb: "Leads with what still fails", icon: "doc" },
          ],
        },
        {
          heading: "Use it",
          items: [
            { label: "Agent gallery", href: "/#agents-hub", blurb: "Built agents and drafted briefs", icon: "box" },
            { label: "Agent teams", href: "/#agents-hub", blurb: "Routes by measurement, shows the table", icon: "route" },
            { label: "Brief studio", href: "/#agents-hub", blurb: "Pre-flight a brief before you build it", icon: "pen" },
            { label: "Live chat runner", href: "/chat/hr_policy_live", blurb: "Talk to a built agent, with citations", icon: "chat" },
          ],
        },
      ],
      footer: scored[0]
        ? { prompt: "See it for yourself.", label: "Open a scored run →", href: `/runs/${scored[0].id}` }
        : undefined,
    },
    {
      label: "Evidence",
      columns: [
        {
          heading: "Scored runs",
          items: scored.map((r) => ({
            label: r.id,
            href: `/runs/${r.id}`,
            blurb: `${r.cases} cases, every residual failure named`,
            icon: "doc" as const,
            chip: `${Math.round(r.rate * 100)}%`,
          })),
        },
        {
          heading: "How it was checked",
          items: [
            { label: "Judge calibration", href: "/#pipeline", blurb: "Cohen's κ against hand labels, reported either way", icon: "scale" },
            { label: "Run artifacts", href: "/#agents-hub", blurb: "Every file the factory wrote, with real sizes", icon: "box" },
            { label: "Team routing", href: "/#agents-hub", blurb: "Pooled IDF, so corpora are comparable", icon: "users" },
          ],
        },
      ],
      footer: { prompt: "Every number on this site comes from these files.", label: "Browse the artifacts →", href: "/#agents-hub" },
    },
  ];
}
