import Link from "next/link";
import { notFound } from "next/navigation";
import { listRunIds, loadRun } from "@/lib/runs";
import {
  CalibrationPanel, DefinitionPanel, GroundabilityPanel,
  IterationsPanel, RequirementsPanel, SuitePanel,
} from "@/components/artifacts";
import { Pill, Stat } from "@/components/ui";

export async function generateStaticParams() {
  return (await listRunIds()).map((id) => ({ id }));
}

const NAV = [
  ["requirements", "Requirements"],
  ["groundability", "Groundability"],
  ["definition", "Agent"],
  ["evals", "Evals"],
  ["iterations", "Iterations"],
  ["residual", "What still fails"],
] as const;

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await loadRun(id);
  if (!run) notFound();

  const report = run.report;
  const lastIter = Math.max(-1, ...Object.keys(run.verdicts).map(Number));
  const verdicts = lastIter >= 0 ? run.verdicts[lastIter] : [];

  return (
    <main className="mx-auto max-w-content px-4 py-10">
      <Link href="/#runs" className="text-sm text-muted hover:text-ink">
        ← all runs
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <h1 className="display text-[clamp(1.8rem,4vw,2.6rem)]">
          {id.replace(/^_/, "").replace(/_/g, " ")}
        </h1>
        {run.synthetic ? <Pill tone="warn">fixture — not evidence</Pill> : <Pill tone="accent">live run</Pill>}
      </div>

      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
        {run.manifest.brief || report?.brief}
      </p>

      {report && report.evaluated === false && (
        <div className="card mt-8 border-warn/30 bg-warn/[0.06] p-5">
          <h2 className="text-sm font-semibold text-warn">Not scored</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            No evaluation pass completed, so this run has no pass rate. Stopped
            because: {report.stop_reason}. Showing 0% here would be a fabricated
            number.
          </p>
        </div>
      )}

      {report && report.evaluated !== false && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Final pass rate"
            value={`${Math.round(report.final_pass_rate * 100)}%`}
            sub={`agent v${report.best_version}`}
            tone={report.final_pass_rate >= 0.85 ? "ok" : report.final_pass_rate >= 0.6 ? "warn" : "bad"}
          />
          <Stat label="Still failing" value={String(report.residual_failures.length)} sub="diagnosed below" />
          <Stat label="Iterations" value={String(report.iterations.length)} sub={report.stop_reason} />
          <Stat
            label="Tokens"
            value={report.budget ? report.budget.tokens_used.toLocaleString() : "—"}
            sub={report.budget ? `of ${report.budget.max_tokens.toLocaleString()}` : undefined}
          />
        </div>
      )}

      <nav className="sticky top-[57px] z-30 -mx-4 mt-10 overflow-x-auto border-y bg-canvas/85 px-4 backdrop-blur-md">
        <ul className="flex gap-1 py-2 text-sm">
          {NAV.map(([href, label]) => (
            <li key={href}>
              <a
                href={`#${href}`}
                className="block whitespace-nowrap rounded-lg px-3 py-1.5 text-muted hover:bg-ink/5 hover:text-ink"
              >
                {label}
              </a>
            </li>
          ))}
          <li className="ml-auto">
            <Link
              href={`/chat/${id}`}
              className="block whitespace-nowrap rounded-lg bg-accent px-3.5 py-1.5 font-semibold text-white hover:brightness-110"
            >
              Chat with this agent →
            </Link>
          </li>
        </ul>
      </nav>

      <div className="space-y-14 py-10">
        <Block id="requirements" n="01" title="Requirements"
          lede="What the intake interviewer concluded the assistant is for — and, unattended, the assumptions it made rather than skipping the questions.">
          {run.requirements ? <RequirementsPanel req={run.requirements} /> : <Missing />}
        </Block>

        <Block id="groundability" n="02" title="Groundability"
          lede="Whether the documents can actually support what the brief asked for. Topics they cannot are demoted to must-refuse before any agent exists to hallucinate the gap away.">
          {run.groundability ? <GroundabilityPanel g={run.groundability} /> : <Missing />}
        </Block>

        <Block id="definition" n="03" title="Agent definition"
          lede="The declarative artifact the runtime loads. Tools are model-proposed but deterministically audited: a binding survives only if it can cite a real requirement.">
          {run.definition ? <DefinitionPanel d={run.definition} /> : <Missing />}
        </Block>

        <Block id="evals" n="04" title="Eval suite"
          lede="Derived from the documents alone — the generator never sees the agent definition, so tests cannot be tuned to the prompt that was just written.">
          {run.suite ? <SuitePanel suite={run.suite} verdicts={verdicts} /> : <Missing />}
        </Block>

        <Block id="iterations" n="05" title="Critic → optimizer"
          lede="One targeted fix per iteration, aimed at the largest failure cluster, so every change is attributable to a measured delta. Anything that loses ground is reverted.">
          {report ? <IterationsPanel iterations={report.iterations} scorecards={report.scorecards} /> : <Missing />}
        </Block>

        <Block id="residual" n="06" title="What still fails"
          lede="A factory claiming 100% is suspicious. These are the cases the final agent still gets wrong, and why.">
          <div className="space-y-4">
            {report && report.residual_failures.length > 0 ? (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-[11px] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Case</th>
                      <th className="px-4 py-2.5 font-medium">Question</th>
                      <th className="px-4 py-2.5 font-medium">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.residual_failures.map((r) => (
                      <tr key={r.case_id} className="border-b align-top last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-muted">{r.case_id}</td>
                        <td className="px-4 py-3">{r.question}</td>
                        <td className="px-4 py-3 text-muted">{r.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card p-5 text-sm text-muted">
                No residual failures recorded.
              </div>
            )}
            <CalibrationPanel c={report?.calibration ?? null} />
          </div>
        </Block>
      </div>
    </main>
  );
}

function Block({
  id, n, title, lede, children,
}: { id: string; n: string; title: string; lede: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32">
      <div className="flex items-baseline gap-2.5">
        <span className="mono-nums text-xs font-bold text-accent">{n}</span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{lede}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Missing() {
  return (
    <div className="card p-5 text-sm text-muted">
      This artifact was not produced — the run stopped before this stage.
    </div>
  );
}
