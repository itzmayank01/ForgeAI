const STAGES = [
  { n: "00", name: "ingest",        artifact: "manifest.json",        delay: 0 },
  { n: "01", name: "intake",        artifact: "requirements.json",    delay: 0.9 },
  { n: "02", name: "groundability", artifact: "groundability.json",   delay: 1.8 },
  { n: "03", name: "generate",      artifact: "agent_def.v0.json",    delay: 2.7 },
  { n: "04", name: "evalgen",       artifact: "eval_suite.json",      delay: 3.6 },
  { n: "05", name: "judge → fix",   artifact: "iter_0/scorecard.json", delay: 4.5 },
  { n: "06", name: "report",        artifact: "report.md",            delay: 5.4 },
];

/**
 * The hero visual. Deliberately the real pipeline rather than an abstract
 * graphic: seven stages in order, each emitting the artifact it genuinely
 * writes to the run directory.
 */
export function ForgeConsole() {
  return (
    <div className="card lift-lg overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-bad/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-warn/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-ok/60" />
        <span className="ml-2 font-mono text-[11px] text-muted">
          forgeai build --brief hr_policy
        </span>
      </div>

      <div className="space-y-px bg-ink/5 px-0 py-0">
        {STAGES.map((s) => (
          <div
            key={s.n}
            className="stage-row flex items-center gap-3 bg-surface px-4 py-2.5"
            style={{ animationDelay: `${s.delay}s` }}
          >
            <span className="mono-nums w-5 shrink-0 font-mono text-[11px] text-accent">
              {s.n}
            </span>
            <span className="w-28 shrink-0 text-[13px] font-medium">{s.name}</span>
            <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-ink/10">
              <span
                className="stage-bar absolute inset-0 rounded-full bg-accent"
                style={{ animationDelay: `${s.delay}s` }}
              />
            </span>
            <span className="hidden shrink-0 font-mono text-[10px] text-muted sm:inline">
              {s.artifact}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted">
          28 cases · 1 fix applied · 2 still failing
          <span className="blink ml-1 text-accent">▍</span>
        </span>
        <span className="rounded-full bg-ok/12 px-2 py-0.5 text-[10px] font-semibold text-ok">
          82% pass
        </span>
      </div>
    </div>
  );
}

/**
 * Stat strip. A plain grid of equal boxes is what reads as templated, so these
 * share one surface divided by hairlines, with the headline figure dominant.
 */
export function StatStrip({
  items,
}: {
  items: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "bad" }[];
}) {
  const tones = { ok: "text-ok", warn: "text-warn", bad: "text-bad" } as const;
  return (
    <div className="card lift grid gap-px overflow-hidden bg-ink/[0.07] sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="bg-surface px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            {s.label}
          </div>
          <div
            className={`mono-nums mt-2 text-[28px] font-bold leading-none tracking-tight ${
              s.tone ? tones[s.tone] : ""
            }`}
          >
            {s.value}
          </div>
          {s.sub && <div className="mt-1.5 text-[11px] leading-snug text-muted">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}
