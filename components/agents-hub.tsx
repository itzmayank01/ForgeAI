"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AGENTS, AGENT_TEAMS, AUTHORS, CATEGORIES, builtMembers,
  type AgentItem, type AgentTeamItem, type CorpusId,
} from "@/lib/agents";
import {
  AgentIcon,
  IconArtifact,
  IconCross,
  IconSearch,
  IconUsers,
} from "@/components/icons";
import { BriefStudio } from "./brief-studio";
import { TeamBuilder } from "./team-builder";

/**
 * The gallery.
 *
 * Every control here does something real or is not here. In particular:
 *
 *   - an entry with no committed run cannot be "chatted" with. It used to
 *     return a canned paragraph after a 600ms setTimeout, which is a fake
 *     agent on a site arguing that fake results are the whole problem. Those
 *     entries are briefs now, and what you can do with a brief is pre-flight
 *     it or build it.
 *   - a team room routes by measurement. The previous Launch button looked up
 *     an agent named "Atlas" that the catalogue never contained, so every room
 *     silently opened a chat with whichever agent sat first in the array.
 *   - the category pills are derived from the agents present, so none of them
 *     can land on an empty gallery, and "Created by" is a filter rather than a
 *     caret that does nothing.
 */

interface RouterScore {
  agentId: string;
  runId: string;
  score: number;
  share: number;
  topFile: string | null;
}

interface Msg {
  role: "user" | "agent" | "system";
  text: string;
  citations?: string[];
  routing?: { winner: string | null; ambiguous: boolean; reason: string; scores: RouterScore[] };
}

export interface ArtifactGroup {
  runId: string;
  brief: string;
  passRate: number | null;
  files: { path: string; name: string; bytes: number; stage: string }[];
}

export interface AgentsHubProps {
  /** Committed brief per built run, so a card can never drift from what ran. */
  runBriefs?: Record<string, string>;
  artifacts?: ArtifactGroup[];
}

type Tab = "agents" | "teams" | "artifacts";

const fmtBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB`
  : n >= 1024 ? `${Math.round(n / 1024)} KB`
  : `${n} B`;

export function AgentsHub({ runBriefs = {}, artifacts = [] }: AgentsHubProps) {
  const seeded = useMemo(
    () => AGENTS.map((a) => (a.runId && runBriefs[a.runId]
      ? { ...a, brief: runBriefs[a.runId] }
      : a)),
    [runBriefs],
  );

  const [agents, setAgents] = useState<AgentItem[]>(seeded);
  const [teams, setTeams] = useState<AgentTeamItem[]>(AGENT_TEAMS);
  const [tab, setTab] = useState<Tab>("agents");
  const [category, setCategory] = useState("All");
  const [author, setAuthor] = useState("All");
  const [authorOpen, setAuthorOpen] = useState(false);
  const [query, setQuery] = useState("");

  const [composer, setComposer] = useState("");
  const [chip, setChip] = useState<AgentItem | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [studioOpen, setStudioOpen] = useState(false);
  const [teamBuilderOpen, setTeamBuilderOpen] = useState(false);

  const [chatAgent, setChatAgent] = useState<AgentItem | null>(null);
  const [room, setRoom] = useState<AgentTeamItem | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // A menu that only closes by clicking its own toggle is a menu that gets
  // left hanging over the gallery.
  const authorMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!authorOpen) return;
    function onDown(e: MouseEvent) {
      if (!authorMenuRef.current?.contains(e.target as Node)) setAuthorOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAuthorOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [authorOpen]);

  const authorList = useMemo(
    () => ["All", ...new Set(agents.map((a) => a.author))].filter(
      (a, i, xs) => xs.indexOf(a) === i),
    [agents],
  );

  const matches = (hay: string) => hay.toLowerCase().includes(query.trim().toLowerCase());

  const filteredAgents = useMemo(
    () => agents.filter((a) =>
      (category === "All" || a.category === category) &&
      (author === "All" || a.author === author) &&
      (query.trim() === "" ||
        matches(a.name) || matches(a.description) ||
        matches(a.category) || a.tags.some(matches))),
    [agents, category, author, query],
  );

  const filteredTeams = useMemo(
    () => teams.filter((t) =>
      (category === "All" || t.category === category) &&
      (query.trim() === "" ||
        matches(t.name) || matches(t.description) || t.tags.some(matches))),
    [teams, category, query],
  );

  function useAsBrief(agent: AgentItem) {
    setComposer(agent.brief);
    setChip(agent);
    setTab("agents");
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function openChat(agent: AgentItem) {
    setRoom(null);
    setChatAgent(agent);
    setInput("");
    setMsgs([{
      role: "system",
      text:
        `${agent.name} answers only from the ${agent.runId} corpus and cites the chunk ` +
        `each claim came from. Retrieval here is BM25; the committed scores were measured ` +
        `on the CLI with dense embeddings.`,
    }]);
  }

  function openRoom(team: AgentTeamItem) {
    setChatAgent(null);
    setRoom(team);
    setInput("");
    const built = builtMembers(team, agents);
    setMsgs([{
      role: "system",
      text: built.length === 0
        ? `No member of ${team.name} has been built, so this room can show you where a ` +
          `question would be routed but has no documents to answer from.`
        : `A question here is scored against the documents of ${built.length} built ` +
          `member${built.length === 1 ? "" : "s"} and handed to the best match. The routing ` +
          `table comes back with the answer.`,
    }]);
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);

    try {
      if (chatAgent?.runId) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: chatAgent.runId, question: q }),
        });
        const data = await res.json();
        setMsgs((m) => [...m, data.error
          ? { role: "system", text: data.error }
          : { role: "agent", text: data.answer || "(empty answer)", citations: data.citations }]);
      } else if (room) {
        const res = await fetch("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId: room.id,
            question: q,
            // Rooms assembled here are not in the server's catalogue, so the
            // roster travels with the request.
            memberAgentIds: room.members.map((m) => m.agentId),
          }),
        });
        const data = await res.json();
        if (data.error && !data.routing) {
          setMsgs((m) => [...m, { role: "system", text: data.error }]);
        } else if (!data.answered) {
          setMsgs((m) => [...m, {
            role: "system",
            text: data.message ?? data.error ?? "no answer",
            routing: data.routing,
          }]);
        } else {
          const who = agents.find((a) => a.id === data.agentId);
          setMsgs((m) => [...m, {
            role: "agent",
            text: `${who?.name ?? data.agentId} answered:\n\n${data.answer}`,
            citations: data.citations,
            routing: data.routing,
          }]);
        }
      }
    } catch (err) {
      setMsgs((m) => [...m, {
        role: "system",
        text: err instanceof Error ? err.message : "request failed",
      }]);
    } finally {
      setBusy(false);
    }
  }

  const drawerTitle = chatAgent?.name ?? room?.name ?? "";
  const drawerOpen = Boolean(chatAgent || room);

  return (
    <section id="agents-hub" className="scroll-mt-20">
      <div className="mx-auto max-w-content px-4 py-8">
        {/* ── tabs, search, create ─────────────────────────────────────── */}
        <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-7">
            {([["agents", "Agents"], ["teams", "Agent Teams"], ["artifacts", "Artifacts"]] as const)
              .map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`relative pb-3 text-base font-bold transition ${
                    tab === key ? "text-ink" : "text-muted hover:text-ink"}`}
                >
                  {label}
                  {tab === key && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald-600" />
                  )}
                </button>
              ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {tab !== "artifacts" && (
              <div className="relative min-w-[240px] sm:min-w-[280px]">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">
                  <IconSearch className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  aria-label={tab === "agents" ? "Search agents" : "Search agent teams"}
                  placeholder={tab === "agents" ? "Search agents…" : "Search agent teams…"}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-full border border-ink/10 bg-ink/[0.03] py-2 pl-9 pr-8 text-xs text-ink shadow-xs transition placeholder:text-muted focus:border-emerald-600 focus:bg-surface focus:outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute inset-y-0 right-3 flex items-center text-xs text-muted hover:text-ink"
                  >
                    <IconCross className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {tab === "agents" && (
              <button
                onClick={() => { setChip(null); setStudioOpen(true); }}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-[0.98]"
              >
                <span className="text-sm font-bold leading-none">+</span>
                Create My Own Agent
              </button>
            )}
            {tab === "teams" && (
              <button
                onClick={() => setTeamBuilderOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-[0.98]"
              >
                <span className="text-sm font-bold leading-none">+</span>
                Create My Own Agent Team
              </button>
            )}
          </div>
        </div>

        {/* ── composer ─────────────────────────────────────────────────── */}
        {tab === "agents" && (
          <div className="mt-5 rounded-2xl border bg-surface p-3.5 shadow-xs">
            <textarea
              ref={composerRef}
              rows={2}
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder="Describe the agent you want in one paragraph — what it must answer, from which documents, and what it must refuse."
              className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-ink placeholder:text-muted focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {chip && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-500/20">
                    <span className="grid h-4 w-4 place-items-center rounded-md bg-emerald-600/15 text-emerald-700 dark:text-emerald-400">
                      <AgentIcon name={chip.id} className="w-3 h-3" />
                    </span>
                    <span>{chip.name}</span>
                    <button
                      onClick={() => { setChip(null); setComposer(""); }}
                      aria-label={`Remove ${chip.name}`}
                      className="text-emerald-700/70 hover:text-emerald-900 dark:text-emerald-400/70 ml-0.5"
                    >
                      <IconCross className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {!chip && (
                  <span className="text-[11px] text-muted">
                    Or pick a brief below to load it here.
                  </span>
                )}
              </div>
              <button
                onClick={() => setStudioOpen(true)}
                disabled={!composer.trim()}
                className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40"
              >
                Create →
              </button>
            </div>
          </div>
        )}

        {/* ── category pills ───────────────────────────────────────────── */}
        {tab !== "artifacts" && (
          <div className="no-scrollbar mt-5 flex items-center gap-2 overflow-x-auto py-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  category === cat
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-ink/[0.04] text-muted hover:bg-ink/[0.08] hover:text-ink"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* ── created-by filter + count ────────────────────────────────── */}
        {tab !== "artifacts" && (
          <div className="mt-4 flex items-center justify-between text-xs text-muted">
            {tab === "agents" ? (
              <div ref={authorMenuRef} className="relative">
                <button
                  onClick={() => setAuthorOpen((o) => !o)}
                  aria-expanded={authorOpen}
                  className="flex items-center gap-1.5 font-medium transition hover:text-ink"
                >
                  <span>Created by:</span>
                  <span className="font-semibold text-ink">{author}</span>
                  <span className={`transition ${authorOpen ? "rotate-180" : ""}`}>▾</span>
                </button>
                {authorOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1.5 min-w-[180px] overflow-hidden rounded-xl border bg-surface py-1 shadow-lg">
                    {authorList.map((a) => (
                      <button
                        key={a}
                        onClick={() => { setAuthor(a); setAuthorOpen(false); }}
                        className={`block w-full px-3.5 py-1.5 text-left text-xs transition hover:bg-ink/[0.04] ${
                          a === author ? "font-semibold text-ink" : "text-muted"}`}
                      >
                        {a}
                        <span className="ml-1.5 text-[10px] text-muted">
                          {a === "All" ? agents.length : agents.filter((x) => x.author === a).length}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : <span />}
            <span>
              {tab === "agents" ? filteredAgents.length : filteredTeams.length} shown
            </span>
          </div>
        )}

        {/* ── agents ───────────────────────────────────────────────────── */}
        {tab === "agents" && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="group flex flex-col justify-between rounded-2xl border bg-surface p-4 shadow-sm transition hover:border-emerald-500/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start gap-3">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg shadow-sm ${agent.avatarBg}`}>
                      {agent.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[14px] font-bold tracking-tight text-ink">
                        {agent.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                        {agent.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {agent.tags.slice(0, 4).map((t) => (
                      <span key={t} className="rounded-md bg-ink/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate rounded-full bg-ink/[0.04] px-2 py-0.5 text-[10px] font-medium text-muted">
                      {agent.category}
                    </span>
                    {/* Driven by whether artifacts exist, never by a hand-set
                        label, so the gallery cannot overstate what was built. */}
                    {agent.runId ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {agent.badge ?? "Built"}
                      </span>
                    ) : (
                      <span
                        title="No committed run. Nothing was built and nothing was scored."
                        className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                      >
                        Brief only
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {agent.runId ? (
                      <>
                        <Link
                          href={`/runs/${agent.runId}`}
                          className="rounded-full bg-ink/[0.04] px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-ink/[0.08] hover:text-ink"
                          title="Open the run's committed artifacts"
                        >
                          Evidence
                        </Link>
                        <button
                          onClick={() => openChat(agent)}
                          className="rounded-full border px-4 py-1 text-[11.5px] font-semibold text-ink transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                        >
                          Chat
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => useAsBrief(agent)}
                        className="rounded-full border px-4 py-1 text-[11.5px] font-semibold text-ink transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                        title="Load this brief into the composer"
                      >
                        Use as brief
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── teams ────────────────────────────────────────────────────── */}
        {tab === "teams" && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {filteredTeams.map((team) => {
              const roster = team.members
                .map((m) => agents.find((a) => a.id === m.agentId))
                .filter((a): a is AgentItem => Boolean(a));
              const built = roster.filter((a) => a.runId).length;
              return (
                <div
                  key={team.id}
                  className="flex flex-col justify-between rounded-2xl border bg-surface p-5 shadow-sm transition hover:border-emerald-500/50 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        built > 0
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>
                        {team.badge}
                      </span>
                      <span className="font-mono text-[11px] text-muted">{team.category}</span>
                    </div>

                    <h3 className="mt-2.5 text-base font-bold tracking-tight text-ink">{team.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{team.description}</p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {team.tags.map((t) => (
                        <span key={t} className="rounded-md bg-ink/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted">
                          {t}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {roster.slice(0, 4).map((m) => (
                          <span
                            key={m.id}
                            title={`${m.name}${m.runId ? " · built" : " · brief"}`}
                            className={`grid h-8 w-8 place-items-center rounded-full border-2 border-surface text-sm ${m.avatarBg}`}
                          >
                            {m.avatar}
                          </span>
                        ))}
                        {roster.length > 4 && (
                          <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-surface bg-ink/[0.06] text-[10px] font-semibold text-muted">
                            +{roster.length - 4}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted">
                        {roster.length} member{roster.length === 1 ? "" : "s"} · {built} can answer
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2 border-t pt-3">
                    <span className="max-w-[210px] truncate text-[11px] text-muted">
                      📦 {team.outputArtifact}
                    </span>
                    <button
                      onClick={() => openRoom(team)}
                      className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      Open room
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── artifacts ────────────────────────────────────────────────── */}
        {tab === "artifacts" && (
          <div className="mt-6 space-y-5">
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              Every number this site shows comes from one of these files. They are what the
              factory wrote, committed in the repository under{" "}
              <code className="font-mono text-[12px]">runs/</code> — a stage that never ran has no
              file here rather than an empty placeholder.
            </p>
            {artifacts.length === 0 && (
              <div className="card p-8 text-center text-sm text-muted">
                No run artifacts are present in this checkout.
              </div>
            )}
            {artifacts.map((group) => {
              const stages = [...new Set(group.files.map((f) => f.stage))];
              const total = group.files.reduce((n, f) => n + f.bytes, 0);
              return (
                <div key={group.runId} className="rounded-2xl border bg-surface p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-mono text-sm font-bold text-ink">{group.runId}</h3>
                      <p className="mt-1 line-clamp-2 max-w-2xl text-xs leading-relaxed text-muted">
                        {group.brief}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {group.passRate !== null && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {Math.round(group.passRate * 100)}% final
                        </span>
                      )}
                      <Link
                        href={`/runs/${group.runId}`}
                        className="rounded-full border px-3 py-1 text-[11px] font-semibold text-muted transition hover:text-ink"
                      >
                        Inspect ↗
                      </Link>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                    <span>{group.files.length} files</span>
                    <span>·</span>
                    <span>{fmtBytes(total)}</span>
                    <span>·</span>
                    <span>{stages.length} stages present</span>
                  </div>

                  <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
                    {group.files.map((f) => (
                      <div
                        key={f.path}
                        className="flex items-center justify-between gap-3 rounded-lg bg-ink/[0.02] px-2.5 py-1.5"
                      >
                        <span className="min-w-0 truncate font-mono text-[11px] text-ink" title={f.path}>
                          {f.name}
                        </span>
                        <span className="mono-nums shrink-0 font-mono text-[10px] text-muted">
                          {fmtBytes(f.bytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── empty state ──────────────────────────────────────────────── */}
        {((tab === "agents" && filteredAgents.length === 0) ||
          (tab === "teams" && filteredTeams.length === 0)) && (
          <div className="card mt-6 p-8 text-center text-muted">
            <p className="text-sm font-semibold text-ink">Nothing matches that</p>
            <p className="mt-1 text-xs">Clear the search, or pick another category.</p>
            <button
              onClick={() => { setQuery(""); setCategory("All"); setAuthor("All"); }}
              className="mt-3 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* ── drawer ─────────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative flex h-full w-full max-w-lg flex-col border-l bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b bg-canvas/80 px-5 py-3.5 backdrop-blur">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base ${
                  chatAgent?.avatarBg ?? "bg-ink/[0.06] text-ink"}`}>
                  {chatAgent?.avatar ?? "👥"}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-ink">{drawerTitle}</h3>
                  <div className="text-[10px] text-muted">
                    {chatAgent
                      ? `${chatAgent.version} · grounded in ${chatAgent.runId}`
                      : `${builtMembers(room!, agents).length} of ${room!.members.length} members can answer`}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {chatAgent?.runId && (
                  <Link
                    href={`/chat/${chatAgent.runId}`}
                    className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:text-ink"
                  >
                    Full page ↗
                  </Link>
                )}
                <button
                  onClick={() => { setChatAgent(null); setRoom(null); }}
                  aria-label="Close"
                  className="rounded-full p-1 text-muted transition hover:bg-ink/5 hover:text-ink"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="scroll-slim flex-1 space-y-3.5 overflow-y-auto p-4">
              {msgs.map((m, i) => (
                <div key={i}>
                  {m.role === "system" ? (
                    <p className="rounded-xl bg-ink/[0.03] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-muted">
                      {m.text}
                    </p>
                  ) : (
                    <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                        m.role === "user"
                          ? "rounded-br-sm bg-emerald-600 text-white shadow-sm"
                          : "rounded-bl-sm border bg-ink/[0.04] text-ink"}`}>
                        {m.text}
                      </div>
                    </div>
                  )}

                  {m.routing && m.routing.scores.length > 0 && (
                    <div className="mt-1.5 rounded-xl border bg-ink/[0.02] p-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        Routing {m.routing.ambiguous && "· margin was thin"}
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {m.routing.scores.map((s) => {
                          const a = agents.find((x) => x.id === s.agentId);
                          return (
                            <div key={s.agentId} className="flex items-center gap-2 text-[10.5px]">
                              <span className="w-36 shrink-0 truncate text-muted">
                                {a?.avatar} {a?.name ?? s.agentId}
                              </span>
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
                                <span
                                  className={`block h-full rounded-full ${
                                    s.agentId === m.routing!.winner ? "bg-emerald-600" : "bg-ink/25"}`}
                                  style={{ width: `${Math.round(s.share * 100)}%` }}
                                />
                              </span>
                              <span className="mono-nums w-9 shrink-0 text-right font-mono text-muted">
                                {Math.round(s.share * 100)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.citations.map((c) => (
                        <span key={c} className="rounded-md bg-ink/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {busy && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="h-2 w-2 animate-ping rounded-full bg-emerald-600" />
                  {room ? "Routing, then retrieving…" : "Retrieving…"}
                </div>
              )}
            </div>

            {chatAgent && chatAgent.sampleQuestions.length > 0 && (
              <div className="border-t bg-ink/[0.015] px-4 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Try
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {chatAgent.sampleQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={busy}
                      onClick={() => send(q)}
                      className="rounded-lg border bg-surface px-2.5 py-1 text-left text-[11px] text-muted transition hover:border-emerald-500 hover:text-ink disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t bg-surface p-3">
              <form
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  aria-label="Message"
                  placeholder={room ? `Ask ${room.name}…` : `Ask ${drawerTitle}…`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={busy}
                  className="flex-1 rounded-full border bg-ink/[0.03] px-4 py-2 text-xs text-ink transition placeholder:text-muted focus:border-emerald-600 focus:bg-surface focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="rounded-full bg-emerald-600 p-2 text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <BriefStudio
        isOpen={studioOpen}
        initialBrief={composer}
        initialName={chip?.name ?? ""}
        initialCorpus={(chip?.corpusHint ?? "hr_policy_live") as CorpusId}
        onClose={() => setStudioOpen(false)}
        onBriefSaved={(a) => { setAgents((prev) => [a, ...prev]); setAuthor("All"); setCategory("All"); }}
      />

      <TeamBuilder
        isOpen={teamBuilderOpen}
        agents={agents}
        onClose={() => setTeamBuilderOpen(false)}
        onTeamCreated={(t) => { setTeams((prev) => [t, ...prev]); setCategory("All"); setQuery(""); }}
      />
    </section>
  );
}
