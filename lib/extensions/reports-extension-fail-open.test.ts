import { describe, expect, it, vi } from "vitest";
import {
  REPORTS_EXTENSION_ACCESS_TIMEOUT_MS,
  resolveReportsExtensionAccessSafely,
} from "./registry";

const workspace = {
  id: "ws_test",
  slug: "test-workspace",
} as const;
const reportsExtensionId = ["guang", "pu-bi-report"].join("");
const mappingExtensionId = ["guang", "pu-", "mi", "dun-integrate"].join("");

describe("resolveReportsExtensionAccessSafely — reports extension fail-open contract", () => {
  it("returns the descriptor result when getAccess resolves normally", async () => {
    await expect(
      resolveReportsExtensionAccessSafely(
        {
          id: reportsExtensionId,
          getAccess: async () => ({ ok: true }),
        },
        workspace,
      ),
    ).resolves.toEqual({ ok: true });
  });

  it("treats a thrown getAccess as ok=false so the shared reports page still loads", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      await expect(
        resolveReportsExtensionAccessSafely(
          {
            id: reportsExtensionId,
            getAccess: async () => {
              throw new Error("Cannot read properties of undefined (reading 'enabled')");
            },
          },
          workspace,
        ),
      ).resolves.toEqual({ ok: false });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("falls back to ok=false when a single extension hangs past the timeout", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const start = Date.now();
      const result = await resolveReportsExtensionAccessSafely(
        {
          id: mappingExtensionId,
          getAccess: () => new Promise<{ ok: boolean }>(() => undefined),
        },
        workspace,
        { timeoutMs: 25 },
      );
      const elapsed = Date.now() - start;
      expect(result).toEqual({ ok: false });
      expect(elapsed).toBeLessThan(500);
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("exposes the production timeout constant so /reports cannot hang on a single extension probe forever", () => {
    expect(REPORTS_EXTENSION_ACCESS_TIMEOUT_MS).toBeGreaterThan(0);
    expect(REPORTS_EXTENSION_ACCESS_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });
});
