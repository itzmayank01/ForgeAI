import { loadAllRuns } from "@/lib/runs";
import { Integrations } from "@/components/integrations";
import { Landscape } from "@/components/landscape";
import {
  MarkBox, MarkChat, MarkDoc, MarkFlask, MarkIntake, MarkLoop, MarkPen,
  MarkRoute, MarkScale, MarkShield, MarkSpark, MarkUsers, MegaNav,
  type MegaSection,
} from "@/components/mega-nav";

/**
 * A preview route for the new section components, so they can be reviewed
 * running rather than described, without editing any page that is currently
 * being worked on. Everything on it reads from committed artifacts.
 */
export const metadata = { title: "ForgeAI — design preview" };

/** A code card, the artefact the first landscape panel holds. */
function DefinitionCard({ json }: { json: string }) {
  return (
    <div className="overflow-hidden rounded-xl bg-[#0d1512] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
      <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-2">
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="ml-1.5 font-mono text-[10.5px] text-white/45">
          03_agent_def.final.json
        </span>
      </div>
      <pre className="max-h-[19rem] overflow-auto p-4 font-mono text-[10.5px] leading-[1.75] text-emerald-200/90">
{json}
      </pre>
    </div>
  );
}

/** Measured pass rates, drawn from the committed reports. */
function ScoreCard({ runs }: { runs: { id: string; rate: number; cases: number }[] }) {
  return (
    <div className="rounded-xl border bg-surface p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-bold tracking-tight text-ink">Final pass rate</h3>
        <span className="font-mono text-[10.5px] text-muted">06_report.json</span>
      </div>
      <div className="mt-5 space-y-4">
        {runs.map((r) => (
          <div key={r.id}>
            <div className="flex items-baseline justify-between text-[11.5px]">
              <span className="font-mono text-muted">{r.id}</span>
              <span className="mono-nums font-semibold text-ink">
                {Math.round(r.rate * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/[0.07]">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round(r.rate * 100)}%` }}
              />
            </div>
            <div className="mt-1 text-[10.5px] text-muted">
              {r.cases} generated cases · both proposed fixes measured and reverted
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 border-t pt-3 text-[11px] leading-relaxed text-muted">
        Neither bar reaches 100, and the report leads with what still fails. A factory that
        claims 100% is suspicious.
      </p>
    </div>
  );
}

export default async function DesignPreview() {
  const runs = (await loadAllRuns()).filter((r) => !r.synthetic);
  const scored = runs
    .filter((r) => r.report && r.report.evaluated !== false)
    .map((r) => ({
      id: r.id,
      rate: r.report!.final_pass_rate,
      cases: r.suite?.cases.length ?? 0,
    }));

  const hr = runs.find((r) => r.id === "hr_policy_live");
  const def = hr?.definition;
  const json = def
    ? JSON.stringify(
        {
          name: def.name,
          // The committed JSON records the model that produced the run, but
          // the shared type does not declare it. Read it defensively rather
          // than widening a type the rest of the site depends on.
          model: (def as { model?: string }).model,
          temperature: def.temperature,
          retrieval: def.retrieval,
          tools: def.tools,
          output_contract: {
            require_citations: def.output_contract.require_citations,
            refusal_message: def.output_contract.refusal_message,
          },
        },
        null,
        2,
      )
    : "{}";

  const sections: MegaSection[] = [
    {
      label: "Platform",
      columns: [
        {
          heading: "The factory",
          items: [
            { label: "Intake interviewer", href: "/#pipeline", blurb: "Asks ≤5 questions, or answers them itself", icon: MarkIntake },
            { label: "Groundability guard", href: "/#pipeline", blurb: "Refuses briefs the documents cannot support", icon: MarkShield },
            { label: "Agent generator", href: "/#pipeline", blurb: "Tools must earn their place", icon: MarkSpark },
            { label: "Eval generator", href: "/#pipeline", blurb: "Never imports the agent definition", icon: MarkFlask },
          ],
        },
        {
          heading: "Scoring",
          items: [
            { label: "Evidentiary judge", href: "/#pipeline", blurb: "Deterministic first, another model family", icon: MarkScale },
            { label: "Critic-optimizer", href: "/#pipeline", blurb: "Reverts a fix that did not help", icon: MarkLoop },
            { label: "Honest report", href: "/#pipeline", blurb: "Leads with what still fails", icon: MarkDoc },
          ],
        },
        {
          heading: "Use it",
          items: [
            { label: "Agent gallery", href: "/#agents-hub", blurb: "Two built, seventeen briefs", icon: MarkBox, chip: "19" },
            { label: "Agent teams", href: "/#agents-hub", blurb: "Routes by measurement, shows the table", icon: MarkRoute },
            { label: "Brief studio", href: "/#agents-hub", blurb: "Pre-flight a brief before you build it", icon: MarkPen },
            { label: "Live chat runner", href: "/chat/hr_policy_live", blurb: "Talk to a built agent, with citations", icon: MarkChat },
          ],
        },
      ],
      footer: { prompt: "See it for yourself.", label: "Open a scored run →", href: "/runs/hr_policy_live" },
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
            icon: MarkDoc,
            chip: `${Math.round(r.rate * 100)}%`,
          })),
        },
        {
          heading: "How it was checked",
          items: [
            { label: "Judge calibration", href: "/#pipeline", blurb: "Cohen's κ against hand labels, reported either way", icon: MarkScale },
            { label: "Run artifacts", href: "/#agents-hub", blurb: "Every file the factory wrote, with real sizes", icon: MarkBox },
            { label: "Team routing", href: "/#agents-hub", blurb: "Pooled IDF, so corpora are comparable", icon: MarkUsers },
          ],
        },
      ],
      footer: { prompt: "Every number on this site comes from these files.", label: "Browse the artifacts →", href: "/#agents-hub" },
    },
  ];

  return (
    <main className="pb-10">
      <div className="sticky top-0 z-40 border-b bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-content items-center gap-6 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 text-base font-bold tracking-tight text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-sm font-black text-white">
              F
            </span>
            ForgeAI
          </span>
          <MegaNav sections={sections} />
          <span className="ml-auto rounded-full border px-3 py-1 text-[11px] font-semibold text-muted">
            design preview
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-content px-4 pt-10 sm:px-6">
        <p className="rounded-xl border bg-ink/[0.02] p-3.5 text-[12.5px] leading-relaxed text-muted">
          Hover <strong className="text-ink">Platform</strong> or{" "}
          <strong className="text-ink">Evidence</strong> above — or tab to them and press Escape to
          dismiss. Below are the two landscape sections and the integrations strip, all reading
          from committed run artifacts.
        </p>
      </div>

      <Landscape
        eyebrow="Honest by construction"
        title="The agent is a document you can read, not a prompt you have to trust"
        standfirst="Every decision the factory made is written down as declarative JSON — the model, the retrieval parameters, the tools that survived the audit, and the exact sentence the agent says when it refuses."
        points={[
          {
            title: "Tools must earn their place",
            body: "The generator proposes; a deterministic audit decides. A binding survives only if the tool exists and its triggering requirement resolves to a real must-answer topic. Zero tools is a valid outcome.",
          },
          {
            title: "Citations are resolved, not trusted",
            body: "Sources are numbered rather than labelled with chunk ids, because asked for doc_01_c003 a model reproduces the shape of an id and not the id. Numbers are resolved back in code; anything invented is reported as fabricated.",
          },
          {
            title: "The refusal is part of the contract",
            body: "The sentence the agent says when the documents cannot answer is written into the definition, so a refusal is a designed response rather than an empty reply.",
          },
        ]}
        visual={<DefinitionCard json={json} />}
        panelLabel="runs/hr_policy_live/03_agent_def.final.json"
        tint="slate"
      />

      <Landscape
        eyebrow="Two dissimilar briefs"
        title="One factory, measured on prose policy and on a parts catalogue"
        standfirst="A factory that only works on one shape of problem has not been shown to work. These are the committed scores, not a target."
        points={[
          {
            title: "Nothing is rounded up",
            body: "Both runs stopped at the iteration cap rather than at a good number, and both proposed fixes were measured and reverted because neither improved the score.",
          },
          {
            title: "Failures are named individually",
            body: "The report lists every residual failure by case id with the reason — fact recall, a citation to a chunk never retrieved — instead of summarising them into a percentage.",
          },
          {
            title: "The judge's agreement is published",
            body: "Cohen's κ against hand-adjudicated labels appears next to the score whether or not it flatters the run. Loosening a judge until it agrees with its author is how a calibration becomes decoration.",
          },
        ]}
        visual={<ScoreCard runs={scored} />}
        panelLabel={`runs/*/06_report.json · ${scored.length} scored runs`}
        tint="mint"
      />

      <Integrations />
    </main>
  );
}
