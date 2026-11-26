import { NextResponse } from "next/server";
import { AGENTS, AGENT_TEAMS } from "@/lib/agents";
import { loadChunks } from "@/lib/runs";
import { routeQuestion, type RouterCorpus } from "@/lib/router";
import { answerWithRun } from "@/lib/answer";

export const maxDuration = 30;

/**
 * Ask a team room.
 *
 * Two steps, both reportable. The router scores the question against every
 * member corpus that actually exists and says which member should take it;
 * that member then answers through exactly the same path as a direct chat.
 *
 * A team whose members were never built cannot answer. It says so and returns
 * the routing table anyway, because the routing is real even when the roster
 * is not.
 */
export async function POST(req: Request) {
  const { teamId, question, routeOnly, memberAgentIds } = (await req.json()) as {
    teamId?: string; question?: string; routeOnly?: boolean; memberAgentIds?: string[];
  };

  if (!teamId || !question?.trim()) {
    return NextResponse.json({ error: "teamId and question are required" }, { status: 400 });
  }

  // A room assembled in the browser exists only in that browser, so the
  // catalogue cannot hold it and the client sends its roster. Each id is still
  // resolved against the catalogue of agents, so a caller cannot name a run of
  // its own choosing -- only the agents the gallery already publishes.
  const catalogued = AGENT_TEAMS.find((t) => t.id === teamId);
  const roster = catalogued
    ? catalogued.members.map((m) => m.agentId)
    : (memberAgentIds ?? []);
  const teamName = catalogued?.name ?? "this room";

  if (!catalogued && roster.length === 0) {
    return NextResponse.json(
      { error: `no team ${teamId}, and no roster was sent with the request` },
      { status: 404 },
    );
  }

  const corpora: RouterCorpus[] = [];
  for (const agentId of roster) {
    const agent = AGENTS.find((a) => a.id === agentId);
    if (!agent?.runId) continue;
    const chunks = await loadChunks(agent.runId);
    if (chunks.length > 0) {
      corpora.push({ agentId: agent.id, runId: agent.runId, chunks });
    }
  }

  const decision = routeQuestion(question, corpora);

  // Routing is pure retrieval arithmetic and costs nothing, so a caller that
  // only wants to show WHERE a question would go -- the landing page does --
  // can have it without spending a model call or needing a key at all.
  if (routeOnly) {
    return NextResponse.json({ routing: decision, answered: false, routeOnly: true });
  }

  if (decision.reason === "no_built_members") {
    return NextResponse.json({
      routing: decision,
      answered: false,
      message:
        `Every member of ${teamName} is a brief, not a built agent. There are ` +
        `no documents behind this room, so there is nothing to answer from. ` +
        `Build a member first and the room will route to it.`,
    });
  }

  if (decision.winner === null) {
    return NextResponse.json({
      routing: decision,
      answered: false,
      message:
        `No member's documents share any term with that question, so the ` +
        `router has nothing to go on. It will not pick one at random.`,
    });
  }

  const winner = AGENTS.find((a) => a.id === decision.winner);
  const result = await answerWithRun(winner!.runId!, question);
  if (!result.ok) {
    return NextResponse.json(
      { routing: decision, answered: false, error: result.error },
      { status: result.status },
    );
  }

  const { ok, ...payload } = result;
  void ok;
  return NextResponse.json({ routing: decision, answered: true, agentId: winner!.id, ...payload });
}
