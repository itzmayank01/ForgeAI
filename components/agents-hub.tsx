"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AGENTS, AGENT_TEAMS, CATEGORIES, type AgentItem, type AgentTeamItem } from "@/lib/agents";
import { CreateAgentModal } from "./create-agent-modal";

interface AgentsHubProps {
  initialRunIds?: string[];
}

export function AgentsHub({ initialRunIds = [] }: AgentsHubProps) {
  const [agents, setAgents] = useState<AgentItem[]>(AGENTS);
  const [activeTab, setActiveTab] = useState<"agents" | "teams">("agents");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [chattingAgent, setChattingAgent] = useState<AgentItem | null>(null);

  // Chat drawer state for inline conversations
  const [drawerMessages, setDrawerMessages] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const [drawerInput, setDrawerInput] = useState("");
  const [drawerBusy, setDrawerBusy] = useState(false);

  // Filter agents
  const filteredAgents = useMemo(() => {
    return agents.filter((a) => {
      const matchCat = selectedCategory === "All" || a.category === selectedCategory;
      const matchQuery =
        searchQuery.trim() === "" ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [agents, selectedCategory, searchQuery]);

  // Filter teams
  const filteredTeams = useMemo(() => {
    return AGENT_TEAMS.filter((t) => {
      const matchCat = selectedCategory === "All" || t.category === selectedCategory;
      const matchQuery =
        searchQuery.trim() === "" ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [selectedCategory, searchQuery]);

  function handleAgentCreated(newAgent: AgentItem) {
    setAgents((prev) => [newAgent, ...prev]);
    setSelectedCategory("All");
    openChat(newAgent);
  }

  function openChat(agent: AgentItem) {
    setChattingAgent(agent);
    setDrawerMessages([
      {
        role: "agent",
        text: `Hello! I am ${agent.name} (${agent.version ?? "v1.0"}). ${agent.description} What can I assist you with today?`,
      },
    ]);
    setDrawerInput("");
  }

  async function sendDrawerMessage(text: string) {
    if (!text.trim() || drawerBusy || !chattingAgent) return;

    const userText = text.trim();
    setDrawerMessages((prev) => [...prev, { role: "user", text: userText }]);
    setDrawerInput("");
    setDrawerBusy(true);

    // If it's a live run agent with an actual runId (e.g. hr_policy_live or ship_spares_live)
    if (chattingAgent.runId) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: chattingAgent.runId, question: userText }),
        });
        const data = await res.json();
        if (data.answer) {
          const citText =
            data.citations?.length > 0 ? `\n\n[Citations: ${data.citations.join(", ")}]` : "";
          setDrawerMessages((prev) => [
            ...prev,
            { role: "agent", text: `${data.answer}${citText}` },
          ]);
        } else {
          setDrawerMessages((prev) => [
            ...prev,
            { role: "agent", text: data.error ?? "Failed to retrieve answer." },
          ]);
        }
      } catch (e) {
        setDrawerMessages((prev) => [
          ...prev,
          { role: "agent", text: "Error communicating with retrieval engine." },
        ]);
      } finally {
        setDrawerBusy(false);
      }
      return;
    }

    // Specialized response generator for gallery agents
    setTimeout(() => {
      let reply = `Understood. Analyzing "${userText}" from the perspective of ${chattingAgent.name}...\n\n`;
      if (chattingAgent.category === "Engineering") {
        reply += `I have cross-checked the technical specifications and evaluation criteria. For this workflow, I recommend executing a deterministic audit, setting retrieval top_k to 8, and asserting strict bounds on hallucinations.`;
      } else if (chattingAgent.category === "Content Creation" || chattingAgent.category === "Design") {
        reply += `Here is a structured concept:\n1. Hook: Frame the challenge immediately.\n2. Core Delivery: Emphasize evidence, clean rhythm, and specialized modular agents.\n3. Call to Action: Guide the user into testing the autonomous pipeline.`;
      } else {
        reply += `Based on our domain guidelines, here are the grounded recommendations to address your query thoroughly while remaining within compliance limits.`;
      }
      setDrawerMessages((prev) => [...prev, { role: "agent", text: reply }]);
      setDrawerBusy(false);
    }, 600);
  }

  return (
    <section id="agents-hub" className="scroll-mt-20">
      <div className="mx-auto max-w-content px-4 py-8">
        {/* Top Header Row with Tabs, Search Bar and Create Button (Matching Image 2 & 3) */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5">
          {/* Left Tabs */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => setActiveTab("agents")}
              className={`relative pb-3 text-base font-bold transition ${
                activeTab === "agents"
                  ? "text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              Agents
              {activeTab === "agents" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("teams")}
              className={`relative pb-3 text-base font-bold transition ${
                activeTab === "teams"
                  ? "text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              Agent Teams
              {activeTab === "teams" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
              )}
            </button>
          </div>

          {/* Right Search Input & Green "+ Create My Own Agent" Button (Image 2) */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] sm:min-w-[280px]">
              <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-muted">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border bg-ink/[0.03] pl-9 pr-4 py-2 text-xs text-ink placeholder:text-muted focus:bg-surface focus:border-emerald-600 focus:outline-none transition shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-3 flex items-center text-xs text-muted hover:text-ink"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-5 py-2 text-xs font-semibold shadow-sm transition hover:scale-[1.02]"
            >
              <span className="text-sm font-bold leading-none">+</span>
              Create My Own Agent
            </button>
          </div>
        </div>

        {/* Categories Filter Pills Row (Horizontally Scrollable) */}
        <div className="mt-5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-2">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-ink/[0.04] text-muted hover:bg-ink/[0.08] hover:text-ink"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <span className="hidden sm:inline text-muted text-xs pl-2">›</span>
        </div>

        {/* Sub-Filter / Indicator */}
        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-1.5 font-medium">
            <span>Created by:</span>
            <span className="font-semibold text-ink">ForgeAI</span>
            <span>▾</span>
          </div>
          <span>
            {activeTab === "agents" ? filteredAgents.length : filteredTeams.length} available
          </span>
        </div>

        {/* ── 3-Column Grid of Agent Cards (Matching Image 3) ── */}
        {activeTab === "agents" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="group relative flex flex-col justify-between rounded-2xl border bg-surface p-4 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-start gap-3">
                    {/* Cute Pastel Circle Avatar */}
                    <div
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg shadow-sm ${agent.avatarBg}`}
                    >
                      {agent.avatar}
                    </div>

                    {/* Title & Description */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="truncate text-[14px] font-bold text-ink tracking-tight">
                          {agent.name}
                        </h3>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                        {agent.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer with badges and Chat pill button */}
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-ink/[0.04] px-2 py-0.5 text-[10px] font-medium text-muted">
                      {agent.category}
                    </span>
                    {/* Status is driven by whether committed artifacts exist,
                        never by a hand-set label. Only a run the factory
                        actually produced may claim to be tested; everything
                        else is marked a concept so the gallery cannot
                        overstate what was built. */}
                    {agent.runId ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {agent.badge ?? "Live tested"}
                      </span>
                    ) : (
                      <span
                        className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                        title="No committed run artifacts. This agent has not been produced or evaluated by the factory."
                      >
                        Concept — not built
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {agent.runId && (
                      <Link
                        href={`/chat/${agent.runId}`}
                        className="rounded-full bg-ink/[0.04] px-3 py-1 text-[11px] font-semibold text-muted hover:text-ink hover:bg-ink/[0.08] transition"
                        title="Open full page chat with document retrieval"
                      >
                        Full ↗
                      </Link>
                    )}
                    <button
                      onClick={() => openChat(agent)}
                      className="rounded-full border border-gray-300 dark:border-gray-700 px-4 py-1 text-[11.5px] font-semibold text-ink hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition"
                      title={agent.runId
                        ? "Chat grounded in this run's committed documents"
                        : "Ungrounded preview — no documents, no eval suite behind this agent"}
                    >
                      {agent.runId ? "Chat" : "Preview"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Agent Teams Grid */
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                className="flex flex-col justify-between rounded-2xl border bg-surface p-5 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                      {team.badge}
                    </span>
                    <span className="text-[11px] font-mono text-muted">{team.category}</span>
                  </div>

                  <h3 className="mt-2.5 text-base font-bold text-ink tracking-tight">{team.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{team.description}</p>

                  {/* Team Members */}
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Roster ({team.members.length} Agents)
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {team.members.map((m) => (
                        <div
                          key={m.name}
                          className="flex items-center gap-2 rounded-xl bg-ink/[0.025] px-2.5 py-1.5 text-xs"
                        >
                          <span className="text-base">{m.avatar}</span>
                          <div className="min-w-0">
                            <div className="font-semibold truncate text-[11.5px]">{m.name}</div>
                            <div className="text-[10px] text-muted truncate">{m.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t pt-3 text-xs">
                  <span className="text-[11px] text-muted truncate max-w-[220px]">
                    📦 {team.outputArtifact}
                  </span>
                  <button
                    onClick={() => {
                      const leadAgent = agents.find((a) => a.name.includes("Atlas")) || agents[0];
                      openChat(leadAgent);
                    }}
                    className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 text-xs font-semibold shadow-sm transition"
                  >
                    Launch Team Chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty Search Fallback */}
        {((activeTab === "agents" && filteredAgents.length === 0) ||
          (activeTab === "teams" && filteredTeams.length === 0)) && (
          <div className="card mt-6 p-8 text-center text-muted">
            <p className="text-sm font-semibold text-ink">No matching agents found</p>
            <p className="mt-1 text-xs">Try clearing your search query or selecting another category.</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
              className="mt-3 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Interactive Instant Chat Drawer / Modal ── */}
      {chattingAgent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative flex h-full w-full max-w-lg flex-col bg-surface shadow-2xl border-l">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b px-5 py-3.5 bg-canvas/80 backdrop-blur">
              <div className="flex items-center gap-3">
                <div
                  className={`grid h-9 w-9 place-items-center rounded-xl text-base ${chattingAgent.avatarBg}`}
                >
                  {chattingAgent.avatar}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">{chattingAgent.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-muted">
                    <span>{chattingAgent.version ?? "v1.0"}</span>
                    <span>•</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">Active</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {chattingAgent.runId && (
                  <Link
                    href={`/chat/${chattingAgent.runId}`}
                    className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-muted hover:text-ink transition"
                  >
                    Open Full Page ↗
                  </Link>
                )}
                <button
                  onClick={() => setChattingAgent(null)}
                  className="rounded-full p-1 text-muted hover:text-ink hover:bg-ink/5 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Drawer Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scroll-slim">
              {drawerMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-emerald-600 text-white rounded-br-sm shadow-sm"
                        : "bg-ink/[0.04] text-ink rounded-bl-sm border"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {drawerBusy && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
                  Generating verified response...
                </div>
              )}
            </div>

            {/* Suggestions */}
            {chattingAgent.sampleQuestions.length > 0 && (
              <div className="border-t bg-ink/[0.015] px-4 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Suggested Queries
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {chattingAgent.sampleQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={drawerBusy}
                      onClick={() => sendDrawerMessage(q)}
                      className="rounded-lg border bg-surface px-2.5 py-1 text-left text-[11px] text-muted hover:border-emerald-500 hover:text-ink transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Bar */}
            <div className="border-t p-3 bg-surface">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendDrawerMessage(drawerInput);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder={`Ask ${chattingAgent.name}...`}
                  value={drawerInput}
                  onChange={(e) => setDrawerInput(e.target.value)}
                  disabled={drawerBusy}
                  className="flex-1 rounded-full border bg-ink/[0.03] px-4 py-2 text-xs text-ink placeholder:text-muted focus:border-emerald-600 focus:bg-surface focus:outline-none transition"
                />
                <button
                  type="submit"
                  disabled={drawerBusy || !drawerInput.trim()}
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white p-2 transition shadow-sm"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* "+ Create My Own Agent" Modal */}
      <CreateAgentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAgentCreated={handleAgentCreated}
      />
    </section>
  );
}
