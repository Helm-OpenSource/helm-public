import { describe, expect, it } from "vitest";

import { SOLUTION_EXTENSION_CATALOG } from "@/lib/extensions/solution-extension-catalog";

describe("public solution extension catalog", () => {
  it("uses the checked-in case-management sample catalog when the registry stub is empty", () => {
    expect(SOLUTION_EXTENSION_CATALOG.map((entry) => entry.extensionKey)).toEqual([
      "case-management-sample-signals",
      "case-management-sample-bi-report",
      "case-management-sample-workers",
    ]);
  });

  it("does not expose stale public-samples extension keys", () => {
    expect(
      SOLUTION_EXTENSION_CATALOG.some((entry) => entry.extensionKey.startsWith("public-samples-")),
    ).toBe(false);
  });
});
