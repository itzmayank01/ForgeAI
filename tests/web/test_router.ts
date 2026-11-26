/**
 * The team router, the pre-flight and the citation resolver.
 *
 * Run: node --test tests/web/
 *
 * These are the three pieces of hosted logic that can be wrong without
 * anything looking wrong: a router that silently always picks the first
 * member, a pre-flight that grows a verdict its calibration does not support,
 * and a citation resolver that lets an invented id through as a real source.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { bm25 } from "../../lib/bm25.ts";
import { routeQuestion, AMBIGUOUS_MARGIN } from "../../lib/router.ts";
import { splitTopics, probeTopics, MAY_CLASSIFY, CALIBRATION } from "../../lib/preflight.ts";
import { resolveCitations } from "../../lib/answer.ts";
import { AGENTS, AGENT_TEAMS, CATEGORIES, builtMembers } from "../../lib/agents.ts";

const root = join(import.meta.dirname, "..", "..", "data", "runs");
const corpus = (id) => JSON.parse(readFileSync(join(root, id, "web", "chunks.json"), "utf8")).chunks;

const HR = { agentId: "hr_policy_live", runId: "hr_policy_live", chunks: corpus("hr_policy_live") };
const SP = { agentId: "ship_spares_live", runId: "ship_spares_live", chunks: corpus("ship_spares_live") };
const BOTH = [HR, SP];

// ── router ───────────────────────────────────────────────────────────────

test("routes a leave question to the HR corpus", () => {
  const d = routeQuestion("How much annual leave can I carry over to next year?", BOTH);
  assert.equal(d.reason, "routed");
  assert.equal(d.winner, "hr_policy_live");
});

test("routes a parts question to the spares corpus", () => {
  const d = routeQuestion("What is the lead time for the fuel injector part?", BOTH);
  assert.equal(d.reason, "routed");
  assert.equal(d.winner, "ship_spares_live");
});

test("router order does not decide the winner", () => {
  // The bug this replaces picked whichever member came first in the array.
  const forward = routeQuestion("grievance procedure against my manager", BOTH);
  const reversed = routeQuestion("grievance procedure against my manager", [SP, HR]);
  assert.equal(forward.winner, reversed.winner);
  assert.equal(forward.winner, "hr_policy_live");
});

test("a question sharing no term with any corpus routes nowhere", () => {
  const d = routeQuestion("zzzqqq flibbertigibbet wuggleplonk", BOTH);
  assert.equal(d.reason, "no_lexical_overlap");
  assert.equal(d.winner, null);
});

test("a team with no built member is reported, not guessed at", () => {
  const d = routeQuestion("anything at all", []);
  assert.equal(d.reason, "no_built_members");
  assert.equal(d.winner, null);
});

test("shares sum to one and the winner holds the largest", () => {
  const d = routeQuestion("What does the supplier agreement say about warranty?", BOTH);
  const total = d.scores.reduce((n, s) => n + s.share, 0);
  assert.ok(Math.abs(total - 1) < 0.01, `shares sum to ${total}`);
  assert.equal(d.scores[0].agentId, d.winner);
});

test("a thin margin is flagged rather than presented as a confident pick", () => {
  const d = routeQuestion("What are the payment terms and the expense limits?", BOTH);
  if (d.reason === "routed" && d.scores.length > 1) {
    const gap = d.scores[0].share - d.scores[1].share;
    assert.equal(d.ambiguous, gap < AMBIGUOUS_MARGIN);
  }
});

test("pooled scoring is what makes corpora comparable", () => {
  // Normalised per corpus, the best chunk of every corpus ties at 1.0 and the
  // router cannot tell them apart. This is the regression that guards it.
  const perCorpus = bm25("annual leave carry over", HR.chunks, 1)[0].score;
  const pooled = bm25("annual leave carry over", HR.chunks, 1, 1.5, 0.75, false)[0].score;
  assert.equal(perCorpus, 1);
  assert.notEqual(pooled, 1);
});

// ── pre-flight ───────────────────────────────────────────────────────────

test("the brief's dash-list becomes separate clauses", () => {
  const clauses = splitTopics(
    "I need an assistant that answers HR policy questions for shore staff - annual " +
    "leave and carry-over, parental leave, travel expense reimbursement, and how to " +
    "raise a grievance. It must never give legal advice.",
  );
  assert.ok(clauses.length >= 5, `got ${clauses.length}: ${JSON.stringify(clauses)}`);
  assert.ok(clauses.some((c) => /parental leave/i.test(c)));
  assert.ok(clauses.some((c) => /legal advice/i.test(c)));
});

test("an empty or wordless brief yields no clauses", () => {
  assert.deepEqual(splitTopics(""), []);
  assert.deepEqual(splitTopics("   .  "), []);
});

test("prohibitions are detected deterministically", () => {
  const r = probeTopics(
    ["annual leave entitlement", "it must never give legal advice"],
    HR.chunks,
  );
  assert.equal(r.probes[0].prohibition, false);
  assert.equal(r.probes[1].prohibition, true);
});

test("the pre-flight returns a passage to read, not a verdict", () => {
  const r = probeTopics(["how do I raise a grievance"], HR.chunks);
  assert.equal(r.classified, false);
  assert.ok(r.probes[0].passage && r.probes[0].passage.length > 0);
  assert.ok(r.probes[0].topFile);
  // The calibration says the score does not separate covered from absent, so
  // no verdict field may exist on the result at all.
  assert.ok(!("support" in r.probes[0]));
  assert.ok(!("verdict" in r.probes[0]));
});

test("the classification gate is driven by the committed calibration", () => {
  assert.equal(MAY_CLASSIFY, CALIBRATION.separates);
  // It does not separate today, and the UI must not claim otherwise.
  assert.equal(CALIBRATION.separates, false);
  assert.ok(CALIBRATION.overlapping_positives > 0);
});

test("a clause with no lexical match retrieves nothing", () => {
  const r = probeTopics(["zzzqqq flibbertigibbet"], HR.chunks);
  assert.equal(r.probes[0].passage, null);
  assert.equal(r.probes[0].score, 0);
  assert.equal(r.emptyClauses, 1);
});

// ── citations ────────────────────────────────────────────────────────────

const IDS = ["doc_00_c000", "doc_01_c001", "doc_02_c002"];

test("a source number resolves to the chunk at that position", () => {
  assert.deepEqual(resolveCitations(["2"], IDS).citations, ["doc_01_c001"]);
  assert.deepEqual(resolveCitations(["[3]"], IDS).citations, ["doc_02_c002"]);
});

test("an out-of-range number is fabricated, not clamped", () => {
  const r = resolveCitations(["9"], IDS);
  assert.deepEqual(r.citations, []);
  assert.deepEqual(r.fabricated, ["9"]);
});

test("a correctly copied chunk id is honoured", () => {
  assert.deepEqual(resolveCitations(["doc_01_c001"], IDS).citations, ["doc_01_c001"]);
});

test("an invented id is reported rather than repaired", () => {
  const r = resolveCitations(["doc_07_c999"], IDS);
  assert.deepEqual(r.citations, []);
  assert.deepEqual(r.fabricated, ["doc_07_c999"]);
});

test("duplicate citations collapse", () => {
  assert.deepEqual(resolveCitations(["1", "1", "doc_00_c000"], IDS).citations, ["doc_00_c000"]);
});

// ── catalogue invariants ─────────────────────────────────────────────────

test("every team member refers to an agent that exists", () => {
  for (const team of AGENT_TEAMS) {
    for (const m of team.members) {
      assert.ok(
        AGENTS.some((a) => a.id === m.agentId),
        `team ${team.id} references missing agent ${m.agentId}`,
      );
    }
  }
});

test("a team's badge matches how many members were really built", () => {
  for (const team of AGENT_TEAMS) {
    const n = builtMembers(team, AGENTS).length;
    assert.ok(
      team.badge.startsWith(String(n)),
      `team ${team.id} claims "${team.badge}" but ${n} member(s) were built`,
    );
  }
});

test("no category filter can be empty", () => {
  for (const cat of CATEGORIES) {
    if (cat === "All") continue;
    assert.ok(
      AGENTS.some((a) => a.category === cat),
      `category "${cat}" has no agents and would show an empty gallery`,
    );
  }
});

test("only an agent with a runId may claim to have been built", () => {
  for (const a of AGENTS) {
    if (!a.runId) {
      assert.ok(
        !/built|scored|verified|tested|%/i.test(a.badge ?? ""),
        `${a.id} has no run but its badge claims "${a.badge}"`,
      );
    }
  }
});

test("every brief-only entry carries a brief the factory could be given", () => {
  for (const a of AGENTS) {
    if (a.runId) continue;
    assert.ok(a.brief.length > 120, `${a.id} has no usable brief`);
    assert.ok(a.tags.length > 0, `${a.id} has no tags`);
  }
});
