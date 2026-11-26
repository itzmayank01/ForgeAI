import { NextResponse } from "next/server";
import { loadChunks } from "@/lib/runs";
import { probeTopics, splitTopics, CALIBRATION, MAY_CLASSIFY } from "@/lib/preflight";

/**
 * Retrieval pre-flight: what would this corpus hand an agent built from this
 * brief? Deterministic, no model call, no key required — so it works on the
 * deployed site whatever the quota is doing.
 */
export async function POST(req: Request) {
  const { brief, corpusId } = (await req.json()) as { brief?: string; corpusId?: string };

  if (!brief?.trim() || !corpusId) {
    return NextResponse.json({ error: "brief and corpusId are required" }, { status: 400 });
  }

  const chunks = await loadChunks(corpusId);
  if (chunks.length === 0) {
    return NextResponse.json({ error: `no committed corpus for ${corpusId}` }, { status: 404 });
  }

  const clauses = splitTopics(brief);
  if (clauses.length === 0) {
    return NextResponse.json({ error: "no probeable clause in that brief" }, { status: 400 });
  }

  const result = probeTopics(clauses, chunks);
  return NextResponse.json({
    ...result,
    corpusId,
    corpusChunks: chunks.length,
    corpusFiles: [...new Set(chunks.map((c) => c.filename))],
    mayClassify: MAY_CLASSIFY,
    calibration: CALIBRATION,
  });
}
