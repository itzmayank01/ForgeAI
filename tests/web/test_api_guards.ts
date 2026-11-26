/**
 * The API guards.
 *
 * These endpoints are public and spend a metered daily budget, so the
 * interesting cases are the hostile and the careless ones: an oversized body,
 * an unknown run id reaching the filesystem, a retry loop, a repeated question
 * re-billing the model.
 *
 * Run: npm run test:web
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_BODY_BYTES, MAX_QUESTION, rateLimit, readJson, requireOneOf, requireText,
  resetRateLimits, clientKey,
} from "../../lib/api.ts";
import { TTLCache, answerKey } from "../../lib/cache.ts";

const json = (body, headers = {}) =>
  new Request("http://x/api", { method: "POST", body, headers });

// ── body reading ─────────────────────────────────────────────────────────

test("a body over the ceiling is refused by declared length", async () => {
  const r = await readJson(json("{}", { "content-length": String(MAX_BODY_BYTES + 1) }));
  assert.equal(r.ok, false);
  assert.equal(r.code, "body_too_large");
});

test("a lying content-length does not get through", async () => {
  // The header says small, the body is not. Measuring what arrived is the
  // only check that holds.
  const big = JSON.stringify({ q: "x".repeat(MAX_BODY_BYTES + 100) });
  const r = await readJson(json(big, { "content-length": "10" }));
  assert.equal(r.ok, false);
  assert.equal(r.code, "body_too_large");
});

test("malformed JSON is a 400, not a crash", async () => {
  const r = await readJson(json("{not json"));
  assert.equal(r.ok, false);
  assert.equal(r.code, "bad_json");
});

test("a valid body parses", async () => {
  const r = await readJson(json(JSON.stringify({ a: 1 })));
  assert.equal(r.ok, true);
  assert.deepEqual(r.body, { a: 1 });
});

// ── field validation ─────────────────────────────────────────────────────

test("an empty or whitespace question is rejected", () => {
  for (const v of ["", "   ", null, undefined, 42]) {
    assert.equal(requireText(v, "question", MAX_QUESTION).ok, false);
  }
});

test("an over-long question is rejected with its actual length", () => {
  const r = requireText("x".repeat(MAX_QUESTION + 1), "question", MAX_QUESTION);
  assert.equal(r.ok, false);
  assert.equal(r.code, "field_too_long");
  assert.match(r.error, new RegExp(String(MAX_QUESTION + 1)));
});

test("a question is trimmed", () => {
  const r = requireText("  hello  ", "question", 100);
  assert.equal(r.ok, true);
  assert.equal(r.value, "hello");
});

test("an id outside the known set is refused, including traversal", () => {
  const allowed = ["hr_policy_live", "ship_spares_live"];
  for (const bad of ["../../etc/passwd", "hr_policy_live/../x", "", null, "unknown"]) {
    assert.equal(requireOneOf(bad, allowed, "runId").ok, false, `${bad} must not pass`);
  }
  assert.equal(requireOneOf("hr_policy_live", allowed, "runId").ok, true);
});

// ── rate limiting ────────────────────────────────────────────────────────

test("a caller is cut off after the limit and told when to retry", () => {
  resetRateLimits();
  const key = "test:caller";
  for (let i = 0; i < 5; i++) assert.equal(rateLimit(key, 5, 60_000).ok, true);
  const blocked = rateLimit(key, 5, 60_000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter > 0);
});

test("one caller's budget does not affect another's", () => {
  resetRateLimits();
  for (let i = 0; i < 5; i++) rateLimit("a", 5, 60_000);
  assert.equal(rateLimit("a", 5, 60_000).ok, false);
  assert.equal(rateLimit("b", 5, 60_000).ok, true);
});

test("the window expires", () => {
  resetRateLimits();
  rateLimit("c", 1, 1);
  const after = Date.now() + 5;
  while (Date.now() < after) { /* spin past the 1ms window */ }
  assert.equal(rateLimit("c", 1, 1).ok, true);
});

test("the caller key comes from the first forwarded address", () => {
  const r = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
  assert.equal(clientKey(r), "1.2.3.4");
  assert.equal(clientKey(new Request("http://x")), "unknown");
});

// ── cache ────────────────────────────────────────────────────────────────

test("the answer key includes the model, so a re-route is not served stale text", () => {
  const a = answerKey("hr_policy_live", "How much leave?", "openai/gpt-oss-20b");
  const b = answerKey("hr_policy_live", "How much leave?", "openai/gpt-oss-120b");
  assert.notEqual(a, b);
});

test("the answer key normalises whitespace and case but not meaning", () => {
  const m = "m";
  assert.equal(
    answerKey("r", "  How   much LEAVE? ", m),
    answerKey("r", "how much leave?", m),
  );
  assert.notEqual(answerKey("r", "how much leave?", m), answerKey("r", "how much pay?", m));
});

test("the cache expires entries", () => {
  const c = new TTLCache(10, 1);
  c.set("k", "v");
  const after = Date.now() + 5;
  while (Date.now() < after) { /* spin */ }
  assert.equal(c.get("k"), undefined);
});

test("the cache evicts least-recently-used beyond its ceiling", () => {
  const c = new TTLCache(2, 60_000);
  c.set("a", 1);
  c.set("b", 2);
  c.get("a");          // a is now the most recent
  c.set("c", 3);       // evicts b, not a
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("b"), undefined);
  assert.equal(c.get("c"), 3);
  assert.equal(c.size, 2);
});
