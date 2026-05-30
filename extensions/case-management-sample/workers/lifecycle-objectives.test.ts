import { describe, expect, it } from "vitest";

import { buildLifecycleObjective } from "./lifecycle-objectives";

describe("case-management-sample lifecycle objectives", () => {
  it("keeps objective values non-negative and explainable", () => {
    const objective = buildLifecycleObjective({
      expectedRecoveryPoints: 91,
      estimatedEffortMinutes: 30,
      estimatedDaysToResolve: 2,
      subject: "CASE-SAMPLE-001",
    });

    expect(objective.expectedRecoveryPoints).toBe(91);
    expect(objective.estimatedEffortMinutes).toBe(30);
    expect(objective.estimatedDaysToResolve).toBe(2);
    expect(objective.reasonChain).toHaveLength(4);
  });
});
