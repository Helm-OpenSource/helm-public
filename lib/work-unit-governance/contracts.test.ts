import { describe, expect, it } from "vitest";
import {
  HIGH_RISK_WORK_UNIT_CLASSES,
  buildDecisionCard,
  computeWorkUnitSnapshotHash,
  hwuAcceptanceChecklist,
  validateUserVisibleTerminology,
  validateWorkUnitTransition,
  validateWorkUnitWithinPublicCore,
  workUnitRiskClassSchema,
  workUnitStateSchema,
  type HelmWorkUnit,
  type WorkUnitState,
} from "./contracts";

const BASE_TIME = "2026-07-19T00:00:00.000Z";

function baseWorkUnit(overrides: Partial<HelmWorkUnit> = {}): HelmWorkUnit {
  const candidateArtifacts = [
    {
      artifactId: "candidate-summary",
      kind: "decision_card",
      title: "Synthetic renewal-cost check",
      summary: "Review whether the synthetic quote includes renewal cost basis.",
      state: "candidate",
      producedBy: "ai",
    },
  ] as const;
  const base = {
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
    },
    riskClass: "internal_mainline",
    conflictKeys: ["quote:Q-001"],
    candidateArtifacts,
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
        createdAt: BASE_TIME,
      },
    ],
    decision: undefined,
    decisionSnapshotHash: undefined,
    mergeReceipt: undefined,
    activationScope: "private_workspace_truth",
    activationReceipt: undefined,
    rollbackOrRemediationPlan: {
      kind: "rollback",
      summary: "Supersede the synthetic rule with a newer accepted work unit.",
      responsibleOwnerRef: "owner-1",
    },
    auditRefs: [],
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  } satisfies HelmWorkUnit;

  return { ...base, ...overrides };
}

describe("Helm Work Unit governance contracts", () => {
  it("keeps HWU state and risk vocabularies as documented closed sets", () => {
    expect(workUnitStateSchema.options).toEqual([
      "draft",
      "candidate",
      "checking",
      "needs_owner_review",
      "changes_requested",
      "accepted_by_human",
      "promoted_to_mainline",
      "activation_requested",
      "activated_by_human",
      "rejected_by_human",
      "withdrawn",
      "superseded",
      "stale",
      "quarantined",
    ]);
    expect(workUnitRiskClassSchema.options).toEqual([
      "read_only",
      "local_draft",
      "internal_mainline",
      "customer_visible",
      "runtime_activation",
      "commercial_commitment",
    ]);
    expect([...HIGH_RISK_WORK_UNIT_CLASSES].sort()).toEqual([
      "commercial_commitment",
      "customer_visible",
      "runtime_activation",
    ]);
  });

  it("accepts a clean synthetic candidate and builds a low-complexity decision card", () => {
    const workUnit = baseWorkUnit();

    expect(validateWorkUnitWithinPublicCore(workUnit)).toEqual([]);
    expect(computeWorkUnitSnapshotHash(workUnit)).toMatch(/^sha256:[a-f0-9]{64}$/);

    const card = buildDecisionCard(workUnit);
    expect(card.title).toBe("Synthetic renewal-cost check");
    expect(card.questions).toContain("What is the candidate?");
    expect(card.checks).toEqual([{ name: "synthetic-boundary-check", ok: true }]);
    expect(validateUserVisibleTerminology(card)).toEqual([]);
  });

  it("blocks AI-created accepted, promoted, or activated states", () => {
    for (const status of [
      "accepted_by_human",
      "promoted_to_mainline",
      "activated_by_human",
    ] satisfies WorkUnitState[]) {
      const violations = validateWorkUnitWithinPublicCore(
        baseWorkUnit({
          status,
          decision: {
            decidedBy: { actorType: "ai", actorRef: "agent-1" },
            decision: "accepted",
            decidedAt: BASE_TIME,
            snapshotHash: "sha256:invalid",
            rationale: "AI tried to accept the candidate.",
          },
        }),
      );
      expect(violations.map((v) => v.rule)).toContain("ai-cannot-authoritative-state");
    }
  });

  it("requires accepted human approval bound to the current snapshot before mainline promotion", () => {
    const candidate = baseWorkUnit();
    const snapshotHash = computeWorkUnitSnapshotHash(candidate);
    const accepted = baseWorkUnit({
      status: "promoted_to_mainline",
      decisionSnapshotHash: snapshotHash,
      decision: {
        decidedBy: { actorType: "human_owner", actorRef: "owner-1" },
        decision: "accepted",
        decidedAt: BASE_TIME,
        snapshotHash,
        rationale: "Synthetic owner accepted this exact candidate snapshot.",
      },
      mergeReceipt: {
        receiptId: "merge-1",
        actor: { actorType: "human_owner", actorRef: "owner-1" },
        snapshotHash,
        createdAt: BASE_TIME,
        summary: "Promoted the synthetic candidate into a private mainline projection.",
        publicCoreCarriesRealInstance: false,
      },
    });

    expect(validateWorkUnitWithinPublicCore(accepted)).toEqual([]);

    const staleApproval = baseWorkUnit({
      status: "promoted_to_mainline",
      decisionSnapshotHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      decision: accepted.decision,
      mergeReceipt: accepted.mergeReceipt,
    });
    expect(validateWorkUnitWithinPublicCore(staleApproval).map((v) => v.rule)).toContain(
      "approval-snapshot-mismatch",
    );
  });

  it("invalidates an accepted candidate when related conflict keys changed", () => {
    const candidate = baseWorkUnit();
    const snapshotHash = computeWorkUnitSnapshotHash(candidate);
    const accepted = baseWorkUnit({
      status: "accepted_by_human",
      decisionSnapshotHash: snapshotHash,
      decision: {
        decidedBy: { actorType: "human_owner", actorRef: "owner-1" },
        decision: "accepted",
        decidedAt: BASE_TIME,
        snapshotHash,
        rationale: "Accepted before related mainline drift.",
      },
      relatedMainlineChanges: [
        {
          mainlineRef: "mainline:quote:Q-001:v2",
          conflictKeys: ["quote:Q-001"],
          changedAt: "2026-07-19T01:00:00.000Z",
        },
      ],
    });

    expect(validateWorkUnitWithinPublicCore(accepted).map((v) => v.rule)).toContain(
      "approval-invalidated-by-related-mainline-change",
    );
  });

  it("fails closed when high-risk work lacks a human owner or activation is treated as mainline", () => {
    const noOwner = baseWorkUnit({
      owner: undefined,
      riskClass: "commercial_commitment",
      activationScope: "commercial_commitment",
    });
    expect(validateWorkUnitWithinPublicCore(noOwner).map((v) => v.rule)).toContain(
      "high-risk-owner-required",
    );

    const activatedWithoutReceipt = baseWorkUnit({
      status: "activated_by_human",
      riskClass: "runtime_activation",
      activationScope: "production_runtime",
      decision: {
        decidedBy: { actorType: "human_owner", actorRef: "owner-1" },
        decision: "accepted",
        decidedAt: BASE_TIME,
        snapshotHash: computeWorkUnitSnapshotHash(baseWorkUnit()),
        rationale: "Accepted, but activation still needs its own receipt.",
      },
      decisionSnapshotHash: computeWorkUnitSnapshotHash(baseWorkUnit()),
    });
    expect(validateWorkUnitWithinPublicCore(activatedWithoutReceipt).map((v) => v.rule)).toContain(
      "activation-needs-independent-receipt",
    );
  });

  it("rejects AI risk downgrade and checks transition authority", () => {
    const current = baseWorkUnit({ riskClass: "customer_visible" });
    const downgraded = baseWorkUnit({ riskClass: "local_draft" });
    expect(
      validateWorkUnitTransition({
        current,
        next: downgraded,
        actor: { actorType: "ai", actorRef: "agent-1" },
      }).map((v) => v.rule),
    ).toContain("ai-risk-downgrade");

    expect(
      validateWorkUnitTransition({
        current,
        next: baseWorkUnit({ status: "accepted_by_human" }),
        actor: { actorType: "ai", actorRef: "agent-1" },
      }).map((v) => v.rule),
    ).toContain("human-owner-transition-required");
  });

  it("guards user-visible terminology and maps acceptance checklist to HWU requirements", () => {
    expect(validateUserVisibleTerminology("Open the PR and wait for CI before Merge")).toEqual([
      { term: "PR", index: 9 },
      { term: "CI", index: 25 },
      { term: "Merge", index: 35 },
    ]);

    expect(hwuAcceptanceChecklist.map((item) => item.requirementId)).toEqual([
      "HWU-01",
      "HWU-02",
      "HWU-03",
      "HWU-04",
      "HWU-05",
      "HWU-06",
      "HWU-07",
      "HWU-08",
      "HWU-09",
      "HWU-10",
      "HWU-11",
      "HWU-12",
      "HWU-13",
      "HWU-14",
      "HWU-15",
    ]);
  });
});
