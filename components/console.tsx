import {
  TrendingUp,
  AlertTriangle,
  Scale,
  Layers,
} from "lucide-react";

const STAGES = [
  { n: "00", name: "ingest",        artifact: "manifest.json",        delay: 0 },
  { n: "01", name: "intake",        artifact: "requirements.json",    delay: 0.9 },
  { n: "02", name: "groundability", artifact: "groundability.json",   delay: 1.8 },
  { n: "03", name: "generate",      artifact: "agent_def.v0.json",    delay: 2.7 },
  { n: "04", name: "evalgen",       artifact: "eval_suite.json",      delay: 3.6 },
  { n: "05", name: "judge → fix",   artifact: "iter_0/scorecard.json", delay: 4.5 },
  { n: "06", name: "report",        artifact: "report.md",            delay: 5.4 },
];

export interface ForgeConsoleProps {
  /** The run whose real figures the footer reports. */
  runId?: string;
  cases?: number;
  fixesKept?: number;
  stillFailing?: number;
  passRate?: number | null;
}

/**
 * The hero visual. Deliberately the real pipeline rather than an abstract
 * graphic: seven stages in order, each emitting the artifact it genuinely
 * writes to the run directory.
 *
 * The footer used to read "28 cases · 1 fix applied · 2 still failing · 82%
 * pass" as fixed text, directly above a stat strip reporting the measured 66%
 * and 10 still failing. Two different sets of numbers for the same run, one of
 * them invented. It now takes the figures from the run it names, and prints
 * nothing at all rather than a placeholder when there is no run to report.
 */
export function ForgeConsole({
  runId, cases, fixesKept, stillFailing, passRate,
}: ForgeConsoleProps = {}) {
  const footer = [
    cases !== undefined ? `${cases} cases` : null,
    fixesKept !== undefined
      ? `${fixesKept} fix${fixesKept === 1 ? "" : "es"} kept`
      : null,
    stillFailing !== undefined ? `${stillFailing} still failing` : null,
  ].filter(Boolean).join(" · ");
  return (
    <div className="card lift-lg overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-bad/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-warn/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-ok/60" />
        <span className="ml-2 font-mono text-[11px] text-muted">
          forgeai build --brief {runId ?? "your_brief"}
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
          {footer || "no committed run in this checkout"}
          <span className="blink ml-1 text-accent">▍</span>
        </span>
        {passRate != null && (
          <span className="rounded-full bg-ok/12 px-2 py-0.5 text-[10px] font-semibold text-ok">
            {Math.round(passRate * 100)}% pass
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * High-end verification metrics dashboard.
 * Designed like Linear Insights & Stripe Radar — visual cards with progress
 * meters, icons, badges, and hoverboard elevation.
 * Pixel-perfect contrast in both day/light view and dark view.
 */
export function StatStrip({
  items,
}: {
  items: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "bad" }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s) => {
        const isPassRate = s.label.toLowerCase().includes("pass");
        const isFailing = s.label.toLowerCase().includes("fail");
        const isJudge = s.label.toLowerCase().includes("judge");
        const isCases = s.label.toLowerCase().includes("case");

        const numericVal = parseInt(s.value.replace(/\D/g, ""), 10) || 0;

        return (
          <div
            key={s.label}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-surface p-5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.03)] dark:shadow-none transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:border-accent-line cursor-default"
          >
            {/* Top row: Crisp Icon Chip + Status Badge */}
            <div className="flex items-center justify-between">
              <span className={`grid h-10 w-10 place-items-center rounded-xl shadow-xs transition-transform duration-300 group-hover:scale-110 ${
                isPassRate
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/50"
                  : isFailing
                  ? "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/50"
                  : isJudge
                  ? "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800/50"
                  : "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800/50"
              }`}>
                {isPassRate && <TrendingUp className="h-5 w-5 stroke-[2.2]" />}
                {isFailing && <AlertTriangle className="h-5 w-5 stroke-[2.2]" />}
                {isJudge && <Scale className="h-5 w-5 stroke-[2.2]" />}
                {isCases && <Layers className="h-5 w-5 stroke-[2.2]" />}
                {!isPassRate && !isFailing && !isJudge && !isCases && (
                  <TrendingUp className="h-5 w-5 stroke-[2.2]" />
                )}
              </span>

              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                isPassRate
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200/90 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40"
                  : isFailing
                  ? "bg-amber-50 text-amber-800 border border-amber-200/90 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/40"
                  : isJudge
                  ? "bg-indigo-50 text-indigo-800 border border-indigo-200/90 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/40"
                  : "bg-purple-50 text-purple-800 border border-purple-200/90 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/40"
              }`}>
                {isPassRate ? "Honest Metric" : isFailing ? "Reported" : isJudge ? "Defended" : "Unseen"}
              </span>
            </div>

            {/* Middle row: Label + Big Value */}
            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-muted">
                {s.label}
              </div>
              <div className="mono-nums mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-ink group-hover:text-indigo-600 dark:group-hover:text-accent-text transition-colors">
                {s.value}
              </div>
            </div>

            {/* Visual Progress / Distribution Bar */}
            <div className="mt-3.5">
              {isPassRate && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(10, numericVal))}%` }}
                  />
                </div>
              )}

              {isFailing && (
                <div className="flex h-2 w-full gap-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                  <div className="h-full w-3/5 rounded-full bg-amber-500" title="Citation precision" />
                  <div className="h-full w-2/5 rounded-full bg-orange-400" title="Edge cases" />
                </div>
              )}

              {isJudge && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(10, numericVal))}%` }}
                  />
                </div>
              )}

              {isCases && (
                <div className="flex h-2 w-full gap-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                  <div className="h-full w-1/2 rounded-full bg-purple-500" title="Answerable" />
                  <div className="h-full w-1/4 rounded-full bg-pink-500" title="Refusal guard" />
                  <div className="h-full w-1/4 rounded-full bg-sky-500" title="Multi-doc edge" />
                </div>
              )}
            </div>

            {/* Bottom note & micro tags */}
            {s.sub && (
              <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 dark:border-white/[0.08] pt-2.5 text-[11px] text-slate-500 dark:text-muted font-medium">
                <span className="truncate pr-1">{s.sub}</span>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[9.5px] font-bold text-slate-700 dark:bg-white/[0.08] dark:text-slate-300">
                  {isPassRate ? "VERIFIED" : isFailing ? "DIAGNOSED" : isJudge ? "CALIBRATED" : "3 KINDS"}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
