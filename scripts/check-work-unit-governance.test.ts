import { describe, expect, it } from "vitest";

import {
  buildDefaultWorkUnitGovernanceFixtures,
  buildDefaultWorkUnitLedgerFixtures,
  buildDefaultWorkUnitOwnerLifecycleFixtures,
  buildDefaultWorkUnitRuntimeFixtures,
  buildDefaultWorkUnitTerminologyFixtures,
  runWorkUnitGovernanceBoundaryCheck,
} from "./check-work-unit-governance";

describe("check-work-unit-governance", () => {
  it("passes the built-in synthetic HWU boundary fixture set", () => {
    const result = runWorkUnitGovernanceBoundaryCheck();

    expect(result.ok).toBe(true);
    expect(result.total).toBe(21);
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
    expect(result.ledgerFixtures.map((fixture) => fixture.name)).toEqual([
      "ledger-append-plan-never-writes-from-public-core",
      "ledger-conflict-key-needs-supersede-baseline",
      "ledger-review-finding-waiver-needs-owner",
    ]);
    expect(result.ownerLifecycleFixtures.map((fixture) => fixture.name)).toEqual([
      "owner-lifecycle-never-sends-or-approves",
      "owner-lifecycle-ai-decision-is-blocked",
      "owner-lifecycle-proxy-needs-receipted-authorization",
      "owner-lifecycle-stale-related-mainline-change-needs-review",
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
      ledgerFixtures: [],
      ownerLifecycleFixtures: [],
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
      ledgerFixtures: [],
      ownerLifecycleFixtures: [],
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
      ledgerFixtures: [],
      ownerLifecycleFixtures: [],
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

  it("fails when a ledger fixture no longer detects its boundary rule", () => {
    const ledgerFixture = buildDefaultWorkUnitLedgerFixtures()[1];
    const result = runWorkUnitGovernanceBoundaryCheck({
      workUnitFixtures: [],
      transitionFixtures: [],
      terminologyFixtures: [],
      runtimeFixtures: [],
      ledgerFixtures: [
        {
          ...ledgerFixture,
          run: () => [],
        },
      ],
      ownerLifecycleFixtures: [],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      {
        name: "ledger-conflict-key-needs-supersede-baseline",
        check: "ledger",
        detail: "missing expected rule(s): conflict-key-active-event-needs-supersede",
      },
    ]);
  });

  it("fails when an owner lifecycle fixture no longer detects its boundary rule", () => {
    const ownerLifecycleFixture = buildDefaultWorkUnitOwnerLifecycleFixtures()[1];
    const result = runWorkUnitGovernanceBoundaryCheck({
      workUnitFixtures: [],
      transitionFixtures: [],
      terminologyFixtures: [],
      runtimeFixtures: [],
      ledgerFixtures: [],
      ownerLifecycleFixtures: [
        {
          ...ownerLifecycleFixture,
          run: () => [],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      {
        name: "owner-lifecycle-ai-decision-is-blocked",
        check: "owner-lifecycle",
        detail: "missing expected rule(s): human-owner-lifecycle-command-required",
      },
    ]);
  });
});
