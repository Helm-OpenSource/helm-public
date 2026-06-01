import { describe, expect, it } from "vitest";
import { resolveOptionalApprovalsReadModel } from "@/features/approvals/optional-read-model";

describe("optional approvals read model resolver", () => {
  it("returns the read model when it resolves before the timeout", async () => {
    await expect(
      resolveOptionalApprovalsReadModel(Promise.resolve("ready"), "fallback", 50),
    ).resolves.toBe("ready");
  });

  it("returns the fallback when the read model rejects", async () => {
    await expect(
      resolveOptionalApprovalsReadModel(
        Promise.reject(new Error("read model unavailable")),
        "fallback",
        50,
      ),
    ).resolves.toBe("fallback");
  });

  it("returns the fallback when the read model does not resolve in time", async () => {
    const never = new Promise<string>(() => undefined);

    await expect(
      resolveOptionalApprovalsReadModel(never, "fallback", 1),
    ).resolves.toBe("fallback");
  });
});
