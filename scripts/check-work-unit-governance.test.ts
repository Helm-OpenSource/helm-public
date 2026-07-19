import { describe, expect, it } from "vitest";

import {
  buildDefaultWorkUnitGovernanceFixtures,
  buildDefaultWorkUnitTerminologyFixtures,
  runWorkUnitGovernanceBoundaryCheck,
} from "./check-work-unit-governance";

describe("check-work-unit-governance", () => {
  it("passes the built-in synthetic HWU boundary fixture set", () => {
    const result = runWorkUnitGovernanceBoundaryCheck();

    expect(result.ok).toBe(true);
    expect(result.total).toBe(11);
    expect(result.failures).toEqual([]);
    expect(result.workUnitFixtures.map((fixture) => fixture.name)).toEqual([
      "clean-candidate",
      "ai-authoritative-state",
      "stale-snapshot-promotion",
      "conflict-key-mainline-drift",
      "high-risk-owner-missing",
      "runtime-activation-without-independent-receipt",
    ]);
  });

  it("fails when a negative work-unit fixture no longer detects its boundary rule", () => {
    const cleanFixture = buildDefaultWorkUnitGovernanceFixtures()[0];
    const result = runWorkUnitGovernanceBoundaryCheck({
      workUnitFixtures: [
        {
          ...cleanFixture,
          expectedRules: ["ai-cannot-authoritative-state"],
        },
      ],
      transitionFixtures: [],
      terminologyFixtures: [],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      {
        name: "clean-candidate",
        check: "work-unit",
        detail: "missing expected rule(s): ai-cannot-authoritative-state",
      },
    ]);
  });

  it("fails when user-visible GitHub terminology is not detected in nested content", () => {
    const cleanTerminologyFixture = buildDefaultWorkUnitTerminologyFixtures()[0];
    const result = runWorkUnitGovernanceBoundaryCheck({
      workUnitFixtures: [],
      transitionFixtures: [],
      terminologyFixtures: [
        {
          ...cleanTerminologyFixture,
          expectedTerms: ["Merge"],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      {
        name: "decision-card-clean",
        check: "terminology",
        detail: "missing expected rule(s): Merge",
      },
    ]);
  });
});
