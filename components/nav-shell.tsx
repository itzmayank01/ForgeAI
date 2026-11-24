"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);

  useEffect(() => {
    // Detect stored or preferred theme
    const stored = localStorage.getItem("forgeai-theme") as "light" | "dark" | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("forgeai-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left Slim Sidebar (Matching Image 3) ── */}
      <aside className="sticky top-0 hidden h-screen w-16 flex-col justify-between border-r bg-surface py-4 z-40 md:flex items-center">
        {/* Top Logo & Primary Nav Icons */}
        <div className="flex flex-col items-center gap-6">
          {/* Logo Hexagon */}
          <Link
            href="/"
            className="group relative grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white shadow-sm transition hover:scale-105"
            title="ForgeAI Home"
          >
            <span className="font-bold text-sm tracking-tighter">tp</span>
          </Link>

          {/* Navigation Items */}
          <nav className="flex flex-col items-center gap-3">
            <Link
              href="/#agents-hub"
              className={`grid h-10 w-10 place-items-center rounded-xl transition ${
                pathname === "/"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-bold"
                  : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
              title="Agents & Teams"
            >
              {/* Bot Icon */}
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="11" width="18" height="10" rx="2" strokeWidth={2} />
                <circle cx="12" cy="5" r="2" strokeWidth={2} />
                <path d="M12 7v4" strokeWidth={2} />
                <line x1="8" y1="16" x2="8" y2="16" strokeWidth={2} strokeLinecap="round" />
                <line x1="16" y1="16" x2="16" y2="16" strokeWidth={2} strokeLinecap="round" />
              </svg>
            </Link>

            <Link
              href="/chat/hr_policy_live"
              className={`grid h-10 w-10 place-items-center rounded-xl transition ${
                pathname.startsWith("/chat")
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-bold"
                  : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
              title="Interactive Chat Runner"
            >
              {/* Chat Bubble Icon */}
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </Link>

            <Link
              href="/#runs"
              className={`grid h-10 w-10 place-items-center rounded-xl transition ${
                pathname.startsWith("/runs")
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-bold"
                  : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
              title="Factory Runs & Pipelines"
            >
              {/* Sparkles / Pipeline Icon */}
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </Link>
          </nav>
        </div>

        {/* Bottom Utility Icons (Theme toggle, download, settings, sign in) */}
        <div className="flex flex-col items-center gap-3">
          {/* Theme Toggle (Moon / Sun) */}
          <button
            onClick={toggleTheme}
            className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-ink/5 hover:text-ink transition"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="5" strokeWidth={2} />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                />
              </svg>
            )}
          </button>

          {/* Export / Download Artifacts */}
          <Link
            href="/#runs"
            className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-ink/5 hover:text-ink transition"
            title="Download Run Artifacts"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </Link>

          {/* Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-ink/5 hover:text-ink transition"
            title="Settings & Models"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <circle cx="12" cy="12" r="3" strokeWidth={2} />
            </svg>
          </button>

          {/* User Sign In */}
          <button
            onClick={() => setIsUserOpen(true)}
            className="flex flex-col items-center gap-1 text-[9px] text-muted hover:text-ink transition"
          >
            <div className="grid h-8 w-8 place-items-center rounded-full bg-ink/10 text-xs font-semibold text-ink">
              👤
            </div>
            <span>Sign In</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header for Mobile & Desktop */}
        <header className="sticky top-0 z-30 border-b bg-canvas/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-content items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-ink">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-sm">
                  F
                </span>
                <span className="text-base">ForgeAI</span>
              </Link>
              <span className="hidden sm:inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Autonomous Factory
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 text-xs font-medium text-muted">
              <Link
                href="/#agents-hub"
                className="rounded-lg px-2.5 py-1.5 hover:bg-ink/5 hover:text-ink transition"
              >
                Discover Agents
              </Link>
              <Link
                href="/#runs"
                className="rounded-lg px-2.5 py-1.5 hover:bg-ink/5 hover:text-ink transition"
              >
                Live Runs
              </Link>
              <Link
                href="/#pipeline"
                className="rounded-lg px-2.5 py-1.5 hover:bg-ink/5 hover:text-ink transition"
              >
                The 7 Stages
              </Link>
              <Link
                href="/chat/hr_policy_live"
                className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold hover:bg-emerald-100 transition"
              >
                Live Chat Runner →
              </Link>
            </div>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="mt-20 border-t bg-ink/[0.015]">
          <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              ForgeAI — The agent that builds agents, tests them like a QA engineer, and ships with
              evidence.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/#runs" className="hover:text-ink">
                Demonstrations
              </Link>
              <Link href="/#pipeline" className="hover:text-ink">
                Harness Specification
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-ink"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-ink">Platform & Model Settings</h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-muted hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-muted">Primary Inference Model</label>
                <div className="mt-1 rounded-lg border bg-ink/[0.02] p-2 font-mono text-[11px]">
                  Groq Llama-3.3-70b-versatile / GPT-OSS
                </div>
              </div>
              <div>
                <label className="font-semibold text-muted">Semantic Embedding Engine</label>
                <div className="mt-1 rounded-lg border bg-ink/[0.02] p-2 font-mono text-[11px]">
                  BAAI/bge-small-en-v1.5 (dense) + BM25 (hosted fallback)
                </div>
              </div>
              <div>
                <label className="font-semibold text-muted">Judge Defense Protocols</label>
                <div className="mt-1 text-muted leading-relaxed">
                  Active position bias randomization, length suppression, and deterministic fact recall checks.
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 py-2 text-xs font-semibold text-white transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* User Sign In Modal */}
      {isUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border bg-surface p-6 shadow-2xl text-center space-y-4">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-800 text-xl font-bold dark:bg-emerald-950 dark:text-emerald-300">
              tp
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Welcome to ForgeAI</h3>
              <p className="mt-1 text-xs text-muted">
                Sign in to manage custom agents, export test reports, and orchestrate agent teams.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => setIsUserOpen(false)}
                className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-semibold text-white transition"
              >
                Continue as Guest Developer
              </button>
              <button
                onClick={() => setIsUserOpen(false)}
                className="w-full rounded-full border py-2 text-xs font-semibold hover:bg-ink/5 transition text-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
