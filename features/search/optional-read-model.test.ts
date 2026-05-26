import { describe, expect, it } from "vitest";
import { resolveOptionalSearchReadModel } from "@/features/search/optional-read-model";

describe("optional search read model resolver", () => {
  it("returns the read model when it resolves before the timeout", async () => {
    await expect(
      resolveOptionalSearchReadModel(Promise.resolve("ready"), "fallback", 50),
    ).resolves.toEqual({
      data: "ready",
      degraded: false,
      reason: "ready",
    });
  });

  it("returns a degraded fallback when the read model rejects", async () => {
    await expect(
      resolveOptionalSearchReadModel(
        Promise.reject(new Error("search unavailable")),
        "fallback",
        50,
      ),
    ).resolves.toEqual({
      data: "fallback",
      degraded: true,
      reason: "error",
    });
  });

  it("returns a degraded fallback when the read model does not resolve in time", async () => {
    const never = new Promise<string>(() => undefined);

    await expect(
      resolveOptionalSearchReadModel(never, "fallback", 1),
    ).resolves.toEqual({
      data: "fallback",
      degraded: true,
      reason: "timeout",
    });
  });
});
