import { NextResponse } from "next/server";
import { loadChunks, loadRun } from "@/lib/runs";
import { bm25 } from "@/lib/bm25";

export const maxDuration = 30;

/**
 * Several keys, rotated per request and retried on a rate limit.
 *
 * The CLI pool does this properly; the hosted chat needs at least the same
 * idea because a single key caps the page at 8,000 tokens/minute, and a
 * reviewer clicking a few suggested questions in a row will hit that.
 */
const API_KEYS: string[] = (() => {
  const seen = new Set<string>();
  const push = (raw?: string) =>
    (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean).forEach((k) => seen.add(k));

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

const API_KEY = API_KEYS[0] ?? "";
const BASE_URL = process.env.FORGEAI_BASE_URL ?? "https://api.groq.com/openai/v1";
const MODEL = process.env.FORGEAI_GEN_MODEL ?? "openai/gpt-oss-20b";

export async function POST(req: Request) {
  const { runId, question } = (await req.json()) as { runId?: string; question?: string };

  if (!runId || !question?.trim()) {
    return NextResponse.json({ error: "runId and question are required" }, { status: 400 });
  }
  if (!API_KEY) {
    return NextResponse.json(
      { error: "No API key configured on the server." }, { status: 503 },
    );
  }

  const run = await loadRun(runId);
  const definition = run?.definition;
  if (!definition) {
    return NextResponse.json({ error: `no agent definition for ${runId}` }, { status: 404 });
  }

  const chunks = await loadChunks(runId);
  const hits = bm25(question, chunks, definition.retrieval.top_k);

  // Nothing cleared the floor: refuse deterministically rather than inviting
  // the model to fill the gap from memory. Same rule as the CLI runtime.
  if (hits.length === 0) {
    return NextResponse.json({
      answer: definition.output_contract.refusal_message,
      refused: true, confidence: 0, citations: [], retrieved: [],
    });
  }

  // Number the sources rather than labelling them with chunk ids. Asked to
  // cite `doc_01_c003`, the model reproduces the SHAPE of an id and not the id:
  // on the CLI that accounted for five of hr_policy's ten residual failures,
  // every one a correct answer carrying a citation to a chunk it had never been
  // shown. Here the fabricated id was merely filtered out below, so a correct
  // answer arrived with no citations at all. Copying `2` is a far easier task,
  // and the number is resolved back to a chunk id in code.
  const context = hits
    .map((h, i) => `[${i + 1}] ${h.item.text}`)
    .join("\n\n");

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

  try {
    // Start at a different key per request so concurrent readers spread across
    // the pool instead of queueing on whichever one is listed first.
    const offset = Math.floor(Math.random() * API_KEYS.length);
    let r: Response | null = null;

    // Two sweeps of the pool with a short pause between them. One sweep gives
    // up the instant every key is momentarily busy, which is what a reader sees
    // as "rate limited" even though Groq's per-minute window refills in
    // seconds. A person who clicked once will happily wait two.
    const sweeps = 2;
    outer: for (let sweep = 0; sweep < sweeps; sweep++) {
      if (sweep > 0) await new Promise((res) => setTimeout(res, 1800));
      for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
        const key = API_KEYS[(offset + attempt) % API_KEYS.length];
        r = await fetch(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
        });
        // A rate limit is this key's problem, not the request's: try the next.
        if (r.status !== 429) break outer;
      }
    }

    if (!r) {
      return NextResponse.json({ error: "no key available" }, { status: 503 });
    }
    if (r.status === 429) {
      return NextResponse.json(
        {
          error:
            `Every one of the ${API_KEYS.length} configured key(s) is rate limited ` +
            `right now. Groq's free-tier window refills within a minute — try again shortly.`,
        },
        { status: 429 },
      );
    }
    if (!r.ok) {
      return NextResponse.json(
        { error: `upstream ${r.status}` }, { status: 502 },
      );
    }

    const data = await r.json();
    const raw: string = data.choices?.[0]?.message?.content ?? "";

    let parsed: { answer?: string; citations?: string[]; refused?: boolean; confidence?: number };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Unparseable output is a refusal, never a guess.
      return NextResponse.json({
        answer: definition.output_contract.refusal_message,
        refused: true, confidence: 0, citations: [],
        retrieved: hits.map((h) => ({ chunk_id: h.item.chunk_id, filename: h.item.filename, score: h.score })),
        note: "model returned unparseable output",
      });
    }

    // Resolve a source number to the chunk it was given; still honour a raw
    // chunk id when the model copies one correctly. Anything else -- an
    // out-of-range number, an invented id -- stays out of `citations` and is
    // reported as fabricated, so the page can show that it happened rather
    // than quietly presenting an answer as uncited.
    const retrievedIds = new Set(hits.map((h) => h.item.chunk_id));
    const rawCitations = parsed.citations ?? [];
    const citations: string[] = [];
    const fabricated: string[] = [];
    for (const item of rawCitations) {
      const text = String(item).trim().replace(/^\[|\]$/g, "");
      const n = /^\d+$/.test(text) ? Number(text) : NaN;
      if (!Number.isNaN(n)) {
        if (n >= 1 && n <= hits.length) {
          const id = hits[n - 1].item.chunk_id;
          if (!citations.includes(id)) citations.push(id);
        } else {
          fabricated.push(String(item));
        }
      } else if (retrievedIds.has(text)) {
        if (!citations.includes(text)) citations.push(text);
      } else {
        fabricated.push(String(item));
      }
    }

    return NextResponse.json({
      answer: parsed.answer ?? "",
      refused: Boolean(parsed.refused),
      confidence: parsed.confidence ?? 0.5,
      citations,
      fabricated,
      retrieved: hits.map((h) => ({
        chunk_id: h.item.chunk_id, filename: h.item.filename,
        score: Number(h.score.toFixed(3)), text: h.item.text,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "request failed" }, { status: 500 },
    );
  }
}
