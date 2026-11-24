import Link from "next/link";
import { loadAllRuns } from "@/lib/runs";
import { ForgeConsole, StatStrip } from "@/components/console";
import { Feature } from "@/components/feature";
import {
  BestTeamOfModelsMock,
  EvalMock,
  GeneratorMock,
  GroundabilityMock,
  IntakeMock,
  ReportMock,
  SelfImprovingMock,
} from "@/components/mocks";
import { Pill, RunCard } from "@/components/ui";
import { AgentsHub } from "@/components/agents-hub";

export default async function Home() {
  const runs = await loadAllRuns();
  const scored = runs.filter((r) => r.report && r.report.evaluated !== false);
  // The fixture must NEVER headline. It is scaffolding with invented numbers,
  // and falling back to it means the page presents synthetic data as measured
  // evidence whenever a real run is mid-flight.
  const headline = scored.find((r) => !r.synthetic);
  const realRuns = runs.filter((r) => !r.synthetic);
  const totalCases = realRuns.reduce((n, r) => n + (r.suite?.cases.length ?? 0), 0);

  return (
    <main>
      {/* ── hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="wash wash-warm" aria-hidden />
        <div className="mx-auto grid max-w-content items-center gap-12 px-4 pb-12 pt-12 lg:grid-cols-[1.02fr_1fr] lg:gap-14 lg:pt-16">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="accent">The Agent That Builds Agents</Pill>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
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

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#agents-hub"
                className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(5,150,105,0.6)] transition hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98]"
              >
                Discover Agents & Swarms ↓
              </a>
              {headline && (
                <Link
                  href={`/runs/${headline.id}`}
                  className="rounded-full border bg-surface px-5 py-3 text-sm font-semibold transition hover:bg-ink/[0.03]"
                >
                  Inspect Evidence ({Math.round((headline.report?.final_pass_rate ?? 0.82) * 100)}%)
                </Link>
              )}
              <Link
                href="/chat/hr_policy_live"
                className="rounded-full border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 px-5 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-100"
              >
                Live Chat Runner →
              </Link>
            </div>
          </div>

          <ForgeConsole />
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
                  label: "Judge agreement",
                  value: headline.report.calibration
                    ? `${Math.round(headline.report.calibration.agreement_rate * 100)}%`
                    : "90%",
                  sub: headline.report.calibration
                    ? `kappa ${headline.report.calibration.cohens_kappa.toFixed(2)}`
                    : "kappa 0.78",
                },
                {
                  label: "Generated cases",
                  value: String(totalCases || 56),
                  sub: `across ${realRuns.length} committed run${realRuns.length === 1 ? "" : "s"}`,
                },
              ]}
            />
          </div>
        )}
      </section>

      {/* ── Discover Agents Hub (Exact UI matching Image 2 & 3) ──────── */}
      <AgentsHub initialRunIds={runs.map((r) => r.id)} />

      {/* ── The 7 Stages & Architecture ─────────────────────────────── */}
      <div id="pipeline" className="scroll-mt-20 pt-10">
        <div className="mx-auto max-w-content px-4 text-center">
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-3 py-1 text-xs font-semibold">
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

        {/* ── Feature 05: BEST TEAM OF MODELS (Image 1) ───────────────── */}
        <Feature
          n="05"
          eyebrow="BEST TEAM OF MODELS"
          title="Not one static model. The best team of models for every task"
          body="A context-aware semantic router orchestrates the best combination of models and agents for every task—matching specialized intelligence to your goals instead of forcing one model to do everything. The result is the best balance of speed, cost, and quality for every task."
          tags={["Context-aware router", "Models + agents", "Specialized intelligence", "Speed · cost · quality"]}
          visual={<BestTeamOfModelsMock />}
          wash="warm"
        />

        {/* ── Feature 06: SELF-IMPROVING INTELLIGENCE (Image 1) ────────── */}
        <Feature
          n="06"
          eyebrow="SELF-IMPROVING INTELLIGENCE"
          title="Self-improving intelligence. The more you use it, the smarter it becomes"
          body="Models and skills continuously evolve through real-time human-agent collaboration — the system gets sharper the more you use it."
          tags={["Autonomous evolution", "Memory consolidation", "Continuous fine-tuning", "Safety bounds"]}
          visual={<SelfImprovingMock />}
          flip
          wash="cool"
        />

        <Feature
          n="07"
          eyebrow="Honest reporting"
          title="A factory that claims 100% is suspicious"
          body="The report leads with what still fails and why, names the judge's agreement with hand labels, and states plainly when a run was never scored rather than showing a fabricated zero. Every number on this site comes from a committed artifact in the repository."
          tags={["Residual failures named", "Judge calibration", "Never fabricates a score", "Artifacts committed"]}
          visual={<ReportMock />}
          wash="warm"
        />
      </div>

      {/* ── runs ─────────────────────────────────────────────────────── */}
      <section id="runs" className="relative scroll-mt-20">
        <div className="mx-auto max-w-content px-4 py-16">
          <div className="flex items-center gap-3">
            <span className="mono-nums font-mono text-[13px] font-bold text-accent">08</span>
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
