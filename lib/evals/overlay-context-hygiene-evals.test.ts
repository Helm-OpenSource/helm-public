import { describe, expect, it } from "vitest";

import { runOverlayHygieneEval } from "@/lib/evals/overlay-context-hygiene-evals";

describe("overlay context hygiene eval", () => {
  it("passes: clean→passed, injection→failed, synthetic skipped ok, real skipped rejected", () => {
    const metrics = runOverlayHygieneEval();
    expect(metrics.cleanScansPassed).toBe(true);
    expect(metrics.injectionScansFailed).toBe(true);
    expect(metrics.syntheticSkippedAccepted).toBe(true);
    expect(metrics.realSkippedRejected).toBe(true);
    expect(metrics.passed).toBe(true);
  });
});
