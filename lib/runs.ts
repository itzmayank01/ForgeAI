import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Run, CaseVerdict, WebChunk } from "./types";

const ROOT = join(process.cwd(), "data", "runs");

async function json<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function listRunIds(): Promise<string[]> {
  if (!existsSync(ROOT)) return [];
  const out: string[] = [];
  for (const name of await readdir(ROOT)) {
    if (name.startsWith(".")) continue;
    if ((await stat(join(ROOT, name))).isDirectory()) out.push(name);
  }
  // Real runs first; the fixture is scaffolding, not evidence.
  return out.sort((a, b) =>
    Number(a.startsWith("_")) - Number(b.startsWith("_")) || b.localeCompare(a));
}

export async function loadRun(id: string): Promise<Run | null> {
  const dir = join(ROOT, id);
  if (!existsSync(dir)) return null;

  const manifest = await json<Run["manifest"] & { synthetic?: boolean }>(
    join(dir, "00_inputs", "manifest.json"));

  const verdicts: Record<number, CaseVerdict[]> = {};
  const itersDir = join(dir, "05_iterations");
  if (existsSync(itersDir)) {
    for (const name of await readdir(itersDir)) {
      const m = /^iter_(\d+)$/.exec(name);
      if (!m) continue;
      const v = await json<{ verdicts: CaseVerdict[] }>(
        join(itersDir, name, "verdicts.json"));
      if (v) verdicts[Number(m[1])] = v.verdicts;
    }
  }

  let reportMarkdown: string | null = null;
  try {
    reportMarkdown = await readFile(join(dir, "06_report.md"), "utf8");
  } catch { /* report.md is optional */ }

  return {
    id,
    synthetic: Boolean(manifest?.synthetic) || id.startsWith("_"),
    manifest: manifest ?? { brief: "", documents: [], skipped: [] },
    requirements: await json(join(dir, "01_requirements.json")),
    groundability: await json(join(dir, "02_groundability.json")),
    definitionV0: await json(join(dir, "03_agent_def.v0.json")),
    definition: await json(join(dir, "03_agent_def.final.json")),
    suite: await json(join(dir, "04_eval_suite.json")),
    report: await json(join(dir, "06_report.json")),
    verdicts,
    reportMarkdown,
  };
}

export async function loadAllRuns(): Promise<Run[]> {
  const ids = await listRunIds();
  const runs = await Promise.all(ids.map(loadRun));
  return runs.filter((r): r is Run => r !== null);
}

export async function loadChunks(id: string): Promise<WebChunk[]> {
  const data = await json<{ chunks: WebChunk[] }>(
    join(ROOT, id, "web", "chunks.json"));
  return data?.chunks ?? [];
}
