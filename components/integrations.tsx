/**
 * The integrations strip.
 *
 * The pattern this borrows normally shows a wall of third-party logos, which
 * works because the product really does talk to all of them. ForgeAI makes
 * outbound calls to exactly two hosts -- api.groq.com and api.open-meteo.com
 * -- so a wall would be the same fabrication as a pass rate nobody measured,
 * in a nicer typeface.
 *
 * So the strip splits what the repository can evidence: the services it calls,
 * and the platform it runs on. The second group is not an integration and is
 * not presented as one. The closing line states the whole outbound surface,
 * which is a stronger thing to be able to say than a long logo row.
 */

import { BRAND_MARKS, BrandLogo, Wordmark } from "./brand-marks";

interface Tile {
  name: string;
  note: string;
  /** A real brand mark where one exists, a wordmark where none does. */
  markKey?: keyof typeof BRAND_MARKS;
}

/** Hosts the code actually issues requests to. */
const CALLS: Tile[] = [
  { name: "Groq", note: "inference for the agent, eval generator and judge" },
  { name: "OpenAI-compatible", note: "any endpoint — provider is one env var" },
  { name: "Open-Meteo", note: "the weather tool in the audited registry" },
];

/** Where it runs. Not integrations, and not dressed up as any. */
const RUNS_ON: Tile[] = [
  { name: "Vercel", note: "hosts the site and its API routes", markKey: "vercel" },
  { name: "Next.js", note: "App Router, React server components", markKey: "nextjs" },
  { name: "Python", note: "the factory CLI and its test suite", markKey: "python" },
  { name: "GitHub", note: "every run artifact is committed here", markKey: "github" },
];

function Tile({ t, dup = false }: { t: Tile; dup?: boolean }) {
  const mark = t.markKey ? BRAND_MARKS[t.markKey] : null;
  return (
    <li
      aria-hidden={dup || undefined}
      style={mark ? ({ "--brand": mark.brand } as React.CSSProperties) : undefined}
      className="group flex w-[16rem] shrink-0 items-center gap-3.5 rounded-2xl border bg-surface px-4 py-3.5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-accent-line hover:shadow-lg"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[rgb(var(--tint))] text-ink transition-colors duration-200 group-hover:text-[color:var(--brand,rgb(var(--accent)))]">
        {mark ? <BrandLogo mark={mark} /> : <Wordmark label={t.name} />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold tracking-tight text-ink">
          {t.name}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted">{t.note}</span>
      </span>
    </li>
  );
}

/**
 * A moving stack. The list is rendered twice and the track translates by
 * exactly -50%, which is what makes the loop seamless; the duplicate is
 * aria-hidden so a screen reader is not read the same four tiles twice.
 */
function Row({ tiles, dir = "left" }: { tiles: Tile[]; dir?: "left" | "right" }) {
  return (
    <div className="marquee mt-5">
      <ul className="marquee-track" data-dir={dir}>
        {tiles.map((t) => <Tile key={t.name} t={t} />)}
        {/* duplicate for the seamless loop; hidden from assistive tech */}
        {tiles.map((t) => (
          <Tile key={`${t.name}-dup`} t={t} dup />
        ))}
      </ul>
    </div>
  );
}

export function Integrations() {
  return (
    <section className="border-y bg-ink/[0.018]">
      <div className="mx-auto max-w-content px-4 py-16 sm:px-6">
        <h2 className="display mx-auto max-w-xl text-center text-[clamp(1.5rem,3vw,2.1rem)] leading-[1.12]">
          Two outbound calls,
          <br className="hidden sm:block" /> and a stack you already run
        </h2>

        <div className="mt-10">
          <div className="text-center text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            Services it calls
          </div>
          <Row tiles={CALLS} />
        </div>

        <div className="mt-9">
          <div className="text-center text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            Where it runs
          </div>
          <Row tiles={RUNS_ON} dir="right" />
        </div>

        <p className="mx-auto mt-9 max-w-2xl text-center text-[12.5px] leading-relaxed text-muted">
          That is the complete outbound surface:{" "}
          <code className="font-mono text-[12px] text-ink">api.groq.com</code> for inference and{" "}
          <code className="font-mono text-[12px] text-ink">api.open-meteo.com</code> for the one
          tool that needs the network. Point{" "}
          <code className="font-mono text-[12px] text-ink">FORGEAI_BASE_URL</code> elsewhere and the
          first one changes. Your documents are read from disk and never leave it.
        </p>
      </div>
    </section>
  );
}
