import { describe, expect, it } from "vitest";
import {
  ASK_HELM_ACTION_INTENT_TYPES,
  loadAskHelmActionIntentCases,
  runAskHelmActionIntentEval,
} from "@/lib/evals/ask-helm-action-intent-evals";

describe("Ask Helm action intent evals", () => {
  it("loads a balanced v2 action seed set with real user phrasing backfill", () => {
    const cases = loadAskHelmActionIntentCases();
    const intentTypes = new Set(cases.map((item) => item.intentType));

    expect(cases).toHaveLength(36);
    expect(intentTypes.size).toBe(ASK_HELM_ACTION_INTENT_TYPES.length);
    for (const intentType of ASK_HELM_ACTION_INTENT_TYPES) {
      expect(cases.filter((item) => item.intentType === intentType)).toHaveLength(4);
    }
  });

  it("keeps action classification above the v2 threshold", () => {
    const summary = runAskHelmActionIntentEval();

    expect(summary.minimumPassRate).toBe(90);
    expect(summary.totalCases).toBe(36);
    expect(summary.passRate).toBeGreaterThanOrEqual(90);
    expect(summary.meetsMinimumPassRate).toBe(true);
    expect(summary.cases.filter((item) => !item.passed)).toEqual([]);
  });
});
