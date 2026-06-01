import { describe, expect, it } from "vitest";
import {
  loadAskHelmQueryIntentCases,
  runAskHelmQueryIntentEval,
} from "@/lib/evals/ask-helm-query-intent-evals";

describe("Ask Helm query intent evals", () => {
  it("loads the v1 seed set plus real-user query phrasing backfill", () => {
    const cases = loadAskHelmQueryIntentCases();
    const intentTypes = new Set(cases.map((item) => item.intentType));

    expect(cases).toHaveLength(38);
    expect(intentTypes.size).toBe(13);
  });

  it("keeps the rule-based baseline above the first-pass threshold", () => {
    const summary = runAskHelmQueryIntentEval();

    expect(summary.minimumPassRate).toBe(80);
    expect(summary.totalCases).toBe(38);
    expect(summary.passRate).toBeGreaterThanOrEqual(80);
    expect(summary.meetsMinimumPassRate).toBe(true);
    expect(summary.cases.filter((item) => !item.passed)).toEqual([]);
  });
});
