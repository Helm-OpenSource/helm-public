import { describe, expect, it } from "vitest";

import {
  buildDefaultWorkUnitActivationHandoffFixtures,
  buildDefaultWorkUnitGovernanceFixtures,
  buildDefaultWorkUnitLedgerFixtures,
  buildDefaultWorkUnitOwnerLifecycleFixtures,
  buildDefaultWorkUnitRepairLearningFixtures,
  buildDefaultWorkUnitRuntimeFixtures,
  buildDefaultWorkUnitTerminologyFixtures,
  runWorkUnitGovernanceBoundaryCheck,
} from "./check-work-unit-governance";

describe("check-work-unit-governance", () => {
  it("passes the built-in synthetic HWU boundary fixture set", () => {
    const result = runWorkUnitGovernanceBoundaryCheck();

    expect(result.ok).toBe(true);
    expect(result.total).toBe(32);
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
    expect(result.activationHandoffFixtures.map((fixture) => fixture.name)).toEqual([
      "activation-handoff-never-executes-public-core-side-effects",
      "activation-handoff-before-mainline-is-blocked",
      "activation-handoff-ai-authorization-is-blocked",
      "activation-handoff-customer-effect-needs-remediation",
      "activation-handoff-stale-mainline-is-blocked",
    ]);
    expect(result.repairLearningFixtures.map((fixture) => fixture.name)).toEqual([
      "repair-learning-never-executes-public-core-side-effects",
      "repair-learning-ai-repair-returns-to-candidate",
      "repair-learning-ai-repair-cannot-change-check-rules",
      "repair-learning-finding-needs-asset-or-owner-waiver",
      "repair-learning-ai-waiver-is-blocked",
      "repair-learning-clean-asset",
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
      activationHandoffFixtures: [],
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
      activationHandoffFixtures: [],
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
      activationHandoffFixtures: [],
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
      activationHandoffFixtures: [],
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
      activationHandoffFixtures: [],
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

  it("fails when an activation handoff fixture no longer detects its boundary rule", () => {
    const activationFixture = buildDefaultWorkUnitActivationHandoffFixtures()[2];
    const result = runWorkUnitGovernanceBoundaryCheck({
      workUnitFixtures: [],
      transitionFixtures: [],
      terminologyFixtures: [],
      runtimeFixtures: [],
      ledgerFixtures: [],
      ownerLifecycleFixtures: [],
      activationHandoffFixtures: [
        {
          ...activationFixture,
          run: () => [],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      {
        name: "activation-handoff-ai-authorization-is-blocked",
        check: "activation-handoff",
        detail: "missing expected rule(s): activation-authorization-needs-human-owner",
      },
    ]);
  });

  it("fails when a repair learning fixture no longer detects its boundary rule", () => {
    const repairFixture = buildDefaultWorkUnitRepairLearningFixtures()[2];
    const result = runWorkUnitGovernanceBoundaryCheck({
      workUnitFixtures: [],
      transitionFixtures: [],
      terminologyFixtures: [],
      runtimeFixtures: [],
      ledgerFixtures: [],
      ownerLifecycleFixtures: [],
      activationHandoffFixtures: [],
      repairLearningFixtures: [
        {
          ...repairFixture,
          run: () => [],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      {
        name: "repair-learning-ai-repair-cannot-change-check-rules",
        check: "repair-learning",
        detail: "missing expected rule(s): ai-repair-cannot-change-check-rules",
      },
    ]);
  });
});
