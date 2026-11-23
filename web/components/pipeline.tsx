const STAGES = [
  { n: "01", name: "Ingest", what: "Parse PDFs, CSVs and markdown. Chunk, embed, index.",
    out: "corpus manifest + hashes" },
  { n: "02", name: "Intake", what: "Read the brief, ask up to 5 clarifying questions — or answer them itself and record every assumption.",
    out: "requirements document" },
  { n: "03", name: "Groundability", what: "Check the documents can actually support what was asked. Topics they cannot are demoted to must-refuse before any agent exists.",
    out: "groundability report" },
  { n: "04", name: "Generate", what: "Compose the system prompt, derive retrieval parameters, select tools — and reject every tool that cannot cite a requirement.",
    out: "agent definition v0" },
  { n: "05", name: "Eval", what: "Derive a test set from the documents alone. A gate drops cases that would make the suite a rubber stamp.",
    out: "eval suite" },
  { n: "06", name: "Judge → Fix", what: "Score every case, classify each failure, apply one targeted fix, re-run. Revert anything that loses ground.",
    out: "iteration log + scorecards" },
  { n: "07", name: "Report", what: "State the final score, what changed and why — and what still fails.",
    out: "run report" },
];

export function PipelineRail() {
  return (
    <ol className="relative grid gap-px overflow-hidden rounded-2xl border bg-ink/8 sm:grid-cols-2 lg:grid-cols-4">
      {STAGES.map((s, i) => (
        <li
          key={s.n}
          className={`relative bg-surface p-5 ${i === 6 ? "sm:col-span-2 lg:col-span-1" : ""}`}
        >
          <div className="flex items-baseline gap-2.5">
            <span className="mono-nums text-xs font-bold text-accent">{s.n}</span>
            <h3 className="font-semibold tracking-tight">{s.name}</h3>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.what}</p>
          <div className="mt-3 font-mono text-[11px] text-muted/80">→ {s.out}</div>
        </li>
      ))}
    </ol>
  );
}

const GUARDS = [
  {
    title: "The eval generator never sees the agent",
    body: "Tests derive from the documents alone. The module does not import AgentDefinition, so a suite cannot be quietly tuned to the prompt that was just written.",
  },
  {
    title: "The judge never sees the system prompt",
    body: "It runs a different open-weight family from the generator and scores each case against a rubric in isolation — nothing to prefer, no order to be biased by.",
  },
  {
    title: "Length is recorded, never scored",
    body: "Scoring is fact recall and unsupported-claim rate, both independent of answer length. Verbosity cannot inflate a result.",
  },
  {
    title: "Determinism first, model last",
    body: "Refusal is a boolean in the output contract. Citation validity is set arithmetic. Numbers must match exactly. Only the ambiguous residue reaches a model — and the escalation rate is reported.",
  },
  {
    title: "A fix is kept only if it helps",
    body: "Every iteration is compared against the best score so far, and reverted when it loses ground. Three blind fixes ending worse than the start is a factory defect.",
  },
  {
    title: "The judge is itself checked",
    body: "Agreement against hand-labelled cases is measured and published with its disagreements. An uncalibrated run says so, in place of the number.",
  },
];

export function GuardGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {GUARDS.map((g) => (
        <div key={g.title} className="card p-5">
          <h3 className="text-[15px] font-semibold leading-snug tracking-tight">{g.title}</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{g.body}</p>
        </div>
      ))}
    </div>
  );
}
