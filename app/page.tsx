import Link from "next/link";
import { loadAllRuns } from "@/lib/runs";
import { GuardGrid, PipelineRail } from "@/components/pipeline";
import { ForgeConsole, StatStrip } from "@/components/console";
import { Pill, RunCard, Section } from "@/components/ui";

export default async function Home() {
  const runs = await loadAllRuns();
  const live = runs.filter((r) => !r.synthetic);
  // Only runs that actually measured something can headline a number.
  const scored = runs.filter((r) => r.report && r.report.evaluated !== false);
  const headline = scored.find((r) => !r.synthetic) ?? scored[0];
  const totalCases = runs.reduce((n, r) => n + (r.suite?.cases.length ?? 0), 0);

  return (
    <main>
      {/* Hero — split, so the right half carries the product rather than air */}
      <section className="relative overflow-hidden">
        <div className="bloom" aria-hidden />
        <div className="dotgrid" aria-hidden />

        <div className="mx-auto grid max-w-content items-center gap-12 px-4 pb-16 pt-16 lg:grid-cols-[1.02fr_1fr] lg:gap-14 lg:pt-24">
          <div>
            <Pill tone="accent">The agent that builds agents</Pill>
            <h1 className="display mt-5 text-[clamp(2.3rem,5.4vw,3.7rem)]">
              One paragraph in.
              <br />
              A tested agent out.
            </h1>
            <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-muted">
              ForgeAI takes a brief and a folder of documents, then writes the agent,
              generates its tests, judges the results, diagnoses every failure and
              fixes what it can — unattended.
            </p>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              The hard part is not building a chatbot. It is building evals honest
              enough to judge an agent nobody hand-wrote.
            </p>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {headline && (
                <Link
                  href={`/runs/${headline.id}`}
                  className="lift rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  See a full run
                </Link>
              )}
              <Link
                href="#how"
                className="rounded-xl border bg-surface px-5 py-2.5 text-sm font-semibold transition hover:bg-ink/[0.04]"
              >
                How it avoids fooling itself
              </Link>
            </div>
          </div>

          <div className="lg:pl-2">
            <ForgeConsole />
          </div>
        </div>

        {headline?.report && (
          <div className="mx-auto max-w-content px-4 pb-14">
            <StatStrip
              items={[
                {
                  label: "Final pass rate",
                  value: `${Math.round(headline.report.final_pass_rate * 100)}%`,
                  sub: headline.report.stop_reason,
                  tone: headline.report.final_pass_rate >= 0.85 ? "ok" : "warn",
                },
                {
                  label: "Still failing",
                  value: String(headline.report.residual_failures.length),
                  sub: "named and diagnosed in the report",
                },
                {
                  label: "Judge agreement",
                  value: headline.report.calibration
                    ? `${Math.round(headline.report.calibration.agreement_rate * 100)}%`
                    : "—",
                  sub: headline.report.calibration
                    ? `kappa ${headline.report.calibration.cohens_kappa.toFixed(2)}`
                    : "not calibrated",
                },
                {
                  label: "Generated cases",
                  value: String(totalCases),
                  sub: `across ${runs.length} run${runs.length === 1 ? "" : "s"}`,
                },
              ]}
            />
          </div>
        )}

        <div className="rule mx-auto max-w-content" />
      </section>

      <Section
        id="pipeline"
        split
        eyebrow="The factory"
        title="Seven stages, each leaving evidence"
        lede="Every stage writes a committed artifact. The run directory is the deliverable — the code is only how it gets made."
      >
        <PipelineRail />
      </Section>

      <Section
        id="runs"
        eyebrow="Demonstrations"
        title="Full runs, start to finish"
        lede="Two deliberately dissimilar briefs — prose policy documents against a tabular parts catalogue — because a factory that only works on one shape of problem has not been shown to work."
      >
        {runs.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            No runs yet. Run{" "}
            <code className="font-mono text-ink">forgeai build</code> and refresh.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {runs.map((r) => (
              <RunCard
                key={r.id}
                id={r.id}
                brief={r.manifest.brief || r.report?.brief || ""}
                // No report, or one that completed no eval pass, means no
                // score exists. Falling back to 0 would invent one.
                passRate={
                  !r.report || r.report.evaluated === false
                    ? null
                    : r.report.final_pass_rate
                }
                cases={r.suite?.cases.length ?? 0}
                iterations={r.report?.iterations.length ?? 0}
                synthetic={r.synthetic}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        id="how"
        split
        eyebrow="Trust"
        title="How it avoids fooling itself"
        lede="A pipeline that grades its own homework will always report success. These are the separations and checks that make the numbers mean something."
      >
        <GuardGrid />
      </Section>
    </main>
  );
}
