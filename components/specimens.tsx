"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Artefact specimens: the things a landscape panel holds.
 *
 * Shared between the homepage and the design preview so one implementation is
 * on screen in both places. Each reads from committed run data passed in by a
 * server component; neither holds a figure of its own.
 */

/* ── JSON highlighting ────────────────────────────────────────────────────
   A tiny tokenizer rather than a syntax-highlighting dependency. The input is
   always JSON.stringify output, so the grammar it has to survive is known and
   small: a key, a string, a number, a boolean, null, punctuation. A 60kB
   highlighter to colour nine lines would be the wrong trade.
   ───────────────────────────────────────────────────────────────────────── */
const TOKEN = /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\b-?\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;

function highlight(json: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(json)) !== null) {
    if (m.index > last) out.push(json.slice(last, m.index));
    const [text, key, str, num, lit] = m;
    const cls = key
      ? "text-[rgb(var(--accent-text))]"
      : str
        ? "text-[rgb(var(--ok-text))]"
        : num
          ? "text-[rgb(var(--warn-text))]"
          : lit
            ? "text-[rgb(var(--bad-text))]"
            : "";
    out.push(
      <span key={`${m.index}-${text.slice(0, 8)}`} className={cls}>
        {text}
      </span>,
    );
    last = m.index + text.length;
  }
  if (last < json.length) out.push(json.slice(last));
  return out;
}

export function DefinitionCard({ json }: { json: string }) {
  return (
    <div className="overflow-hidden rounded-xl bg-[#0c0d12] shadow-[0_24px_50px_-20px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 font-mono text-[11px] text-white/50">
          03_agent_def.final.json
        </span>
        <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[9.5px] text-white/45">
          committed
        </span>
      </div>
      {/*
        whitespace-pre-wrap with break-words, not overflow-x-auto: a horizontal
        scrollbar across the bottom of a specimen panel is the detail that made
        this read as an embedded widget rather than a printed sample, and
        nobody scrolls it sideways anyway.
      */}
      <pre className="max-h-[21rem] overflow-y-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-[1.8] text-white/70 scroll-slim">
        {highlight(json)}
      </pre>
    </div>
  );
}

export interface ScoredRun {
  id: string;
  rate: number;
  cases: number;
}

/**
 * Reveals on scroll, and animates only the reveal.
 *
 * The bar grows to the measured pass rate and the figure counts up to it; the
 * value itself is the committed one and the animation stops there. Nothing on
 * this card drifts, ticks or simulates live traffic, because there is no live
 * traffic -- a dashboard that invents movement is the same lie as a pass rate
 * that invents a number. Under prefers-reduced-motion it simply appears.
 */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (setShown(true), io.disconnect()),
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}

function Counter({ to, shown }: { to: number; shown: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!shown) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(to);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      // easeOutCubic: fast then settling, so it reads as arriving at a value
      // rather than sliding past it.
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, to]);
  return <>{n}</>;
}

export function ScoreCard({ runs }: { runs: ScoredRun[] }) {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <div ref={ref} className="rounded-xl border bg-surface p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-bold tracking-tight text-ink">Final pass rate</h3>
        <span className="font-mono text-[10.5px] text-muted">06_report.json</span>
      </div>

      <div className="mt-5 space-y-5">
        {runs.map((r, i) => (
          <div key={r.id}>
            <div className="flex items-baseline justify-between text-[11.5px]">
              <span className="font-mono text-muted">{r.id}</span>
              <span className="mono-nums text-[15px] font-bold text-ink">
                <Counter to={Math.round(r.rate * 100)} shown={shown} />%
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[rgb(var(--tint))]">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-out motion-reduce:transition-none"
                style={{
                  width: shown ? `${Math.round(r.rate * 100)}%` : "0%",
                  transitionDelay: `${i * 140}ms`,
                }}
              />
            </div>
            <div className="mt-1.5 text-[10.5px] text-muted">
              {r.cases} generated cases · every proposed fix measured and reverted
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
