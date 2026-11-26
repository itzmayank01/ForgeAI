import Link from "next/link";
import type { ReactNode } from "react";

export function Pill({
  tone = "neutral", children,
}: { tone?: "neutral" | "ok" | "warn" | "bad" | "accent"; children: ReactNode }) {
  const tones = {
    neutral: "bg-ink/6 text-muted",
    ok: "bg-ok/12 text-ok",
    warn: "bg-warn/14 text-warn",
    bad: "bg-bad/12 text-bad",
    accent: "bg-accent/12 text-accent",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label, value, sub, tone = "neutral",
}: { label: string; value: string; sub?: string; tone?: "neutral" | "ok" | "warn" | "bad" }) {
  const colors = {
    neutral: "text-ink", ok: "text-ok", warn: "text-warn", bad: "text-bad",
  } as const;
  return (
    <div className="card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className={`mono-nums mt-1.5 text-2xl font-bold tracking-tight ${colors[tone]}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Section({
  id, eyebrow, title, lede, children, split = false,
}: {
  id?: string; eyebrow?: string; title: string; lede?: string;
  children: ReactNode; split?: boolean;
}) {
  const head = (
    <>
      {eyebrow && (
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          {eyebrow}
        </div>
      )}
      <h2 className="display mt-2 text-[clamp(1.6rem,3.2vw,2.3rem)]">{title}</h2>
      {lede && (
        <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-muted">{lede}</p>
      )}
    </>
  );

  // Split puts the heading in a sticky left rail. A full-width heading above a
  // narrow body leaves the right half of a desktop viewport empty, which is the
  // single thing that made this page read as a template.
  if (split) {
    return (
      <section id={id} className="mx-auto max-w-content scroll-mt-20 px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">{head}</div>
          <div className="min-w-0">{children}</div>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="mx-auto max-w-content scroll-mt-20 px-4 py-16">
      {head}
      <div className="mt-7">{children}</div>
    </section>
  );
}

/** A score bar. Width encodes the rate; colour encodes the band. Never rely on
 *  colour alone — the number is always printed beside it. */
export function Meter({ value, tone }: { value: number; tone?: "ok" | "warn" | "bad" }) {
  const band = tone ?? (value >= 0.85 ? "ok" : value >= 0.6 ? "warn" : "bad");
  const bg = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[band];
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10"
        role="img"
        aria-label={`${Math.round(value * 100)} percent`}
      >
        <div className={`h-full rounded-full ${bg}`} style={{ width: `${Math.max(value * 100, 1.5)}%` }} />
      </div>
      <span className="mono-nums w-10 shrink-0 text-right text-xs font-semibold">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export function RunCard({
  id, brief, passRate, cases, synthetic, iterations,
}: {
  id: string; brief: string; passRate: number | null; cases: number;
  synthetic: boolean; iterations: number;
}) {
  return (
    <div className="card group relative flex flex-col justify-between p-5 transition hover:border-accent-line hover:shadow-[0_4px_24px_-8px_rgba(99,102,241,0.18)]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <Link href={`/runs/${id}`} className="font-semibold tracking-tight hover:text-accent-text transition">
            {id.replace(/^_/, "").replace(/_/g, " ")}
          </Link>
          {synthetic ? <Pill tone="warn">fixture</Pill> : <Pill tone="accent">live run</Pill>}
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{brief}</p>
        <div className="mt-4">
          {passRate === null ? (
            <span className="text-xs text-warn">not scored — no eval pass completed</span>
          ) : (
            <Meter value={passRate} />
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted">
        <div className="flex gap-3">
          <span>{cases} cases</span>
          {iterations > 0 && (
            <span>{iterations} iter{iterations === 1 ? "" : "s"}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/chat/${id}`}
            className="rounded-full bg-accent-soft text-accent-text px-3 py-1 text-[11px] font-semibold hover:bg-accent-soft transition"
          >
            Chat Runner →
          </Link>
          <Link
            href={`/runs/${id}`}
            className="font-medium text-ink hover:text-accent-text transition"
          >
            Inspect →
          </Link>
        </div>
      </div>
    </div>
  );
}
