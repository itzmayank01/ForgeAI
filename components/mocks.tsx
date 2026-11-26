"use client";

import { useEffect, useState } from "react";
import { AgentIcon, IconUsers } from "@/components/icons";

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
            tone ==="terminal"
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
                r.pass ?"bg-ok/12 text-ok" : "bg-bad/12 text-bad"
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
export interface ReportMockProps {
  runId?: string;
  passRate?: number | null;
  stopReason?: string;
  residual?: { case_id: string; why: string }[];
  agreementRate?: number | null;
  kappa?: number | null;
}

/**
 * The report panel, fed from the run it names.
 *
 * It used to state "82%" and "90% agreement with hand labels, Cohen's kappa
 * 0.78" as fixed text, on a page whose own stat strip reported the measured
 * 58% and kappa 0.17 for the same run. Two numbers for one measurement, the
 * flattering one invented -- in a panel whose closing line is that a factory
 * claiming 100% is suspicious. It now reports the run or reports nothing.
 */
export function ReportMock({
  runId, passRate, stopReason, residual = [], agreementRate, kappa,
}: ReportMockProps = {}) {
  return (
    <Frame title="06_report.md" meta={runId ? `run ${runId}` : "honest by construction"}>
      <div className="space-y-3 p-4">
        <div className="flex items-baseline gap-2">
          <span className="mono-nums text-[26px] font-bold leading-none">
            {passRate != null ? `${Math.round(passRate * 100)}%` : "—"}
          </span>
          <span className="text-[12px] text-muted">{stopReason ?? "no run in this checkout"}</span>
        </div>

        <div className="rounded-lg border border-warn/30 bg-warn/[0.06] p-3">
          <div className="text-[12px] font-semibold text-warn">What still fails</div>
          {residual.length > 0 ? (
            <ul className="mt-1.5 space-y-1 text-[11.5px] leading-snug text-muted">
              {residual.slice(0, 2).map((f) => (
                <li key={f.case_id}>
                  <code className="font-mono">{f.case_id}</code> — {f.why}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[11.5px] text-muted">
              Nothing recorded as still failing for this run.
            </p>
          )}
        </div>

        <div className="rounded-lg bg-ink/[0.03] p-3 text-[11.5px] leading-relaxed text-muted">
          <strong className="text-ink">Judge calibration:</strong>{" "}
          {agreementRate != null && kappa != null ? (
            <>
              {Math.round(agreementRate * 100)}% agreement with hand labels, Cohen&rsquo;s κ{" "}
              {kappa.toFixed(2)}. Reported whether or not it flatters the run.
            </>
          ) : (
            <>not calibrated in this run, so no agreement figure is shown.</>
          )}
        </div>

        <p className="text-[11.5px] italic leading-relaxed text-muted">
          A factory that claims 100% is suspicious. An uncalibrated run says so instead of showing a
          number.
        </p>
      </div>
    </Frame>
  );
}

/**
 * Live routing, computed on the real corpora.
 *
 * This replaced two panels that depicted a product ForgeAI is not: a mocked-up
 * team chat with a fictional agent called Atlas, and a console announcing
 * "post-training delta applied to weights" and "skill auto-update v1.2 to
 * v1.3". ForgeAI does not fine-tune anything, has no persistent memory and
 * runs no background consolidation, so those panels described capabilities
 * that do not exist anywhere in the repository.
 *
 * What is here instead asks the live endpoint, with routeOnly so it costs no
 * model call, and draws whatever comes back. If the router changes, this
 * changes with it; it cannot drift into decoration.
 */
export function RouterMock() {
  const QUESTIONS = [
    "How much annual leave can I carry over?",
    "What is the lead time on a lube oil filter cartridge?",
  ];
  const [i, setI] = useState(0);
  const [data, setData] = useState<null | {
    winner: string | null;
    reason: string;
    ambiguous: boolean;
    scores: { agentId: string; score: number; share: number; topFile: string | null }[];
  }>(null);
  const [busy, setBusy] = useState(false);

  const NAME: Record<string, string> = {
    hr_policy_live: "HR Policy Assistant",
    ship_spares_live: "Ship Spares Specialist",
  };

  async function ask(index: number) {
    setI(index);
    setBusy(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: "shore-and-vessel-desk",
          question: QUESTIONS[index],
          routeOnly: true,
        }),
      });
      const json = await res.json();
      setData(json.routing ?? null);
    } catch {
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { ask(0); /* eslint-disable-next-line */ }, []);

  return (
    <div className="mock rounded-3xl border bg-surface p-5 shadow-[0_16px_40px_-16px_rgba(5,150,105,0.14)]">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent-soft text-accent-text dark:text-accent-text">
            <IconUsers className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-[13px] font-bold tracking-tight text-ink">Shore &amp; Vessel Desk</div>
            <div className="text-[10px] text-muted">2 built members · live routing</div>
          </div>
        </div>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-text dark:text-accent-text">
          real request
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUESTIONS.map((q, n) => (
          <button
            key={q}
            onClick={() => ask(n)}
            disabled={busy}
            className={`rounded-lg border px-2.5 py-1 text-left text-[11px] transition disabled:opacity-50 ${
              i === n ?"border-accent-line bg-accent-soft text-ink " : "text-muted hover:text-ink"
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="mt-3.5 space-y-2">
        {busy && <div className="text-[11px] text-muted">scoring both corpora…</div>}
        {!busy && data?.scores.map((s) => (
          <div key={s.agentId} className="flex items-center gap-2 text-[11px]">
            <span className="w-[170px] shrink-0 truncate text-muted flex items-center gap-1.5">
              <AgentIcon name={s.agentId} className="w-4 h-4 shrink-0 rounded-xs" />
              <span className="truncate">{NAME[s.agentId] ?? s.agentId}</span>
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
              <span
                className={`block h-full rounded-full transition-all duration-500 ${
                  s.agentId === data.winner ?"bg-accent" : "bg-ink/25"
                }`}
                style={{ width: `${Math.max(Math.round(s.share * 100), 1)}%` }}
              />
            </span>
            <span className="mono-nums w-10 shrink-0 text-right font-mono text-muted">
              {Math.round(s.share * 100)}%
            </span>
          </div>
        ))}
        {!busy && data && (
          <div className="pt-1 text-[10.5px] text-muted">
            best-matching file:{" "}
            <span className="font-mono text-ink">
              {data.scores.find((s) => s.agentId === data.winner)?.topFile ?? "none"}
            </span>
            {data.ambiguous && " · margin was thin"}
          </div>
        )}
        {!busy && !data && (
          <div className="text-[11px] text-muted">routing unavailable in this environment</div>
        )}
      </div>
    </div>
  );
}
