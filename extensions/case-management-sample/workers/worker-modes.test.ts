import { describe, expect, it } from "vitest";
import { CASE_MANAGEMENT_SAMPLE_WORKER_MODES } from "./worker-modes";

describe("case-management-sample worker modes", () => {
  it("keeps the pack in review-first preparation-only posture", () => {
    expect(CASE_MANAGEMENT_SAMPLE_WORKER_MODES).toEqual([
      "review_first",
      "preparation_only",
    ]);
  });
});
