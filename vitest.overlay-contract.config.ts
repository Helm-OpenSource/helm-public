import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * The Public↔Overlay composition contract, run against an EXTERNAL Overlay
 * checkout.
 *
 * Separate from vitest.config.ts on purpose. This suite fails when the external
 * checkout is absent or is at the wrong commit — which is correct for the gate
 * and wrong for someone running the ordinary test suite on a machine that has
 * only this repository. Splitting the config keeps "the contract was not
 * verified" loud in CI without making every local run depend on a second
 * checkout.
 *
 * `@helm/core` resolves to THIS repository, because that is exactly what the
 * Overlay's package imports resolve to in the composed deployment: the Overlay
 * is the host, this repo is Core.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@helm/core": path.resolve(__dirname, "."),
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/__mocks__/server-only.ts"),
    },
  },
  test: {
    pool: "forks",
    environment: "node",
    globals: true,
    testTimeout: Number(process.env.VITEST_TEST_TIMEOUT_MS ?? "60000"),
    include: ["tools/caio-access-gateway/overlay-composition-contract.test.ts"],
  },
});
