import type { ReactNode } from "react";

/**
 * The landscape section: a section heading and standfirst across the top, a
 * large tinted panel holding the artefact on the left, and three short headed
 * points down the right.
 *
 * It reads better than the alternating body-plus-tag-pills row for one
 * structural reason: three headed points are three claims a reader can check
 * one at a time, where a paragraph plus a row of pills is one claim and some
 * decoration. Each point here is a sentence the repository can answer for.
 *
 * The panel is tinted rather than white so the artefact inside it reads as a
 * specimen being shown rather than another card in the page's own stack, and
 * it carries a faint grid for the same reason a contact sheet does.
 */

export interface Point {
  title: string;
  body: string;
}

export function Landscape({
  eyebrow, title, standfirst, points, visual, tint = "mint", panelLabel,
}: {
  eyebrow?: string;
  title: string;
  standfirst?: string;
  points: Point[];
  visual: ReactNode;
  tint?: "mint" | "sky" | "slate";
  /** Small caption under the panel, e.g. the file the artefact comes from. */
  panelLabel?: string;
}) {
  const tints: Record<string, string> = {
    mint: "from-emerald-50 to-emerald-100/40 dark:from-emerald-950/40 dark:to-emerald-900/10",
    sky: "from-sky-50 to-indigo-100/40 dark:from-sky-950/40 dark:to-indigo-900/10",
    slate: "from-slate-100 to-slate-200/50 dark:from-slate-900/60 dark:to-slate-800/20",
  };

  return (
    <section className="mx-auto max-w-content px-4 py-14 sm:px-6 lg:py-20">
      <header className="max-w-2xl">
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            {eyebrow}
          </div>
        )}
        <h2 className="display mt-2.5 text-[clamp(1.7rem,3.4vw,2.6rem)] leading-[1.08]">
          {title}
        </h2>
        {standfirst && (
          <p className="mt-3.5 text-[15px] leading-relaxed text-muted">{standfirst}</p>
        )}
      </header>

      {/* minmax(0,…) rather than a bare fr: an fr track floors at its
          min-content width, so the code card's long unwrapped lines widen the
          left column and crush the points column to a few words per line.
          Flooring at 0 lets the pre scroll inside its own box instead. */}
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
        <div className="min-w-0">
          <div
            className={`relative min-w-0 overflow-hidden rounded-[22px] bg-gradient-to-br ${tints[tint]} p-5 sm:p-7`}
          >
            {/* A faint grid, so the panel reads as a surface rather than a
                block of colour. Pure decoration, hidden from assistive tech. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.5]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgb(var(--ink)/0.05) 1px, transparent 1px)," +
                  "linear-gradient(to bottom, rgb(var(--ink)/0.05) 1px, transparent 1px)",
                backgroundSize: "26px 26px",
              }}
            />
            <div className="relative min-w-0">{visual}</div>
          </div>
          {panelLabel && (
            <p className="mt-2.5 pl-1 font-mono text-[11px] text-muted">{panelLabel}</p>
          )}
        </div>

        <dl className="space-y-7 lg:pt-3">
          {points.map((p) => (
            <div key={p.title}>
              <dt className="text-[15px] font-bold tracking-tight text-ink">{p.title}</dt>
              <dd className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{p.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
