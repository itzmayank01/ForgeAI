import type { ReactNode } from "react";

/**
 * Alternating feature row: numbered eyebrow, headline, body, pill tags on one
 * side and a product mockup on the other, flipping each row. A stack of
 * identical left-aligned blocks is what makes a page feel generated.
 */
export function Feature({
  n, eyebrow, title, body, tags, visual, flip = false, wash = "warm",
}: {
  n: string; eyebrow: string; title: string; body: string;
  tags: string[]; visual: ReactNode; flip?: boolean;
  wash?: "warm" | "cool" | "none";
}) {
  return (
    <section className="relative">
      {wash !== "none" && (
        <div className={`wash ${wash === "warm" ? "wash-warm" : "wash-cool"}`} aria-hidden />
      )}
      <div className="mx-auto grid max-w-content items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className={flip ? "lg:order-2" : ""}>
          <div className="flex items-center gap-3">
            <span className="mono-nums font-mono text-[13px] font-bold text-accent">{n}</span>
            <span className="h-px w-10 bg-ink/20" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">
              {eyebrow}
            </span>
          </div>

          <h2 className="display mt-5 text-[clamp(1.75rem,3.3vw,2.45rem)]">{title}</h2>
          <p className="lede mt-5 max-w-xl">{body}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-accent-soft px-3 py-1.5 text-[12px] font-medium text-accent"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className={flip ? "lg:order-1" : ""}>{visual}</div>
      </div>
    </section>
  );
}
