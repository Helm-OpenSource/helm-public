import { describe, expect, it } from "vitest";
import { decideCaseStewardship } from "./decide";

describe("case-management-sample case stewardship driver", () => {
  it("flags aged cases for review", () => {
    expect(decideCaseStewardship({ unresolvedDays: 4 }).mode).toBe(
      "review_required",
    );
  });
});
