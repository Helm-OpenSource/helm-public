import { mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

// Public CI runs the executable OSS-safe suite. The excluded files assert
// private-repo docs, self-check, repo-split, or internal review artifacts that
// are intentionally removed from the public projection.
export default mergeConfig(baseConfig, {
  test: {
    exclude: [
      "tests/e2e/**",
      "lib/presentation/**/*.test.ts",
      "lib/self-check*.test.ts",
      "lib/codex/**/*.test.ts",
      "lib/codex-*.test.ts",
      "lib/release-readiness-check.test.ts",
      "lib/worker-skill-resource/*.test.ts",
      "lib/i18n/api-workspace-default-locale-inventory.test.ts",
      "lib/agentic-governance-eval.test.ts",
      "lib/evals/llm-context-evals.test.ts",
      "lib/public-mirror-clean-receipt-builder.test.ts",
      "lib/public-mirror-preflight.test.ts",
      "lib/public-mirror-smoke.test.ts",
      "lib/public-package-manifest-builder.test.ts",
      "lib/evals/pack-a-pilot-readiness.test.ts",
      "scripts/repo-split-execute.test.ts",
    ],
  },
});
