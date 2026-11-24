import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "ForgeAI — the agent that builds agents",
  description:
    "A factory that turns a one-paragraph brief and a folder of documents into a tested, self-improving retrieval agent — with the evidence to judge it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <header className="sticky top-0 z-40 border-b bg-canvas/80 backdrop-blur-md">
          <nav className="mx-auto flex max-w-content items-center gap-6 px-4 py-3.5">
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <span
                aria-hidden
                className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-[13px] font-bold text-white"
              >
                F
              </span>
              ForgeAI
            </Link>
            <div className="ml-auto flex items-center gap-1 text-sm text-muted">
              <Link href="/#runs" className="rounded-lg px-3 py-1.5 hover:bg-ink/5 hover:text-ink">
                Runs
              </Link>
              <Link href="/#how" className="rounded-lg px-3 py-1.5 hover:bg-ink/5 hover:text-ink">
                How it works
              </Link>
            </div>
          </nav>
        </header>
        {children}
        <footer className="mt-24 border-t">
          <div className="mx-auto max-w-content px-4 py-10 text-sm text-muted">
            <p className="max-w-2xl">
              ForgeAI builds the agent, writes its tests, judges the results, diagnoses the
              failures and fixes them — then reports what still does not work.
            </p>
            <p className="mt-3 text-xs">
              Every number on this site comes from a committed artifact in the repository.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
