import { NextResponse } from "next/server";
import { answerWithRun } from "@/lib/answer";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { runId, question } = (await req.json()) as { runId?: string; question?: string };

  if (!runId || !question?.trim()) {
    return NextResponse.json({ error: "runId and question are required" }, { status: 400 });
  }

  const result = await answerWithRun(runId, question);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { ok, ...payload } = result;
  void ok;
  return NextResponse.json(payload);
}
