import { describe, expect, it } from "vitest";

import {
  buildDefaultWorkUnitGovernanceFixtures,
  buildDefaultWorkUnitRuntimeFixtures,
  buildDefaultWorkUnitTerminologyFixtures,
  runWorkUnitGovernanceBoundaryCheck,
} from "./check-work-unit-governance";

describe("check-work-unit-governance", () => {
  it("passes the built-in synthetic HWU boundary fixture set", () => {
    const result = runWorkUnitGovernanceBoundaryCheck();

    expect(result.ok).toBe(true);
    expect(result.total).toBe(14);
    expect(result.failures).toEqual([]);
    expect(result.workUnitFixtures.map((fixture) => fixture.name)).toEqual([
      "clean-candidate",
      "ai-authoritative-state",
      "stale-snapshot-promotion",
      "conflict-key-mainline-drift",
      "high-risk-owner-missing",
      "runtime-activation-without-independent-receipt",
    ]);
    expect(result.runtimeFixtures.map((fixture) => fixture.name)).toEqual([
      "runtime-readout-never-executes-public-core-side-effects",
      "ai-runtime-acceptance-is-blocked",
      "private-mainline-projection-is-shape-only",
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
      runtimeFixtures: [],
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
      runtimeFixtures: [],
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

  it("fails when a runtime fixture no longer detects its boundary rule", () => {
    const runtimeFixture = buildDefaultWorkUnitRuntimeFixtures()[1];
    const result = runWorkUnitGovernanceBoundaryCheck({
      workUnitFixtures: [],
      transitionFixtures: [],
      terminologyFixtures: [],
      runtimeFixtures: [
        {
          ...runtimeFixture,
          run: () => [],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      {
        name: "ai-runtime-acceptance-is-blocked",
        check: "runtime",
        detail: "missing expected rule(s): human-owner-runtime-command-required",
      },
    ]);
  });
});
