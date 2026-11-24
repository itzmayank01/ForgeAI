import type {
  AgentDefinition, CaseVerdict, EvalSuite, GroundabilityReport,
  IterationLog, JudgeCalibration, RequirementsDoc, Scorecard,
} from "@/lib/types";
import { Meter, Pill } from "./ui";

const VERDICT_TONE = { supported: "ok", weak: "warn", unsupported: "bad" } as const;

export function RequirementsPanel({ req }: { req: RequirementsDoc }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {([["Scope", req.scope], ["Audience", req.audience], ["Tone", req.tone]] as const).map(
          ([k, v]) => (
            <div key={k} className="card p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{k}</div>
              <p className="mt-1.5 text-sm leading-relaxed">{v}</p>
            </div>
          ),
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h4 className="text-sm font-semibold">Must answer</h4>
          <ul className="mt-3 space-y-2.5">
            {req.must_answer.map((t) => (
              <li key={t.name} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs leading-relaxed text-muted">{t.description}</div>
                </div>
                {t.support_score !== null && (
                  <span className="mono-nums shrink-0 text-xs text-muted">
                    {t.support_score.toFixed(2)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h4 className="text-sm font-semibold">Must refuse</h4>
          <ul className="mt-3 space-y-2.5">
            {req.must_refuse.map((t) => (
              <li key={t.name} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs leading-relaxed text-muted">{t.description}</div>
                </div>
                {t.verdict === "unsupported" && <Pill tone="bad">no support</Pill>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {req.assumptions.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Assumptions</h4>
            <Pill>{req.mode}</Pill>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            The brief caps clarifying questions at five but also demands an unattended run.
            Unattended mode asks them anyway, answers itself, and shows its working.
          </p>
          <ul className="mt-3.5 space-y-3">
            {req.assumptions.map((a, i) => (
              <li key={i} className="border-l-2 border-accent/40 pl-3.5">
                <div className="text-sm font-medium">{a.question}</div>
                <div className="mt-1 text-sm text-muted">{a.assumed_answer}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Pill tone={a.confidence === "high" ? "ok" : a.confidence === "low" ? "bad" : "warn"}>
                    {a.confidence}
                  </Pill>
                  <span className="italic">{a.basis}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function GroundabilityPanel({ g }: { g: GroundabilityReport }) {
  return (
    <div className="card overflow-hidden">
      {g.aborted && (
        <div className="border-b bg-bad/10 p-4 text-sm text-bad">
          <strong>Build aborted.</strong> {g.abort_reason}
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="border-b text-left text-[11px] uppercase tracking-wider text-muted">
          <tr>
            <th className="px-4 py-2.5 font-medium">Topic</th>
            <th className="px-4 py-2.5 font-medium">Support</th>
            <th className="px-4 py-2.5 font-medium">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {g.topics.map((t) => (
            <tr key={t.name} className="border-b last:border-0">
              <td className="px-4 py-2.5">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted">{t.description}</div>
              </td>
              <td className="mono-nums px-4 py-2.5 align-top">
                {t.support_score?.toFixed(3) ?? "—"}
              </td>
              <td className="px-4 py-2.5 align-top">
                {t.verdict && <Pill tone={VERDICT_TONE[t.verdict]}>{t.verdict}</Pill>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {g.moved_to_refuse.length > 0 && (
        <div className="border-t bg-ink/[0.03] p-4 text-xs text-muted">
          Demoted to <strong className="text-ink">must-refuse</strong> before generation:{" "}
          {g.moved_to_refuse.join(", ")} — so the agent declines them by construction rather
          than inventing an answer.
        </div>
      )}
    </div>
  );
}

export function DefinitionPanel({ d }: { d: AgentDefinition }) {
  const rejected = d.provenance.tools_rejected ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["Strategy", d.retrieval.strategy],
          ["top_k", String(d.retrieval.top_k)],
          ["Chunk", `${d.retrieval.chunk_size}/${d.retrieval.chunk_overlap}`],
          ["Temperature", d.temperature.toFixed(2)],
        ] as const).map(([k, v]) => (
          <div key={k} className="card p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-muted">{k}</div>
            <div className="mono-nums mt-1 text-base font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h4 className="text-sm font-semibold">Tools</h4>
        {d.tools.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            None attached. For a policy assistant over prose documents that is the correct
            answer — an unused tool is a factory defect, not a feature.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {d.tools.map((t) => (
              <li key={t.name} className="text-sm">
                <code className="font-mono text-accent">{t.name}</code>
                <span className="text-muted"> — {t.reason}</span>
                <div className="text-xs text-muted">
                  justified by: <em>{t.triggering_requirement}</em>
                </div>
              </li>
            ))}
          </ul>
        )}
        {rejected.length > 0 && (
          <div className="mt-4 border-t pt-3.5">
            <div className="text-xs font-medium text-muted">Rejected by the audit</div>
            <ul className="mt-1.5 space-y-1">
              {rejected.map((r, i) => (
                <li key={i} className="font-mono text-[11px] leading-relaxed text-bad">{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <details className="card group overflow-hidden">
        <summary className="cursor-pointer list-none p-5 text-sm font-semibold hover:bg-ink/[0.02]">
          System prompt
          <span className="ml-2 font-normal text-muted group-open:hidden">— show</span>
        </summary>
        <pre className="scroll-slim max-h-[28rem] overflow-auto border-t bg-ink/[0.03] p-5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
          {d.system_prompt}
        </pre>
      </details>
    </div>
  );
}

export function SuitePanel({
  suite, verdicts,
}: { suite: EvalSuite; verdicts: CaseVerdict[] }) {
  const byId = new Map(verdicts.map((v) => [v.case_id, v]));
  const counts = suite.cases.reduce<Record<string, number>>((a, c) => {
    a[c.kind] = (a[c.kind] ?? 0) + 1;
    return a;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Pill tone="accent">{suite.cases.length} cases</Pill>
        {Object.entries(counts).map(([k, n]) => (
          <Pill key={k}>{k.replace(/_/g, " ")}: {n}</Pill>
        ))}
        <span className="ml-auto font-mono">generated by {suite.generated_by}</span>
      </div>

      {Object.keys(suite.gate_report).length > 0 && (
        <div className="card p-4">
          <h4 className="text-sm font-semibold">Quality gate</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Cases that would make the suite a rubber stamp are dropped before scoring. The
            decisive one: an &ldquo;out of scope&rdquo; question that actually retrieves strong
            context is secretly answerable, and keeping it would teach the optimizer to make
            the agent refuse everything.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(suite.gate_report).map(([k, v]) => (
              <Pill key={k} tone={k === "kept" ? "ok" : k === "warning" ? "bad" : "warn"}>
                {k.replace(/_/g, " ")}: {String(v)}
              </Pill>
            ))}
          </div>
        </div>
      )}

      <div className="card scroll-slim max-h-[34rem] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Case</th>
              <th className="px-4 py-2.5 font-medium">Kind</th>
              <th className="px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {suite.cases.map((c) => {
              const v = byId.get(c.id);
              return (
                <tr key={c.id} className="border-b align-top last:border-0">
                  <td className="px-4 py-3">
                    <div className="leading-snug">{c.question}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted">
                      {c.id}
                      {c.expected_facts.length > 0 && ` · expects: ${c.expected_facts[0].slice(0, 60)}`}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Pill tone={c.should_refuse ? "warn" : "neutral"}>
                      {c.edge_type ?? c.kind.replace(/_/g, " ")}
                    </Pill>
                    <div className="mt-1 text-[11px] text-muted">{c.difficulty}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {v ? (
                      <>
                        <Pill tone={v.passed ? "ok" : "bad"}>{v.passed ? "pass" : "fail"}</Pill>
                        {v.notes && (
                          <div className="mt-1 max-w-[16rem] text-[11px] leading-snug text-muted">
                            {v.notes}
                          </div>
                        )}
                        <div className="mt-1 text-[11px] text-muted">{v.judge_path}</div>
                      </>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IterationsPanel({
  iterations, scorecards,
}: { iterations: IterationLog[]; scorecards: Scorecard[] }) {
  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Iter</th>
              <th className="px-4 py-2.5 font-medium">Pass rate</th>
              <th className="px-4 py-2.5 font-medium">Answerable</th>
              <th className="px-4 py-2.5 font-medium">Refusals</th>
              <th className="px-4 py-2.5 font-medium">Edge</th>
              <th className="px-4 py-2.5 font-medium">Escalated</th>
            </tr>
          </thead>
          <tbody>
            {scorecards.map((s) => (
              <tr key={s.iteration} className="border-b last:border-0">
                <td className="mono-nums px-4 py-3 font-semibold">{s.iteration}</td>
                <td className="w-48 px-4 py-3"><Meter value={s.pass_rate} /></td>
                <td className="mono-nums px-4 py-3">{pct(s.by_kind.answerable)}</td>
                <td className="mono-nums px-4 py-3">{pct(s.by_kind.out_of_scope)}</td>
                <td className="mono-nums px-4 py-3">{pct(s.by_kind.edge)}</td>
                <td className="mono-nums px-4 py-3 text-muted">{pct(s.llm_escalation_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {iterations.map((it) => it.fix && (
        <div key={it.iteration} className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono-nums text-xs font-bold text-accent">
              {String(it.iteration).padStart(2, "0")}
            </span>
            <code className="font-mono text-sm">{it.fix.category}</code>
            <span className="text-muted">→</span>
            <code className="font-mono text-sm text-accent">{it.fix.rung}</code>
            <span className="ml-auto">
              {it.kept ? (
                <Pill tone={it.score_after >= it.score_before ? "ok" : "warn"}>
                  {pctDelta(it.score_after - it.score_before)}
                </Pill>
              ) : (
                <Pill tone="bad">reverted</Pill>
              )}
            </span>
          </div>

          <p className="mt-2.5 text-sm text-muted">{it.fix.rationale}</p>
          {it.revert_reason && <p className="mt-1 text-sm text-bad">{it.revert_reason}</p>}

          {it.fix.diff.before && Object.keys(it.fix.diff.before).length > 0 && (
            <pre className="mt-3 overflow-x-auto rounded-lg bg-ink/[0.04] p-3 font-mono text-[11px]">
              {Object.keys(it.fix.diff.before).map((k) => (
                `${k}: ${JSON.stringify((it.fix!.diff.before as Record<string, unknown>)[k])} → ${JSON.stringify((it.fix!.diff.after as Record<string, unknown>)[k])}\n`
              )).join("")}
            </pre>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(it.failures_by_category).map(([k, n]) => (
              <Pill key={k}>{k.replace(/_/g, " ")}: {n}</Pill>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CalibrationPanel({ c }: { c: JudgeCalibration | null }) {
  if (!c || c.n_cases === 0) {
    return (
      <div className="card border-warn/30 bg-warn/[0.06] p-5">
        <h4 className="text-sm font-semibold text-warn">Not calibrated</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Every score on this page is unverified. A judge nobody has checked is not evidence —
          run <code className="font-mono text-ink">forgeai calibrate</code> against hand-labelled
          cases before trusting these numbers.
        </p>
      </div>
    );
  }
  return (
    <div className="card p-5">
      <div className="flex items-baseline gap-3">
        <span className="mono-nums text-2xl font-bold">
          {Math.round(c.agreement_rate * 100)}%
        </span>
        <span className="text-sm text-muted">
          agreement with hand labels ({c.agreements}/{c.n_cases}), Cohen&rsquo;s kappa{" "}
          <strong className="mono-nums text-ink">{c.cohens_kappa.toFixed(2)}</strong>
        </span>
      </div>
      {c.disagreements.length > 0 && (
        <ul className="mt-3.5 space-y-1.5 border-t pt-3.5">
          {c.disagreements.map((d) => (
            <li key={d.case_id} className="font-mono text-xs text-muted">
              <span className="text-ink">{d.case_id}</span> — judge said{" "}
              {String(d.judge)}, human said {String(d.human)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const pct = (v: number | undefined) => (v === undefined ? "—" : `${Math.round(v * 100)}%`);
const pctDelta = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;
