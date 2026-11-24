/**
 * Copy run artifacts from runs/ into data/runs so they ship with the Vercel
 * build. Next only bundles what sits under the app root, and runs/ is written
 * by the Python factory. Runs as a prebuild step.
 */
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "runs");
const dest = join(here, "..", "data", "runs");

if (!existsSync(src)) {
  console.log("[sync-runs] no ../runs directory; nothing to sync");
  process.exit(0);
}

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

let n = 0;
for (const name of await readdir(src)) {
  if (name.startsWith(".")) continue;
  if (!(await stat(join(src, name))).isDirectory()) continue;
  await cp(join(src, name), join(dest, name), { recursive: true });
  n++;
  console.log(`[sync-runs] ${name}`);
}
console.log(`[sync-runs] synced ${n} run(s)`);
