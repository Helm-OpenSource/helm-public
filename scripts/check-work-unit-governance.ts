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
  buildActivationHandoffReadout,
  validateActivationAuthorization,
  validateActivationHandoffRequest,
} from "../lib/work-unit-governance/activation-handoff";
import {
  activationRuntimeBindingSchema,
  buildActivationRuntimeExecutionEnvelope,
  buildPublicCoreNoopActivationRuntimeExecutor,
  validateActivationRuntimeBinding,
  type ActivationRuntimeBinding,
} from "../lib/work-unit-governance/activation-runtime-binding";
import {
  planPrivateMainlineLedgerAppend,
  privateMainlineLedgerEventSchema,
  validateReviewFindingDisposition,
  type PrivateMainlineLedger,
} from "../lib/work-unit-governance/mainline-ledger";
import {
  buildPrivateMainlineStoreAppendEnvelope,
  buildPublicCoreNoopPrivateMainlineStore,
  privateMainlineStoreBindingSchema,
  validatePrivateMainlineStoreBinding,
  type PrivateMainlineStoreBinding,
} from "../lib/work-unit-governance/private-mainline-store";
import {
  buildOwnerLifecycleReadout,
  ownerReviewReceiptSchema,
  planOwnerLifecycleEvent,
  validateOwnerLifecycleReceipts,
  type OwnerReviewReceipt,
} from "../lib/work-unit-governance/owner-lifecycle";
import {
  buildOwnerNotificationHandoffEnvelope,
  buildPublicCoreNoopOwnerNotificationDispatcher,
  ownerNotificationBindingSchema,
  validateOwnerNotificationBinding,
  type OwnerNotificationBinding,
} from "../lib/work-unit-governance/owner-notification-binding";
import {
  buildWorkUnitProofPackage,
  buildWorkUnitProofPackageReadout,
  validateWorkUnitProofPackage,
} from "../lib/work-unit-governance/proof-package";
import {
  buildRepairLearningReadout,
  validateLearningFindingResolution,
  validateWorkUnitRepairCandidate,
} from "../lib/work-unit-governance/repair-learning-loop";
import {
  buildPrivateMainlineProjection,
  buildWorkUnitRuntimeReadout,
  planWorkUnitRuntimeEvent,
} from "../lib/work-unit-governance/runtime";
import {
  buildSyntheticActivationAuthorityReceipt,
  buildSyntheticActivationHandoffRequest,
  buildSyntheticFailedWorkUnit,
  buildSyntheticLearningAssetDraft,
  buildSyntheticLearningFinding,
  buildSyntheticOwnerLifecyclePolicy,
  buildSyntheticPromotedWorkUnit,
  buildSyntheticRepairedWorkUnit,
  buildSyntheticRepairCandidateRecord,
  buildSyntheticWorkUnit,
  buildSyntheticWorkUnitProofPackage,
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

export type WorkUnitGovernanceOwnerNotificationFixture = {
  readonly name: string;
  readonly run: () => readonly WorkUnitViolation[];
  readonly expectedRules: readonly string[];
};

export type WorkUnitGovernanceActivationHandoffFixture = {
  readonly name: string;
  readonly run: () => readonly WorkUnitViolation[];
  readonly expectedRules: readonly string[];
};

export type WorkUnitGovernanceActivationRuntimeFixture = {
  readonly name: string;
  readonly run: () => readonly WorkUnitViolation[];
  readonly expectedRules: readonly string[];
};

export type WorkUnitGovernanceRepairLearningFixture = {
  readonly name: string;
  readonly run: () => readonly WorkUnitViolation[];
  readonly expectedRules: readonly string[];
};

export type WorkUnitGovernanceProofPackageFixture = {
  readonly name: string;
  readonly run: () => readonly WorkUnitViolation[];
  readonly expectedRules: readonly string[];
};

export type WorkUnitGovernancePrivateMainlineStoreFixture = {
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
    | "owner-notification"
    | "activation-handoff"
    | "activation-runtime"
    | "repair-learning"
    | "proof-package"
    | "private-mainline-store"
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
  readonly ownerNotificationFixtures: readonly WorkUnitGovernanceOwnerNotificationFixture[];
  readonly activationHandoffFixtures: readonly WorkUnitGovernanceActivationHandoffFixture[];
  readonly activationRuntimeFixtures: readonly WorkUnitGovernanceActivationRuntimeFixture[];
  readonly repairLearningFixtures: readonly WorkUnitGovernanceRepairLearningFixture[];
  readonly proofPackageFixtures: readonly WorkUnitGovernanceProofPackageFixture[];
  readonly privateMainlineStoreFixtures: readonly WorkUnitGovernancePrivateMainlineStoreFixture[];
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

function privateMainlineStoreBinding(
  overrides: Partial<PrivateMainlineStoreBinding> = {},
): PrivateMainlineStoreBinding {
  return privateMainlineStoreBindingSchema.parse({
    schemaVersion: "helm.private-mainline-store-binding.v1",
    bindingRef: "synthetic-binding:private-mainline-store",
    storeMode: "private_control_plane",
    storeRef: "synthetic://private-mainline-store",
    authorityRef: "synthetic://owner-plane/work-unit-mainline",
    capabilities: {
      appendOnly: true,
      snapshotBoundReceipts: true,
      conflictKeySerialization: true,
      humanOwnerReceiptRequired: true,
      activationAuthoritySeparated: true,
      privateStorePersists: true,
      publicCoreCarriesRealInstance: false,
      publicCorePersists: false,
      publicCoreWritesPrivateMainline: false,
      publicCoreSendsExternally: false,
      publicCoreActivatesRuntime: false,
    },
    ...overrides,
  });
}

function publicCoreNoopMainlineStoreBinding(
  overrides: Partial<PrivateMainlineStoreBinding> = {},
): PrivateMainlineStoreBinding {
  return privateMainlineStoreBindingSchema.parse({
    ...privateMainlineStoreBinding({
      storeMode: "public_core_noop",
      storeRef: "public-core:no-private-mainline-store",
      authorityRef: undefined,
      capabilities: {
        appendOnly: true,
        snapshotBoundReceipts: true,
        conflictKeySerialization: true,
        humanOwnerReceiptRequired: true,
        activationAuthoritySeparated: true,
        privateStorePersists: false,
        publicCoreCarriesRealInstance: false,
        publicCorePersists: false,
        publicCoreWritesPrivateMainline: false,
        publicCoreSendsExternally: false,
        publicCoreActivatesRuntime: false,
      },
    }),
    ...overrides,
  });
}

export function buildDefaultWorkUnitPrivateMainlineStoreFixtures(): readonly WorkUnitGovernancePrivateMainlineStoreFixture[] {
  return [
    {
      name: "private-mainline-store-envelope-is-handoff-only",
      run: () => {
        const workUnit = acceptedSyntheticWorkUnit();
        const envelope = buildPrivateMainlineStoreAppendEnvelope({
          binding: privateMainlineStoreBinding(),
          ledger: SYNTHETIC_LEDGER,
          workUnit,
          event: syntheticMainlineEvent({ workUnit }),
          requestedBy: { actorType: "system", actorRef: "mainline-handoff-builder" },
          requestedAt: FIXTURE_TIME,
        });
        if (!envelope.ok) return envelope.violations;

        const violations: WorkUnitViolation[] = [];
        if (
          envelope.envelope.readinessClaim !== "not_readiness" ||
          !envelope.envelope.privateStoreRequired ||
          envelope.envelope.publicCoreCarriesRealInstance ||
          envelope.envelope.publicCorePersists ||
          envelope.envelope.publicCoreWritesPrivateMainline ||
          envelope.envelope.createsExternalEffect ||
          envelope.envelope.sendsExternally ||
          envelope.envelope.writesTarget ||
          envelope.envelope.activatesRuntime ||
          envelope.envelope.grantsApproval ||
          envelope.appendPlan.publicCorePersists ||
          envelope.appendPlan.publicCoreWritesPrivateMainline ||
          envelope.appendPlan.createsExternalEffect
        ) {
          violations.push({
            rule: "private-mainline-store-envelope-side-effect",
            detail: envelope.envelope.envelopeId,
          });
        }
        return violations;
      },
      expectedRules: [],
    },
    {
      name: "private-mainline-store-public-noop-cannot-append",
      run: () => {
        const workUnit = acceptedSyntheticWorkUnit();
        const envelope = buildPrivateMainlineStoreAppendEnvelope({
          binding: publicCoreNoopMainlineStoreBinding(),
          ledger: SYNTHETIC_LEDGER,
          workUnit,
          event: syntheticMainlineEvent({ workUnit }),
          requestedBy: { actorType: "system", actorRef: "mainline-handoff-builder" },
          requestedAt: FIXTURE_TIME,
        });
        if (!envelope.ok) return envelope.violations;

        const appendResult = buildPublicCoreNoopPrivateMainlineStore().append(envelope.envelope);
        return appendResult.ok
          ? [{ rule: "private-mainline-store-public-noop-wrote", detail: envelope.envelope.eventId }]
          : appendResult.violations;
      },
      expectedRules: ["public-core-private-mainline-store-is-noop"],
    },
    {
      name: "private-mainline-store-missing-governance-capability-is-blocked",
      run: () =>
        validatePrivateMainlineStoreBinding({
          ...privateMainlineStoreBinding(),
          authorityRef: undefined,
          capabilities: {
            ...privateMainlineStoreBinding().capabilities,
            appendOnly: false,
            conflictKeySerialization: false,
            humanOwnerReceiptRequired: false,
          },
        }),
      expectedRules: [
        "private-store-authority-required",
        "private-store-append-only-required",
        "private-store-conflict-serialization-required",
        "private-store-human-owner-receipt-required",
      ],
    },
    {
      name: "private-mainline-store-public-core-side-effect-claim-is-blocked",
      run: () =>
        validatePrivateMainlineStoreBinding({
          ...publicCoreNoopMainlineStoreBinding(),
          capabilities: {
            ...publicCoreNoopMainlineStoreBinding().capabilities,
            privateStorePersists: true,
            publicCoreCarriesRealInstance: true,
            publicCorePersists: true,
            publicCoreWritesPrivateMainline: true,
            publicCoreSendsExternally: true,
            publicCoreActivatesRuntime: true,
          },
        }),
      expectedRules: [
        "public-core-noop-cannot-persist-private-store",
        "private-store-public-core-real-instance-forbidden",
        "private-store-public-core-persistence-forbidden",
        "private-store-public-core-write-forbidden",
        "private-store-public-core-send-forbidden",
        "private-store-public-core-activation-forbidden",
      ],
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

function ownerNotificationBinding(
  overrides: Partial<OwnerNotificationBinding> = {},
): OwnerNotificationBinding {
  return ownerNotificationBindingSchema.parse({
    schemaVersion: "helm.owner-notification-binding.v1",
    bindingRef: "synthetic-binding:owner-notification",
    dispatcherMode: "private_control_plane",
    dispatcherRef: "synthetic://private-owner-notifications",
    channel: "private_inbox",
    authorityRef: "synthetic://owner-plane/notification-authority",
    deliveryPolicyRef: "synthetic://owner-plane/delivery-policy",
    capabilities: {
      ownerRefsOnly: true,
      snapshotBoundMessages: true,
      humanOwnerAuthorityRequired: true,
      escalationPolicyRequired: true,
      contactDetailsStoredOutsidePublicCore: true,
      redactedEnvelopeOnly: true,
      privateDispatcherSends: true,
      privateDispatcherPersistsReceipt: true,
      publicCoreCarriesRealInstance: false,
      publicCorePersists: false,
      publicCoreSendsNotification: false,
      publicCoreWritesTarget: false,
      publicCoreActivatesRuntime: false,
      publicCoreGrantsApproval: false,
    },
    ...overrides,
  });
}

function publicCoreNoopOwnerNotificationBinding(
  overrides: Partial<OwnerNotificationBinding> = {},
): OwnerNotificationBinding {
  return ownerNotificationBindingSchema.parse({
    ...ownerNotificationBinding({
      dispatcherMode: "public_core_noop",
      dispatcherRef: "public-core:no-owner-notification-dispatcher",
      authorityRef: undefined,
      deliveryPolicyRef: undefined,
      capabilities: {
        ownerRefsOnly: true,
        snapshotBoundMessages: true,
        humanOwnerAuthorityRequired: true,
        escalationPolicyRequired: true,
        contactDetailsStoredOutsidePublicCore: true,
        redactedEnvelopeOnly: true,
        privateDispatcherSends: false,
        privateDispatcherPersistsReceipt: false,
        publicCoreCarriesRealInstance: false,
        publicCorePersists: false,
        publicCoreSendsNotification: false,
        publicCoreWritesTarget: false,
        publicCoreActivatesRuntime: false,
        publicCoreGrantsApproval: false,
      },
    }),
    ...overrides,
  });
}

export function buildDefaultWorkUnitOwnerNotificationFixtures(): readonly WorkUnitGovernanceOwnerNotificationFixture[] {
  return [
    {
      name: "owner-notification-envelope-is-handoff-only",
      run: () => {
        const envelope = buildOwnerNotificationHandoffEnvelope({
          binding: ownerNotificationBinding(),
          workUnit: buildSyntheticWorkUnit(),
          policy: buildSyntheticOwnerLifecyclePolicy({
            reviewDueAt: "2026-07-20T00:00:00.000Z",
          }),
          receipts: [],
          requestedBy: { actorType: "system", actorRef: "owner-notification-handoff-builder" },
          requestedAt: FIXTURE_TIME,
          notificationKind: "owner_review_requested",
          reason: "Synthetic owner review is pending.",
        });
        if (!envelope.ok) return envelope.violations;

        const serialized = JSON.stringify(envelope.envelope);
        const violations: WorkUnitViolation[] = [];
        if (
          envelope.envelope.readinessClaim !== "not_readiness" ||
          envelope.envelope.approvalClaim !== "not_approval" ||
          !envelope.envelope.privateDispatcherRequired ||
          !envelope.envelope.deliveryReceiptRequired ||
          envelope.envelope.publicCoreCarriesRealInstance ||
          envelope.envelope.publicCorePersists ||
          envelope.envelope.createsExternalEffect ||
          envelope.envelope.sendsNotification ||
          envelope.envelope.sendsExternally ||
          envelope.envelope.writesTarget ||
          envelope.envelope.activatesRuntime ||
          envelope.envelope.grantsApproval ||
          envelope.publicCorePersists ||
          envelope.sendsNotification ||
          envelope.createsExternalEffect ||
          envelope.grantsApproval
        ) {
          violations.push({
            rule: "owner-notification-envelope-side-effect",
            detail: envelope.envelope.envelopeId,
          });
        }
        if (serialized.includes("@")) {
          violations.push({
            rule: "owner-notification-envelope-leaked-contact-detail",
            detail: envelope.envelope.envelopeId,
          });
        }
        return violations;
      },
      expectedRules: [],
    },
    {
      name: "owner-notification-public-noop-cannot-dispatch",
      run: () => {
        const envelope = buildOwnerNotificationHandoffEnvelope({
          binding: publicCoreNoopOwnerNotificationBinding(),
          workUnit: buildSyntheticWorkUnit(),
          policy: buildSyntheticOwnerLifecyclePolicy({
            reviewDueAt: "2026-07-20T00:00:00.000Z",
          }),
          receipts: [],
          requestedBy: { actorType: "system", actorRef: "owner-notification-handoff-builder" },
          requestedAt: FIXTURE_TIME,
          notificationKind: "owner_review_requested",
          reason: "Synthetic owner review is pending.",
        });
        if (!envelope.ok) return envelope.violations;

        const dispatchResult =
          buildPublicCoreNoopOwnerNotificationDispatcher().dispatch(envelope.envelope);
        return dispatchResult.ok
          ? [{ rule: "owner-notification-public-noop-sent", detail: envelope.envelope.envelopeId }]
          : dispatchResult.violations;
      },
      expectedRules: ["public-core-owner-notification-dispatcher-is-noop"],
    },
    {
      name: "owner-notification-missing-governance-capability-is-blocked",
      run: () =>
        validateOwnerNotificationBinding({
          ...ownerNotificationBinding(),
          authorityRef: undefined,
          deliveryPolicyRef: undefined,
          capabilities: {
            ...ownerNotificationBinding().capabilities,
            ownerRefsOnly: false,
            snapshotBoundMessages: false,
            humanOwnerAuthorityRequired: false,
            escalationPolicyRequired: false,
            redactedEnvelopeOnly: false,
            privateDispatcherSends: false,
            privateDispatcherPersistsReceipt: false,
          },
        }),
      expectedRules: [
        "owner-notification-private-authority-required",
        "owner-notification-private-delivery-policy-required",
        "owner-notification-owner-refs-only-required",
        "owner-notification-snapshot-bound-required",
        "owner-notification-human-owner-authority-required",
        "owner-notification-escalation-policy-required",
        "owner-notification-redacted-envelope-required",
        "owner-notification-private-dispatch-required",
        "owner-notification-private-receipt-persistence-required",
      ],
    },
    {
      name: "owner-notification-public-core-side-effect-claim-is-blocked",
      run: () =>
        validateOwnerNotificationBinding({
          ...publicCoreNoopOwnerNotificationBinding(),
          capabilities: {
            ...publicCoreNoopOwnerNotificationBinding().capabilities,
            privateDispatcherSends: true,
            privateDispatcherPersistsReceipt: true,
            publicCoreCarriesRealInstance: true,
            publicCorePersists: true,
            publicCoreSendsNotification: true,
            publicCoreWritesTarget: true,
            publicCoreActivatesRuntime: true,
            publicCoreGrantsApproval: true,
          },
        }),
      expectedRules: [
        "public-core-notification-dispatcher-cannot-send",
        "public-core-notification-dispatcher-cannot-persist-receipt",
        "owner-notification-public-core-real-instance-forbidden",
        "owner-notification-public-core-persistence-forbidden",
        "owner-notification-public-core-send-forbidden",
        "owner-notification-public-core-write-forbidden",
        "owner-notification-public-core-activation-forbidden",
        "owner-notification-public-core-approval-forbidden",
      ],
    },
    {
      name: "owner-notification-closed-work-unit-does-not-trigger-review",
      run: () => {
        const envelope = buildOwnerNotificationHandoffEnvelope({
          binding: ownerNotificationBinding(),
          workUnit: acceptedSyntheticWorkUnit(),
          policy: buildSyntheticOwnerLifecyclePolicy(),
          receipts: [],
          requestedBy: { actorType: "system", actorRef: "owner-notification-handoff-builder" },
          requestedAt: FIXTURE_TIME,
          notificationKind: "owner_review_requested",
          reason: "Synthetic owner review is pending.",
        });
        return envelope.ok
          ? [{ rule: "owner-notification-closed-work-unit-sent", detail: envelope.envelope.envelopeId }]
          : envelope.violations;
      },
      expectedRules: ["owner-notification-no-pending-owner"],
    },
  ];
}

export function buildDefaultWorkUnitActivationHandoffFixtures(): readonly WorkUnitGovernanceActivationHandoffFixture[] {
  return [
    {
      name: "activation-handoff-never-executes-public-core-side-effects",
      run: () => {
        const workUnit = buildSyntheticPromotedWorkUnit({
          activationScope: "production_runtime",
        });
        const readout = buildActivationHandoffReadout({
          workUnit,
          request: buildSyntheticActivationHandoffRequest(workUnit),
        });
        const violations: WorkUnitViolation[] = [];
        if (
          readout.publicCorePersists ||
          readout.createsExternalEffect ||
          readout.sendsExternally ||
          readout.writesTarget ||
          readout.activatesRuntime ||
          readout.grantsApproval
        ) {
          violations.push({
            rule: "activation-handoff-public-core-side-effect",
            detail: "readout",
          });
        }
        for (const action of readout.actions) {
          if (
            action.publicCoreExecutes ||
            action.createsExternalEffect ||
            action.sendsExternally ||
            action.writesTarget ||
            action.activatesRuntime ||
            action.grantsApproval
          ) {
            violations.push({
              rule: "activation-handoff-action-side-effect",
              detail: action.actionId,
            });
          }
        }
        return violations;
      },
      expectedRules: [],
    },
    {
      name: "activation-handoff-before-mainline-is-blocked",
      run: () => {
        const workUnit = buildSyntheticWorkUnit({
          activationScope: "production_runtime",
        });
        return validateActivationHandoffRequest({
          workUnit,
          request: buildSyntheticActivationHandoffRequest(workUnit),
        });
      },
      expectedRules: ["activation-handoff-mainline-required"],
    },
    {
      name: "activation-handoff-ai-authorization-is-blocked",
      run: () => {
        const workUnit = buildSyntheticPromotedWorkUnit({
          activationScope: "production_runtime",
        });
        const request = buildSyntheticActivationHandoffRequest(workUnit);
        return validateActivationAuthorization({
          workUnit,
          request,
          receipt: buildSyntheticActivationAuthorityReceipt(workUnit, request, {
            actor: { actorType: "ai", actorRef: "agent-1" },
          }),
        });
      },
      expectedRules: ["activation-authorization-needs-human-owner"],
    },
    {
      name: "activation-handoff-customer-effect-needs-remediation",
      run: () => {
        const workUnit = buildSyntheticPromotedWorkUnit({
          activationScope: "customer_visible",
          rollbackOrRemediationPlan: {
            kind: "rollback",
            summary: "Rollback is not enough for synthetic customer-visible effects.",
            responsibleOwnerRef: "owner-1",
          },
        });
        return validateActivationHandoffRequest({
          workUnit,
          request: buildSyntheticActivationHandoffRequest(workUnit),
        });
      },
      expectedRules: ["activation-handoff-remediation-required"],
    },
    {
      name: "activation-handoff-stale-mainline-is-blocked",
      run: () => {
        const workUnit = buildSyntheticPromotedWorkUnit({
          activationScope: "production_runtime",
          relatedMainlineChanges: [
            {
              mainlineRef: "mainline:quote:Q-001:v2",
              conflictKeys: ["quote:Q-001"],
              changedAt: "2026-07-19T01:00:00.000Z",
            },
          ],
        });
        return validateActivationHandoffRequest({
          workUnit,
          request: buildSyntheticActivationHandoffRequest(workUnit),
        });
      },
      expectedRules: ["activation-handoff-stale-mainline"],
    },
  ];
}

function activationRuntimeBinding(
  overrides: Partial<ActivationRuntimeBinding> = {},
): ActivationRuntimeBinding {
  return activationRuntimeBindingSchema.parse({
    schemaVersion: "helm.activation-runtime-binding.v1",
    bindingRef: "synthetic-binding:activation-runtime",
    executorMode: "private_control_plane",
    executorRef: "synthetic://private-activation-runtime",
    authorityRef: "synthetic://activation-authority",
    executionPolicyRef: "synthetic://activation-policy",
    receiptStoreRef: "synthetic://activation-receipts",
    capabilities: {
      snapshotBoundExecution: true,
      mainlineReceiptRequired: true,
      humanOwnerAuthorizationRequired: true,
      activationAuthoritySeparated: true,
      rollbackOrRemediationRequired: true,
      targetRefResolvedOutsidePublicCore: true,
      privateExecutorActivatesRuntime: true,
      privateExecutorPersistsReceipt: true,
      publicCoreCarriesRealInstance: false,
      publicCorePersists: false,
      publicCoreSendsExternally: false,
      publicCoreWritesTarget: false,
      publicCoreActivatesRuntime: false,
      publicCoreGrantsApproval: false,
    },
    ...overrides,
  });
}

function publicCoreNoopActivationRuntimeBinding(
  overrides: Partial<ActivationRuntimeBinding> = {},
): ActivationRuntimeBinding {
  return activationRuntimeBindingSchema.parse({
    ...activationRuntimeBinding({
      executorMode: "public_core_noop",
      executorRef: "public-core:no-activation-runtime-executor",
      authorityRef: undefined,
      executionPolicyRef: undefined,
      receiptStoreRef: undefined,
      capabilities: {
        snapshotBoundExecution: true,
        mainlineReceiptRequired: true,
        humanOwnerAuthorizationRequired: true,
        activationAuthoritySeparated: true,
        rollbackOrRemediationRequired: true,
        targetRefResolvedOutsidePublicCore: true,
        privateExecutorActivatesRuntime: false,
        privateExecutorPersistsReceipt: false,
        publicCoreCarriesRealInstance: false,
        publicCorePersists: false,
        publicCoreSendsExternally: false,
        publicCoreWritesTarget: false,
        publicCoreActivatesRuntime: false,
        publicCoreGrantsApproval: false,
      },
    }),
    ...overrides,
  });
}

export function buildDefaultWorkUnitActivationRuntimeFixtures(): readonly WorkUnitGovernanceActivationRuntimeFixture[] {
  return [
    {
      name: "activation-runtime-envelope-is-handoff-only",
      run: () => {
        const workUnit = buildSyntheticPromotedWorkUnit({
          activationScope: "production_runtime",
        });
        const request = buildSyntheticActivationHandoffRequest(workUnit);
        const envelope = buildActivationRuntimeExecutionEnvelope({
          binding: activationRuntimeBinding(),
          workUnit,
          request,
          receipt: buildSyntheticActivationAuthorityReceipt(workUnit, request),
          requestedBy: { actorType: "system", actorRef: "activation-runtime-envelope-builder" },
          requestedAt: FIXTURE_TIME,
          reason: "Synthetic activation was independently authorized.",
        });
        if (!envelope.ok) return envelope.violations;

        const violations: WorkUnitViolation[] = [];
        if (
          envelope.envelope.activationClaim !== "not_activation" ||
          envelope.envelope.readinessClaim !== "not_readiness" ||
          !envelope.envelope.privateExecutorRequired ||
          !envelope.envelope.privateExecutionReceiptRequired ||
          envelope.envelope.targetRefSafety !== "opaque_ref_only" ||
          envelope.envelope.publicCoreCarriesRealInstance ||
          envelope.envelope.publicCorePersists ||
          envelope.envelope.createsExternalEffect ||
          envelope.envelope.sendsExternally ||
          envelope.envelope.writesTarget ||
          envelope.envelope.activatesRuntime ||
          envelope.envelope.grantsApproval ||
          envelope.publicCorePersists ||
          envelope.writesTarget ||
          envelope.activatesRuntime ||
          envelope.grantsApproval
        ) {
          violations.push({
            rule: "activation-runtime-envelope-side-effect",
            detail: envelope.envelope.envelopeId,
          });
        }
        return violations;
      },
      expectedRules: [],
    },
    {
      name: "activation-runtime-public-noop-cannot-execute",
      run: () => {
        const workUnit = buildSyntheticPromotedWorkUnit({
          activationScope: "production_runtime",
        });
        const request = buildSyntheticActivationHandoffRequest(workUnit);
        const envelope = buildActivationRuntimeExecutionEnvelope({
          binding: publicCoreNoopActivationRuntimeBinding(),
          workUnit,
          request,
          receipt: buildSyntheticActivationAuthorityReceipt(workUnit, request),
          requestedBy: { actorType: "system", actorRef: "activation-runtime-envelope-builder" },
          requestedAt: FIXTURE_TIME,
          reason: "Synthetic activation was independently authorized.",
        });
        if (!envelope.ok) return envelope.violations;

        const executeResult = buildPublicCoreNoopActivationRuntimeExecutor().execute(
          envelope.envelope,
        );
        return executeResult.ok
          ? [{ rule: "activation-runtime-public-noop-activated", detail: envelope.envelope.envelopeId }]
          : executeResult.violations;
      },
      expectedRules: ["public-core-activation-runtime-executor-is-noop"],
    },
    {
      name: "activation-runtime-missing-governance-capability-is-blocked",
      run: () =>
        validateActivationRuntimeBinding({
          ...activationRuntimeBinding(),
          authorityRef: undefined,
          executionPolicyRef: undefined,
          receiptStoreRef: undefined,
          capabilities: {
            ...activationRuntimeBinding().capabilities,
            snapshotBoundExecution: false,
            humanOwnerAuthorizationRequired: false,
            activationAuthoritySeparated: false,
            rollbackOrRemediationRequired: false,
            targetRefResolvedOutsidePublicCore: false,
            privateExecutorActivatesRuntime: false,
            privateExecutorPersistsReceipt: false,
          },
        }),
      expectedRules: [
        "activation-runtime-private-authority-required",
        "activation-runtime-private-policy-required",
        "activation-runtime-private-receipt-store-required",
        "activation-runtime-snapshot-bound-required",
        "activation-runtime-human-owner-authorization-required",
        "activation-runtime-authority-separation-required",
        "activation-runtime-recovery-plan-required",
        "activation-runtime-target-ref-private-resolution-required",
        "activation-runtime-private-executor-required",
        "activation-runtime-private-receipt-persistence-required",
      ],
    },
    {
      name: "activation-runtime-public-core-side-effect-claim-is-blocked",
      run: () =>
        validateActivationRuntimeBinding({
          ...publicCoreNoopActivationRuntimeBinding(),
          capabilities: {
            ...publicCoreNoopActivationRuntimeBinding().capabilities,
            privateExecutorActivatesRuntime: true,
            privateExecutorPersistsReceipt: true,
            publicCoreCarriesRealInstance: true,
            publicCorePersists: true,
            publicCoreSendsExternally: true,
            publicCoreWritesTarget: true,
            publicCoreActivatesRuntime: true,
            publicCoreGrantsApproval: true,
          },
        }),
      expectedRules: [
        "public-core-activation-runtime-cannot-activate",
        "public-core-activation-runtime-cannot-persist-receipt",
        "activation-runtime-public-core-real-instance-forbidden",
        "activation-runtime-public-core-persistence-forbidden",
        "activation-runtime-public-core-send-forbidden",
        "activation-runtime-public-core-write-forbidden",
        "activation-runtime-public-core-activation-forbidden",
        "activation-runtime-public-core-approval-forbidden",
      ],
    },
    {
      name: "activation-runtime-raw-target-ref-is-blocked",
      run: () => {
        const workUnit = buildSyntheticPromotedWorkUnit({
          activationScope: "production_runtime",
        });
        const request = buildSyntheticActivationHandoffRequest(workUnit, {
          targetRef: "https://example.invalid/activate",
        });
        const envelope = buildActivationRuntimeExecutionEnvelope({
          binding: activationRuntimeBinding(),
          workUnit,
          request,
          receipt: buildSyntheticActivationAuthorityReceipt(workUnit, request),
          requestedBy: { actorType: "system", actorRef: "activation-runtime-envelope-builder" },
          requestedAt: FIXTURE_TIME,
          reason: "Synthetic activation was independently authorized.",
        });
        return envelope.ok
          ? [{ rule: "activation-runtime-raw-target-ref-was-not-blocked", detail: request.handoffId }]
          : envelope.violations;
      },
      expectedRules: ["activation-runtime-target-ref-must-be-opaque"],
    },
  ];
}

export function buildDefaultWorkUnitRepairLearningFixtures(): readonly WorkUnitGovernanceRepairLearningFixture[] {
  return [
    {
      name: "repair-learning-never-executes-public-core-side-effects",
      run: () => {
        const original = buildSyntheticFailedWorkUnit();
        const repaired = buildSyntheticRepairedWorkUnit(original);
        const finding = buildSyntheticLearningFinding(original);
        const readout = buildRepairLearningReadout({
          original,
          repaired,
          repair: buildSyntheticRepairCandidateRecord({ original, repaired }),
          findings: [finding],
          learningDrafts: [buildSyntheticLearningAssetDraft({ finding })],
        });
        const violations: WorkUnitViolation[] = [];
        if (
          readout.publicCoreCarriesRealInstance ||
          readout.publicCorePersists ||
          readout.createsExternalEffect ||
          readout.sendsExternally ||
          readout.writesTarget ||
          readout.grantsApproval ||
          readout.changesCheckRules
        ) {
          violations.push({
            rule: "repair-learning-public-core-side-effect",
            detail: "readout",
          });
        }
        for (const actionItem of readout.actions) {
          if (
            actionItem.publicCoreExecutes ||
            actionItem.publicCorePersists ||
            actionItem.createsExternalEffect ||
            actionItem.sendsExternally ||
            actionItem.writesTarget ||
            actionItem.grantsApproval ||
            actionItem.changesCheckRules
          ) {
            violations.push({
              rule: "repair-learning-action-side-effect",
              detail: actionItem.actionId,
            });
          }
        }
        return violations;
      },
      expectedRules: [],
    },
    {
      name: "repair-learning-ai-repair-returns-to-candidate",
      run: () => {
        const original = buildSyntheticFailedWorkUnit();
        const candidate = buildSyntheticRepairedWorkUnit(original);
        const snapshotHash = computeWorkUnitSnapshotHash(candidate);
        const repaired = buildSyntheticRepairedWorkUnit(original, {
          status: "accepted_by_human",
          decisionSnapshotHash: snapshotHash,
          decision: syntheticAcceptedDecision(snapshotHash, {
            actorType: "ai",
            actorRef: "agent-1",
          }),
        });
        return validateWorkUnitRepairCandidate({
          original,
          repaired,
          repair: buildSyntheticRepairCandidateRecord({ original, repaired }),
        });
      },
      expectedRules: ["ai-cannot-authoritative-state", "repair-must-return-new-candidate"],
    },
    {
      name: "repair-learning-ai-repair-cannot-change-check-rules",
      run: () => {
        const original = buildSyntheticFailedWorkUnit();
        const repaired = buildSyntheticRepairedWorkUnit(original);
        return validateWorkUnitRepairCandidate({
          original,
          repaired,
          repair: buildSyntheticRepairCandidateRecord({
            original,
            repaired,
            overrides: {
              changesCheckRules: true,
              checkRuleChangeRefs: ["synthetic://guard/relaxed-renewal-cost"],
            },
          }),
        });
      },
      expectedRules: ["ai-repair-cannot-change-check-rules"],
    },
    {
      name: "repair-learning-finding-needs-asset-or-owner-waiver",
      run: () =>
        validateLearningFindingResolution({
          finding: buildSyntheticLearningFinding(buildSyntheticFailedWorkUnit()),
        }),
      expectedRules: ["learning-finding-needs-executable-asset-or-owner-waiver"],
    },
    {
      name: "repair-learning-ai-waiver-is-blocked",
      run: () => {
        const original = buildSyntheticFailedWorkUnit();
        const finding = buildSyntheticLearningFinding(original);
        return validateLearningFindingResolution({
          finding,
          draft: buildSyntheticLearningAssetDraft({
            finding,
            overrides: {
              disposition: {
                findingId: finding.findingId,
                disposition: "owner_waived",
                summary: "AI attempted to waive a synthetic finding.",
                recordedBy: { actorType: "ai", actorRef: "agent-1" },
                recordedAt: FIXTURE_TIME,
                waiverReason: "No human owner approved this waiver.",
              },
            },
          }),
        });
      },
      expectedRules: ["finding-waiver-needs-human-owner"],
    },
    {
      name: "repair-learning-clean-asset",
      run: () => {
        const original = buildSyntheticFailedWorkUnit();
        const finding = buildSyntheticLearningFinding(original);
        return validateLearningFindingResolution({
          finding,
          draft: buildSyntheticLearningAssetDraft({ finding }),
        });
      },
      expectedRules: [],
    },
  ];
}

export function buildDefaultWorkUnitProofPackageFixtures(): readonly WorkUnitGovernanceProofPackageFixture[] {
  return [
    {
      name: "proof-package-never-grants-readiness-or-approval",
      run: () => {
        const workUnit = buildSyntheticPromotedWorkUnit();
        const packageItem = buildSyntheticWorkUnitProofPackage(workUnit);
        const readout = buildWorkUnitProofPackageReadout(packageItem);
        const violations: WorkUnitViolation[] = [];
        if (
          packageItem.publicCoreCarriesRealInstance ||
          packageItem.publicCorePersists ||
          packageItem.createsExternalEffect ||
          packageItem.sendsExternally ||
          packageItem.writesTarget ||
          packageItem.grantsApproval ||
          packageItem.grantsReadiness ||
          packageItem.activatesRuntime ||
          packageItem.appliesLearningAsset ||
          packageItem.readinessClaim !== "not_readiness" ||
          readout.publicCorePersists ||
          readout.grantsApproval ||
          readout.grantsReadiness ||
          readout.activatesRuntime
        ) {
          violations.push({
            rule: "proof-package-public-core-side-effect",
            detail: packageItem.packageId,
          });
        }
        return violations;
      },
      expectedRules: [],
    },
    {
      name: "proof-package-snapshot-mismatch-is-blocked",
      run: () => {
        const workUnit = buildSyntheticPromotedWorkUnit();
        return validateWorkUnitProofPackage({
          workUnit,
          packageItem: buildSyntheticWorkUnitProofPackage(workUnit, {
            snapshotHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          }),
        });
      },
      expectedRules: ["proof-package-snapshot-mismatch"],
    },
    {
      name: "proof-package-raw-private-entry-is-blocked",
      run: () => {
        const workUnit = buildSyntheticPromotedWorkUnit();
        const clean = buildSyntheticWorkUnitProofPackage(workUnit);
        return validateWorkUnitProofPackage({
          workUnit,
          packageItem: {
            ...clean,
            entries: [
              ...clean.entries,
              {
                entryId: "proof-entry:raw-private",
                kind: "evidence_manifest",
                title: "Raw private fixture should not render",
                summary: "This entry is intentionally unsafe.",
                ref: "synthetic://unsafe-redaction/raw-private-fixture",
                redactionStatus: "raw_private_rejected",
                observedBy: { actorType: "ai", actorRef: "agent-1" },
                observedAt: FIXTURE_TIME,
                snapshotHash: clean.snapshotHash,
                publicCoreCarriesRealInstance: false,
              },
            ],
          },
        });
      },
      expectedRules: ["proof-entry-redaction-not-public-safe"],
    },
    {
      name: "proof-package-requires-all-hwu-coverage",
      run: () => {
        const workUnit = buildSyntheticPromotedWorkUnit();
        const clean = buildSyntheticWorkUnitProofPackage(workUnit);
        return validateWorkUnitProofPackage({
          workUnit,
          packageItem: {
            ...clean,
            requirementCoverage: clean.requirementCoverage.filter(
              (coverage) => coverage.requirementId !== "HWU-14",
            ),
          },
        });
      },
      expectedRules: ["proof-package-requirement-coverage-mismatch"],
    },
    {
      name: "proof-package-clean",
      run: () => {
        const workUnit = buildSyntheticPromotedWorkUnit();
        return validateWorkUnitProofPackage({
          workUnit,
          packageItem: buildWorkUnitProofPackage({ workUnit }),
        });
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
  readonly ledgerFixtures?: readonly WorkUnitGovernanceLedgerFixture[];
  readonly ownerLifecycleFixtures?: readonly WorkUnitGovernanceOwnerLifecycleFixture[];
  readonly ownerNotificationFixtures?: readonly WorkUnitGovernanceOwnerNotificationFixture[];
  readonly activationHandoffFixtures?: readonly WorkUnitGovernanceActivationHandoffFixture[];
  readonly activationRuntimeFixtures?: readonly WorkUnitGovernanceActivationRuntimeFixture[];
  readonly repairLearningFixtures?: readonly WorkUnitGovernanceRepairLearningFixture[];
  readonly proofPackageFixtures?: readonly WorkUnitGovernanceProofPackageFixture[];
  readonly privateMainlineStoreFixtures?: readonly WorkUnitGovernancePrivateMainlineStoreFixture[];
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
  const ownerNotificationFixtures =
    options.ownerNotificationFixtures ?? buildDefaultWorkUnitOwnerNotificationFixtures();
  const activationHandoffFixtures =
    options.activationHandoffFixtures ?? buildDefaultWorkUnitActivationHandoffFixtures();
  const activationRuntimeFixtures =
    options.activationRuntimeFixtures ?? buildDefaultWorkUnitActivationRuntimeFixtures();
  const repairLearningFixtures =
    options.repairLearningFixtures ?? buildDefaultWorkUnitRepairLearningFixtures();
  const proofPackageFixtures =
    options.proofPackageFixtures ?? buildDefaultWorkUnitProofPackageFixtures();
  const privateMainlineStoreFixtures =
    options.privateMainlineStoreFixtures ?? buildDefaultWorkUnitPrivateMainlineStoreFixtures();

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

  for (const fixture of ownerNotificationFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "owner-notification",
        actualRules: rulesFrom(fixture.run()),
        expectedRules: fixture.expectedRules,
      }),
    );
  }

  for (const fixture of activationHandoffFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "activation-handoff",
        actualRules: rulesFrom(fixture.run()),
        expectedRules: fixture.expectedRules,
      }),
    );
  }

  for (const fixture of activationRuntimeFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "activation-runtime",
        actualRules: rulesFrom(fixture.run()),
        expectedRules: fixture.expectedRules,
      }),
    );
  }

  for (const fixture of repairLearningFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "repair-learning",
        actualRules: rulesFrom(fixture.run()),
        expectedRules: fixture.expectedRules,
      }),
    );
  }

  for (const fixture of proofPackageFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "proof-package",
        actualRules: rulesFrom(fixture.run()),
        expectedRules: fixture.expectedRules,
      }),
    );
  }

  for (const fixture of privateMainlineStoreFixtures) {
    failures.push(
      ...compareExpectedRules({
        name: fixture.name,
        check: "private-mainline-store",
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
    ownerNotificationFixtures.length +
    activationHandoffFixtures.length +
    activationRuntimeFixtures.length +
    repairLearningFixtures.length +
    proofPackageFixtures.length +
    privateMainlineStoreFixtures.length +
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
    ownerNotificationFixtures,
    activationHandoffFixtures,
    activationRuntimeFixtures,
    repairLearningFixtures,
    proofPackageFixtures,
    privateMainlineStoreFixtures,
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
