/**
 * Let node --test load the app's TypeScript directly.
 *
 * Node strips types happily but will not resolve an extensionless relative
 * import to a .ts file, while Next requires imports to be written that way.
 * Rather than keep a second copy of the logic in JS just to test it -- which
 * is how a test suite ends up passing against code nobody ships -- this hook
 * teaches the resolver the one thing it is missing.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    if (relative && !/\.(ts|tsx|js|mjs|cjs|json)$/.test(specifier)) {
      for (const ext of [".ts", ".tsx"]) {
        const candidate = new URL(specifier + ext, context.parentURL);
        if (existsSync(fileURLToPath(candidate))) {
          return nextResolve(specifier + ext, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
