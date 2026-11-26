/**
 * Artefact specimens: the things a landscape panel holds.
 *
 * Shared between the homepage and the design preview so one implementation is
 * on screen in both places. Each reads from committed run data passed in by a
 * server component; neither holds a figure of its own.
 */

export function DefinitionCard({ json }: { json: string }) {
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

export interface ScoredRun {
  id: string;
  rate: number;
  cases: number;
}

export function ScoreCard({ runs }: { runs: ScoredRun[] }) {
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
