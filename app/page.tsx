import Link from "next/link";
import { listArtifacts, loadAllRuns } from "@/lib/runs";
import { ForgeConsole, StatStrip } from "@/components/console";
import { Feature } from "@/components/feature";
import {
  EvalMock,
  GeneratorMock,
  GroundabilityMock,
  JudgeMock,
  LoopMock,
  IntakeMock,
  ReportMock,
  RouterMock,
} from "@/components/mocks";
import { Pill, RunCard } from "@/components/ui";
import { AgentsHub, type ArtifactGroup } from "@/components/agents-hub";
import { FloatingChatCard } from "@/components/floating-chat";

export default async function Home() {
  const runs = await loadAllRuns();
  const scored = runs.filter((r) => r.report && r.report.evaluated !== false);
  // The fixture must NEVER headline. It is scaffolding with invented numbers,
  // and falling back to it means the page presents synthetic data as measured
  // evidence whenever a real run is mid-flight.
  const headline = scored.find((r) => !r.synthetic);
  const realRuns = runs.filter((r) => !r.synthetic);
  const totalCases = realRuns.reduce((n, r) => n + (r.suite?.cases.length ?? 0), 0);

  // The gallery's built cards carry the brief that was actually committed with
  // the run, never a paraphrase kept alongside it that can quietly drift.
  const runBriefs = Object.fromEntries(
    realRuns.map((r) => [r.id, r.manifest.brief || r.report?.brief || ""]),
  );

  const artifacts: ArtifactGroup[] = await Promise.all(
    realRuns.map(async (r) => ({
      runId: r.id,
      brief: r.manifest.brief || r.report?.brief || "",
      passRate:
        !r.report || r.report.evaluated === false ? null : r.report.final_pass_rate,
      files: await listArtifacts(r.id),
    })),
  );

  return (
    <main>
      {/* ── hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="wash wash-warm" aria-hidden />
        <div className="mx-auto grid max-w-content items-center gap-12 px-4 pb-12 pt-12 lg:grid-cols-[1.02fr_1fr] lg:gap-14 lg:pt-16">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="accent">The Agent That Builds Agents</Pill>
              <span className="rounded-full bg-indigo-100 dark:bg-emerald-950/60 text-indigo-800 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
                Autonomous AI Factory
              </span>
            </div>

            <h1 className="display mt-5 text-[clamp(2.4rem,5.6vw,3.9rem)]">
              One paragraph in.
              <br />
              A tested agent out.
            </h1>
            <p className="lede mt-6 max-w-lg">
              ForgeAI takes a brief and a folder of documents, then writes the agent,
              generates its tests, judges the results, diagnoses every failure and fixes
              what it can — unattended.
            </p>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              The hard part is not building a chatbot. It is building evals honest enough
              to judge an agent nobody hand-wrote.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#agents-hub"
                className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(99,102,241,0.6)] transition hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98]"
              >
                Browse agents &amp; teams ↓
              </a>
              {headline && (
                <Link
                  href={`/runs/${headline.id}`}
                  className="rounded-full border border-ink/10 bg-surface px-5 py-3 text-sm font-semibold text-ink shadow-xs transition hover:border-ink/20 hover:bg-ink/[0.03]"
                >
                  Inspect Evidence{headline.report ? ` (${Math.round(headline.report.final_pass_rate * 100)}%)` : ""}
                </Link>
              )}
              <Link
                href="/chat/hr_policy_live"
                className="rounded-full border border-indigo-500/30 bg-indigo-50/60 dark:bg-emerald-950/30 px-5 py-3 text-sm font-semibold text-indigo-700 dark:text-emerald-300 transition hover:bg-indigo-100/80 dark:hover:bg-emerald-900/40"
              >
                Chat Runner →
              </Link>
            </div>
          </div>

          <FloatingChatCard className="w-full" />
        </div>

        {headline?.report && (
          <div className="mx-auto max-w-content px-4 pb-12">
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
                  // No calibration artifact means the judge was never checked
                  // against hand labels. A placeholder here would be a number
                  // nobody measured, which is the one thing this page must not
                  // print, so it says plainly that it is missing.
                  label: "Judge agreement",
                  value: headline.report.calibration
                    ? `${Math.round(headline.report.calibration.agreement_rate * 100)}%`
                    : "—",
                  sub: headline.report.calibration
                    ? `kappa ${headline.report.calibration.cohens_kappa.toFixed(2)}`
                    : "not calibrated in this run",
                },
                {
                  label: "Generated cases",
                  value: totalCases > 0 ? String(totalCases) : "—",
                  sub: `across ${realRuns.length} committed run${realRuns.length === 1 ? "" : "s"}`,
                },
              ]}
            />
          </div>
        )}
      </section>

      {/* ── Discover Agents Hub (Exact UI matching Image 2 & 3) ──────── */}
      <AgentsHub runBriefs={runBriefs} artifacts={artifacts} />

      {/* ── The 7 Stages & Architecture ─────────────────────────────── */}
      <div id="pipeline" className="scroll-mt-20 pt-10">
        <div className="mx-auto max-w-content px-4 text-center">
          <span className="rounded-full bg-indigo-100 dark:bg-emerald-950/60 text-indigo-800 dark:text-emerald-300 px-3 py-1 text-xs font-semibold">
            Orchestration Under Uncertainty
          </span>
          <h2 className="display mt-4 text-[clamp(1.8rem,3.6vw,2.7rem)]">
            How ForgeAI Builds & Verifies Agents
          </h2>
          <p className="lede mt-3 max-w-xl mx-auto">
            Seven discrete stages in order. Every stage runs on open models and records its working
            so the factory never fools itself.
          </p>
        </div>

        <Feature
          n="01"
          eyebrow="Intake interviewer"
          title="It interviews you — or, unattended, interviews itself"
          body="The brief caps clarifying questions at five but the review demands an unattended run. ForgeAI asks the same questions either way: interactively it waits for you, unattended it answers from retrieved document text and records every assumption with its confidence and the chunk that justified it."
          tags={["≤5 questions", "Unattended mode", "Assumptions recorded", "Retrieval-backed"]}
          visual={<IntakeMock />}
          wash="warm"
        />

        <Feature
          n="02"
          eyebrow="Groundability guard"
          title="It refuses to build an agent that would have to hallucinate"
          body="Before anything is generated, every requested topic is scored against the corpus. Topics the documents cannot support are demoted into must-refuse, so the agent declines them by construction. If more than half the brief is unsupported, the build aborts and names the documents you are missing."
          tags={["Max-cosine probe", "Phrasing-robust", "Demote, don't delete", "Aborts honestly"]}
          visual={<GroundabilityMock />}
          flip
          wash="cool"
        />

        <Feature
          n="03"
          eyebrow="Agent generator"
          title="Tools must earn their place, and the audit is deterministic"
          body="The generator proposes tools; a deterministic audit decides. A binding survives only if the tool exists and its claimed triggering requirement resolves to a real must-answer topic. An HR agent with a weather tool is a factory defect, so it is asserted in the test suite rather than hoped for."
          tags={["Declarative definition", "Deterministic audit", "Zero tools is valid", "Schema-validated"]}
          visual={<GeneratorMock />}
          wash="warm"
        />

        <Feature
          n="04"
          eyebrow="Eval generator"
          title="Tests derived from the documents, never from the prompt"
          body="The eval generator does not import the agent definition, so a suite cannot be quietly tuned to the prompt just written. A deterministic gate then drops cases that would make the suite a rubber stamp — including out-of-scope questions the corpus can actually answer, which would teach the optimizer to refuse everything."
          tags={["Documents only", "≥20 cases", "Quality gate", "Prompts committed"]}
          visual={<EvalMock />}
          flip
          wash="cool"
        />

        <Feature
          n="05"
          eyebrow="Evidentiary judge"
          title="The judge never sees the prompt, and runs a different model family"
          body="Scoring is deterministic first: citation arithmetic and fact recall decide most cases outright, and a model is asked only about the ambiguous residue. That model is deliberately from another open-weight family than the agent's, because a model marking its own family's homework is not an independent check. Its agreement with hand-adjudicated labels is reported as Cohen's kappa, including when that number is poor."
          tags={["Deterministic first", "Blind to the prompt", "Two model families", "Kappa reported"]}
          visual={<JudgeMock />}
          wash="warm"
        />

        <Feature
          n="06"
          eyebrow="Critic-optimizer"
          title="It proposes a fix, re-scores it, and throws it away when it does not help"
          body="Failures are classified into a fix ladder — retrieval miss, prompt defect, hallucination — and the cheapest plausible repair is applied. The point is what happens next: the suite is run again and the change survives only if the score rose. In both committed runs every proposed fix was measured and reverted, and the report says so rather than quietly shipping a change that did nothing."
          tags={["Deterministic diagnosis", "Measured, not assumed", "Reverts on no gain", "Unmeasured never counted"]}
          visual={<LoopMock />}
          flip
          wash="cool"
        />

        <Feature
          n="07"
          eyebrow="Honest reporting"
          title="A factory that claims 100% is suspicious"
          body="The report leads with what still fails and why, names the judge's agreement with hand labels, and states plainly when a run was never scored rather than showing a fabricated zero. Every number on this site comes from a committed artifact in the repository."
          tags={["Residual failures named", "Judge calibration", "Never fabricates a score", "Artifacts committed"]}
          visual={
            <ReportMock
              runId={headline?.id}
              passRate={headline?.report?.final_pass_rate ?? null}
              stopReason={headline?.report?.stop_reason}
              residual={headline?.report?.residual_failures}
              agreementRate={headline?.report?.calibration?.agreement_rate ?? null}
              kappa={headline?.report?.calibration?.cohens_kappa ?? null}
            />
          }
          wash="warm"
        />
      </div>

        <Feature
          n="08"
          eyebrow="Routing between agents"
          title="A room of agents is only honest if the routing is a measurement"
          body="Put a question to a team room and it is scored against every member's committed documents before anyone answers, then handed to the best match — and the table that decided it comes back with the reply. All the member corpora are pooled into one document set first, because BM25's IDF is computed over whatever set it is given, so scoring each corpus on its own produces numbers from different scales that cannot be compared. A question matching nothing routes nowhere and says so."
          tags={["Pooled IDF", "Routing table shown", "Thin margins flagged", "Refuses to guess"]}
          visual={<RouterMock />}
          wash="warm"
        />

        <Feature
          n="09"
          eyebrow="One command"
          title="Seven stages, in order, each writing the file it is accountable for"
          body="A build is one command and then nothing to supervise. Each stage emits the artifact named beside it, and the run is readable afterwards from those files alone — which is what makes a claim on this site checkable rather than something you take on trust. The figures underneath are read from the run named in the title bar, so they cannot drift from it."
          tags={["Unattended", "One artifact per stage", "Resumable", "Figures read from the run"]}
          visual={
            <ForgeConsole
              runId={headline?.id}
              cases={headline?.suite?.cases.length}
              fixesKept={headline?.report?.iterations.filter((i) => i.kept === true).length}
              stillFailing={headline?.report?.residual_failures.length}
              passRate={headline?.report?.final_pass_rate ?? null}
            />
          }
          flip
          wash="cool"
        />

      {/* ── runs ─────────────────────────────────────────────────────── */}
      <section id="runs" className="relative scroll-mt-20">
        <div className="mx-auto max-w-content px-4 py-16">
          <div className="flex items-center gap-3">
            <span className="mono-nums font-mono text-[13px] font-bold text-accent">10</span>
            <span className="h-px w-10 bg-ink/20" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">
              Demonstrations
            </span>
          </div>
          <h2 className="display mt-5 max-w-2xl text-[clamp(1.75rem,3.3vw,2.45rem)]">
            Two deliberately dissimilar briefs
          </h2>
          <p className="lede mt-5 max-w-2xl">
            Prose policy documents against a tabular parts catalogue — because a factory
            that only works on one shape of problem has not been shown to work.
          </p>

          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {runs.map((r) => (
              <RunCard
                key={r.id}
                id={r.id}
                brief={r.manifest.brief || r.report?.brief || ""}
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
        </div>
      </section>

      <div id="trust" className="scroll-mt-20" />
    </main>
  );
}
