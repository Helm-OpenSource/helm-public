import {
  helmWorkUnitSchema,
  type HelmWorkUnit,
  type WorkUnitActor,
  type WorkUnitDecision,
  type WorkUnitReceipt,
} from "./contracts";

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
