#!/usr/bin/env tsx
/**
 * Public Core guard for Helm Work Unit governance.
 *
 * This is a deterministic synthetic fixture check. It does not read customer
 * data, write private mainline facts, activate runtime paths, send externally,
 * or grant approvals.
 */

import {
  buildDecisionCard,
  computeWorkUnitSnapshotHash,
  hwuAcceptanceChecklist,
  validateUserVisibleTerminology,
  validateWorkUnitTransition,
  validateWorkUnitWithinPublicCore,
  type HelmWorkUnit,
  type WorkUnitActor,
  type WorkUnitViolation,
} from "../lib/work-unit-governance/contracts";
import {
  buildPrivateMainlineProjection,
  buildWorkUnitRuntimeReadout,
  planWorkUnitRuntimeEvent,
} from "../lib/work-unit-governance/runtime";
import {
  buildSyntheticWorkUnit,
  syntheticAcceptedDecision,
  syntheticReceipt,
  WORK_UNIT_SYNTHETIC_TIME,
} from "../lib/work-unit-governance/synthetic-fixtures";

const FIXTURE_TIME = WORK_UNIT_SYNTHETIC_TIME;

const EXPECTED_REQUIREMENT_IDS = Array.from({ length: 15 }, (_, index) => {
  return `HWU-${String(index + 1).padStart(2, "0")}`;
});

export type WorkUnitGovernanceFixture = {
  readonly name: string;
  readonly workUnit: HelmWorkUnit;
  readonly expectedRules: readonly string[];
};

export type WorkUnitGovernanceTransitionFixture = {
  readonly name: string;
  readonly current: HelmWorkUnit;
  readonly next: HelmWorkUnit;
  readonly actor: WorkUnitActor;
  readonly expectedRules: readonly string[];
};

export type WorkUnitGovernanceTerminologyFixture = {
  readonly name: string;
  readonly input: unknown;
  readonly expectedTerms: readonly string[];
};

export type WorkUnitGovernanceRuntimeFixture = {
  readonly name: string;
  readonly run: () => readonly WorkUnitViolation[];
  readonly expectedRules: readonly string[];
};

export type WorkUnitGovernanceFailure = {
  readonly name: string;
  readonly check: "work-unit" | "transition" | "terminology" | "runtime" | "checklist";
  readonly detail: string;
};

export type WorkUnitGovernanceCheckResult = {
  readonly ok: boolean;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly workUnitFixtures: readonly WorkUnitGovernanceFixture[];
  readonly transitionFixtures: readonly WorkUnitGovernanceTransitionFixture[];
  readonly terminologyFixtures: readonly WorkUnitGovernanceTerminologyFixture[];
  readonly runtimeFixtures: readonly WorkUnitGovernanceRuntimeFixture[];
  readonly failures: readonly WorkUnitGovernanceFailure[];
};

function rulesFrom(violations: readonly WorkUnitViolation[]): readonly string[] {
  return violations.map((violation) => violation.rule);
}

export function buildDefaultWorkUnitGovernanceFixtures(): readonly WorkUnitGovernanceFixture[] {
  const candidate = buildSyntheticWorkUnit();
  const snapshotHash = computeWorkUnitSnapshotHash(candidate);
  const staleHash = "sha256:0000000000000000000000000000000000000000000000000000000000000000";

  return [
    {
      name: "clean-candidate",
      workUnit: candidate,
      expectedRules: [],
    },
    {
      name: "ai-authoritative-state",
      workUnit: buildSyntheticWorkUnit({
        status: "accepted_by_human",
        decisionSnapshotHash: snapshotHash,
        decision: {
          decidedBy: { actorType: "ai", actorRef: "agent-1" },
          decision: "accepted",
          decidedAt: FIXTURE_TIME,
          snapshotHash,
          rationale: "AI attempted to accept the synthetic candidate.",
        },
      }),
      expectedRules: ["ai-cannot-authoritative-state"],
    },
    {
      name: "stale-snapshot-promotion",
      workUnit: buildSyntheticWorkUnit({
        status: "promoted_to_mainline",
        decisionSnapshotHash: staleHash,
        decision: syntheticAcceptedDecision(staleHash),
        mergeReceipt: syntheticReceipt("merge-stale", staleHash),
      }),
      expectedRules: ["approval-snapshot-mismatch"],
    },
    {
      name: "conflict-key-mainline-drift",
      workUnit: buildSyntheticWorkUnit({
        status: "accepted_by_human",
        decisionSnapshotHash: snapshotHash,
        decision: syntheticAcceptedDecision(snapshotHash),
        relatedMainlineChanges: [
          {
            mainlineRef: "mainline:quote:Q-001:v2",
            conflictKeys: ["quote:Q-001"],
            changedAt: "2026-07-19T01:00:00.000Z",
          },
        ],
      }),
      expectedRules: ["approval-invalidated-by-related-mainline-change"],
    },
    {
      name: "high-risk-owner-missing",
      workUnit: buildSyntheticWorkUnit({
        owner: undefined,
        riskClass: "commercial_commitment",
      }),
      expectedRules: ["high-risk-owner-required"],
    },
    {
      name: "runtime-activation-without-independent-receipt",
      workUnit: buildSyntheticWorkUnit({
        status: "activated_by_human",
        riskClass: "runtime_activation",
        activationScope: "production_runtime",
        decisionSnapshotHash: snapshotHash,
        decision: syntheticAcceptedDecision(snapshotHash),
      }),
      expectedRules: ["activation-needs-independent-receipt"],
    },
  ];
}

export function buildDefaultWorkUnitTransitionFixtures(): readonly WorkUnitGovernanceTransitionFixture[] {
  return [
    {
      name: "ai-risk-downgrade",
      current: buildSyntheticWorkUnit({ riskClass: "customer_visible" }),
      next: buildSyntheticWorkUnit({ riskClass: "local_draft" }),
      actor: { actorType: "ai", actorRef: "agent-1" },
      expectedRules: ["ai-risk-downgrade"],
    },
    {
      name: "ai-human-only-state-transition",
      current: buildSyntheticWorkUnit(),
      next: buildSyntheticWorkUnit({ status: "accepted_by_human" }),
      actor: { actorType: "ai", actorRef: "agent-1" },
      expectedRules: ["human-owner-transition-required"],
    },
  ];
}

export function buildDefaultWorkUnitTerminologyFixtures(): readonly WorkUnitGovernanceTerminologyFixture[] {
  return [
    {
      name: "decision-card-clean",
      input: buildDecisionCard(buildSyntheticWorkUnit()),
      expectedTerms: [],
    },
    {
      name: "nested-github-terms",
      input: {
        primaryAction: "Merge",
        helper: { next: "Open the PR after CI completes." },
      },
      expectedTerms: ["Merge", "PR", "CI"],
    },
  ];
}

export function buildDefaultWorkUnitRuntimeFixtures(): readonly WorkUnitGovernanceRuntimeFixture[] {
  return [
    {
      name: "runtime-readout-never-executes-public-core-side-effects",
      run: () => {
        const readout = buildWorkUnitRuntimeReadout(buildSyntheticWorkUnit());
        const violations: WorkUnitViolation[] = [];
        if (readout.privateMainlineBoundary.publicCoreCarriesRealInstance) {
          violations.push({
            rule: "runtime-public-core-carries-real-instance",
            detail: "privateMainlineBoundary.publicCoreCarriesRealInstance",
          });
        }
        for (const command of readout.commands) {
          if (command.publicCoreExecutes || command.createsExternalEffect) {
            violations.push({
              rule: "runtime-command-side-effect",
              detail: command.commandId,
            });
          }
        }
        const activationCommand = readout.commands.find(
          (command) => command.commandId === "record_activation",
        );
        if (!activationCommand || activationCommand.enabled) {
          violations.push({
            rule: "runtime-activation-enabled-in-public-core",
            detail: "record_activation",
          });
        }
        return violations;
      },
      expectedRules: [],
    },
    {
      name: "ai-runtime-acceptance-is-blocked",
      run: () => {
        const plan = planWorkUnitRuntimeEvent({
          workUnit: buildSyntheticWorkUnit(),
          event: {
            commandId: "accept_candidate",
            actor: { actorType: "ai", actorRef: "agent-1" },
            at: FIXTURE_TIME,
            rationale: "AI attempted to accept a synthetic candidate.",
          },
        });
        if (!plan.ok) return plan.violations;
        return [
          {
            rule: "ai-runtime-acceptance-was-not-blocked",
            detail: "accept_candidate",
          },
        ];
      },
      expectedRules: ["human-owner-runtime-command-required"],
    },
    {
      name: "private-mainline-projection-is-shape-only",
      run: () => {
        const candidate = buildSyntheticWorkUnit();
        const snapshotHash = computeWorkUnitSnapshotHash(candidate);
        const accepted = buildSyntheticWorkUnit({
          status: "accepted_by_human",
          decisionSnapshotHash: snapshotHash,
          decision: syntheticAcceptedDecision(snapshotHash),
        });
        const promoted = buildSyntheticWorkUnit({
          status: "promoted_to_mainline",
          decisionSnapshotHash: snapshotHash,
          decision: syntheticAcceptedDecision(snapshotHash),
          mergeReceipt: syntheticReceipt("merge-1", snapshotHash),
        });
        const projection = buildPrivateMainlineProjection([candidate, accepted, promoted]);
        const violations: WorkUnitViolation[] = [];
        if (projection.publicCoreCarriesRealInstance) {
          violations.push({
            rule: "projection-public-core-carries-real-instance",
            detail: "publicCoreCarriesRealInstance",
          });
        }
        if (projection.entries.some((entry) => entry.publicCoreCarriesRealInstance)) {
          violations.push({
            rule: "projection-entry-carries-real-instance",
            detail: "entries.publicCoreCarriesRealInstance",
          });
        }
        const projectedStates = projection.entries.map((entry) => entry.state);
        if (projectedStates.join("|") !== "accepted_by_human|promoted_to_mainline") {
          violations.push({
            rule: "projection-unexpected-entry-states",
            detail: projectedStates.join(", "),
          });
        }
        return violations;
      },
      expectedRules: [],
    },
  ];
}

function compareExpectedRules(options: {
  readonly name: string;
  readonly check: WorkUnitGovernanceFailure["check"];
  readonly actualRules: readonly string[];
  readonly expectedRules: readonly string[];
}): readonly WorkUnitGovernanceFailure[] {
  const missing = options.expectedRules.filter((rule) => !options.actualRules.includes(rule));
  if (missing.length > 0) {
    return [
      {
        name: options.name,
        check: options.check,
        detail: `missing expected rule(s): ${missing.join(", ")}`,
      },
    ];
  }

  if (options.expectedRules.length === 0 && options.actualRules.length > 0) {
    return [
      {
        name: options.name,
        check: options.check,
        detail: `unexpected rule(s): ${options.actualRules.join(", ")}`,
      },
    ];
  }

  return [];
}

export function runWorkUnitGovernanceBoundaryCheck(options: {
  readonly workUnitFixtures?: readonly WorkUnitGovernanceFixture[];
  readonly transitionFixtures?: readonly WorkUnitGovernanceTransitionFixture[];
  readonly terminologyFixtures?: readonly WorkUnitGovernanceTerminologyFixture[];
  readonly runtimeFixtures?: readonly WorkUnitGovernanceRuntimeFixture[];
} = {}): WorkUnitGovernanceCheckResult {
  const workUnitFixtures =
    options.workUnitFixtures ?? buildDefaultWorkUnitGovernanceFixtures();
  const transitionFixtures =
    options.transitionFixtures ?? buildDefaultWorkUnitTransitionFixtures();
  const terminologyFixtures =
    options.terminologyFixtures ?? buildDefaultWorkUnitTerminologyFixtures();
  const runtimeFixtures =
    options.runtimeFixtures ?? buildDefaultWorkUnitRuntimeFixtures();

  const failures: WorkUnitGovernanceFailure[] = [];

  for (const fixture of workUnitFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "work-unit",
        actualRules: rulesFrom(validateWorkUnitWithinPublicCore(fixture.workUnit)),
        expectedRules: fixture.expectedRules,
      }),
    );
  }

  for (const fixture of transitionFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "transition",
        actualRules: rulesFrom(
          validateWorkUnitTransition({
            current: fixture.current,
            next: fixture.next,
            actor: fixture.actor,
          }),
        ),
        expectedRules: fixture.expectedRules,
      }),
    );
  }

  for (const fixture of terminologyFixtures) {
    const actualTerms = validateUserVisibleTerminology(fixture.input).map((violation) => violation.term);
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "terminology",
        actualRules: actualTerms,
        expectedRules: fixture.expectedTerms,
      }),
    );
  }

  for (const fixture of runtimeFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "runtime",
        actualRules: rulesFrom(fixture.run()),
        expectedRules: fixture.expectedRules,
      }),
    );
  }

  const actualRequirementIds = hwuAcceptanceChecklist.map((item) => item.requirementId);
  if (actualRequirementIds.join("|") !== EXPECTED_REQUIREMENT_IDS.join("|")) {
    failures.push({
      name: "hwu-acceptance-checklist",
      check: "checklist",
      detail: `expected ${EXPECTED_REQUIREMENT_IDS.join(", ")}, got ${actualRequirementIds.join(", ")}`,
    });
  }

  const total =
    workUnitFixtures.length +
    transitionFixtures.length +
    terminologyFixtures.length +
    runtimeFixtures.length +
    1;

  return {
    ok: failures.length === 0,
    total,
    passed: total - failures.length,
    failed: failures.length,
    workUnitFixtures,
    transitionFixtures,
    terminologyFixtures,
    runtimeFixtures,
    failures,
  };
}

function main(): number {
  const result = runWorkUnitGovernanceBoundaryCheck();
  if (result.ok) {
    console.log(
      `[check:work-unit-governance] PASS - ${result.passed}/${result.total} check(s) matched expected boundary outcomes.`,
    );
    return 0;
  }

  console.error(
    `[check:work-unit-governance] FAIL - ${result.failed}/${result.total} check(s) mismatched:`,
  );
  for (const failure of result.failures) {
    console.error(`- ${failure.check}/${failure.name}: ${failure.detail}`);
  }
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
