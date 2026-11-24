const STAGES = [
  { n: "00", name: "Ingest", what: "Parse PDFs, CSVs and markdown. Chunk, embed, index.",
    out: "manifest.json" },
  { n: "01", name: "Intake", what: "Read the brief, ask up to five clarifying questions — or, unattended, answer them itself and record every assumption with the chunk that justified it.",
    out: "requirements.json" },
  { n: "02", name: "Groundability", what: "Check the documents can support what was asked. Topics they cannot are demoted to must-refuse before any agent exists to hallucinate the gap.",
    out: "groundability.json" },
  { n: "03", name: "Generate", what: "Compose the system prompt, derive retrieval parameters, select tools — and reject every tool that cannot cite a requirement.",
    out: "agent_def.v0.json" },
  { n: "04", name: "Eval", what: "Derive a test set from the documents alone. A gate drops cases that would make the suite a rubber stamp.",
    out: "eval_suite.json" },
  { n: "05", name: "Judge → Fix", what: "Score every case, classify each failure, apply one targeted fix, re-run. Revert anything that loses ground.",
    out: "iter_N/scorecard.json" },
  { n: "06", name: "Report", what: "State the final score, what changed and why — and what still fails.",
    out: "report.md" },
];

/**
 * A timeline rather than a card grid. The stages are a sequence, and a grid of
 * equal boxes says nothing about order — it also leaves a ragged trailing cell
 * at seven items, which is the tell of a layout nobody looked at.
 */
export function PipelineRail() {
  return (
    <ol className="relative">
      {/* spine */}
      <span
        aria-hidden
        className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-accent/50 via-ink/15 to-transparent"
      />
      {STAGES.map((s, i) => (
        <li key={s.n} className="relative grid grid-cols-[32px_1fr] gap-4 pb-7 last:pb-0">
          <span className="relative z-10 mt-0.5 grid h-8 w-8 place-items-center rounded-full border bg-surface">
            <span className="mono-nums font-mono text-[10px] font-bold text-accent">{s.n}</span>
          </span>

          <div className="min-w-0 pt-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-[15px] font-semibold tracking-tight">{s.name}</h3>
              <code className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted">
                {s.out}
              </code>
            </div>
            <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted">{s.what}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const GUARDS = [
  {
    k: "separation",
    title: "The eval generator never sees the agent",
    body: "Tests derive from the documents alone. The module does not import AgentDefinition, so a suite cannot be quietly tuned to the prompt just written.",
    feature: true,
  },
  {
    k: "judge",
    title: "The judge never sees the system prompt",
    body: "It runs a different open-weight family from the generator and scores each case against a rubric in isolation — nothing to prefer, no order to be biased by.",
    feature: true,
  },
  { k: "verbosity", title: "Length is recorded, never scored",
    body: "Scoring is fact recall and unsupported-claim rate, both independent of answer length." },
  { k: "determinism", title: "Determinism first, model last",
    body: "Refusal is a boolean. Citations are set arithmetic. Numbers must match exactly. Only the residue reaches a model, and the escalation rate is published." },
  { k: "revert", title: "A fix is kept only if it helps",
    body: "Every iteration is compared against the best score so far and reverted when it loses ground." },
  { k: "calibration", title: "The judge is itself checked",
    body: "Agreement against hand labels is measured and published with its disagreements. An uncalibrated run says so." },
];

/**
 * Two featured panels carry the load-bearing ideas; the rest sit in a quieter
 * band beneath. Six identical boxes would flatten the hierarchy.
 */
export function GuardGrid() {
  const featured = GUARDS.filter((g) => g.feature);
  const rest = GUARDS.filter((g) => !g.feature);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {featured.map((g) => (
          <div key={g.k} className="card lift relative overflow-hidden p-6">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
            />
            <h3 className="text-[17px] font-semibold leading-snug tracking-tight">{g.title}</h3>
            <p className="mt-2.5 text-[14px] leading-relaxed text-muted">{g.body}</p>
          </div>
        ))}
      </div>

      <div className="card grid gap-px overflow-hidden bg-ink/[0.07] sm:grid-cols-2">
        {rest.map((g) => (
          <div key={g.k} className="bg-surface p-5">
            <h3 className="text-[14px] font-semibold leading-snug tracking-tight">{g.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{g.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
