"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconCross,
  IconMicrophone,
  IconPaperclip,
  IconSparkles,
} from "@/components/icons";

interface ChatMessage {
  id: string;
  role: "agent" | "user";
  text: string;
  citation?: string;
  timestamp?: string;
}

const FORGE_EXCHANGES: ChatMessage[] = [
  {
    id: "m1",
    role: "agent",
    text: "Hi there. How can I assist you with company policies or vessel spares today?",
  },
  {
    id: "m2",
    role: "user",
    text: "Hi. Can I carry over unused annual leave into the next calendar year?",
  },
  {
    id: "m3",
    role: "agent",
    text: "Yes. Up to 5 days of unused annual leave can be carried over, provided written manager approval is submitted by December 15.",
    citation: "leave_policy.md · doc_01_c000",
  },
  {
    id: "m4",
    role: "user",
    text: "What is the maximum daily reimbursement for business travel meals?",
  },
  {
    id: "m5",
    role: "agent",
    text: "Daily subsistence allowance is strictly capped at $75/day with itemized tax receipts. Alcohol and unitemized claims are excluded.",
    citation: "travel_expenses.md · doc_02_c001",
  },
  {
    id: "m6",
    role: "user",
    text: "Do we have bronze impellers in Rotterdam for emergency dispatch?",
  },
  {
    id: "m7",
    role: "agent",
    text: "Yes. Impeller bronze 120mm is catalogued under SKU-BR-120 with 2 units available for priority dispatch from Rotterdam depot.",
    citation: "parts_catalog.csv · spares_03_c004",
  },
  {
    id: "m8",
    role: "user",
    text: "Can you provide the vesting schedule for executive stock options?",
  },
  {
    id: "m9",
    role: "agent",
    text: "Refusal: Executive stock options are not covered in the Shore Staff Policy handbook. Request out of groundable scope.",
    citation: "groundability_guard · refused",
  },
];

export function FloatingChatCard({
  className = "",
  standalone = true,
}: {
  className?: string;
  standalone?: boolean;
}) {
  const [input, setInput] = useState("");
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;

    setIsLiveMode(true);
    setLiveMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text: q },
    ]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "hr_policy_live", question: q }),
      });
      const data = await res.json();
      setLiveMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: "agent",
          text: data.answer || "(No grounded answer returned)",
          citation: data.citations?.[0] ?? "hr_policy_live · retrieval",
        },
      ]);
    } catch {
      setLiveMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "agent",
          text: "Request failed in local environment.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`relative mx-auto flex w-full max-w-[390px] flex-col overflow-hidden rounded-3xl border border-ink/10 bg-surface shadow-2xl transition hover:shadow-[0_24px_50px_-12px_rgba(5,150,105,0.18)] ${className}`}
    >
      {/* ── Top Header matching reference (← Title ✕) ── */}
      <div className="flex items-center justify-between border-b border-ink/10 bg-canvas/70 px-5 py-3.5 backdrop-blur-md">
        <Link
          href="/#agents-hub"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-ink/[0.05] hover:text-ink"
          title="Back to agents hub"
        >
          <IconArrowLeft className="h-4 w-4" />
        </Link>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-ink text-sm">
            <span>ForgeAI Assistant</span>
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          </div>
          <span className="text-[10px] text-muted">
            {isLiveMode ? "Interactive Session" : "Auto-streaming live queries"}
          </span>
        </div>

        {isLiveMode ? (
          <button
            onClick={() => {
              setIsLiveMode(false);
              setLiveMessages([]);
            }}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-ink/[0.05] hover:text-ink text-xs font-semibold"
            title="Reset to floating stream"
          >
            <IconCross className="h-4 w-4" />
          </button>
        ) : (
          <Link
            href="/chat/hr_policy_live"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-ink/[0.05] hover:text-ink"
            title="Open full runner"
          >
            <IconCross className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* ── Chat Messages Viewport (Floating Upward) ── */}
      <div
        className="relative h-[360px] overflow-hidden px-4 py-3"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
        }}
      >
        {isLiveMode ? (
          /* Live user interaction mode */
          <div className="flex h-full flex-col gap-3.5 overflow-y-auto pr-1">
            {liveMessages.map((msg) =>
              msg.role === "agent" ? (
                <div key={msg.id} className="flex items-start gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-white shadow-xs">
                    <IconSparkles className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="max-w-[82%] rounded-2xl rounded-tl-xs border border-indigo-500/20 bg-indigo-50/70 p-3 text-xs leading-relaxed text-ink dark:bg-emerald-950/40">
                    <p>{msg.text}</p>
                    {msg.citation && (
                      <span className="mt-1.5 inline-block rounded-md bg-indigo-100/80 px-1.5 py-0.5 font-mono text-[9.5px] text-indigo-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                        {msg.citation}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[82%] rounded-2xl rounded-tr-xs bg-ink/[0.05] p-3 text-xs leading-relaxed text-ink dark:bg-ink/[0.1]">
                    {msg.text}
                  </div>
                </div>
              )
            )}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="h-2 w-2 animate-ping rounded-full bg-indigo-600" />
                Retrieving from corpus…
              </div>
            )}
          </div>
        ) : (
          /* Smooth Continuous Floating Upward Animation */
          <div
            className="animate-float-upward flex flex-col gap-3.5 hover:cursor-pointer"
            title="Hover to pause floating text"
          >
            {/* We duplicate the conversation list to ensure a seamless infinite vertical loop */}
            {[...FORGE_EXCHANGES, ...FORGE_EXCHANGES].map((msg, idx) =>
              msg.role === "agent" ? (
                <div key={`${msg.id}-${idx}`} className="flex items-start gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-white shadow-xs">
                    <IconSparkles className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="max-w-[82%] rounded-2xl rounded-tl-xs border border-indigo-500/20 bg-indigo-50/70 p-3 text-xs leading-relaxed text-ink dark:bg-emerald-950/40">
                    <p>{msg.text}</p>
                    {msg.citation && (
                      <span className="mt-1.5 inline-block rounded-md bg-indigo-100/80 px-1.5 py-0.5 font-mono text-[9.5px] text-indigo-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                        {msg.citation}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div key={`${msg.id}-${idx}`} className="flex justify-end">
                  <div className="max-w-[82%] rounded-2xl rounded-tr-xs bg-ink/[0.05] p-3 text-xs leading-relaxed text-ink dark:bg-ink/[0.1]">
                    {msg.text}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Input Pill (Paperclip, Input, Mic) ── */}
      <div className="border-t border-ink/10 bg-canvas/40 p-3.5">
        <form
          onSubmit={handleSend}
          className="flex items-center justify-between gap-2 rounded-full border border-ink/10 bg-surface px-3.5 py-2 shadow-2xs transition focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/10"
        >
          {/* Paperclip icon */}
          <button
            type="button"
            className="text-muted transition hover:text-ink"
            title="Attach reference document"
          >
            <IconPaperclip className="h-4 w-4" />
          </button>

          {/* Interactive or skeleton text input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about policies, spares, evals…"
            className="flex-1 bg-transparent text-xs text-ink placeholder:text-muted focus:outline-none"
          />

          {/* Microphone icon */}
          <button
            type="button"
            className="text-muted transition hover:text-ink"
            title="Voice input"
          >
            <IconMicrophone className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted">
          <span>{isLiveMode ? "Press Enter to query" : "Hover chat to pause float"}</span>
          <Link
            href="/chat/hr_policy_live"
            className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Full Live Runner →
          </Link>
        </div>
      </div>
    </div>
  );
}
