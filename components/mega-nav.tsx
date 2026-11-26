"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * The hover board: a wide mega-menu that opens under a nav item.
 *
 * Three things make this feel built rather than bolted on, and all three are
 * the parts people usually skip:
 *
 *   - A diagonal path. Moving the pointer from the trigger down-right to the
 *     far column leaves the trigger before it enters the panel. Closing on
 *     mouseleave therefore shuts the menu mid-journey. The panel is anchored
 *     to a wrapper that spans both, and closing is delayed, so the gap is
 *     survivable.
 *   - Keyboard. It opens on focus, closes on Escape and returns focus to the
 *     trigger, and every link is tabbable in reading order. A hover-only
 *     menu is unreachable for anyone not using a mouse.
 *   - Intent. Opening instantly means the board flashes at anyone whose
 *     pointer crosses the nav on the way somewhere else, so opening waits.
 *
 * Contents are the site's own sections. A mega-menu advertising pages that do
 * not exist is the navigational version of a fabricated metric.
 */

const OPEN_DELAY = 110;
const CLOSE_DELAY = 180;

export interface MegaItem {
  label: string;
  href: string;
  blurb: string;
  /**
   * A key, never a React element.
   *
   * Passing a prebuilt element from a server component across the RSC
   * boundary -- and reusing the same instance for several items, as any
   * shared icon is -- makes the client deserializer try to redefine
   * `_debugInfo` on an object it has already seen, and the page dies with
   * "Cannot redefine property". Keys serialize as strings and the client
   * builds a fresh element per use site.
   */
  icon: MarkKey;
  /** Shown as a small trailing chip, e.g. "2 built". Omit when there is none. */
  chip?: string;
}

export interface MegaColumn {
  heading: string;
  items: MegaItem[];
}

export interface MegaSection {
  label: string;
  columns: MegaColumn[];
  footer?: { prompt: string; label: string; href: string };
}

/* ── tiny inline marks, so this file has no cross-file dependency while the
      shared icon set is being edited ─────────────────────────────────────── */
const PATHS = {
  intake: "M8 6h8M8 11h8M8 16h5M5 3h14v18H5z",
  shield: "M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z",
  spark: "M12 4v16M4 12h16M7 7l10 10M17 7L7 17",
  flask: "M9 3v6l-5 9a2 2 0 002 3h12a2 2 0 002-3l-5-9V3M9 3h6",
  scale: "M12 4v16M6 8h12M4 14h4l-2-6zM16 14h4l-2-6z",
  loop: "M4 12a8 8 0 0114-5m2 5a8 8 0 01-14 5M18 4v3h-3M6 20v-3h3",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h7M10 17h5",
  route: "M6 4v6a4 4 0 004 4h8M18 10l3 4-3 4M6 4a2 2 0 100 4 2 2 0 000-4z",
  chat: "M4 5h16v10H9l-5 4z",
  users: "M3 20a5 5 0 0110 0M8 11a3 3 0 100-6 3 3 0 000 6M15 20a5 5 0 016-4.9M17 11a3 3 0 100-6",
  box: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9",
  pen: "M4 20l4-1 10-10-3-3L5 16zM14 6l3 3",
} as const;

export type MarkKey = keyof typeof PATHS;

/** A fresh element per call. Never hoist these into shared constants. */
function Mark({ name }: { name: MarkKey }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
         strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function MegaNav({ sections }: { sections: MegaSection[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});

  const clear = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  useEffect(() => clear, []);

  function hoverOpen(label: string) {
    clear();
    // Already showing a board: swap immediately, so sliding sideways along the
    // nav does not blink through a closed state.
    if (open) setOpen(label);
    else openTimer.current = setTimeout(() => setOpen(label), OPEN_DELAY);
  }
  function hoverClose() {
    clear();
    closeTimer.current = setTimeout(() => setOpen(null), CLOSE_DELAY);
  }
  function dismiss(label?: string) {
    clear();
    setOpen(null);
    if (label) triggers.current[label]?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(open); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative hidden md:block" onMouseLeave={hoverClose}>
      <div className="flex items-center gap-0.5">
        {sections.map((s) => {
          const active = open === s.label;
          return (
            <button
              key={s.label}
              ref={(el) => { triggers.current[s.label] = el; }}
              aria-expanded={active}
              aria-haspopup="true"
              onMouseEnter={() => hoverOpen(s.label)}
              onFocus={() => { clear(); setOpen(s.label); }}
              onClick={() => (active ? dismiss(s.label) : setOpen(s.label))}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                active ?"bg-ink/[0.05] text-ink" : "text-muted hover:bg-ink/[0.04] hover:text-ink"
              }`}
            >
              {s.label}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}
                   strokeLinecap="round" strokeLinejoin="round"
                   className={`h-3 w-3 transition-transform duration-200 ${active ?"rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          );
        })}
      </div>

      {sections.map((s) => {
        if (open !== s.label) return null;
        const cols = s.columns.length;
        return (
          <div
            key={s.label}
            // The wrapper starts at the trigger's baseline and carries the
            // padding, so the pointer never crosses dead space on its way in.
            className="absolute left-0 top-full z-50 pt-2"
            onMouseEnter={clear}
            onMouseLeave={hoverClose}
          >
            <div className="mega-board w-[min(92vw,56rem)] overflow-hidden rounded-2xl border bg-surface shadow-[0_24px_60px_-20px_rgba(15,23,27,0.25)]">
              <div
                className="grid gap-x-8 gap-y-6 p-6"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
              >
                {s.columns.map((col) => (
                  <div key={col.heading}>
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                      {col.heading}
                    </div>
                    <ul className="mt-3 space-y-0.5">
                      {col.items.map((item) => (
                        <li key={item.href + item.label}>
                          <Link
                            href={item.href}
                            onClick={() => dismiss()}
                            className="group flex items-start gap-2.5 rounded-xl p-2 transition hover:bg-ink/[0.04]"
                          >
                            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                              <Mark name={item.icon} />
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="text-[12.5px] font-semibold text-ink">{item.label}</span>
                                {item.chip && (
                                  <span className="rounded-full bg-ink/[0.05] px-1.5 py-px text-[9.5px] font-semibold text-muted">
                                    {item.chip}
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">
                                {item.blurb}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {s.footer && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t bg-ink/[0.02] px-6 py-3">
                  <span className="text-[12px] font-semibold text-ink">{s.footer.prompt}</span>
                  <Link
                    href={s.footer.href}
                    onClick={() => dismiss()}
                    className="text-[12px] font-medium text-accent underline-offset-4 hover:underline"
                  >
                    {s.footer.label}
                  </Link>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
