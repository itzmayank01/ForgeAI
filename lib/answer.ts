/**
 * Answering a question against one built run's committed documents.
 *
 * Lifted out of app/api/chat so the team router can reuse it verbatim. A
 * routed answer and a direct answer must come from the same code path, or the
 * team room becomes a second, subtly different agent wearing the first one's
 * name and scorecard.
 */

import { loadChunks, loadRun } from "./runs";
import { bm25 } from "./bm25";
import { TTLCache, answerKey } from "./cache";

/**
 * Several keys, rotated per request and retried on a rate limit.
 *
 * The CLI pool does this properly; the hosted chat needs at least the same
 * idea because a single key caps the page at 8,000 tokens/minute, and a
 * reviewer clicking a few suggested questions in a row will hit that.
 */
/**
 * A real key is `gsk_` and ~52 more base62 characters. Every placeholder this
 * repository ships -- gsk_your_key_here, gsk_key_one -- is far shorter and
 * carries underscores the real thing never has, so shape alone separates them.
 *
 * A dead entry in the pool is not harmless. The pool rotates onto it, the
 * provider returns 401, and that request fails. An untouched
 * FORGEAI_API_KEY=gsk_your_key_here sat in this project's own .env for the
 * whole build, costing a measured 8 failures in 20 requests once rate limiting
 * made the loop walk the whole pool.
 */
export function isPlausibleKey(value: string): boolean {
  const body = value.startsWith("gsk_") ? value.slice(4) : value;
  return /^[A-Za-z0-9-]{20,}$/.test(body);
}

export const API_KEYS: string[] = (() => {
  const seen = new Set<string>();
  const push = (raw?: string) =>
    (raw ?? "").split(",").map((s) => s.trim())
      .filter((k) => k && isPlausibleKey(k))
      .forEach((k) => seen.add(k));

  push(process.env.FORGEAI_API_KEYS);
  push(process.env.FORGEAI_API_KEY);
  push(process.env.GROQ_API_KEY);
  // Scan well past any plausible count. The Python loader had the same 2..10
  // limit and silently ignored keys numbered 11 and up, so adding keys made no
  // difference and the pool quietly stayed small.
  for (let i = 2; i <= 30; i++) {
    push(process.env[`FORGEAI_API_KEY_${i}`]);
    push(process.env[`GROQ_API_KEY_${i}`]);
  }
  return [...seen];
})();

const BASE_URL = process.env.FORGEAI_BASE_URL ?? "https://api.groq.com/openai/v1";
const MODEL = process.env.FORGEAI_GEN_MODEL ?? "openai/gpt-oss-20b";

/**
 * How long one upstream call may take, and how long the whole request may
 * spend sweeping the key pool.
 *
 * `fetch` has no default timeout. A provider that accepts the connection and
 * then stalls held this function until Vercel killed it at maxDuration, and
 * the caller saw a blank 504 rather than a refusal. Per-attempt is well under
 * the function budget so a stall costs one attempt, not the request.
 */
const ATTEMPT_TIMEOUT_MS = 11_000;
const TOTAL_BUDGET_MS = 24_000;

/**
 * Answers already paid for.
 *
 * Keyed on run, model and the normalised question — everything that decides
 * the result — so a hit returns what a miss would have produced. Ten minutes
 * is long enough to cover a reviewer working through the suggested questions
 * and short enough that a redeploy with a new definition is not shadowed by
 * stale text.
 */
const ANSWERS = new TTLCache<AnswerResult>(200, 10 * 60 * 1000);

export interface Retrieved {
  chunk_id: string;
  filename: string;
  score: number;
  text?: string;
}

export interface AnswerResult {
  ok: true;
  /** True when this was served from the in-instance answer cache. */
  cached?: boolean;
  answer: string;
  refused: boolean;
  confidence: number;
  citations: string[];
  fabricated: string[];
  retrieved: Retrieved[];
  note?: string;
}

export interface AnswerError {
  ok: false;
  status: number;
  error: string;
}

export function keysConfigured(): boolean {
  return API_KEYS.length > 0;
}

export async function answerWithRun(
  runId: string,
  question: string,
): Promise<AnswerResult | AnswerError> {
  if (API_KEYS.length === 0) {
    return { ok: false, status: 503, error: "No API key configured on the server." };
  }

  const run = await loadRun(runId);
  const definition = run?.definition;
  if (!definition) {
    return { ok: false, status: 404, error: `no agent definition for ${runId}` };
  }

  // The model is part of the key: a re-route must not be served an answer the
  // previous model produced, which is the same rule the CLI's answer cache
  // follows when FORGEAI_AGENT_MODEL changes mid-run.
  const model = (definition as { model?: string }).model ?? MODEL;
  const key = answerKey(runId, question, model);
  const cached = ANSWERS.get(key);
  if (cached) return { ...cached, cached: true };

  const chunks = await loadChunks(runId);
  const hits = bm25(question, chunks, definition.retrieval.top_k);

  // Nothing cleared the floor: refuse deterministically rather than inviting
  // the model to fill the gap from memory. Same rule as the CLI runtime.
  if (hits.length === 0) {
    const refusal: AnswerResult = {
      ok: true,
      answer: definition.output_contract.refusal_message,
      refused: true, confidence: 0, citations: [], fabricated: [], retrieved: [],
    };
    ANSWERS.set(key, refusal);
    return refusal;
  }

  // Number the sources rather than labelling them with chunk ids. Asked to
  // cite `doc_01_c003`, the model reproduces the SHAPE of an id and not the
  // id: on the CLI that accounted for five of hr_policy's ten residual
  // failures, every one a correct answer carrying a citation to a chunk it had
  // never been shown. Copying `2` is a far easier task, and the number is
  // resolved back to a chunk id in code.
  const context = hits.map((h, i) => `[${i + 1}] ${h.item.text}`).join("\n\n");

  const body = {
    model: MODEL,
    temperature: definition.temperature,
    max_tokens: 2048,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system" as const, content: definition.system_prompt },
      {
        role: "user" as const,
        content:
          `CONTEXT:\n${context}\n\nQUESTION: ${question}\n\n` +
          `Answer only from the context above. Every claim must cite the ` +
          `source number it came from: put those numbers in "citations", for ` +
          `example ["2"] or ["1","3"]. Use only numbers shown above. If the ` +
          `context does not support an answer, set refused to true.\n\n` +
          `Reply with JSON: {"answer": string, "citations": string[], ` +
          `"refused": boolean, "confidence": number}`,
      },
    ],
  };

  const retrieved: Retrieved[] = hits.map((h) => ({
    chunk_id: h.item.chunk_id,
    filename: h.item.filename,
    score: Number(h.score.toFixed(3)),
    text: h.item.text,
  }));

  try {
    // Start at a different key per request so concurrent readers spread across
    // the pool instead of queueing on whichever one is listed first.
    const offset = Math.floor(Math.random() * API_KEYS.length);
    let r: Response | null = null;

    // Two sweeps of the pool with a short pause between them. One sweep gives
    // up the instant every key is momentarily busy, which is what a reader
    // sees as "rate limited" even though Groq's per-minute window refills in
    // seconds. A person who clicked once will happily wait two.
    // A key the provider rejects is dead -- rotated, revoked, mistyped -- and
    // it is this key's problem, not the request's, exactly like a rate limit.
    // Only retrying on 429 meant one rotated key among fourteen failed roughly
    // one request in fourteen outright, which reads as an unreliable site
    // rather than as one stale entry in the pool.
    let rejected = 0;
    const deadline = Date.now() + TOTAL_BUDGET_MS;
    let timedOut = false;

    outer: for (let sweep = 0; sweep < 2; sweep++) {
      if (sweep > 0) {
        if (Date.now() > deadline) break;
        await new Promise((res) => setTimeout(res, 1800));
      }
      for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
        if (Date.now() > deadline) { timedOut = true; break outer; }
        const key = API_KEYS[(offset + attempt) % API_KEYS.length];
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), ATTEMPT_TIMEOUT_MS);
        try {
          r = await fetch(`${BASE_URL}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify(body),
            signal: ac.signal,
          });
        } catch (err) {
          // An aborted or failed attempt is this key's problem, like a 429.
          if ((err as Error)?.name === "AbortError") timedOut = true;
          continue;
        } finally {
          clearTimeout(timer);
        }
        if (r.status === 401 || r.status === 403) {
          if (sweep === 0) rejected++;
          continue;
        }
        if (r.status !== 429) break outer;
      }
    }

    if (!r) {
      return timedOut
        ? { ok: false, status: 504,
            error: "The model provider did not respond in time. Retrieval and routing ran locally and are unaffected." }
        : { ok: false, status: 503, error: "no key available" };
    }
    if (r.status === 429) {
      return {
        ok: false, status: 429,
        error:
          `Every one of the ${API_KEYS.length} configured key(s) is rate limited ` +
          `right now. Groq's free-tier window refills within a minute — try again shortly.`,
      };
    }
    // Name the cause. "upstream 401" in a chat bubble reads as the site being
    // broken, when it means the key in the environment is no longer valid --
    // which is exactly what a rotated key looks like, and the one failure a
    // reviewer is most likely to hit.
    if (r.status === 401 || r.status === 403) {
      return {
        ok: false, status: 502,
        error:
          `The model provider rejected all ${rejected} configured key(s). The ` +
          `retrieval and routing above are real and ran locally; only the ` +
          `generation step needs a valid key. Set FORGEAI_API_KEYS and retry.`,
      };
    }
    if (!r.ok) return { ok: false, status: 502, error: `upstream ${r.status}` };

    const data = await r.json();
    const raw: string = data.choices?.[0]?.message?.content ?? "";

    let parsed: { answer?: string; citations?: string[]; refused?: boolean; confidence?: number };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Unparseable output is a refusal, never a guess.
      return {
        ok: true,
        answer: definition.output_contract.refusal_message,
        refused: true, confidence: 0, citations: [], fabricated: [], retrieved,
        note: "model returned unparseable output",
      };
    }

    // A refusal with no text is still a refusal. The model regularly sets
    // refused:true and leaves `answer` empty -- correctly, when retrieval came
    // back with neighbouring material rather than the thing asked about -- and
    // taking that literally rendered an empty chat bubble, which reads as the
    // agent having silently failed. Fall back to the contract's own refusal
    // wording, which is the sentence it was built to say.
    const text = (parsed.answer ?? "").trim();
    const refused = Boolean(parsed.refused);

    const result: AnswerResult = {
      ok: true,
      answer: text || definition.output_contract.refusal_message,
      refused: refused || text === "",
      confidence: parsed.confidence ?? 0.5,
      ...resolveCitations(parsed.citations ?? [], hits.map((h) => h.item.chunk_id)),
      retrieved,
    };
    ANSWERS.set(key, result);
    return result;
  } catch (err) {
    return {
      ok: false, status: 500,
      error: err instanceof Error ? err.message : "request failed",
    };
  }
}

/**
 * Resolve a source number to the chunk it was given; still honour a raw chunk
 * id when the model copies one correctly. Anything else -- an out-of-range
 * number, an invented id -- stays out of `citations` and is reported as
 * fabricated, so the page can show that it happened rather than quietly
 * presenting an answer as uncited.
 */
export function resolveCitations(
  rawCitations: unknown[],
  orderedChunkIds: string[],
): { citations: string[]; fabricated: string[] } {
  const known = new Set(orderedChunkIds);
  const citations: string[] = [];
  const fabricated: string[] = [];

  for (const item of rawCitations) {
    const text = String(item).trim().replace(/^\[|\]$/g, "");
    const n = /^\d+$/.test(text) ? Number(text) : NaN;
    if (!Number.isNaN(n)) {
      if (n >= 1 && n <= orderedChunkIds.length) {
        const id = orderedChunkIds[n - 1];
        if (!citations.includes(id)) citations.push(id);
      } else {
        fabricated.push(String(item));
      }
    } else if (known.has(text)) {
      if (!citations.includes(text)) citations.push(text);
    } else {
      fabricated.push(String(item));
    }
  }
  return { citations, fabricated };
}
