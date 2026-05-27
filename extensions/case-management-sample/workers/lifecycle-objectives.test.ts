import { describe, expect, it } from "vitest";
import { CASE_MANAGEMENT_SAMPLE_LIFECYCLE_OBJECTIVES } from "./lifecycle-objectives";

describe("case-management-sample lifecycle objectives", () => {
  it("stops at review packet preparation", () => {
    expect(CASE_MANAGEMENT_SAMPLE_LIFECYCLE_OBJECTIVES.at(-1)).toBe(
      "handoff_human_review",
    );
  });
});
