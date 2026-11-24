"use client";

import { useRef, useState } from "react";
import { Pill } from "@/components/ui";

interface Retrieved { chunk_id: string; filename: string; score: number; text?: string }
interface Turn {
  question: string;
  answer?: string;
  refused?: boolean;
  confidence?: number;
  citations?: string[];
  fabricated?: string[];
  retrieved?: Retrieved[];
  error?: string;
  pending?: boolean;
}

export function ChatClient({
  runId, suggestions,
}: { runId: string; suggestions: string[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setValue("");
    setTurns((t) => [...t, { question, pending: true }]);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, question }),
      });
      const data = await r.json();
      setTurns((t) =>
        t.map((turn, i) =>
          i === t.length - 1
            ? { question, ...(r.ok ? data : { error: data.error ?? `error ${r.status}` }) }
            : turn,
        ),
      );
    } catch (err) {
      setTurns((t) =>
        t.map((turn, i) =>
          i === t.length - 1
            ? { question, error: err instanceof Error ? err.message : "request failed" }
            : turn,
        ),
      );
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  return (
    <div className="mt-8">
      {turns.length === 0 && (
        <div className="card p-5">
          <div className="text-sm font-semibold">Try one of these</div>
          <p className="mt-1 text-xs text-muted">
            The first two should be answered from the documents. The last should be refused —
            refusing is correct behaviour, not failure.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={busy}
                className="rounded-lg border px-3 py-1.5 text-left text-xs hover:border-accent/50 hover:bg-accent/5 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {turns.map((t, i) => (
          <div key={i} className="space-y-2.5">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-canvas">
                {t.question}
              </div>
            </div>

            {t.pending && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                retrieving and answering…
              </div>
            )}

            {t.error && (
              <div className="card border-bad/30 bg-bad/[0.06] p-4 text-sm text-bad">{t.error}</div>
            )}

            {t.answer !== undefined && (
              <div className="card p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Pill tone={t.refused ? "warn" : "ok"}>{t.refused ? "refused" : "answered"}</Pill>
                  {typeof t.confidence === "number" && (
                    <span className="mono-nums text-xs text-muted">
                      confidence {t.confidence.toFixed(2)}
                    </span>
                  )}
                  {t.fabricated && t.fabricated.length > 0 && (
                    <Pill tone="bad">dropped {t.fabricated.length} fabricated citation(s)</Pill>
                  )}
                </div>

                <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.answer}</p>

                {t.citations && t.citations.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.citations.map((c) => (
                      <code key={c} className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] text-accent">
                        {c}
                      </code>
                    ))}
                  </div>
                )}

                {t.retrieved && t.retrieved.length > 0 && (
                  <details className="mt-3 border-t pt-3">
                    <summary className="cursor-pointer text-xs text-muted hover:text-ink">
                      retrieved {t.retrieved.length} chunk(s)
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {t.retrieved.map((r) => (
                        <li key={r.chunk_id} className="text-xs">
                          <span className="font-mono text-muted">
                            {r.chunk_id} · {r.filename} · {r.score}
                          </span>
                          {r.text && (
                            <p className="mt-0.5 line-clamp-3 leading-relaxed text-muted">{r.text}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(value); }}
        className="sticky bottom-4 mt-6 flex gap-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask the generated agent…"
          disabled={busy}
          className="flex-1 rounded-xl border bg-surface px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-accent/60 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
