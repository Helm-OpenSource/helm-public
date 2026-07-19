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
  planPrivateMainlineLedgerAppend,
  privateMainlineLedgerEventSchema,
  validateReviewFindingDisposition,
  type PrivateMainlineLedger,
} from "../lib/work-unit-governance/mainline-ledger";
import {
  buildOwnerLifecycleReadout,
  ownerReviewReceiptSchema,
  planOwnerLifecycleEvent,
  validateOwnerLifecycleReceipts,
  type OwnerReviewReceipt,
} from "../lib/work-unit-governance/owner-lifecycle";
import {
  buildPrivateMainlineProjection,
  buildWorkUnitRuntimeReadout,
  planWorkUnitRuntimeEvent,
} from "../lib/work-unit-governance/runtime";
import {
  buildSyntheticOwnerLifecyclePolicy,
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

export type WorkUnitGovernanceLedgerFixture = {
  readonly name: string;
  readonly run: () => readonly WorkUnitViolation[];
  readonly expectedRules: readonly string[];
};

export type WorkUnitGovernanceOwnerLifecycleFixture = {
  readonly name: string;
  readonly run: () => readonly WorkUnitViolation[];
  readonly expectedRules: readonly string[];
};

export type WorkUnitGovernanceFailure = {
  readonly name: string;
  readonly check:
    | "work-unit"
    | "transition"
    | "terminology"
    | "runtime"
    | "ledger"
    | "owner-lifecycle"
    | "checklist";
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
  readonly ledgerFixtures: readonly WorkUnitGovernanceLedgerFixture[];
  readonly ownerLifecycleFixtures: readonly WorkUnitGovernanceOwnerLifecycleFixture[];
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

const SYNTHETIC_LEDGER: PrivateMainlineLedger = {
  schemaVersion: "helm.private-mainline-ledger.v1",
  ledgerRef: "synthetic-ledger:work-unit-mainline",
  events: [],
  publicCoreCarriesRealInstance: false,
};

function syntheticMainlineEvent(input: {
  readonly workUnit: HelmWorkUnit;
  readonly eventId?: string;
  readonly baselineEventIds?: readonly string[];
  readonly supersedesEventIds?: readonly string[];
}) {
  const snapshotHash = computeWorkUnitSnapshotHash(input.workUnit);
  return privateMainlineLedgerEventSchema.parse({
    schemaVersion: "helm.private-mainline-ledger-event.v1",
    ledgerRef: SYNTHETIC_LEDGER.ledgerRef,
    eventId: input.eventId ?? `ledger-event:${input.workUnit.id}:mainline`,
    workUnitId: input.workUnit.id,
    eventType: "mainline_recorded",
    actor: { actorType: "human_owner", actorRef: "owner-1" },
    at: FIXTURE_TIME,
    snapshotHash,
    conflictKeys: input.workUnit.conflictKeys,
    baselineEventIds: input.baselineEventIds ?? [],
    supersedesEventIds: input.supersedesEventIds ?? [],
    auditRefs: ["synthetic://audit/mainline"],
    receipt: syntheticReceipt("mainline-receipt-1", snapshotHash),
    publicCoreCarriesRealInstance: false,
    createsExternalEffect: false,
  });
}

function acceptedSyntheticWorkUnit(overrides: Partial<HelmWorkUnit> = {}): HelmWorkUnit {
  const candidate = buildSyntheticWorkUnit({
    ...overrides,
    status: "candidate",
    decision: undefined,
    decisionSnapshotHash: undefined,
    mergeReceipt: undefined,
    activationReceipt: undefined,
  });
  const snapshotHash = computeWorkUnitSnapshotHash(candidate);
  return buildSyntheticWorkUnit({
    ...overrides,
    status: "accepted_by_human",
    decisionSnapshotHash: snapshotHash,
    decision: syntheticAcceptedDecision(snapshotHash),
  });
}

export function buildDefaultWorkUnitLedgerFixtures(): readonly WorkUnitGovernanceLedgerFixture[] {
  return [
    {
      name: "ledger-append-plan-never-writes-from-public-core",
      run: () => {
        const workUnit = acceptedSyntheticWorkUnit();
        const plan = planPrivateMainlineLedgerAppend({
          ledger: SYNTHETIC_LEDGER,
          workUnit,
          event: syntheticMainlineEvent({ workUnit }),
        });
        if (!plan.ok) return plan.violations;

        const violations: WorkUnitViolation[] = [];
        if (
          plan.publicCorePersists ||
          plan.publicCoreWritesPrivateMainline ||
          plan.createsExternalEffect ||
          plan.nextLedger.publicCoreCarriesRealInstance
        ) {
          violations.push({
            rule: "ledger-public-core-side-effect",
            detail: "append plan must remain shape-only",
          });
        }
        return violations;
      },
      expectedRules: [],
    },
    {
      name: "ledger-conflict-key-needs-supersede-baseline",
      run: () => {
        const firstWorkUnit = acceptedSyntheticWorkUnit();
        const firstEvent = syntheticMainlineEvent({ workUnit: firstWorkUnit });
        const firstPlan = planPrivateMainlineLedgerAppend({
          ledger: SYNTHETIC_LEDGER,
          workUnit: firstWorkUnit,
          event: firstEvent,
        });
        if (!firstPlan.ok) return firstPlan.violations;

        const secondWorkUnit = acceptedSyntheticWorkUnit({
          id: "hwu-synthetic-002",
          objective: "Supersede a synthetic mainline entry.",
        });
        const blockedPlan = planPrivateMainlineLedgerAppend({
          ledger: firstPlan.nextLedger,
          workUnit: secondWorkUnit,
          event: syntheticMainlineEvent({
            workUnit: secondWorkUnit,
            eventId: "ledger-event:hwu-synthetic-002:mainline",
          }),
        });
        return blockedPlan.ok
          ? [{ rule: "ledger-conflict-was-not-blocked", detail: secondWorkUnit.id }]
          : blockedPlan.violations;
      },
      expectedRules: ["conflict-key-active-event-needs-supersede"],
    },
    {
      name: "ledger-review-finding-waiver-needs-owner",
      run: () =>
        validateReviewFindingDisposition({
          findingId: "finding-ai-waiver",
          disposition: "owner_waived",
          summary: "AI attempted to waive a synthetic review finding.",
          recordedBy: { actorType: "ai", actorRef: "agent-1" },
          recordedAt: FIXTURE_TIME,
          waiverReason: "No human owner reviewed this.",
        }),
      expectedRules: ["finding-waiver-needs-human-owner"],
    },
  ];
}

function ownerReviewReceiptFor(
  workUnit: HelmWorkUnit,
  ownerRef: string,
  overrides: Partial<OwnerReviewReceipt> = {},
): OwnerReviewReceipt {
  return ownerReviewReceiptSchema.parse({
    schemaVersion: "helm.owner-review-receipt.v1",
    receiptId: `owner-review:${ownerRef}`,
    ownerRef,
    actor: { actorType: "human_owner", actorRef: ownerRef },
    decision: "accepted",
    snapshotHash: computeWorkUnitSnapshotHash(workUnit),
    decidedAt: FIXTURE_TIME,
    rationale: "Synthetic owner reviewed this exact snapshot.",
    publicCoreCarriesRealInstance: false,
    ...overrides,
  });
}

export function buildDefaultWorkUnitOwnerLifecycleFixtures(): readonly WorkUnitGovernanceOwnerLifecycleFixture[] {
  return [
    {
      name: "owner-lifecycle-never-sends-or-approves",
      run: () => {
        const readout = buildOwnerLifecycleReadout({
          workUnit: buildSyntheticWorkUnit(),
          policy: buildSyntheticOwnerLifecyclePolicy(),
          receipts: [],
          now: FIXTURE_TIME,
        });
        const violations: WorkUnitViolation[] = [];
        if (
          readout.publicCorePersists ||
          readout.sendsNotification ||
          readout.createsExternalEffect ||
          readout.grantsApproval
        ) {
          violations.push({
            rule: "owner-lifecycle-public-core-side-effect",
            detail: "readout",
          });
        }
        for (const action of readout.actions) {
          if (
            action.publicCoreExecutes ||
            action.sendsNotification ||
            action.createsExternalEffect ||
            action.grantsApproval
          ) {
            violations.push({
              rule: "owner-lifecycle-action-side-effect",
              detail: action.actionId,
            });
          }
        }
        return violations;
      },
      expectedRules: [],
    },
    {
      name: "owner-lifecycle-ai-decision-is-blocked",
      run: () => {
        const plan = planOwnerLifecycleEvent({
          workUnit: buildSyntheticWorkUnit(),
          policy: buildSyntheticOwnerLifecyclePolicy(),
          receipts: [],
          now: FIXTURE_TIME,
          event: {
            commandId: "record_owner_decision",
            actor: { actorType: "ai", actorRef: "agent-1" },
            at: FIXTURE_TIME,
            ownerRef: "owner-1",
            decision: "accepted",
            rationale: "AI attempted to approve a synthetic candidate.",
          },
        });
        return plan.ok
          ? [{ rule: "owner-lifecycle-ai-decision-was-not-blocked", detail: "record_owner_decision" }]
          : plan.violations;
      },
      expectedRules: ["human-owner-lifecycle-command-required"],
    },
    {
      name: "owner-lifecycle-proxy-needs-receipted-authorization",
      run: () => {
        const workUnit = buildSyntheticWorkUnit();
        return validateOwnerLifecycleReceipts({
          workUnit,
          policy: buildSyntheticOwnerLifecyclePolicy({
            authorizedProxies: [
              {
                ownerRef: "owner-1",
                proxy: {
                  ownerRef: "proxy-1",
                  ownerType: "authorized_human_proxy",
                  displayName: "Synthetic delegated reviewer",
                },
                authorizedBy: { actorType: "human_owner", actorRef: "owner-1" },
                authorizationReceiptRef: "owner-proxy-auth:owner-1:proxy-1",
                authorizedAt: FIXTURE_TIME,
                publicCoreCarriesRealInstance: false,
              },
            ],
          }),
          receipts: [
            ownerReviewReceiptFor(workUnit, "owner-1", {
              actor: { actorType: "authorized_human_proxy", actorRef: "proxy-1" },
              authorizationReceiptRef: undefined,
            }),
          ],
          now: FIXTURE_TIME,
        });
      },
      expectedRules: ["proxy-receipt-needs-authorization"],
    },
    {
      name: "owner-lifecycle-stale-related-mainline-change-needs-review",
      run: () => {
        const original = buildSyntheticWorkUnit();
        const drifted = buildSyntheticWorkUnit({
          relatedMainlineChanges: [
            {
              mainlineRef: "mainline:quote:Q-001:v2",
              conflictKeys: ["quote:Q-001"],
              changedAt: "2026-07-19T01:00:00.000Z",
            },
          ],
        });
        const readout = buildOwnerLifecycleReadout({
          workUnit: drifted,
          policy: buildSyntheticOwnerLifecyclePolicy(),
          receipts: [ownerReviewReceiptFor(original, "owner-1")],
          now: "2026-07-19T02:00:00.000Z",
        });
        return readout.blockers;
      },
      expectedRules: ["owner-review-stale-related-mainline-change"],
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
  readonly ledgerFixtures?: readonly WorkUnitGovernanceLedgerFixture[];
  readonly ownerLifecycleFixtures?: readonly WorkUnitGovernanceOwnerLifecycleFixture[];
} = {}): WorkUnitGovernanceCheckResult {
  const workUnitFixtures =
    options.workUnitFixtures ?? buildDefaultWorkUnitGovernanceFixtures();
  const transitionFixtures =
    options.transitionFixtures ?? buildDefaultWorkUnitTransitionFixtures();
  const terminologyFixtures =
    options.terminologyFixtures ?? buildDefaultWorkUnitTerminologyFixtures();
  const runtimeFixtures =
    options.runtimeFixtures ?? buildDefaultWorkUnitRuntimeFixtures();
  const ledgerFixtures =
    options.ledgerFixtures ?? buildDefaultWorkUnitLedgerFixtures();
  const ownerLifecycleFixtures =
    options.ownerLifecycleFixtures ?? buildDefaultWorkUnitOwnerLifecycleFixtures();

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

  for (const fixture of ledgerFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "ledger",
        actualRules: rulesFrom(fixture.run()),
        expectedRules: fixture.expectedRules,
      }),
    );
  }

  for (const fixture of ownerLifecycleFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "owner-lifecycle",
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
    ledgerFixtures.length +
    ownerLifecycleFixtures.length +
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
    ledgerFixtures,
    ownerLifecycleFixtures,
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
