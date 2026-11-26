"use client";

import { useState } from "react";
import type { AgentItem, CorpusId } from "@/lib/agents";

/**
 * The brief studio: write a brief, see what a corpus would actually give an
 * agent built from it, and get the command that builds it for real.
 *
 * What this replaced matters. The previous "Create My Own Agent" stepped a
 * progress bar through the seven stage names on a setTimeout and then
 * announced a pass rate of `Math.floor(Math.random() * 8) + 82`, a
 * groundability of "0.82 cos" and a fix delta of "+18%" -- none of which were
 * computed from anything -- and filed the result in the gallery badged
 * "87% Verified". On a site whose entire argument is that it reports only what
 * it measured, that button was the one place it fabricated a measurement.
 *
 * The factory itself cannot run here: it needs the embedding model, an API key
 * and several minutes, none of which exist inside a Vercel function. So this
 * does the part that genuinely can run in the browser -- deterministic
 * retrieval against a committed corpus -- and hands over the command for the
 * rest, rather than pretending to have done it.
 */

interface Probe {
  clause: string;
  prohibition: boolean;
  score: number;
  topFile: string | null;
  topChunk: string | null;
  passage: string | null;
}

interface PreflightResponse {
  probes: Probe[];
  emptyClauses: number;
  corpusId: string;
  corpusChunks: number;
  corpusFiles: string[];
  mayClassify: boolean;
  calibration: {
    positives: { n: number; min: number; max: number };
    negatives: { n: number; min: number; max: number };
    overlapping_positives: number;
    separates: boolean;
  };
  error?: string;
}

const CORPORA: { id: CorpusId; label: string; blurb: string }[] = [
  {
    id: "hr_policy_live",
    label: "HR policy",
    blurb: "3 prose policy documents · 10 chunks",
  },
  {
    id: "ship_spares_live",
    label: "Ship spares",
    blurb: "a parts catalogue and 2 supplier agreements · 20 chunks",
  },
];

export interface BriefStudioProps {
  isOpen: boolean;
  initialBrief?: string;
  initialName?: string;
  initialCorpus?: CorpusId;
  onClose: () => void;
  onBriefSaved: (agent: AgentItem) => void;
}

export function BriefStudio({
  isOpen, initialBrief = "", initialName = "", initialCorpus = "hr_policy_live",
  onClose, onBriefSaved,
}: BriefStudioProps) {
  const [name, setName] = useState(initialName);
  const [brief, setBrief] = useState(initialBrief);
  const [corpus, setCorpus] = useState<CorpusId>(initialCorpus);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PreflightResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Re-seed when the composer opens this with different content.
  const [seed, setSeed] = useState(initialBrief);
  if (isOpen && initialBrief !== seed) {
    setSeed(initialBrief);
    setBrief(initialBrief);
    setName(initialName);
    setCorpus(initialCorpus);
    setResult(null);
    setError(null);
  }

  if (!isOpen) return null;

  async function runPreflight(e: React.FormEvent) {
    e.preventDefault();
    if (!brief.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, corpusId: corpus }),
      });
      const data = (await res.json()) as PreflightResponse;
      if (!res.ok) setError(data.error ?? `request failed (${res.status})`);
      else setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "request failed");
    } finally {
      setBusy(false);
    }
  }

  const command =
    `python -m forgeai build \\\n` +
    `  --brief ${JSON.stringify(brief.replace(/\s+/g, " ").trim() || "your brief here")} \\\n` +
    `  --docs ./demos/${corpus === "hr_policy_live" ? "hr_policy" : "ship_spares"} \\\n` +
    `  --out ./runs/my_agent --unattended`;

  function saveBrief() {
    onBriefSaved({
      id: `brief-${Date.now()}`,
      name: name.trim() || "Untitled brief",
      category: "Engineering",
      avatar: "📝",
      avatarBg: "bg-ink/[0.06] text-ink",
      description: brief.replace(/\s+/g, " ").slice(0, 130) + (brief.length > 130 ? "…" : ""),
      version: "draft",
      author: "You",
      tags: ["your-brief"],
      brief,
      corpusHint: corpus,
      sampleQuestions: [],
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              Deterministic · no model call
            </div>
            <h2 className="display mt-2 text-xl font-bold tracking-tight">Pre-flight a brief</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
              The factory needs the embedding model, a key and several minutes, so it cannot run
              in a web request. This runs the part that can: retrieval against a committed corpus,
              clause by clause, so you can read what an agent built from this brief would be
              handed — before you spend a build on it.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted transition hover:bg-ink/5 hover:text-ink"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="scroll-slim flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <form onSubmit={runPreflight} className="space-y-4">
            <div>
              <label htmlFor="brief-name" className="text-xs font-semibold text-ink">
                Name <span className="font-normal text-muted">(optional, for the gallery card)</span>
              </label>
              <input
                id="brief-name"
                type="text"
                placeholder="Shore staff HR advisor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border bg-ink/[0.02] px-3.5 py-2 text-xs text-ink placeholder:text-muted focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="brief-text" className="text-xs font-semibold text-ink">
                One-paragraph brief
              </label>
              <textarea
                id="brief-text"
                required
                rows={5}
                placeholder="I need an assistant that answers HR policy questions for shore staff — annual leave and carry-over, parental leave, travel expense reimbursement, and how to raise a grievance. It must never give legal advice."
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                className="mt-1.5 w-full rounded-xl border bg-ink/[0.02] p-3 text-xs leading-relaxed text-ink placeholder:text-muted focus:border-emerald-600 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-muted">
                Clauses are split on sentences, dashes and long comma lists — the same shape the
                intake stage reads.
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold text-ink">Probe against</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {CORPORA.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCorpus(c.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      corpus === c.id
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30"
                        : "bg-ink/[0.02] hover:border-emerald-400"
                    }`}
                  >
                    <div className="text-xs font-semibold text-ink">{c.label}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{c.blurb}</div>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                Only corpora committed in this repository can be probed. Uploading your own
                documents is a build, and a build runs on the CLI.
              </p>
            </div>

            <button
              type="submit"
              disabled={busy || !brief.trim()}
              className="w-full rounded-full bg-emerald-600 py-3 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Retrieving…" : "Run pre-flight →"}
            </button>
          </form>

          {error && (
            <div className="rounded-xl border border-bad/40 bg-bad/[0.06] p-3 text-xs text-ink">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-ink/[0.02] p-3.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  There is no pass or fail here, and that is a measurement
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                  A supported / unsupported badge was calibrated against these very corpora and
                  rejected: {result.calibration.overlapping_positives} of{" "}
                  {result.calibration.positives.n} topics known to be covered scored at or below
                  the highest-scoring topic known to be absent. A must-refuse topic is written in
                  the documents&apos; own vocabulary, so lexical overlap is highest exactly where
                  support is missing. Read the passage instead — it is the one the agent would get.
                </p>
                <div className="mono-nums mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-muted">
                  <span>covered n={result.calibration.positives.n} [{result.calibration.positives.min}–{result.calibration.positives.max}]</span>
                  <span>absent n={result.calibration.negatives.n} [{result.calibration.negatives.min}–{result.calibration.negatives.max}]</span>
                  <span>data/preflight-calibration.json</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                <span className="font-semibold text-ink">{result.probes.length} clauses</span>
                <span>·</span>
                <span>{result.corpusChunks} chunks in {result.corpusFiles.length} files</span>
                {result.emptyClauses > 0 && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      {result.emptyClauses} clause{result.emptyClauses === 1 ? "" : "s"} retrieved nothing
                    </span>
                  </>
                )}
              </div>

              <ul className="space-y-2.5">
                {result.probes.map((p, i) => (
                  <li key={i} className="rounded-xl border bg-surface p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-ink">{p.clause}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {p.prohibition && (
                            <span className="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[10px] font-medium text-muted">
                              prohibition
                            </span>
                          )}
                          {p.topFile ? (
                            <span className="rounded-full bg-ink/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted">
                              {p.topFile}
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              nothing retrieved
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="mono-nums shrink-0 font-mono text-[11px] text-muted">
                        {p.score.toFixed(3)}
                      </span>
                    </div>
                    {p.passage && (
                      <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink/[0.02] p-2.5 text-[11px] leading-relaxed text-muted">
                        {p.passage}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              <div className="rounded-xl border bg-ink/[0.02] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Build it for real
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(command.replace(/\\\n\s+/g, " "));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    }}
                    className="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold text-muted transition hover:text-ink"
                  >
                    {copied ? "copied" : "copy"}
                  </button>
                </div>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-ink/[0.04] p-2.5 font-mono text-[10.5px] leading-relaxed text-ink">
{command}
                </pre>
                <p className="mt-1.5 text-[11px] text-muted">
                  Point <code className="font-mono">--docs</code> at your own folder to build on
                  your own documents. The run writes its artifacts under{" "}
                  <code className="font-mono">runs/</code> and this site reads them from there.
                </p>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-full border py-2.5 text-xs font-semibold transition hover:bg-ink/5"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={saveBrief}
                  className="flex-1 rounded-full bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-700"
                >
                  Keep this brief in the gallery
                </button>
              </div>
              <p className="text-center text-[11px] text-muted">
                It will be filed as a brief. Nothing was built and nothing was scored, so it gets
                no badge and no pass rate.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
