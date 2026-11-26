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

const Mark = ({ d, box = "0 0 24 24" }: { d: string; box?: string }) => (
  <svg viewBox={box} fill="none" stroke="currentColor" strokeWidth={1.6}
       strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
    <path d={d} />
  </svg>
);

interface Tile {
  name: string;
  note: string;
  mark: React.ReactNode;
}

/** Hosts the code actually issues requests to. */
const CALLS: Tile[] = [
  {
    name: "Groq",
    note: "inference for the agent, eval generator and judge",
    mark: <Mark d="M12 3a9 9 0 109 9h-9z" />,
  },
  {
    name: "OpenAI-compatible",
    note: "any endpoint — provider is one environment variable",
    mark: <Mark d="M4 12h6m4 0h6M7 7l5 5-5 5M17 7l-5 5 5 5" />,
  },
  {
    name: "Open-Meteo",
    note: "the weather tool in the audited registry",
    mark: <Mark d="M7 18h9a4 4 0 000-8 6 6 0 00-11.3 2A3.5 3.5 0 005 18z" />,
  },
];

/** Where it runs. Not integrations, and not dressed up as any. */
const RUNS_ON: Tile[] = [
  { name: "Vercel", note: "hosts the site and its API routes", mark: <Mark d="M12 4l9 16H3z" /> },
  { name: "Next.js", note: "App Router, React server components", mark: <Mark d="M12 3a9 9 0 109 9 9 9 0 00-9-9zM9 15V9l6 8" /> },
  { name: "Python", note: "the factory CLI and its test suite", mark: <Mark d="M9 7h6M8 4h8v7H8a4 4 0 00-4 4v2M16 20H8v-7h8a4 4 0 004-4V7" /> },
  { name: "GitHub", note: "every run artifact is committed here", mark: <Mark d="M9 20c-4 1-4-2-6-3m12 3v-3.5a3 3 0 00-.9-2.4c2.9-.3 6-1.4 6-6.4a4.7 4.7 0 00-1.3-3.2 4.3 4.3 0 00-.1-3.3S17.5 1 14.5 3a12 12 0 00-6 0C5.5 1 4.4 1.2 4.4 1.2a4.3 4.3 0 00-.1 3.3A4.7 4.7 0 003 7.7c0 5 3.1 6.1 6 6.4a3 3 0 00-.9 2.3V20" /> },
];

function Tile({ t, dup = false }: { t: Tile; dup?: boolean }) {
  return (
    <li aria-hidden={dup || undefined} className="flex w-[15rem] shrink-0 items-center gap-3 rounded-2xl border bg-surface px-3.5 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-accent-line hover:shadow-md">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">
        {t.mark}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-bold tracking-tight text-ink">
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
