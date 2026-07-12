import { describe, expect, it } from "vitest";

import { runAgenticSarpBoundaryCheck } from "./check-agentic-sarp";

describe("check-agentic-sarp", () => {
  it("passes the built-in SARP boundary fixture set", () => {
    const result = runAgenticSarpBoundaryCheck();
    expect(result.ok).toBe(true);
    expect(result.total).toBe(9);
    expect(result.failures).toEqual([]);
    expect(result.receipts.map((receipt) => receipt.verdict)).toEqual([
      "pass",
      "block",
      "escalate",
      "advisory",
      "block",
      "block",
      "block",
      "block",
      "block",
    ]);
    expect(result.fixtures.every((fixture) => fixture.capsule.llmTrajectoryReceipt)).toBe(true);
  });

  it("fails when a fixture verdict does not match", () => {
    const [fixture] = runAgenticSarpBoundaryCheck().fixtures;
    const result = runAgenticSarpBoundaryCheck([
      {
        ...fixture,
        expectedVerdict: "block",
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      {
        name: fixture.name,
        expectedVerdict: "block",
        actualVerdict: "pass",
      },
    ]);
  });
});
