import {
  ActorType,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
  HumanActionExecutionAckStatus,
  HumanActionExecutionStatus,
  HumanActionExecutionType,
  RuntimeMemoryCandidateStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, governanceMock } = vi.hoisted(() => ({
  dbMock: {
    artifactBundle: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    artifactReview: { updateMany: vi.fn() },
    meeting: { findFirst: vi.fn() },
    runtimeSession: { findFirst: vi.fn() },
    humanActionExecution: { findUnique: vi.fn(), create: vi.fn() },
    memoryCandidate: { findUnique: vi.fn(), create: vi.fn() },
    memoryPromotion: { create: vi.fn() },
    memoryItem: { create: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
  governanceMock: {
    assertWorkspaceGovernedActionReviewServiceAccess: vi.fn(),
    assertWorkspaceGovernedActionManagementServiceAccess: vi.fn(),
    assertWorkspaceMemoryServiceAccess: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth/service-governance", () => governanceMock);

import {
  buildGovernedConnectorScopeCandidate,
  buildGovernedExternalSendDraftCandidate,
} from "@/lib/governed-intelligence/capability-closeout-contracts";
import {
  GOVERNED_CONNECTOR_SCOPE_ARTIFACT_TYPE,
  GOVERNED_EXTERNAL_SEND_ARTIFACT_TYPE,
} from "@/lib/governed-intelligence/capability-closeout-materializer";
import {
  GovernedCapabilityCloseoutReviewError,
  prepareGovernedExternalSendHumanExecution,
  projectConfirmedArtifactToMemoryCandidate,
  reviewGovernedCapabilityCloseoutCandidate,
} from "@/lib/governed-intelligence/capability-closeout-review";
import {
  GOVERNED_CANDIDATE_ARTIFACT_TYPE,
  GOVERNED_CANDIDATE_REVIEW_POSTURE,
} from "@/lib/governed-intelligence/governed-candidate-artifact";

const workspaceId = "workspace-1";
const sourceArtifactBundleId = "artifact:synthetic:source";
const sourceArtifactReviewId = "review:synthetic:source";
const closeoutArtifactBundleId = "artifact:synthetic:closeout";
const closeoutArtifactReviewId = "review:synthetic:closeout";
const now = "2026-07-13T02:00:00.000Z";

function externalSendCandidate() {
  const recipientHash = `sha256:${"a".repeat(64)}`;
  const messageContentHash = `sha256:${"b".repeat(64)}`;
  return buildGovernedExternalSendDraftCandidate({
    sourceArtifactBundleId,
    sourceArtifactReviewId,
    meetingId: "meeting-1",
    reviewState: "candidate",
    recipientRef: "recipient:synthetic:fixed-1",
    recipientHash,
    messageContentRef: "content:synthetic:fixed-1",
    messageContentHash,
    dlpReceipt: {
      receiptRef: "receipt:synthetic:dlp-1",
      recipientHash,
      messageContentHash,
      decision: "passed",
      rulesetVersion: "synthetic-dlp-v1",
      scannedAt: now,
      rawContentStored: false,
    },
    rateLimitReceipt: {
      receiptRef: "receipt:synthetic:rate-1",
      recipientHash,
      decision: "allowed",
      checkedAt: now,
      expiresAt: "2026-07-13T02:05:00.000Z",
    },
    dedupeReceipt: {
      receiptRef: "receipt:synthetic:dedupe-1",
      recipientHash,
      messageContentHash,
      decision: "clear",
      checkedAt: now,
    },
  });
}

function connectorCandidate() {
  return buildGovernedConnectorScopeCandidate({
    sourceArtifactBundleId,
    sourceArtifactReviewId,
    reviewState: "needs_review",
    providerRef: "provider:synthetic:crm",
    connectorClass: "crm",
    requestedScopes: ["contacts.read"],
    riskClass: "medium",
    rationale: ["Read-only source evidence is required."],
    evidenceRefs: ["evidence:synthetic:connector-1"],
    missingEvidence: ["Confirm the human connector owner."],
  });
}

function closeoutArtifact(candidate: unknown, overrides = {}) {
  return {
    id: closeoutArtifactBundleId,
    workspaceId,
    artifactType:
      "recipientRef" in (candidate as Record<string, unknown>)
        ? GOVERNED_EXTERNAL_SEND_ARTIFACT_TYPE
        : GOVERNED_CONNECTOR_SCOPE_ARTIFACT_TYPE,
    status: ArtifactBundleStatus.DRAFT,
    systemOfRecordWrite: false,
    artifactsJson: JSON.stringify(candidate),
    reviewPosture:
      "recipientRef" in (candidate as Record<string, unknown>)
        ? "governed_external_send_draft_review_required"
        : "governed_connector_scope_review_required",
    artifactReview: {
      id: closeoutArtifactReviewId,
      workspaceId,
      status: ArtifactReviewStatus.PENDING,
      reviewedByUserId: null,
    },
    ...overrides,
  };
}

function governedJudgementPayload() {
  return {
    schemaVersion: "helm.governed-judgement-artifact/v1",
    candidateId: "governed-candidate:synthetic-memory-1",
    sourceCandidateRef: "candidate:private-shadow:synthetic-memory-1",
    sourceCandidateContentHash: `sha256:${"c".repeat(64)}`,
    proposal: {
      proposalId: "proposal:synthetic:memory-1",
      objectRef: {
        objectType: "opportunity",
        objectId: "object:synthetic:memory-1",
      },
      reviewState: "candidate",
      confidence: 84,
      evidenceRefs: ["evidence:synthetic:memory-1"],
      missingEvidence: [],
      counterEvidenceNeeded: ["Revalidate before official promotion."],
      nextSafeActions: ["Retain this judgement as a memory candidate."],
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
    roleOutputs: ["generator", "critic", "adversary"].map((role) => ({
      role,
      reviewState: "candidate",
      evidenceRefs: ["evidence:synthetic:memory-1"],
      notes: [],
    })),
    boundaryDecision: "allow_candidate",
    trajectoryReceiptRef: "trajectory:synthetic:memory-1",
    requiredHumanReview: true,
    promotionAllowed: false,
    externalEffectAllowed: false,
    contentHash: `sha256:${"d".repeat(64)}`,
  };
}

function confirmedJudgementArtifact(overrides = {}) {
  return {
    id: sourceArtifactBundleId,
    workspaceId,
    artifactType: GOVERNED_CANDIDATE_ARTIFACT_TYPE,
    status: ArtifactBundleStatus.CONFIRMED,
    systemOfRecordWrite: false,
    reviewPosture: GOVERNED_CANDIDATE_REVIEW_POSTURE,
    artifactsJson: JSON.stringify(governedJudgementPayload()),
    evidenceRefs: JSON.stringify(["evidence:synthetic:memory-1"]),
    sourceProvenance: JSON.stringify({
      sourceCandidateRef: "candidate:private-shadow:synthetic-memory-1",
      sourceCandidateContentHash: `sha256:${"c".repeat(64)}`,
      sourceBundleRef: "bundle:private-context:synthetic-memory-1",
      sourceBuildReceiptRef: "receipt:private-context:synthetic-memory-1",
      trajectoryReceiptRef: "trajectory:synthetic:memory-1",
      candidateContentHash: `sha256:${"d".repeat(64)}`,
      redactionStatus: "alias_only",
    }),
    confidence: 84,
    artifactReview: {
      id: sourceArtifactReviewId,
      workspaceId,
      status: ArtifactReviewStatus.CONFIRMED,
      reviewedByUserId: "reviewer-1",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-13T02:01:00.000Z"));
  dbMock.$transaction.mockImplementation(
    async (run: (tx: typeof dbMock) => Promise<unknown>) => run(dbMock),
  );
  dbMock.artifactBundle.updateMany.mockResolvedValue({ count: 1 });
  dbMock.artifactReview.updateMany.mockResolvedValue({ count: 1 });
  dbMock.meeting.findFirst.mockResolvedValue({
    id: "meeting-1",
    workspaceId,
    opportunityId: "opportunity-1",
    companyId: "company-1",
  });
  dbMock.runtimeSession.findFirst.mockResolvedValue({
    id: "runtime-session-1",
    workspaceId,
  });
  dbMock.humanActionExecution.findUnique.mockResolvedValue(null);
  dbMock.humanActionExecution.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => data,
  );
  dbMock.memoryCandidate.findUnique.mockResolvedValue(null);
  dbMock.memoryCandidate.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "memory-candidate-1",
      createdAt: new Date("2026-07-13T02:01:00.000Z"),
      ...data,
    }),
  );
  dbMock.auditLog.create.mockResolvedValue({ id: "audit-1" });
  governanceMock.assertWorkspaceGovernedActionReviewServiceAccess.mockResolvedValue(
    "REVIEWER",
  );
  governanceMock.assertWorkspaceGovernedActionManagementServiceAccess.mockResolvedValue(
    "OPERATOR",
  );
  governanceMock.assertWorkspaceMemoryServiceAccess.mockResolvedValue("REVIEWER");
});

describe("governed capability closeout review", () => {
  it("confirms a connector candidate without touching connector state", async () => {
    dbMock.artifactBundle.findFirst.mockResolvedValue(
      closeoutArtifact(connectorCandidate()),
    );

    await expect(
      reviewGovernedCapabilityCloseoutCandidate({
        workspaceId,
        reviewerId: "reviewer-1",
        reviewerName: "Synthetic Reviewer",
        artifactBundleId: closeoutArtifactBundleId,
        decision: "confirm",
      }),
    ).resolves.toMatchObject({
      reviewStatus: ArtifactReviewStatus.CONFIRMED,
      reused: false,
    });

    expect(dbMock.artifactReview.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ArtifactReviewStatus.CONFIRMED,
        }),
      }),
    );
    expect(dbMock.humanActionExecution.create).not.toHaveBeenCalled();
    expect(dbMock.memoryCandidate.create).not.toHaveBeenCalled();
  });

  it("promotes a confirmed send draft only to READY/PENDING human execution", async () => {
    dbMock.artifactBundle.findFirst.mockResolvedValue(
      closeoutArtifact(externalSendCandidate(), {
        status: ArtifactBundleStatus.CONFIRMED,
        artifactReview: {
          id: closeoutArtifactReviewId,
          workspaceId,
          status: ArtifactReviewStatus.CONFIRMED,
          reviewedByUserId: "reviewer-1",
        },
      }),
    );

    const result = await prepareGovernedExternalSendHumanExecution({
      workspaceId,
      actorUserId: "operator-1",
      actorName: "Synthetic Operator",
      artifactBundleId: closeoutArtifactBundleId,
    });

    expect(result).toMatchObject({ reused: false });
    expect(dbMock.humanActionExecution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: HumanActionExecutionType.MANUAL_EMAIL_SEND,
        status: HumanActionExecutionStatus.READY,
        acknowledgementStatus: HumanActionExecutionAckStatus.PENDING,
        executedAt: null,
      }),
    });
    expect(dbMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: ActorType.USER,
        actionType: "GOVERNED_EXTERNAL_SEND_HANDOFF_PREPARED",
      }),
    });
    expect(dbMock.memoryPromotion.create).not.toHaveBeenCalled();
  });

  it("fails closed when a send rate-limit receipt is expired", async () => {
    vi.setSystemTime(new Date("2026-07-13T02:06:00.000Z"));
    dbMock.artifactBundle.findFirst.mockResolvedValue(
      closeoutArtifact(externalSendCandidate(), {
        status: ArtifactBundleStatus.CONFIRMED,
        artifactReview: {
          id: closeoutArtifactReviewId,
          workspaceId,
          status: ArtifactReviewStatus.CONFIRMED,
          reviewedByUserId: "reviewer-1",
        },
      }),
    );

    await expect(
      prepareGovernedExternalSendHumanExecution({
        workspaceId,
        actorUserId: "operator-1",
        actorName: "Synthetic Operator",
        artifactBundleId: closeoutArtifactBundleId,
      }),
    ).rejects.toMatchObject({ code: "send_receipt_expired" });
    expect(dbMock.humanActionExecution.create).not.toHaveBeenCalled();
  });

  it("projects a confirmed judgement only to PENDING_VERIFICATION memory", async () => {
    dbMock.artifactBundle.findFirst.mockResolvedValue(
      confirmedJudgementArtifact(),
    );

    const result = await projectConfirmedArtifactToMemoryCandidate({
      workspaceId,
      runtimeSessionId: "runtime-session-1",
      actorUserId: "reviewer-1",
      actorName: "Synthetic Reviewer",
      artifactBundleId: sourceArtifactBundleId,
    });

    expect(result.receipt).toMatchObject({
      memoryCandidateId: "memory-candidate-1",
      candidateStatus: "pending_verification",
      memoryPromotionCreated: false,
      canonicalMemoryWritten: false,
    });
    expect(dbMock.memoryCandidate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId,
        runtimeSessionId: "runtime-session-1",
        artifactBundleId: sourceArtifactBundleId,
        status: RuntimeMemoryCandidateStatus.PENDING_VERIFICATION,
      }),
    });
    expect(dbMock.memoryPromotion.create).not.toHaveBeenCalled();
    expect(dbMock.memoryItem.create).not.toHaveBeenCalled();
  });

  it("rejects a foreign runtime session before memory writes", async () => {
    dbMock.artifactBundle.findFirst.mockResolvedValue(
      confirmedJudgementArtifact(),
    );
    dbMock.runtimeSession.findFirst.mockResolvedValue(null);

    await expect(
      projectConfirmedArtifactToMemoryCandidate({
        workspaceId,
        runtimeSessionId: "runtime-session-foreign",
        actorUserId: "reviewer-1",
        actorName: "Synthetic Reviewer",
        artifactBundleId: sourceArtifactBundleId,
      }),
    ).rejects.toBeInstanceOf(GovernedCapabilityCloseoutReviewError);
    expect(dbMock.memoryCandidate.create).not.toHaveBeenCalled();
  });

  it("rejects a confirmed Artifact whose provenance no longer binds its content", async () => {
    dbMock.artifactBundle.findFirst.mockResolvedValue(
      confirmedJudgementArtifact({
        sourceProvenance: JSON.stringify({
          sourceCandidateRef: "candidate:private-shadow:synthetic-memory-1",
          sourceCandidateContentHash: `sha256:${"c".repeat(64)}`,
          sourceBundleRef: "bundle:private-context:synthetic-memory-1",
          sourceBuildReceiptRef: "receipt:private-context:synthetic-memory-1",
          trajectoryReceiptRef: "trajectory:synthetic:memory-1",
          candidateContentHash: `sha256:${"f".repeat(64)}`,
          redactionStatus: "alias_only",
        }),
      }),
    );

    await expect(
      projectConfirmedArtifactToMemoryCandidate({
        workspaceId,
        runtimeSessionId: "runtime-session-1",
        actorUserId: "reviewer-1",
        actorName: "Synthetic Reviewer",
        artifactBundleId: sourceArtifactBundleId,
      }),
    ).rejects.toMatchObject({ code: "artifact_contract_invalid" });
    expect(dbMock.memoryCandidate.create).not.toHaveBeenCalled();
  });

  it("rejects a deterministic memory key whose persisted projection differs", async () => {
    dbMock.artifactBundle.findFirst.mockResolvedValue(
      confirmedJudgementArtifact(),
    );
    const first = await projectConfirmedArtifactToMemoryCandidate({
      workspaceId,
      runtimeSessionId: "runtime-session-1",
      actorUserId: "reviewer-1",
      actorName: "Synthetic Reviewer",
      artifactBundleId: sourceArtifactBundleId,
    });
    const createdData = dbMock.memoryCandidate.create.mock.calls[0][0].data;
    dbMock.memoryCandidate.findUnique.mockResolvedValue({
      id: first.receipt.memoryCandidateId,
      createdAt: new Date(first.receipt.projectedAt),
      ...createdData,
      summary: "substituted projection",
    });
    dbMock.auditLog.findFirst.mockResolvedValue({ id: "audit-1" });

    await expect(
      projectConfirmedArtifactToMemoryCandidate({
        workspaceId,
        runtimeSessionId: "runtime-session-1",
        actorUserId: "reviewer-1",
        actorName: "Synthetic Reviewer",
        artifactBundleId: sourceArtifactBundleId,
      }),
    ).rejects.toMatchObject({ code: "memory_candidate_conflict" });
    expect(dbMock.memoryCandidate.create).toHaveBeenCalledOnce();
  });
});
