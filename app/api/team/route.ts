import { NextResponse } from "next/server";
import { AGENTS, AGENT_TEAMS } from "@/lib/agents";
import { loadChunks } from "@/lib/runs";
import { routeQuestion, type RouterCorpus } from "@/lib/router";
import { answerWithRun } from "@/lib/answer";
import {
  MAX_QUESTION, clientKey, rateLimit, readJson, requestId, requireText,
} from "@/lib/api";
import { fail } from "@/lib/http";

export const maxDuration = 30;

const LIMIT = 20;
const WINDOW_MS = 60_000;
/** A roster is a handful of members, not an enumeration of the catalogue. */
const MAX_ROSTER = 8;

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
  const id = requestId();

  const parsed = await readJson<{
    teamId?: string; question?: string; routeOnly?: boolean; memberAgentIds?: string[];
  }>(req);
  if (!parsed.ok) return fail(parsed.code, parsed.error, 400, id);
  const { teamId, routeOnly, memberAgentIds } = parsed.body;

  // Routing is local arithmetic and costs no tokens, so it gets a looser
  // budget than a request that will reach the model.
  const gate = rateLimit(
    `team:${routeOnly ? "route" : "answer"}:${clientKey(req)}`,
    routeOnly ? 60 : LIMIT,
    WINDOW_MS,
  );
  if (!gate.ok) {
    return fail("rate_limited", `Too many requests; try again in ${gate.retryAfter}s.`,
      429, id, { retryAfter: gate.retryAfter });
  }

  const teamIdOk = requireText(teamId, "teamId", 120);
  if (!teamIdOk.ok) return fail(teamIdOk.code, teamIdOk.error, 400, id);

  const questionOk = requireText(parsed.body.question, "question", MAX_QUESTION);
  if (!questionOk.ok) return fail(questionOk.code, questionOk.error, 400, id);
  const question = questionOk.value;

  // A room assembled in the browser exists only in that browser, so the
  // catalogue cannot hold it and the client sends its roster. Each id is still
  // resolved against the catalogue of agents, so a caller cannot name a run of
  // its own choosing -- only the agents the gallery already publishes.
  const catalogued = AGENT_TEAMS.find((t) => t.id === teamIdOk.value);
  const roster = (
    catalogued ? catalogued.members.map((m) => m.agentId) : (memberAgentIds ?? [])
  )
    .filter((x): x is string => typeof x === "string")
    .slice(0, MAX_ROSTER);
  const teamName = catalogued?.name ?? "this room";

  if (!catalogued && roster.length === 0) {
    return NextResponse.json(
      { error: `no team ${teamIdOk.value}, and no roster was sent with the request`,
        code: "unknown_team", requestId: id },
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
      { routing: decision, answered: false, error: result.error,
        code: "upstream", requestId: id },
      { status: result.status },
    );
  }

  const { ok, ...payload } = result;
  void ok;
  return NextResponse.json({ routing: decision, answered: true, agentId: winner!.id, ...payload });
}
