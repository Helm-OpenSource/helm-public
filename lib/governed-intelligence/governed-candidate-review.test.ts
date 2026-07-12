import {
  ActionExecutionMode,
  ActionStatus,
  ActionType,
  ActorType,
  ApprovalStatus,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
  RiskLevel,
  SourceType,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, governanceMock } = vi.hoisted(() => ({
  dbMock: {
    artifactBundle: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    artifactReview: {
      updateMany: vi.fn(),
    },
    policyRule: {
      findFirst: vi.fn(),
    },
    actionItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    approvalTask: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  governanceMock: {
    assertWorkspaceGovernedActionReviewServiceAccess: vi.fn(),
    assertWorkspaceGovernedCandidatePromotionServiceAccess: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth/service-governance", () => governanceMock);

import {
  GOVERNED_CANDIDATE_ACTION_KIND,
  GOVERNED_CANDIDATE_ARTIFACT_TYPE,
  GOVERNED_CANDIDATE_REVIEW_POSTURE,
  GovernedCandidateReviewError,
  listGovernedJudgementCandidateReviews,
  promoteGovernedJudgementCandidateToTask,
  reviewGovernedJudgementCandidate,
} from "@/lib/governed-intelligence/governed-candidate-review";

const workspaceId = "workspace-1";
const artifactBundleId = "governed-artifact:synthetic-1";
const artifactReviewId = "review-1";
const candidateId = "governed-candidate:synthetic-1";
const candidateContentHash = `sha256:${"a".repeat(64)}`;
const sourceId = `governed-candidate-artifact:${artifactBundleId}`;

function artifactPayload() {
  return {
    schemaVersion: "helm.governed-judgement-artifact/v1",
    candidateId,
    sourceCandidateRef: "candidate:private-shadow:synthetic-1",
    sourceCandidateContentHash: `sha256:${"b".repeat(64)}`,
    proposal: {
      proposalId: "proposal:synthetic:1",
      objectRef: {
        objectType: "opportunity",
        objectId: "object:synthetic:1",
      },
      reviewState: "candidate",
      confidence: 82,
      evidenceRefs: ["evidence:synthetic:1"],
      missingEvidence: [
        {
          gapId: "gap:synthetic:1",
          missingSignalNote: "Verify one counter-signal before execution.",
        },
      ],
      counterEvidenceNeeded: ["Check the latest delivery status."],
      nextSafeActions: ["Create an internal follow-up task."],
      forbiddenCapabilityRefs: [
        "connector_activation",
        "external_send",
        "writeback",
        "run_crm_import",
        "memory_promotion",
        "preference_signal_write",
        "pattern_fact_write",
      ],
    },
    roleOutputs: [
      {
        role: "generator",
        reviewState: "candidate",
        evidenceRefs: ["evidence:synthetic:1"],
        notes: [],
      },
      {
        role: "critic",
        reviewState: "candidate",
        evidenceRefs: ["evidence:synthetic:1"],
        notes: [],
      },
      {
        role: "adversary",
        reviewState: "candidate",
        evidenceRefs: ["evidence:synthetic:1"],
        notes: [],
      },
    ],
    boundaryDecision: "allow_candidate",
    trajectoryReceiptRef: "trajectory:private-shadow:synthetic-1",
    requiredHumanReview: true,
    promotionAllowed: false,
    externalEffectAllowed: false,
    contentHash: candidateContentHash,
  };
}

function artifactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: artifactBundleId,
    workspaceId,
    artifactType: GOVERNED_CANDIDATE_ARTIFACT_TYPE,
    title: "Governed judgement candidate",
    status: ArtifactBundleStatus.DRAFT,
    systemOfRecordWrite: false,
    artifactsJson: JSON.stringify(artifactPayload()),
    evidenceRefs: JSON.stringify(["evidence:synthetic:1"]),
    sourceProvenance: JSON.stringify({
      sourceCandidateRef: "candidate:private-shadow:synthetic-1",
      sourceCandidateContentHash: `sha256:${"b".repeat(64)}`,
      sourceBundleRef: "bundle:private-context:synthetic-1",
      sourceBuildReceiptRef: "receipt:private-context-build:synthetic-1",
      candidateContentHash,
      trajectoryReceiptRef: "trajectory:private-shadow:synthetic-1",
      redactionStatus: "alias_only",
    }),
    confidence: 82,
    openQuestions: JSON.stringify({
      missingEvidence: artifactPayload().proposal.missingEvidence,
      counterEvidenceNeeded: artifactPayload().proposal.counterEvidenceNeeded,
    }),
    reviewPosture: GOVERNED_CANDIDATE_REVIEW_POSTURE,
    reviewedAt: null,
    confirmedAt: null,
    consumedAt: null,
    createdAt: new Date("2026-07-12T08:00:00.000Z"),
    artifactReview: {
      id: artifactReviewId,
      workspaceId,
      status: ArtifactReviewStatus.PENDING,
      reviewedByUserId: null,
      reviewNotes: null,
      decisionSummary: null,
      reviewedAt: null,
    },
    ...overrides,
  };
}

function policy(mode: ActionExecutionMode) {
  return {
    id: `policy-${mode}`,
    workspaceId,
    name: `Synthetic ${mode}`,
    actionType: ActionType.CREATE_TASK,
    mode,
    riskThreshold: RiskLevel.MEDIUM,
    appliesTo: null,
    description: null,
    enabled: true,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  };
}

function existingPromotion() {
  return {
    id: "action-1",
    workspaceId,
    actionType: ActionType.CREATE_TASK,
    sourceId,
    executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
    requiresApproval: true,
    status: ActionStatus.PENDING_APPROVAL,
    metadata: JSON.stringify({
      kind: GOVERNED_CANDIDATE_ACTION_KIND,
      version: 1,
      sourceArtifactBundleId: artifactBundleId,
      sourceArtifactReviewId: artifactReviewId,
      candidateId,
      candidateContentHash,
      sourceCandidateRef: "candidate:private-shadow:synthetic-1",
      evidenceRefCount: 1,
      evidenceRefsHash: `sha256:${"c".repeat(64)}`,
      boundary: "human_promoted_review_first",
      externalEffectAllowed: false,
    }),
    approvalTask: {
      id: "approval-1",
      status: ApprovalStatus.PENDING,
      autoExecute: false,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.$transaction.mockImplementation(
    async (run: (tx: typeof dbMock) => Promise<unknown>) => run(dbMock),
  );
  dbMock.artifactBundle.findFirst.mockResolvedValue(artifactRow());
  dbMock.artifactBundle.findMany.mockResolvedValue([artifactRow()]);
  dbMock.artifactBundle.updateMany.mockResolvedValue({ count: 1 });
  dbMock.artifactReview.updateMany.mockResolvedValue({ count: 1 });
  dbMock.policyRule.findFirst.mockResolvedValue(null);
  dbMock.actionItem.findFirst.mockResolvedValue(null);
  dbMock.actionItem.findMany.mockResolvedValue([]);
  dbMock.actionItem.create.mockResolvedValue({
    id: "action-1",
    status: ActionStatus.PENDING_APPROVAL,
  });
  dbMock.approvalTask.create.mockResolvedValue({
    id: "approval-1",
    status: ApprovalStatus.PENDING,
  });
  dbMock.notification.create.mockResolvedValue({ id: "notification-1" });
  dbMock.auditLog.create.mockResolvedValue({ id: "audit-1" });
  governanceMock.assertWorkspaceGovernedActionReviewServiceAccess.mockResolvedValue(
    "REVIEWER",
  );
  governanceMock.assertWorkspaceGovernedCandidatePromotionServiceAccess.mockResolvedValue(
    "OPERATOR",
  );
});

describe("governed candidate review", () => {
  it("atomically confirms a pending artifact with a human review receipt", async () => {
    await expect(
      reviewGovernedJudgementCandidate({
        workspaceId,
        reviewerId: "reviewer-1",
        reviewerName: "Synthetic Reviewer",
        artifactBundleId,
        decision: "confirm",
        notes: "Evidence is sufficient for an internal task candidate.",
      }),
    ).resolves.toMatchObject({
      artifactBundleId,
      artifactReviewId,
      reviewStatus: ArtifactReviewStatus.CONFIRMED,
      reused: false,
    });

    expect(
      governanceMock.assertWorkspaceGovernedActionReviewServiceAccess,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        userId: "reviewer-1",
        actorType: ActorType.USER,
      }),
    );
    expect(dbMock.artifactReview.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: artifactReviewId,
          workspaceId,
          status: ArtifactReviewStatus.PENDING,
        }),
        data: expect.objectContaining({
          status: ArtifactReviewStatus.CONFIRMED,
          reviewedByUserId: "reviewer-1",
        }),
      }),
    );
    expect(dbMock.artifactBundle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: artifactBundleId,
          workspaceId,
          status: ArtifactBundleStatus.DRAFT,
        }),
        data: expect.objectContaining({
          status: ArtifactBundleStatus.CONFIRMED,
        }),
      }),
    );
    expect(dbMock.auditLog.create).toHaveBeenCalledOnce();
  });

  it("rejects malformed artifacts before changing review state", async () => {
    dbMock.artifactBundle.findFirst.mockResolvedValue(
      artifactRow({ artifactsJson: JSON.stringify({ unexpected: true }) }),
    );

    await expect(
      reviewGovernedJudgementCandidate({
        workspaceId,
        reviewerId: "reviewer-1",
        reviewerName: "Synthetic Reviewer",
        artifactBundleId,
        decision: "reject",
      }),
    ).rejects.toBeInstanceOf(GovernedCandidateReviewError);

    expect(dbMock.artifactReview.updateMany).not.toHaveBeenCalled();
    expect(dbMock.artifactBundle.updateMany).not.toHaveBeenCalled();
  });

  it("atomically rejects a valid pending artifact with a terminal audit receipt", async () => {
    await expect(
      reviewGovernedJudgementCandidate({
        workspaceId,
        reviewerId: "reviewer-1",
        reviewerName: "Synthetic Reviewer",
        artifactBundleId,
        decision: "reject",
        notes: "The counter-signal invalidates this candidate.",
      }),
    ).resolves.toMatchObject({
      reviewStatus: ArtifactReviewStatus.REJECTED,
      reused: false,
    });

    expect(dbMock.artifactReview.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ArtifactReviewStatus.REJECTED,
        }),
      }),
    );
    expect(dbMock.artifactBundle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ArtifactBundleStatus.REJECTED,
        }),
      }),
    );
    expect(dbMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "GOVERNED_INTELLIGENCE_CANDIDATE_REJECTED",
        }),
      }),
    );
  });

  it("fails before database access when review capability is denied", async () => {
    governanceMock.assertWorkspaceGovernedActionReviewServiceAccess.mockRejectedValue(
      new Error("review_denied"),
    );

    await expect(
      reviewGovernedJudgementCandidate({
        workspaceId,
        reviewerId: "member-1",
        reviewerName: "Synthetic Member",
        artifactBundleId,
        decision: "confirm",
      }),
    ).rejects.toThrow("review_denied");

    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(dbMock.artifactBundle.findFirst).not.toHaveBeenCalled();
  });

  it("collapses foreign-workspace review attempts to artifact not found", async () => {
    dbMock.artifactBundle.findFirst.mockResolvedValue(null);

    await expect(
      reviewGovernedJudgementCandidate({
        workspaceId: "workspace-foreign",
        reviewerId: "reviewer-1",
        reviewerName: "Synthetic Reviewer",
        artifactBundleId,
        decision: "confirm",
      }),
    ).rejects.toMatchObject({ code: "artifact_not_found" });

    expect(dbMock.artifactBundle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-foreign",
          id: artifactBundleId,
        }),
      }),
    );
  });

  it("returns a fail-closed read model for malformed persisted payloads", async () => {
    dbMock.artifactBundle.findMany.mockResolvedValue([
      artifactRow({ artifactsJson: "{not-json" }),
    ]);

    await expect(
      listGovernedJudgementCandidateReviews(workspaceId),
    ).resolves.toEqual([
      expect.objectContaining({
        artifactBundleId,
        contractStatus: "invalid",
        candidate: null,
        canReview: false,
        canPromote: false,
      }),
    ]);
  });

  it("reuses the winning terminal review after a concurrent claim loss", async () => {
    dbMock.artifactBundle.findFirst
      .mockResolvedValueOnce(artifactRow())
      .mockResolvedValueOnce(
        artifactRow({
          status: ArtifactBundleStatus.CONFIRMED,
          artifactReview: {
            ...artifactRow().artifactReview,
            status: ArtifactReviewStatus.CONFIRMED,
            reviewedAt: new Date("2026-07-12T09:00:00.000Z"),
          },
        }),
      );
    dbMock.artifactReview.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      reviewGovernedJudgementCandidate({
        workspaceId,
        reviewerId: "reviewer-2",
        reviewerName: "Second Reviewer",
        artifactBundleId,
        decision: "confirm",
      }),
    ).resolves.toMatchObject({
      reviewStatus: ArtifactReviewStatus.CONFIRMED,
      reused: true,
    });

    expect(dbMock.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("governed candidate task promotion", () => {
  it("fails before database access when promotion capability is denied", async () => {
    governanceMock.assertWorkspaceGovernedCandidatePromotionServiceAccess.mockRejectedValue(
      new Error("promotion_denied"),
    );

    await expect(
      promoteGovernedJudgementCandidateToTask({
        workspaceId,
        actorUserId: "reviewer-1",
        actorName: "Synthetic Reviewer",
        artifactBundleId,
        title: "Follow up the operating signal",
      }),
    ).rejects.toThrow("promotion_denied");

    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(dbMock.artifactBundle.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ActionExecutionMode.FORBIDDEN,
    ActionExecutionMode.SUGGEST_ONLY,
  ])("does not promote a %s policy candidate", async (mode) => {
    dbMock.artifactBundle.findFirst.mockResolvedValue(
      artifactRow({
        status: ArtifactBundleStatus.CONFIRMED,
        confirmedAt: new Date("2026-07-12T09:00:00.000Z"),
        artifactReview: {
          ...artifactRow().artifactReview,
          status: ArtifactReviewStatus.CONFIRMED,
          reviewedAt: new Date("2026-07-12T09:00:00.000Z"),
        },
      }),
    );
    dbMock.policyRule.findFirst.mockResolvedValue(policy(mode));

    await expect(
      promoteGovernedJudgementCandidateToTask({
        workspaceId,
        actorUserId: "operator-1",
        actorName: "Synthetic Operator",
        artifactBundleId,
        title: "Follow up the operating signal",
        description: "Review the confirmed signal with the opportunity owner.",
      }),
    ).rejects.toBeInstanceOf(GovernedCandidateReviewError);

    expect(dbMock.artifactBundle.updateMany).not.toHaveBeenCalled();
    expect(dbMock.actionItem.create).not.toHaveBeenCalled();
    expect(dbMock.approvalTask.create).not.toHaveBeenCalled();
  });

  it.each([
    ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
    ActionExecutionMode.REQUIRES_APPROVAL,
  ])("forces %s through a pending human approval task", async (mode) => {
    dbMock.artifactBundle.findFirst.mockResolvedValue(
      artifactRow({
        status: ArtifactBundleStatus.CONFIRMED,
        confirmedAt: new Date("2026-07-12T09:00:00.000Z"),
        artifactReview: {
          ...artifactRow().artifactReview,
          status: ArtifactReviewStatus.CONFIRMED,
          reviewedAt: new Date("2026-07-12T09:00:00.000Z"),
        },
      }),
    );
    dbMock.policyRule.findFirst.mockResolvedValue(policy(mode));

    await expect(
      promoteGovernedJudgementCandidateToTask({
        workspaceId,
        actorUserId: "operator-1",
        actorName: "Synthetic Operator",
        artifactBundleId,
        title: "Follow up the operating signal",
        description: "Review the confirmed signal with the opportunity owner.",
      }),
    ).resolves.toEqual({
      artifactBundleId,
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      reused: false,
    });

    expect(
      governanceMock.assertWorkspaceGovernedCandidatePromotionServiceAccess,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        userId: "operator-1",
        actorType: ActorType.USER,
      }),
    );
    expect(dbMock.actionItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId,
        ownerId: "operator-1",
        actionType: ActionType.CREATE_TASK,
        sourceType: SourceType.SYSTEM_INFERENCE,
        sourceId,
        riskLevel: RiskLevel.MEDIUM,
        executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
        requiresApproval: true,
        status: ActionStatus.PENDING_APPROVAL,
        contentAuthorship: ActorType.AI,
        createdByUserId: "operator-1",
      }),
    });
    expect(dbMock.approvalTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId,
        actionItemId: "action-1",
        status: ApprovalStatus.PENDING,
        autoExecute: false,
      }),
    });
    expect(dbMock.artifactBundle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: artifactBundleId,
          workspaceId,
          status: ArtifactBundleStatus.CONFIRMED,
        }),
        data: expect.objectContaining({
          status: ArtifactBundleStatus.CONSUMED,
        }),
      }),
    );
  });

  it("reuses the existing pending task after a repeated promotion command", async () => {
    dbMock.artifactBundle.findFirst.mockResolvedValue(
      artifactRow({
        status: ArtifactBundleStatus.CONSUMED,
        consumedAt: new Date("2026-07-12T10:00:00.000Z"),
        artifactReview: {
          ...artifactRow().artifactReview,
          status: ArtifactReviewStatus.CONFIRMED,
        },
      }),
    );
    dbMock.actionItem.findFirst.mockResolvedValue(existingPromotion());

    await expect(
      promoteGovernedJudgementCandidateToTask({
        workspaceId,
        actorUserId: "operator-1",
        actorName: "Synthetic Operator",
        artifactBundleId,
        title: "Follow up the operating signal",
      }),
    ).resolves.toEqual({
      artifactBundleId,
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      reused: true,
    });

    expect(dbMock.actionItem.create).not.toHaveBeenCalled();
    expect(dbMock.approvalTask.create).not.toHaveBeenCalled();
  });

  it("fails closed when the candidate is not human-confirmed", async () => {
    await expect(
      promoteGovernedJudgementCandidateToTask({
        workspaceId,
        actorUserId: "operator-1",
        actorName: "Synthetic Operator",
        artifactBundleId,
        title: "Follow up the operating signal",
      }),
    ).rejects.toBeInstanceOf(GovernedCandidateReviewError);

    expect(dbMock.policyRule.findFirst).not.toHaveBeenCalled();
    expect(dbMock.actionItem.create).not.toHaveBeenCalled();
  });

  it("reuses the winning task after a concurrent promotion claim loss", async () => {
    dbMock.artifactBundle.findFirst.mockResolvedValue(
      artifactRow({
        status: ArtifactBundleStatus.CONFIRMED,
        artifactReview: {
          ...artifactRow().artifactReview,
          status: ArtifactReviewStatus.CONFIRMED,
        },
      }),
    );
    dbMock.artifactBundle.updateMany.mockResolvedValue({ count: 0 });
    dbMock.actionItem.findFirst.mockResolvedValue(existingPromotion());

    await expect(
      promoteGovernedJudgementCandidateToTask({
        workspaceId,
        actorUserId: "operator-2",
        actorName: "Second Operator",
        artifactBundleId,
        title: "Follow up the operating signal",
      }),
    ).resolves.toEqual({
      artifactBundleId,
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      reused: true,
    });

    expect(dbMock.actionItem.create).not.toHaveBeenCalled();
    expect(dbMock.approvalTask.create).not.toHaveBeenCalled();
    expect(dbMock.auditLog.create).not.toHaveBeenCalled();
  });
});
