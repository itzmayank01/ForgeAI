import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Run, CaseVerdict, WebChunk } from "./types";
import { TTLCache } from "./cache";

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

export interface ArtifactFile {
  /** Path as it sits in the repository, e.g. runs/hr_policy_live/01_requirements.json */
  path: string;
  /** Path within the run, used as the display label. */
  name: string;
  bytes: number;
  stage: string;
}

/**
 * Every file the factory committed for a run, with its real size.
 *
 * The Artifacts tab exists because "the evidence is in the repository" is a
 * claim a reader cannot check from a landing page. This lists what is actually
 * on disk -- if a stage never ran, its file is simply absent from the list
 * rather than rendered as an empty placeholder.
 */
const STAGE_OF: [RegExp, string][] = [
  [/^00_inputs/, "00 · inputs"],
  [/^01_requirements/, "01 · intake"],
  [/^02_groundability/, "02 · groundability"],
  [/^03_agent_def/, "03 · generator"],
  [/^04_eval_suite/, "04 · eval generator"],
  [/^05_iterations/, "05 · judge & optimizer"],
  [/^06_report/, "06 · report"],
  [/^web\//, "web · hosted corpus"],
];

export async function listArtifacts(id: string): Promise<ArtifactFile[]> {
  const dir = join(ROOT, id);
  if (!existsSync(dir)) return [];

  const out: ArtifactFile[] = [];
  async function walk(rel: string) {
    for (const name of await readdir(join(dir, rel))) {
      if (name.startsWith(".")) continue;
      const childRel = rel ? `${rel}/${name}` : name;
      const info = await stat(join(dir, childRel));
      if (info.isDirectory()) {
        await walk(childRel);
      } else {
        out.push({
          path: `runs/${id}/${childRel}`,
          name: childRel,
          bytes: info.size,
          stage: STAGE_OF.find(([re]) => re.test(childRel))?.[1] ?? "other",
        });
      }
    }
  }
  await walk("");
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Committed chunks never change between deploys, so re-reading and re-parsing
 * the file on every request was pure cost — and the team router does it once
 * per member, so a two-member room paid it twice per question.
 */
const CHUNKS = new TTLCache<WebChunk[]>(16, 60 * 60 * 1000);

export async function loadChunks(id: string): Promise<WebChunk[]> {
  const hit = CHUNKS.get(id);
  if (hit) return hit;
  const data = await json<{ chunks: WebChunk[] }>(
    join(ROOT, id, "web", "chunks.json"));
  const chunks = data?.chunks ?? [];
  if (chunks.length > 0) CHUNKS.set(id, chunks);
  return chunks;
}
