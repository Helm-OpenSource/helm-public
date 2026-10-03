// Node module hook that lets CLI scripts (tsx/node) import server-side
// modules guarded by Next.js's `server-only` package. Resolve the package's
// own react-server export; runtime images do not contain Vitest's test mock.
//
// Usage:
//   NODE_OPTIONS="--import ./scripts/node-hooks/allow-server-only.mjs" \
//     tsx scripts/run-bi-report-push.ts ...
// or via the npm scripts that set it for you (see package.json `bi:*`).
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return nextResolve(specifier, {
        ...context,
        conditions: [...new Set([...context.conditions, "react-server"])],
      });
    }
    return nextResolve(specifier, context);
  },
});
