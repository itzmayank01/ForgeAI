"use client";

import { useState } from "react";

/**
 * Product mockups for the feature sections.
 *
 * Every one renders a real ForgeAI artifact with the field names and values the
 * factory genuinely writes. An invented graphic would look the same at a glance
 * and tell a reviewer nothing, so these double as documentation.
 */

function Frame({
  title,
  meta,
  children,
  tone = "plain",
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  tone?: "plain" | "terminal";
}) {
  return (
    <div className="mock relative overflow-hidden">
      {/* These panels illustrate artifact SHAPE with representative values.
          They sit on the same page as measured figures, so an unlabelled
          number here would read as a second, conflicting claim about the same
          run. The real numbers live on the run pages. */}
      <span className="absolute right-3 top-3 z-10 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted">
        illustrative
      </span>
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        {tone === "terminal" ? (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-bad/50" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn/50" />
            <span className="h-2.5 w-2.5 rounded-full bg-ok/50" />
          </>
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent/15 text-[11px] font-bold text-accent">
            F
          </span>
        )}
        <span
          className={
            tone === "terminal"
              ? "font-mono text-[11px] text-muted"
              : "text-[13px] font-semibold tracking-tight"
          }
        >
          {title}
        </span>
        {meta && <span className="ml-auto font-mono text-[10px] text-muted">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function Bar({
  v,
  tone = "accent",
}: {
  v: number;
  tone?: "accent" | "ok" | "bad" | "muted";
}) {
  const bg = { accent: "bg-accent", ok: "bg-ok", bad: "bg-bad", muted: "bg-ink/20" }[tone];
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08]">
      <span className={`block h-full rounded-full ${bg}`} style={{ width: `${v * 100}%` }} />
    </span>
  );
}

const Tag = ({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad" | "accent";
}) => {
  const tones = {
    neutral: "bg-ink/[0.055] text-muted",
    ok: "bg-ok/12 text-ok",
    warn: "bg-warn/14 text-warn",
    bad: "bg-bad/12 text-bad",
    accent: "bg-accent/12 text-accent",
  } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
};

/* ── 01 intake ─────────────────────────────────────────────────────────── */
export function IntakeMock() {
  return (
    <Frame title="forgeai build --brief hr_policy" meta="unattended" tone="terminal">
      <div className="space-y-3 p-4">
        <div className="rounded-lg bg-ink/[0.035] p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">brief</div>
          <p className="mt-1 text-[12.5px] leading-relaxed">
            I need an assistant that answers HR policy questions for shore staff — annual
            leave and carry-over, parental leave, travel expense reimbursement…
          </p>
        </div>

        {[
          {
            q: "Does this cover seagoing crew as well as shore staff?",
            a: "Shore staff only — the documents are titled “Shore Staff” and contain no seagoing terms.",
            c: "high",
            basis: "leave_policy.md · doc_01_c000",
          },
          {
            q: "Should it quote exact figures or direct staff to HR?",
            a: "Quote exact figures with a citation; the policies state them explicitly.",
            c: "medium",
            basis: "travel_expenses.md · doc_02_c001",
          },
        ].map((x) => (
          <div key={x.q} className="border-l-2 border-accent/50 pl-3">
            <div className="text-[12.5px] font-semibold">{x.q}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{x.a}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Tag tone={x.c === "high" ? "ok" : "warn"}>{x.c} confidence</Tag>
              <span className="font-mono text-[10px] text-muted">{x.basis}</span>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 border-t pt-3 font-mono text-[10px] text-muted">
          2 questions · 2 assumptions recorded
          <span className="blink text-accent">▍</span>
        </div>
      </div>
    </Frame>
  );
}

/* ── 02 groundability ──────────────────────────────────────────────────── */
export function GroundabilityMock() {
  const rows = [
    { t: "annual leave & carry-over", s: 0.82, v: "supported" },
    { t: "parental leave", s: 0.79, v: "supported" },
    { t: "travel reimbursement", s: 0.83, v: "supported" },
    { t: "grievance procedure", s: 0.85, v: "supported" },
    { t: "stock options", s: 0.59, v: "unsupported" },
  ];
  return (
    <Frame title="02_groundability.json" meta="bge-small · max cosine">
      <div className="divide-y">
        {rows.map((r) => (
          <div key={r.t} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-44 shrink-0 truncate text-[12.5px] font-medium">{r.t}</span>
            <span className="flex-1">
              <Bar v={r.s} tone={r.v === "supported" ? "ok" : "bad"} />
            </span>
            <span className="mono-nums w-10 shrink-0 text-right font-mono text-[11px] text-muted">
              {r.s.toFixed(2)}
            </span>
            <span className="w-24 shrink-0 text-right">
              <Tag tone={r.v === "supported" ? "ok" : "bad"}>{r.v}</Tag>
            </span>
          </div>
        ))}
      </div>
      <div className="border-t bg-bad/[0.05] px-4 py-3 text-[12px] leading-relaxed text-muted">
        <strong className="text-bad">1 topic demoted to must-refuse.</strong> No chunk covers
        “stock options”, so the agent declines it by construction rather than inventing an answer.
      </div>
    </Frame>
  );
}

/* ── 03 generator ──────────────────────────────────────────────────────── */
export function GeneratorMock() {
  return (
    <Frame title="03_agent_def.final.json" meta="v1">
      <div className="grid grid-cols-4 divide-x border-b">
        {[
          ["strategy", "dense"],
          ["top_k", "8"],
          ["chunk", "800/120"],
          ["temp", "0.10"],
        ].map(([k, v]) => (
          <div key={k} className="px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-wider text-muted">{k}</div>
            <div className="mono-nums mt-0.5 font-mono text-[12px] font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          tools attached
        </div>
        <div className="mt-2 rounded-lg border border-dashed px-3 py-2.5 text-[12.5px] text-muted">
          none — correct for a policy assistant over prose
        </div>

        <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">
          rejected by the audit
        </div>
        <ul className="mt-2 space-y-1.5">
          {[
            ["weather", "claimed requirement “general helpfulness” matches no topic"],
            ["csv_lookup", "no triggering requirement given"],
          ].map(([n, why]) => (
            <li key={n} className="flex items-start gap-2 text-[11.5px] leading-snug">
              <span className="mt-[3px] text-bad">✕</span>
              <span>
                <code className="font-mono text-bad">{n}</code>
                <span className="text-muted"> — {why}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

/* ── 04 evalgen ────────────────────────────────────────────────────────── */
export function EvalMock() {
  const cases = [
    {
      id: "ans_003",
      q: "What per-diem applies to international travel?",
      k: "answerable",
      d: "medium",
    },
    {
      id: "edge_multi_00",
      q: "How does the notice period compare to the claim deadline?",
      k: "multi-document",
      d: "hard",
    },
    {
      id: "edge_amb_01",
      q: "When’s the cutoff for that?",
      k: "ambiguous",
      d: "hard",
    },
    {
      id: "oos_02",
      q: "How many share options vest after two years?",
      k: "must refuse",
      d: "medium",
    },
  ];
  return (
    <Frame title="04_eval_suite.json" meta="generated from documents only">
      <div className="divide-y">
        {cases.map((c) => (
          <div key={c.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[12.5px] leading-snug">{c.q}</p>
              <Tag
                tone={
                  c.k === "must refuse"
                    ? "warn"
                    : c.k === "answerable"
                    ? "neutral"
                    : "accent"
                }
              >
                {c.k}
              </Tag>
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted">
              {c.id} · {c.d}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t bg-ink/[0.025] px-4 py-3">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
          gate
        </span>
        <Tag tone="ok">kept 28</Tag>
        <Tag tone="bad">oos_is_answerable 1</Tag>
        <Tag tone="warn">duplicate 2</Tag>
      </div>
    </Frame>
  );
}

/* ── 05 judge ──────────────────────────────────────────────────────────── */
export function JudgeMock() {
  const rows = [
    { id: "ans_003", pass: true, path: "deterministic", note: "fact recall 1.00" },
    { id: "oos_02", pass: true, path: "deterministic", note: "refused correctly" },
    { id: "ans_011", pass: false, path: "deterministic", note: "cited chunks it never retrieved" },
    { id: "edge_multi_00", pass: false, path: "escalated", note: "fact recall 0.50" },
  ];
  return (
    <Frame title="05_iterations/iter_1/verdicts.json" meta="judge ≠ generator">
      <div className="divide-y">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                r.pass ? "bg-ok/12 text-ok" : "bg-bad/12 text-bad"
              }`}
            >
              {r.pass ? "✓" : "✕"}
            </span>
            <code className="w-28 shrink-0 truncate font-mono text-[11px]">{r.id}</code>
            <span className="flex-1 truncate text-[12px] text-muted">{r.note}</span>
            <Tag tone={r.path === "escalated" ? "warn" : "neutral"}>{r.path}</Tag>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 divide-x border-t">
        {[
          ["pass rate", "82%"],
          ["escalated", "14%"],
          ["judge κ", "0.78"],
        ].map(([k, v]) => (
          <div key={k} className="px-3 py-2.5 text-center">
            <div className="mono-nums text-[15px] font-bold">{v}</div>
            <div className="text-[9px] uppercase tracking-wider text-muted">{k}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ── 06 loop ───────────────────────────────────────────────────────────── */
export function LoopMock() {
  return (
    <Frame title="05_iterations/iter_0/fix.json" meta="one rung per iteration">
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="bad">retrieval_miss 5</Tag>
          <Tag tone="warn">prompt_defect 3</Tag>
          <Tag tone="warn">hallucination 1</Tag>
        </div>

        <div className="rounded-lg border bg-ink/[0.025] p-3">
          <div className="flex items-center gap-2 text-[12.5px]">
            <code className="font-mono">retrieval_miss</code>
            <span className="text-muted">→</span>
            <code className="font-mono font-semibold text-accent">raise_top_k</code>
          </div>
          <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-muted">
{`- top_k: 5
+ top_k: 8`}
          </pre>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted">before</span>
          <span className="mono-nums text-[13px] font-semibold">61%</span>
          <span className="flex-1">
            <Bar v={0.82} tone="ok" />
          </span>
          <span className="mono-nums text-[13px] font-semibold text-ok">82%</span>
          <Tag tone="ok">+21%</Tag>
        </div>

        <p className="border-t pt-3 text-[11.5px] leading-relaxed text-muted">
          Kept because it measurably helped. An iteration that loses ground is reverted to the best
          definition so far.
        </p>
      </div>
    </Frame>
  );
}

/* ── 07 report ─────────────────────────────────────────────────────────── */
export function ReportMock() {
  return (
    <Frame title="06_report.md" meta="honest by construction">
      <div className="space-y-3 p-4">
        <div className="flex items-baseline gap-2">
          <span className="mono-nums text-[26px] font-bold leading-none">82%</span>
          <span className="text-[12px] text-muted">agent v1 · iteration cap reached</span>
        </div>

        <div className="rounded-lg border border-warn/30 bg-warn/[0.06] p-3">
          <div className="text-[12px] font-semibold text-warn">What still fails</div>
          <ul className="mt-1.5 space-y-1 text-[11.5px] leading-snug text-muted">
            <li>
              <code className="font-mono">edge_multi_00</code> — fact recall 0.50, one source never
              retrieved
            </li>
            <li>
              <code className="font-mono">ans_011</code> — cited a chunk it never retrieved
            </li>
          </ul>
        </div>

        <div className="rounded-lg bg-ink/[0.03] p-3 text-[11.5px] leading-relaxed text-muted">
          <strong className="text-ink">Judge calibration:</strong> 90% agreement with hand labels
          (9/10), Cohen’s κ 0.78. One disagreement listed in full.
        </div>

        <p className="text-[11.5px] italic leading-relaxed text-muted">
          A factory that claims 100% is suspicious. An uncalibrated run says so instead of showing a
          number.
        </p>
      </div>
    </Frame>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   05 BEST TEAM OF MODELS (Exact visual from Image 1)
   ────────────────────────────────────────────────────────────────────────── */
export function BestTeamOfModelsMock({ onOpenStudio }: { onOpenStudio?: () => void }) {
  const [activeTab, setActiveTab] = useState<"Identity" | "Proactive" | "Deliver" | "Team">("Team");
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [showThoughts, setShowThoughts] = useState(false);

  return (
    <div className="relative">
      <div className="mock overflow-hidden rounded-3xl border bg-surface p-5 shadow-[0_16px_40px_-16px_rgba(5,150,105,0.14)]">
        {/* Channel Header */}
        <div className="flex items-center justify-between border-b pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-100 text-[12px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
              #
            </span>
            <div>
              <div className="text-[13px] font-bold tracking-tight text-ink">launch-week</div>
              <div className="text-[10px] text-muted">3 humans · 8 agents</div>
            </div>
          </div>
          <button className="text-muted hover:text-ink transition" aria-label="Notifications">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </button>
        </div>

        {/* User chat message */}
        <div className="mt-3.5 flex items-start gap-2.5">
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink/10 text-[10px] font-bold text-muted">
            L
          </div>
          <div className="text-[12px] text-muted leading-relaxed">
            <span className="font-semibold text-ink">Leo</span>: Merging the release branch after lunch.
          </div>
        </div>

        {/* Agent message box */}
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-purple-600 text-[11px] font-bold text-white shadow-sm">
              🤖
            </span>
            <span className="text-[12.5px] font-bold text-ink">Atlas</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
              PROACTIVE
            </span>
          </div>

          {/* Embedded Release Board Card */}
          <div className="overflow-hidden rounded-2xl border bg-surface/95 shadow-sm">
            {/* Board Header */}
            <div className="flex items-center justify-between border-b bg-blue-50/60 px-4 py-2.5 dark:bg-blue-950/25">
              <div className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-blue-600 dark:text-blue-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                  />
                </svg>
                <span className="text-[12.5px] font-semibold text-ink">Release board · v2.4</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-bold text-white">
                  WEB APP
                </span>
                <span className="text-[11px] text-muted">↗</span>
              </div>
            </div>

            {/* 3 Columns Kanban */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-ink/[0.015]">
              {/* To Do */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  To Do
                </div>
                <div className="h-4 rounded-md bg-purple-100/80 dark:bg-purple-900/40" />
                <div className="h-4 w-4/5 rounded-md bg-purple-100/60 dark:bg-purple-900/30" />
              </div>

              {/* In Progress */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  In Progress
                </div>
                <div className="h-4 rounded-md bg-amber-100/80 dark:bg-amber-900/40" />
                <div className="h-4 w-3/4 rounded-md bg-amber-100/60 dark:bg-amber-900/30" />
              </div>

              {/* Done */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Done
                </div>
                <div className="h-4 rounded-md bg-emerald-100/80 dark:bg-emerald-900/40" />
                <div className="h-4 w-5/6 rounded-md bg-emerald-100/60 dark:bg-emerald-900/30" />
              </div>
            </div>

            {/* Card Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3.5 py-2.5 bg-surface text-[11px] text-muted">
              <div className="flex items-center gap-2">
                <span>1 delivery · v2.4</span>
                <span>•</span>
                <span>Thought for 6s</span>
                <button
                  type="button"
                  onClick={() => setShowThoughts(!showThoughts)}
                  className="font-medium text-ink underline underline-offset-2 hover:text-emerald-700 transition"
                >
                  View my thoughts
                </button>
              </div>
              <button
                type="button"
                onClick={onOpenStudio}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-3 py-1.5 text-[11px] shadow-sm transition hover:scale-[1.02] active:scale-[0.98]"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Open Studio
              </button>
            </div>

            {showThoughts && (
              <div className="border-t bg-ink/[0.03] p-3 text-[11px] leading-relaxed text-muted animate-fadeIn">
                <span className="font-semibold text-ink">Semantic Router trace:</span> Orchestrated Claude 3.5 Sonnet for code planning, routed task board generation to Hermes-70B, audited output contract against 0 errors. Verified in 6.2s.
              </div>
            )}
          </div>

          {/* Feedback row */}
          <div className="flex items-center justify-between text-[11px] text-muted pt-0.5">
            <span className="text-[11.5px]">Was this helpful?</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setHelpful(true)}
                className={`transition ${
                  helpful === true ? "text-emerald-600 scale-110 font-bold" : "hover:text-ink"
                }`}
                aria-label="Thumbs up"
              >
                👍
              </button>
              <button
                type="button"
                onClick={() => setHelpful(false)}
                className={`transition ${
                  helpful === false ? "text-bad scale-110 font-bold" : "hover:text-ink"
                }`}
                aria-label="Thumbs down"
              >
                👎
              </button>
              <button type="button" className="hover:text-ink transition" aria-label="Bookmark">
                🔖
              </button>
              <button type="button" className="hover:text-ink transition" aria-label="Share">
                ↗
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating control dock below */}
      <div className="mt-3 flex items-center justify-center">
        <div className="flex items-center gap-1.5 rounded-full border bg-surface/90 px-3 py-1.5 shadow-lg backdrop-blur text-[11px] font-medium text-muted">
          <button type="button" className="px-1 hover:text-ink transition">
            ||
          </button>
          <button type="button" className="px-1 hover:text-ink transition">
            |&lt;
          </button>
          <button type="button" className="px-1 hover:text-ink transition">
            &gt;|
          </button>
          <span className="mx-1 h-3 w-px bg-ink/10" />
          <button
            type="button"
            onClick={() => setActiveTab("Identity")}
            className={`rounded-full px-2.5 py-0.5 transition ${
              activeTab === "Identity" ? "bg-ink/10 text-ink font-semibold" : "hover:text-ink"
            }`}
          >
            Identity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("Proactive")}
            className={`rounded-full px-2.5 py-0.5 transition ${
              activeTab === "Proactive" ? "bg-ink/10 text-ink font-semibold" : "hover:text-ink"
            }`}
          >
            Proactive
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("Deliver")}
            className={`rounded-full px-2.5 py-0.5 transition ${
              activeTab === "Deliver" ? "bg-ink/10 text-ink font-semibold" : "hover:text-ink"
            }`}
          >
            Deliver
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("Team")}
            className={`rounded-full px-3 py-0.5 font-semibold text-white transition ${
              activeTab === "Team" ? "bg-emerald-800" : "hover:text-ink"
            }`}
          >
            Team
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   06 SELF-IMPROVING INTELLIGENCE (Exact visual from Image 1)
   ────────────────────────────────────────────────────────────────────────── */
export function SelfImprovingMock() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-3xl border border-emerald-900/40 bg-[#0c1813] p-6 shadow-[0_20px_50px_-20px_rgba(5,150,105,0.3)] text-emerald-100">
        {/* Night Header */}
        <div className="flex items-center justify-between border-b border-emerald-900/50 pb-4">
          <div className="flex items-center gap-2 font-mono text-[11.5px] text-emerald-400">
            <span className="text-sm">🌙</span>
            <span>02:47 · while the team sleeps</span>
          </div>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
        </div>

        {/* 4 Evolving Steps */}
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-900/40 bg-[#12231b] px-3.5 py-2.5 text-[12px] leading-relaxed transition hover:border-emerald-600/50">
            <span className="text-emerald-400 font-bold">✓</span>
            <span className="text-sm">🌐</span>
            <span className="flex-1">Dreaming — consolidating 26 memories</span>
            <span className="font-mono text-[10px] text-emerald-400/70">100%</span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-emerald-900/40 bg-[#12231b] px-3.5 py-2.5 text-[12px] leading-relaxed transition hover:border-emerald-600/50">
            <span className="text-emerald-400 font-bold">✓</span>
            <span className="text-sm">🪶</span>
            <span className="flex-1">Skill auto-update · summarizer v1.2 → v1.3</span>
            <span className="rounded bg-emerald-950/80 px-1.5 py-0.5 font-mono text-[9.5px] text-emerald-300">
              +14% F1
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-emerald-900/40 bg-[#12231b] px-3.5 py-2.5 text-[12px] leading-relaxed transition hover:border-emerald-600/50">
            <span className="text-emerald-400 font-bold">✓</span>
            <span className="text-sm">📐</span>
            <span className="flex-1">Post-training delta applied to weights</span>
            <span className="font-mono text-[10px] text-emerald-400/70">Δ 0.04</span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-emerald-800/60 bg-[#14281f] px-3.5 py-2.5 text-[12px] leading-relaxed shadow-[0_0_15px_-3px_rgba(5,150,105,0.2)]">
            <span className="animate-spin text-emerald-400 font-bold text-xs">🔄</span>
            <span className="flex-1 font-medium text-emerald-200">
              Harness self-evolved · 3 tool paths optimized
            </span>
            <span className="rounded bg-emerald-800/60 px-1.5 py-0.5 font-mono text-[9.5px] text-emerald-200">
              active
            </span>
          </div>
        </div>

        {/* Bottom Ready Badge */}
        <div className="mt-5 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#5b21b6] px-4 py-1.5 text-[11px] font-semibold text-purple-100 shadow-md">
            <span className="h-2 w-2 rounded-full bg-purple-300 animate-pulse" />
            Atlas v1.3 ready
          </div>
        </div>
      </div>
    </div>
  );
}
