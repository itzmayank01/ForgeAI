/**
 * Official brand marks, and an honest fallback for the ones that have none.
 *
 * The four paths below are the real marks, copied from the simple-icons
 * package (3,472 icons, CC0) rather than redrawn by eye, with each brand's own
 * guidelines URL kept beside it. They are baked in rather than imported so the
 * site carries no extra dependency for four path strings.
 *
 * Simple Icons has NO mark for Groq and none for Open-Meteo, and inventing a
 * logo for a company is worse than showing none: it misrepresents a third
 * party on a page whose whole argument is that it does not invent things. So
 * those two get a wordmark tile instead, which is accurate and says what it is.
 *
 * The icon paths are CC0; the trademarks remain their owners'. Use here is
 * nominative -- naming the services this project actually calls and runs on.
 */

export interface BrandMark {
  title: string;
  /** The brand's own colour, used on hover only. */
  brand: string;
  guidelines: string;
  path: string;
}

export const BRAND_MARKS: Record<string, BrandMark> = {
  vercel: {
    title: "Vercel",
    brand: "#000000",
    guidelines: "https://vercel.com/geist/brands",
    path: "m12 1.608 12 20.784H0Z",
  },
  nextjs: {
    title: "Next.js",
    brand: "#000000",
    guidelines: "https://vercel.com/design/brands#next-js",
    path: "M18.665 21.978C16.758 23.255 14.465 24 12 24 5.377 24 0 18.623 0 12S5.377 0 12 0s12 5.377 12 12c0 3.583-1.574 6.801-4.067 9.001L9.219 7.2H7.2v9.596h1.615V9.251l9.85 12.727Zm-3.332-8.533 1.6 2.061V7.2h-1.6v6.245Z",
  },
  python: {
    title: "Python",
    brand: "#3776AB",
    guidelines: "https://www.python.org/community/logos/",
    path: "M11.858 0c-.978.005-1.913.088-2.736.234C6.7.662 6.26 1.558 6.26 3.21v2.182h5.725v.727H4.111c-1.664 0-3.121 1-3.577 2.903-.526 2.181-.549 3.542 0 5.82.407 1.694 1.379 2.902 3.043 2.902h1.969v-2.616c0-1.89 1.635-3.557 3.576-3.557h5.72c1.591 0 2.862-1.31 2.862-2.91v-5.45c0-1.553-1.309-2.718-2.863-2.977A18 18 0 0 0 11.858 0M8.762 1.755c.591 0 1.074.491 1.074 1.095 0 .601-.483 1.087-1.074 1.087A1.08 1.08 0 0 1 7.688 2.85c0-.604.48-1.095 1.074-1.095m9.656 4.364v2.543c0 1.971-1.671 3.63-3.577 3.63H9.122c-1.566 0-2.862 1.34-2.862 2.91v5.452c0 1.551 1.349 2.464 2.862 2.91 1.813.532 3.55.628 5.72 0 1.44-.418 2.862-1.258 2.862-2.91V18.47h-5.719v-.727h8.582c1.664 0 2.284-1.16 2.862-2.903.598-1.793.573-3.518 0-5.819-.41-1.656-1.196-2.903-2.862-2.903zm-3.216 13.807a1.08 1.08 0 0 1 1.074 1.088c0 .604-.48 1.094-1.074 1.094-.592 0-1.075-.49-1.075-1.094 0-.601.483-1.088 1.075-1.088",
  },
  github: {
    title: "GitHub",
    brand: "#181717",
    guidelines: "https://github.com/logos",
    path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  },
};

/** A real logo, monochrome by default and brand-coloured on hover. */
export function BrandLogo({ mark, className = "" }: { mark: BrandMark; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={mark.title}
      className={`h-[22px] w-[22px] fill-current ${className}`}
    >
      <path d={mark.path} />
    </svg>
  );
}

/**
 * For a service with no official mark available. A two-letter monogram is
 * plainly a placeholder, where a drawn swoosh would read as the real thing.
 */
export function Wordmark({ label }: { label: string }) {
  // Initials of each word, not the first two letters: "OpenAI-compatible" and
  // "Open-Meteo" both begin "Op", so the naive version gave them the same
  // monogram and the two tiles became indistinguishable at a glance.
  const words = label.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const initials = (
    words.length > 1 ? words.slice(0, 2).map((w) => w[0]).join("") : label.slice(0, 2)
  ).toUpperCase();
  return (
    <span
      aria-label={label}
      role="img"
      className="font-mono text-[12px] font-bold tracking-tight"
    >
      {initials}
    </span>
  );
}
