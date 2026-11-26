import { NextResponse } from "next/server";
import { answerWithRun } from "@/lib/answer";
import { listRunIds } from "@/lib/runs";
import {
  MAX_QUESTION, clientKey, rateLimit, readJson, requestId, requireOneOf, requireText,
} from "@/lib/api";
import { fail } from "@/lib/http";

export const maxDuration = 30;

/** Generous for a reader, tight enough to stop a loop draining the day's tokens. */
const LIMIT = 20;
const WINDOW_MS = 60_000;

export async function POST(req: Request) {
  const id = requestId();

  const gate = rateLimit(`chat:${clientKey(req)}`, LIMIT, WINDOW_MS);
  if (!gate.ok) {
    return fail(
      "rate_limited",
      `More than ${LIMIT} questions in a minute. This is a free-tier demo on a metered daily budget — try again in ${gate.retryAfter}s.`,
      429, id, { retryAfter: gate.retryAfter },
    );
  }

  const body = await readJson<{ runId?: string; question?: string }>(req);
  if (!body.ok) return fail(body.code, body.error, 400, id);

  // runId reaches the filesystem, so it is checked against the runs that exist
  // rather than trusted and joined into a path.
  const runId = requireOneOf(body.body.runId, await listRunIds(), "runId");
  if (!runId.ok) return fail(runId.code, runId.error, 404, id);

  const question = requireText(body.body.question, "question", MAX_QUESTION);
  if (!question.ok) return fail(question.code, question.error, 400, id);

  const result = await answerWithRun(runId.value, question.value);
  if (!result.ok) return fail("upstream", result.error, result.status, id);

  const { ok, ...payload } = result;
  void ok;
  return NextResponse.json(
    { ...payload, requestId: id },
    { headers: { "X-RateLimit-Remaining": String(gate.remaining) } },
  );
}
