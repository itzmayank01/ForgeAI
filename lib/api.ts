/**
 * Shared guards for the public API routes.
 *
 * These endpoints sit on a public URL and spend a metered daily token budget,
 * which makes them the one part of this project where an unbounded input is
 * not merely untidy. Before this, a request could carry a megabyte of text,
 * every repeat re-billed the model, and a hung upstream call held the whole
 * 30-second function until Vercel killed it.
 */

/** Longest question we will embed in a prompt. */
export const MAX_QUESTION = 2_000;
/** Longest brief the pre-flight will split. */
export const MAX_BRIEF = 8_000;
/** Longest body we will read at all, before parsing. */
export const MAX_BODY_BYTES = 32_000;

export interface Failure {
  error: string;
  code: string;
  requestId: string;
}

/**
 * This module stays free of `next/server` on purpose: it holds the logic worth
 * testing — limits, validation, the rate-limit window — and importing
 * NextResponse here would make it unloadable outside a Next runtime, so the
 * guards could only be exercised through a running server. The response
 * helper lives in lib/http.ts instead.
 */

export function requestId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Read and parse a JSON body with a hard byte ceiling.
 *
 * `await req.json()` on an unbounded body will happily buffer whatever arrives.
 */
export async function readJson<T>(
  req: Request,
  max = MAX_BODY_BYTES,
): Promise<{ ok: true; body: T } | { ok: false; code: string; error: string }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > max) {
    return { ok: false, code: "body_too_large", error: `Body exceeds ${max} bytes.` };
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, code: "body_unreadable", error: "Could not read the request body." };
  }
  // content-length can lie or be absent, so measure what actually arrived.
  if (text.length > max) {
    return { ok: false, code: "body_too_large", error: `Body exceeds ${max} bytes.` };
  }
  try {
    return { ok: true, body: JSON.parse(text) as T };
  } catch {
    return { ok: false, code: "bad_json", error: "Body is not valid JSON." };
  }
}

/** A required string field, trimmed, length-checked. */
export function requireText(
  value: unknown,
  name: string,
  max: number,
): { ok: true; value: string } | { ok: false; code: string; error: string } {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, code: "missing_field", error: `${name} is required.` };
  }
  const v = value.trim();
  if (v.length > max) {
    return {
      ok: false,
      code: "field_too_long",
      error: `${name} is ${v.length} characters; the limit is ${max}.`,
    };
  }
  return { ok: true, value: v };
}

/** An id from a known set — never interpolated from user input unchecked. */
export function requireOneOf(
  value: unknown,
  allowed: readonly string[],
  name: string,
): { ok: true; value: string } | { ok: false; code: string; error: string } {
  if (typeof value !== "string" || !allowed.includes(value)) {
    return {
      ok: false,
      code: "unknown_id",
      error: `${name} must be one of: ${allowed.join(", ")}.`,
    };
  }
  return { ok: true, value };
}

/* ── rate limiting ───────────────────────────────────────────────────────
   A fixed window per caller, held in this instance's memory.

   HONEST LIMIT: serverless means several instances and no shared state, so a
   determined caller spread across instances gets more than the stated budget.
   This is not a security control; it is a brake on the ordinary case — a
   script, a stuck retry loop, a reviewer leaning on a button — which is what
   actually drains a free-tier daily quota.
   ──────────────────────────────────────────────────────────────────────── */
const BUCKETS = new Map<string, { count: number; resetAt: number }>();

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const b = BUCKETS.get(key);
  if (!b || b.resetAt <= now) {
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistic sweep so the map cannot grow without bound.
    if (BUCKETS.size > 5_000) {
      for (const [k, v] of BUCKETS) if (v.resetAt <= now) BUCKETS.delete(k);
    }
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

export function resetRateLimits(): void {
  BUCKETS.clear();
}
