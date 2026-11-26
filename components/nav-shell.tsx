"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MegaNav, type MegaSection } from "@/components/mega-nav";
import {
  IconCross,
  IconMoon,
  IconSettings,
  IconSparkles,
  IconSun,
  IconUser,
} from "@/components/icons";
import { FloatingChatCard } from "@/components/floating-chat";

export function NavShell({
  children, navSections = [],
}: {
  children: React.ReactNode;
  /**
   * Built in the layout, which is a server component and can read the run
   * artifacts, so the chips in the menu carry measured pass rates rather than
   * numbers typed into the nav.
   */
  navSections?: MegaSection[];
}) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("forgeai-theme") as "light" | "dark" | null;
    if (stored === "dark") {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      setTheme("light");
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("forgeai-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      {/* ── World-Class Top Navigation Bar ── */}
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-content items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="group flex items-center gap-2.5 font-bold tracking-tight text-ink"
              title="ForgeAI Home"
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-sm font-black text-white shadow-sm shadow-accent/25 transition group-hover:scale-105">
                F
              </span>
              <span className="text-base font-bold tracking-tight">ForgeAI</span>
            </Link>
            <span className="hidden sm:inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent-text dark:text-accent-text border border-accent-line">
              Autonomous Factory
            </span>
          </div>

          {/* Desktop navigation: hover boards, plus the one flat
              destination that is a page rather than a section. */}
          <nav className="hidden items-center gap-1 text-xs font-semibold text-muted md:flex">
            <MegaNav sections={navSections} />
            <Link
              href="/chat/hr_policy_live"
              className={`rounded-lg px-3 py-1.5 transition ${
                pathname.startsWith("/chat")
                  ? "bg-accent-soft font-bold text-accent-text  dark:text-accent-text"
                  : "text-muted hover:bg-ink/[0.04] hover:text-ink"
              }`}
            >
              Runner
            </Link>
          </nav>

          {/* Controls & CTA */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle (Moon / Sun) */}
            <button
              onClick={toggleTheme}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-ink/[0.05] hover:text-ink transition"
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <IconMoon className="h-4 w-4" />
              ) : (
                <IconSun className="h-4 w-4" />
              )}
            </button>

            {/* Platform Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-ink/[0.05] hover:text-ink transition"
              title="Platform Settings & Models"
              aria-label="Platform Settings"
            >
              <IconSettings className="h-4 w-4" />
            </button>

            {/* User Profile */}
            <button
              onClick={() => setIsUserOpen(true)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-ink/[0.05] hover:text-ink transition"
              title="Developer Workspace"
              aria-label="Developer Workspace"
            >
              <IconUser className="h-4 w-4" />
            </button>

            {/* Primary Action Button */}
            <Link
              href="/chat/hr_policy_live"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent active:scale-[0.98]"
            >
              <span>Live Chat Runner</span>
              <span className="text-[11px]">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">{children}</div>

      {/* Footer */}
      <footer className="mt-20 border-t border-ink/10 bg-ink/[0.015]">
        <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            ForgeAI — The autonomous factory that builds agents, generates evals honestly, and ships with evidence.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/#runs" className="hover:text-ink transition">
              Demonstrations
            </Link>
            <Link href="/#pipeline" className="hover:text-ink transition">
              Harness Specification
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink transition"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-ink">Platform &amp; Model Settings</h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-ink/[0.05] hover:text-ink transition"
                aria-label="Close"
              >
                <IconCross className="h-4 w-4" />
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
              className="w-full rounded-full bg-accent hover:bg-accent py-2 text-xs font-semibold text-white transition"
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
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-white text-xl font-black shadow-md shadow-accent/25">
              F
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Developer Workspace</h3>
              <p className="mt-1 text-xs text-muted">
                Manage custom agents, export test reports, and orchestrate agent teams with measured evaluation evidence.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => setIsUserOpen(false)}
                className="w-full rounded-full bg-accent hover:bg-accent py-2.5 text-xs font-semibold text-white transition"
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

      {/* ── Floating Upward Live Chat Widget (Corner Launcher) ── */}
      <div className="fixed bottom-5 right-5 z-40">
        {isWidgetOpen ? (
          <div className="relative animate-fadeIn">
            <div className="absolute -top-3 -right-2 z-50">
              <button
                onClick={() => setIsWidgetOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-full bg-ink text-white shadow-md hover:bg-ink/90 transition"
                title="Close floating widget"
              >
                <IconCross className="h-3.5 w-3.5" />
              </button>
            </div>
            <FloatingChatCard className="w-[360px] sm:w-[380px]" />
          </div>
        ) : (
          <button
            onClick={() => setIsWidgetOpen(true)}
            className="flex items-center gap-2 rounded-full bg-accent hover:bg-accent text-white px-4 py-2.5 text-xs font-semibold shadow-lg shadow-accent/30 transition hover:scale-105 active:scale-95"
            title="Open Live Floating Agent Chat"
          >
            <IconSparkles className="h-4 w-4 text-on-accent" />
            <span>Live Agent</span>
          </button>
        )}
      </div>
    </div>
  );
}
