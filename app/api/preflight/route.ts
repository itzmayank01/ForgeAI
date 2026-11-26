import { NextResponse } from "next/server";
import { loadChunks, listRunIds } from "@/lib/runs";
import { probeTopics, splitTopics, CALIBRATION, MAY_CLASSIFY } from "@/lib/preflight";
import {
  MAX_BRIEF, clientKey, rateLimit, readJson, requestId, requireOneOf, requireText,
} from "@/lib/api";
import { fail } from "@/lib/http";

/**
 * Retrieval pre-flight: what would this corpus hand an agent built from this
 * brief? Deterministic, no model call, no key required — so it works on the
 * deployed site whatever the quota is doing.
 *
 * It costs no tokens but it is not free: every clause runs BM25 over the whole
 * corpus, so an unbounded brief is CPU a caller can spend on our behalf.
 */
export const maxDuration = 15;

const LIMIT = 30;
const WINDOW_MS = 60_000;
/** A brief with hundreds of clauses is not a brief. */
const MAX_CLAUSES = 60;

export async function POST(req: Request) {
  const id = requestId();

  const gate = rateLimit(`preflight:${clientKey(req)}`, LIMIT, WINDOW_MS);
  if (!gate.ok) {
    return fail("rate_limited", `Too many pre-flights; try again in ${gate.retryAfter}s.`,
      429, id, { retryAfter: gate.retryAfter });
  }

  const body = await readJson<{ brief?: string; corpusId?: string }>(req);
  if (!body.ok) return fail(body.code, body.error, 400, id);

  const corpusId = requireOneOf(body.body.corpusId, await listRunIds(), "corpusId");
  if (!corpusId.ok) return fail(corpusId.code, corpusId.error, 404, id);

  const brief = requireText(body.body.brief, "brief", MAX_BRIEF);
  if (!brief.ok) return fail(brief.code, brief.error, 400, id);

  const chunks = await loadChunks(corpusId.value);
  if (chunks.length === 0) {
    return fail("no_corpus", `No committed corpus for ${corpusId.value}.`, 404, id);
  }

  const clauses = splitTopics(brief.value);
  if (clauses.length === 0) {
    return fail("no_clauses", "No probeable clause in that brief.", 400, id);
  }

  const capped = clauses.slice(0, MAX_CLAUSES);
  const result = probeTopics(capped, chunks);

  return NextResponse.json({
    ...result,
    requestId: id,
    corpusId: corpusId.value,
    corpusChunks: chunks.length,
    corpusFiles: [...new Set(chunks.map((c) => c.filename))],
    clausesFound: clauses.length,
    clausesProbed: capped.length,
    mayClassify: MAY_CLASSIFY,
    calibration: CALIBRATION,
  });
}
