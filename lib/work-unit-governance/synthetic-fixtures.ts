import {
  computeWorkUnitSnapshotHash,
  helmWorkUnitSchema,
  type HelmWorkUnit,
  type WorkUnitActor,
  type WorkUnitDecision,
  type WorkUnitReceipt,
} from "./contracts";
import {
  activationAuthorityReceiptSchema,
  activationHandoffRequestSchema,
  type ActivationAuthorityReceipt,
  type ActivationHandoffRequest,
} from "./activation-handoff";
import {
  planPrivateMainlineLedgerAppend,
  privateMainlineLedgerEventSchema,
  type PrivateMainlineLedger,
  type PrivateMainlineLedgerSnapshot,
} from "./mainline-ledger";
import {
  ownerLifecyclePolicySchema,
  type OwnerLifecyclePolicy,
} from "./owner-lifecycle";
import {
  workUnitLearningAssetDraftSchema,
  workUnitLearningFindingSchema,
  workUnitRepairCandidateRecordSchema,
  type WorkUnitLearningAssetDraft,
  type WorkUnitLearningFinding,
  type WorkUnitRepairCandidateRecord,
} from "./repair-learning-loop";

export const WORK_UNIT_SYNTHETIC_TIME = "2026-07-19T00:00:00.000Z";

export function buildSyntheticWorkUnit(overrides: Partial<HelmWorkUnit> = {}): HelmWorkUnit {
  return helmWorkUnitSchema.parse({
    schemaVersion: "helm.work-unit.v1",
    id: "hwu-synthetic-001",
    objective: "Review a synthetic quote before it enters the company mainline.",
    scope: ["synthetic:quote"],
    status: "candidate",
    initiator: { actorType: "human", actorRef: "initiator-1" },
    owner: { ownerRef: "owner-1", ownerType: "human_owner", displayName: "Synthetic owner" },
    agentRole: "draft",
    sourceSnapshot: {
      sourceRef: "synthetic://quote/Q-001",
      redactionStatus: "synthetic",
      mainlineBaselineRef: "mainline:baseline-1",
      dependencyRefs: [],
    },
    riskClass: "internal_mainline",
    conflictKeys: ["quote:Q-001"],
    candidateArtifacts: [
      {
        artifactId: "candidate-summary",
        kind: "decision_card",
        title: "Synthetic renewal-cost check",
        summary: "Review whether the synthetic quote includes renewal cost basis.",
        state: "candidate",
        producedBy: "ai",
      },
    ],
    evidenceManifest: [
      {
        evidenceRef: "synthetic://evidence/renewal-cost",
        title: "Synthetic renewal cost evidence",
        redactionStatus: "synthetic",
      },
    ],
    changeSummary: {
      changedWhat: "Adds a renewal-cost review requirement to the synthetic quote.",
      affectedWho: ["synthetic owner"],
      basis: ["synthetic://evidence/renewal-cost"],
      riskSummary: "Internal mainline update only; no customer-visible action.",
    },
    requiredOwners: {
      mode: "all_of",
      owners: [{ ownerRef: "owner-1", ownerType: "human_owner", displayName: "Synthetic owner" }],
    },
    validationReceipts: [
      {
        receiptId: "validation-1",
        name: "synthetic-boundary-check",
        ok: true,
        summary: "Synthetic public-safe fixture.",
        createdAt: WORK_UNIT_SYNTHETIC_TIME,
      },
    ],
    activationScope: "private_workspace_truth",
    rollbackOrRemediationPlan: {
      kind: "rollback",
      summary: "Supersede the synthetic rule with a newer accepted work unit.",
      responsibleOwnerRef: "owner-1",
    },
    auditRefs: [],
    relatedMainlineChanges: [],
    createdAt: WORK_UNIT_SYNTHETIC_TIME,
    updatedAt: WORK_UNIT_SYNTHETIC_TIME,
    ...overrides,
  });
}

export function syntheticAcceptedDecision(
  snapshotHash: string,
  actor: WorkUnitActor = { actorType: "human_owner", actorRef: "owner-1" },
): WorkUnitDecision {
  return {
    decidedBy: actor,
    decision: "accepted",
    decidedAt: WORK_UNIT_SYNTHETIC_TIME,
    snapshotHash,
    rationale: "Synthetic owner accepted this exact candidate snapshot.",
  };
}

export function syntheticReceipt(
  receiptId: string,
  snapshotHash: string,
  actor: WorkUnitActor = { actorType: "human_owner", actorRef: "owner-1" },
): WorkUnitReceipt {
  return {
    receiptId,
    actor,
    snapshotHash,
    createdAt: WORK_UNIT_SYNTHETIC_TIME,
    summary: "Synthetic human-owner receipt shape.",
    publicCoreCarriesRealInstance: false,
  };
}

export function buildSyntheticAcceptedWorkUnit(
  overrides: Partial<HelmWorkUnit> = {},
): HelmWorkUnit {
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

export function buildSyntheticPromotedWorkUnit(
  overrides: Partial<HelmWorkUnit> = {},
): HelmWorkUnit {
  const accepted = buildSyntheticAcceptedWorkUnit(overrides);
  const snapshotHash = computeWorkUnitSnapshotHash(accepted);

  return buildSyntheticWorkUnit({
    ...overrides,
    status: "promoted_to_mainline",
    decisionSnapshotHash: snapshotHash,
    decision: syntheticAcceptedDecision(snapshotHash),
    mergeReceipt: syntheticReceipt("mainline-receipt-1", snapshotHash),
  });
}

export function buildSyntheticFailedWorkUnit(
  overrides: Partial<HelmWorkUnit> = {},
): HelmWorkUnit {
  return buildSyntheticWorkUnit({
    status: "candidate",
    agentRole: "validate",
    validationReceipts: [
      {
        receiptId: "validation-renewal-cost",
        name: "synthetic-renewal-cost-required",
        ok: false,
        summary: "Synthetic quote is missing renewal cost basis.",
        createdAt: WORK_UNIT_SYNTHETIC_TIME,
      },
    ],
    ...overrides,
  });
}

export function buildSyntheticRepairedWorkUnit(
  original: HelmWorkUnit,
  overrides: Partial<HelmWorkUnit> = {},
): HelmWorkUnit {
  return buildSyntheticWorkUnit({
    id: `${original.id}-repair-1`,
    objective: "Repair the synthetic work package before owner review.",
    scope: original.scope,
    status: "candidate",
    initiator: original.initiator,
    owner: original.owner,
    agentRole: "repair",
    sourceSnapshot: original.sourceSnapshot,
    riskClass: original.riskClass,
    conflictKeys: original.conflictKeys,
    candidateArtifacts: [
      {
        artifactId: "candidate-repair-summary",
        kind: "decision_card",
        title: "Synthetic repaired renewal-cost check",
        summary: "Adds the missing synthetic renewal cost basis before owner review.",
        state: "candidate",
        producedBy: "ai",
      },
    ],
    evidenceManifest: original.evidenceManifest,
    changeSummary: {
      ...original.changeSummary,
      changedWhat: "Repairs the missing renewal-cost basis in the synthetic quote.",
      riskSummary: "AI prepared a candidate repair only; owner review is still required.",
    },
    requiredOwners: original.requiredOwners,
    validationReceipts: [
      {
        receiptId: "validation-repair-renewal-cost",
        name: "synthetic-renewal-cost-required",
        ok: true,
        summary: "Synthetic renewal cost basis is now present.",
        createdAt: WORK_UNIT_SYNTHETIC_TIME,
      },
    ],
    activationScope: original.activationScope,
    rollbackOrRemediationPlan: original.rollbackOrRemediationPlan,
    auditRefs: ["synthetic://audit/repair-candidate"],
    relatedMainlineChanges: original.relatedMainlineChanges,
    createdAt: original.createdAt,
    updatedAt: WORK_UNIT_SYNTHETIC_TIME,
    decision: undefined,
    decisionSnapshotHash: undefined,
    mergeReceipt: undefined,
    activationReceipt: undefined,
    ...overrides,
  });
}

export function buildSyntheticRepairCandidateRecord(input: {
  readonly original: HelmWorkUnit;
  readonly repaired: HelmWorkUnit;
  readonly overrides?: Partial<WorkUnitRepairCandidateRecord>;
}): WorkUnitRepairCandidateRecord {
  const failedReceiptIds = input.original.validationReceipts
    .filter((receipt) => !receipt.ok)
    .map((receipt) => receipt.receiptId);

  return workUnitRepairCandidateRecordSchema.parse({
    schemaVersion: "helm.work-unit-repair-candidate.v1",
    repairId: `repair:${input.original.id}:1`,
    originalWorkUnitId: input.original.id,
    repairedWorkUnitId: input.repaired.id,
    failedReceiptIds:
      failedReceiptIds.length > 0
        ? failedReceiptIds
        : [input.original.validationReceipts[0]?.receiptId ?? "validation-missing"],
    repairedBy: { actorType: "ai", actorRef: "agent-1" },
    repairedAt: WORK_UNIT_SYNTHETIC_TIME,
    originalSnapshotHash: computeWorkUnitSnapshotHash(input.original),
    repairedSnapshotHash: computeWorkUnitSnapshotHash(input.repaired),
    changedArtifactRefs: [input.repaired.candidateArtifacts[0]?.artifactId ?? "candidate-repair"],
    checkRuleChangeRefs: [],
    changesCheckRules: false,
    publicCoreCarriesRealInstance: false,
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    grantsApproval: false,
    ...input.overrides,
  });
}

export function buildSyntheticLearningFinding(
  workUnit: HelmWorkUnit,
  overrides: Partial<WorkUnitLearningFinding> = {},
): WorkUnitLearningFinding {
  return workUnitLearningFindingSchema.parse({
    schemaVersion: "helm.work-unit-learning-finding.v1",
    findingId: `learning-finding:${workUnit.id}:renewal-cost`,
    workUnitId: workUnit.id,
    source: "review_finding",
    severity: "medium",
    summary: "Synthetic review found missing renewal cost basis.",
    sourceSnapshotHash: computeWorkUnitSnapshotHash(workUnit),
    evidenceRefs: ["synthetic://evidence/renewal-cost"],
    recordedAt: WORK_UNIT_SYNTHETIC_TIME,
    ...overrides,
  });
}

export function buildSyntheticLearningAssetDraft(input: {
  readonly finding: WorkUnitLearningFinding;
  readonly overrides?: Partial<WorkUnitLearningAssetDraft>;
}): WorkUnitLearningAssetDraft {
  return workUnitLearningAssetDraftSchema.parse({
    schemaVersion: "helm.work-unit-learning-asset-draft.v1",
    draftId: `learning-asset:${input.finding.findingId}`,
    findingId: input.finding.findingId,
    workUnitId: input.finding.workUnitId,
    sourceSnapshotHash: input.finding.sourceSnapshotHash,
    disposition: {
      findingId: input.finding.findingId,
      disposition: "asset_recorded",
      assetKind: "check",
      assetRef: "synthetic://guard/renewal-cost-required",
      summary: "Prepare a synthetic renewal-cost guard asset.",
      recordedBy: { actorType: "system", actorRef: "guard-writer" },
      recordedAt: WORK_UNIT_SYNTHETIC_TIME,
    },
    publicCoreCarriesRealInstance: false,
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    grantsApproval: false,
    appliesAsset: false,
    ...input.overrides,
  });
}

export function buildSyntheticActivationHandoffRequest(
  workUnit: HelmWorkUnit,
  overrides: Partial<ActivationHandoffRequest> = {},
): ActivationHandoffRequest {
  return activationHandoffRequestSchema.parse({
    schemaVersion: "helm.activation-handoff-request.v1",
    handoffId: `activation-handoff:${workUnit.id}`,
    workUnitId: workUnit.id,
    requestedScope: workUnit.activationScope,
    targetRef: `synthetic://activation-target/${workUnit.id}`,
    requestedBy: { actorType: "human_owner", actorRef: "owner-1" },
    requestedAt: WORK_UNIT_SYNTHETIC_TIME,
    snapshotHash: computeWorkUnitSnapshotHash(workUnit),
    mainlineReceiptRef: workUnit.mergeReceipt?.receiptId ?? "missing-mainline-receipt",
    rollbackOrRemediationPlan: workUnit.rollbackOrRemediationPlan,
    publicCoreCarriesRealInstance: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    activatesRuntime: false,
    ...overrides,
  });
}

export function buildSyntheticActivationAuthorityReceipt(
  workUnit: HelmWorkUnit,
  request: ActivationHandoffRequest,
  overrides: Partial<ActivationAuthorityReceipt> = {},
): ActivationAuthorityReceipt {
  return activationAuthorityReceiptSchema.parse({
    schemaVersion: "helm.activation-authority-receipt.v1",
    receiptId: `activation-authority:${workUnit.id}`,
    handoffId: request.handoffId,
    workUnitId: workUnit.id,
    authorizedScope: request.requestedScope,
    actor: { actorType: "human_owner", actorRef: "owner-1" },
    authorizedAt: WORK_UNIT_SYNTHETIC_TIME,
    snapshotHash: request.snapshotHash,
    rationale: "Synthetic human owner authorized private-plane activation review.",
    authorizationBasisRefs: [request.mainlineReceiptRef],
    publicCoreCarriesRealInstance: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    activatesRuntime: false,
    grantsApproval: false,
    ...overrides,
  });
}

export function buildSyntheticPrivateMainlineLedger(): PrivateMainlineLedgerSnapshot {
  const ledger: PrivateMainlineLedger = {
    schemaVersion: "helm.private-mainline-ledger.v1",
    ledgerRef: "synthetic-ledger:work-unit-mainline",
    events: [],
    publicCoreCarriesRealInstance: false,
  };
  const workUnit = buildSyntheticAcceptedWorkUnit();
  const snapshotHash = computeWorkUnitSnapshotHash(workUnit);
  const event = privateMainlineLedgerEventSchema.parse({
    schemaVersion: "helm.private-mainline-ledger-event.v1",
    ledgerRef: ledger.ledgerRef,
    eventId: `ledger-event:${workUnit.id}:mainline`,
    workUnitId: workUnit.id,
    eventType: "mainline_recorded",
    actor: { actorType: "human_owner", actorRef: "owner-1" },
    at: WORK_UNIT_SYNTHETIC_TIME,
    snapshotHash,
    conflictKeys: workUnit.conflictKeys,
    baselineEventIds: [],
    supersedesEventIds: [],
    auditRefs: ["synthetic://audit/mainline"],
    receipt: syntheticReceipt("mainline-receipt-1", snapshotHash),
    publicCoreCarriesRealInstance: false,
    createsExternalEffect: false,
  });
  const plan = planPrivateMainlineLedgerAppend({ ledger, workUnit, event });
  if (!plan.ok) {
    throw new Error(
      `synthetic_private_mainline_ledger_invalid:${plan.violations
        .map((violation) => violation.rule)
        .join(",")}`,
    );
  }

  return plan.nextLedger;
}

export function buildSyntheticOwnerLifecyclePolicy(
  overrides: Partial<OwnerLifecyclePolicy> = {},
): OwnerLifecyclePolicy {
  return ownerLifecyclePolicySchema.parse({
    schemaVersion: "helm.owner-lifecycle-policy.v1",
    reviewDueAt: "2026-07-19T01:00:00.000Z",
    escalationOwnerRefs: ["owner-escalation-1"],
    authorizedProxies: [],
    publicCoreCarriesRealInstance: false,
    ...overrides,
  });
}
