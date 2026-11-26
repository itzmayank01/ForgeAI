"use client";

import { useState } from "react";
import type { AgentItem, AgentTeamItem } from "@/lib/agents";

/**
 * Assemble a team room from agents that exist.
 *
 * A room is a roster plus a router, nothing more. Members are picked from the
 * gallery rather than typed in, so a team cannot reference an agent that is not
 * there -- the failure the previous hand-written rosters had, where every room
 * listed a member called "Atlas" that the catalogue never contained.
 *
 * The badge is computed from how many members were actually built, so a room
 * of briefs cannot present itself as a working one.
 */
export interface TeamBuilderProps {
  isOpen: boolean;
  agents: AgentItem[];
  onClose: () => void;
  onTeamCreated: (team: AgentTeamItem) => void;
}

export function TeamBuilder({ isOpen, agents, onClose, onTeamCreated }: TeamBuilderProps) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  if (!isOpen) return null;

  const builtCount = picked.filter((id) => agents.find((a) => a.id === id)?.runId).length;

  function toggle(id: string) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function create() {
    const members = picked
      .map((id) => agents.find((a) => a.id === id))
      .filter((a): a is AgentItem => Boolean(a));
    if (members.length === 0) return;

    onTeamCreated({
      id: `team-${Date.now()}`,
      name: name.trim() || "Untitled room",
      category: members[0].category,
      badge: `${builtCount} built member${builtCount === 1 ? "" : "s"}`,
      description:
        `Routes a question to whichever member's documents best match it. ` +
        (builtCount === 0
          ? "No member was built, so this room can route but cannot answer."
          : `${builtCount} of ${members.length} members can answer from committed documents.`),
      tags: [...new Set(members.flatMap((m) => m.tags))].slice(0, 4),
      members: members.map((m) => ({ agentId: m.id, role: m.description.slice(0, 60) })),
      outputArtifact:
        builtCount > 0
          ? "Routed answer with the member's own citations"
          : "Routing decision only — nothing here was built",
    });
    setName("");
    setPicked([]);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div>
            <h2 className="display text-xl font-bold tracking-tight">Create an agent team</h2>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted">
              Pick the members. A question put to the room is scored against every member&apos;s
              committed documents and handed to the best match — the routing table is shown with
              the answer, so you can see why it went where it did.
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

        <div className="scroll-slim flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label htmlFor="team-name" className="text-xs font-semibold text-ink">Room name</label>
            <input
              id="team-name"
              type="text"
              placeholder="Procurement desk"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-ink/[0.02] px-3.5 py-2 text-xs text-ink placeholder:text-muted focus:border-accent-line focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">Members</span>
              <span className="text-[11px] text-muted">
                {picked.length} picked · {builtCount} can answer
              </span>
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {agents.map((a) => {
                const on = picked.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                      on
                        ?"border-accent-line bg-accent-soft"
                        : "bg-ink/[0.02] hover:border-accent-line"
                    }`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm ${a.avatarBg}`}>
                      {a.avatar}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-semibold text-ink">{a.name}</span>
                      <span className="block text-[10px] text-muted">
                        {a.runId ? "built · can answer" : "brief · routes only"}
                      </span>
                    </span>
                    {on && <span className="text-xs text-accent-text">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {picked.length > 0 && builtCount === 0 && (
            <p className="rounded-xl border border-warn bg-warn-soft p-3 text-[11.5px] leading-relaxed text-warn-text dark:text-warn-text">
              None of these members was built, so this room will route a question and then tell you
              there is nothing behind it to answer from. That is allowed — it is just worth knowing
              before you open it.
            </p>
          )}
        </div>

        <div className="flex gap-2.5 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border py-2.5 text-xs font-semibold transition hover:bg-ink/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={picked.length === 0}
            className="flex-1 rounded-full bg-accent py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-accent disabled:opacity-50"
          >
            Create room
          </button>
        </div>
      </div>
    </div>
  );
}
