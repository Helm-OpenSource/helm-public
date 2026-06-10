// Node module hook that lets CLI scripts (tsx/node) import server-side
// modules guarded by Next.js's `server-only` package. Mirrors the vitest
// alias in vitest.config.ts → tests/__mocks__/server-only.ts.
//
// Usage:
//   NODE_OPTIONS="--import ./scripts/node-hooks/allow-server-only.mjs" \
//     tsx scripts/run-bi-report-push.ts ...
// or via the npm scripts that set it for you (see package.json `bi:*`).
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const stubUrl = pathToFileURL(path.join(repoRoot, "tests", "__mocks__", "server-only.ts")).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only" || specifier === "client-only") {
      return { url: stubUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
