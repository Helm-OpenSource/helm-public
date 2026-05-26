import { defineConfig } from "vitest/config";
import path from "node:path";
import { DEFAULT_MYSQL_DATABASE_URL } from "./lib/db-url";

const testDatabaseUrl = process.env.DATABASE_URL ?? DEFAULT_MYSQL_DATABASE_URL;
const testTimeoutMs = Number(process.env.VITEST_TEST_TIMEOUT_MS ?? "60000");
const hookTimeoutMs = Number(process.env.VITEST_HOOK_TIMEOUT_MS ?? "45000");

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Next.js `server-only` is not installed at the workspace root; vitest
      // (node env) doesn't need the real guard. Map to a no-op shim so
      // server-side modules under test can `import "server-only"` cleanly.
      "server-only": path.resolve(__dirname, "tests/__mocks__/server-only.ts"),
    },
  },
  test: {
    // Keep file-level module and Prisma state isolated; the default pool leaks
    // enough shared runtime state to make the helm-v2 integration suite flaky.
    pool: "forks",
    environment: "node",
    globals: true,
    testTimeout: testTimeoutMs,
    hookTimeout: hookTimeoutMs,
    include: [
      "lib/**/*.test.ts",
      "features/**/*.test.ts",
      "features/**/*.test.tsx",
      "extensions/**/*.test.ts",
      "eslint-rules/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    exclude: ["tests/e2e/**"],
  },
});
