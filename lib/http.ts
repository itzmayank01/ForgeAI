import { NextResponse } from "next/server";
import { requestId } from "./api";

/**
 * The one place that turns a failure into a response.
 *
 * Kept apart from lib/api.ts so that module stays importable outside a Next
 * runtime and its guards can be unit-tested directly.
 *
 * Every failure carries three things: a `code` a caller can branch on, a
 * sentence a person can act on, and a `requestId` that ties the response to
 * the server log line.
 */
export function fail(
  code: string,
  error: string,
  status: number,
  id = requestId(),
  extra: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json({ error, code, requestId: id, ...extra }, { status });
}
