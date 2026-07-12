import {
  ActorType,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    artifactBundle: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    artifactReview: {
      create: vi.fn(),
    },
    auditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  buildGovernedJudgementCandidate,
  governedJudgementCandidateSchema,
} from "@/lib/llm/governed-runtime-contracts";
import {
  GOVERNED_CANDIDATE_MATERIALIZE_CAPABILITY,
  GOVERNED_CANDIDATE_MATERIALIZER_PRINCIPAL,
  deriveGovernedCandidateArtifactBundleId,
  GovernedCandidateMaterializationDeniedError,
  materializeGovernedJudgementCandidate,
} from "@/lib/llm/governed-candidate-materializer";

const workspaceId = "workspace-1";
const createdAt = "2026-07-12T08:00:00.000Z";
const evidenceRef = "evidence:synthetic:1";
const sourceCandidateRef = "artifact:private-shadow:source-1";

function candidate(overrides: Record<string, unknown> = {}) {
  const proposal = {
    proposalId: "proposal:synthetic:1",
    objectRef: {
      objectType: "opportunity",
      objectId: "object:synthetic:1",
    },
    reviewState: "candidate" as const,
    confidence: 82,
    evidenceRefs: [evidenceRef],
    missingEvidence: [
      {
        gapId: "gap:synthetic:1",
        missingSignalNote: "One counter-signal still needs human verification.",
      },
    ],
    counterEvidenceNeeded: ["Verify a current counter-signal."],
    nextSafeActions: ["Prepare an explicit human review packet."],
    forbiddenCapabilityRefs: [
      "connector_activation",
      "external_send",
      "writeback",
      "run_crm_import",
      "memory_promotion",
      "preference_signal_write",
      "pattern_fact_write",
    ],
  };
  const roleOutputs = ["generator", "critic", "adversary"].map((role) => ({
    role,
    reviewState: "candidate",
    evidenceRefs: [evidenceRef],
    notes: [],
  }));
  const trajectoryReceipt = {
    receiptId: "trajectory:private-shadow:source-1",
    taskId: sourceCandidateRef,
    createdAt,
    modelProfileKey: "local-shadow-v1",
    redactionStatus: "alias_only" as const,
    rawPromptIncluded: false as const,
    rawCustomerDataIncluded: false as const,
    tenantUrlIncluded: false as const,
    productionReceiptIncluded: false as const,
    boundaryDecisions: ["allow_candidate" as const],
    steps: [
      {
        stepId: "boundary-decision",
        stepType: "boundary_decision" as const,
        summary: "Deterministic arbiter routed a review-first candidate.",
        evidenceRefs: [evidenceRef],
        riskClass: "read" as const,
        blocked: false,
      },
    ],
    finalClaim: {
      claimedDone: true,
      claimedReleaseReady: false,
      claimedApprovalGranted: false,
      promotedCandidate: false,
      intentMatched: true,
      selfCertified: false,
      claimedSourceTruthWithoutEvidence: false,
    },
  };
  return buildGovernedJudgementCandidate({
    sourceCandidateRef,
    sourceCandidateContentHash: `sha256:${"a".repeat(64)}`,
    sourceBundleRef: "bundle:private-context:1",
    sourceBuildReceiptRef: "receipt:private-context-build:1",
    verifiedEvidenceRefs: [evidenceRef],
    proposal,
    roleOutputs,
    trajectoryReceipt,
    ...overrides,
  });
}

function capabilityGrant(overrides: Record<string, unknown> = {}) {
  return {
    grantRef: "grant:governed-candidate:1",
    principalRef: GOVERNED_CANDIDATE_MATERIALIZER_PRINCIPAL,
    capabilityRef: GOVERNED_CANDIDATE_MATERIALIZE_CAPABILITY,
    scopeRef: `workspace:${workspaceId}`,
    effectMode: "draft_only",
    policyVersion: "policy:governed-intelligence:v4",
    isolationProfileRef: "isolation:review-worker:v1",
    entitlementRef: null,
    killSwitchRef: "kill-switch:governed-intelligence:v1",
    issuedAt: "2026-07-12T00:00:00.000Z",
    expiresAt: "2026-07-13T00:00:00.000Z",
    revokedAt: null,
    ...overrides,
  };
}

describe("governed judgement candidate contract", () => {
  it("is strict and binds its content hash, trajectory, and evidence refs", () => {
    const value = candidate();
    expect(governedJudgementCandidateSchema.parse(value)).toEqual(value);
    expect(() =>
      governedJudgementCandidateSchema.parse({
        ...value,
        autoExecuteAllowed: true,
      }),
    ).toThrow();
    expect(() =>
      buildGovernedJudgementCandidate({
        sourceCandidateRef,
        sourceCandidateContentHash: `sha256:${"a".repeat(64)}`,
        sourceBundleRef: "bundle:private-context:1",
        sourceBuildReceiptRef: "receipt:private-context-build:1",
        verifiedEvidenceRefs: [evidenceRef],
        proposal: {
          ...value.proposal,
          nextSafeActions: ["x".repeat(256_001)],
        },
        roleOutputs: value.roleOutputs,
        trajectoryReceipt: value.trajectoryReceipt,
      }),
    ).toThrow();
    expect(() =>
      buildGovernedJudgementCandidate({
        sourceCandidateRef,
        sourceCandidateContentHash: `sha256:${"a".repeat(64)}`,
        sourceBundleRef: "bundle:private-context:1",
        sourceBuildReceiptRef: "receipt:private-context-build:1",
        verifiedEvidenceRefs: [],
        proposal: { ...value.proposal, evidenceRefs: [] },
        roleOutputs: value.roleOutputs.map((output) => ({
          ...output,
          evidenceRefs: [],
        })),
        trajectoryReceipt: {
          ...value.trajectoryReceipt,
          steps: value.trajectoryReceipt.steps.map((step) => ({
            ...step,
            evidenceRefs: [],
          })),
        },
      }),
    ).toThrow();
    expect(() =>
      governedJudgementCandidateSchema.parse({
        ...value,
        contentHash: `sha256:${"f".repeat(64)}`,
      }),
    ).toThrow();
    expect(() =>
      buildGovernedJudgementCandidate({
        sourceCandidateRef,
        sourceCandidateContentHash: `sha256:${"a".repeat(64)}`,
        sourceBundleRef: "bundle:private-context:1",
        sourceBuildReceiptRef: "receipt:private-context-build:1",
        verifiedEvidenceRefs: [evidenceRef],
        proposal: value.proposal,
        roleOutputs: value.roleOutputs.map((output, index) =>
          index === 1
            ? { ...output, evidenceRefs: ["evidence:hallucinated"] }
            : output,
        ),
        trajectoryReceipt: value.trajectoryReceipt,
      }),
    ).toThrow();
  });
});

describe("governed candidate materializer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T12:00:00.000Z"));
    dbMock.$transaction.mockImplementation(
      async (run: (tx: typeof dbMock) => Promise<unknown>) => run(dbMock),
    );
    dbMock.artifactBundle.findUnique.mockResolvedValue(null);
    dbMock.artifactBundle.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({ ...data }),
    );
    dbMock.artifactReview.create.mockResolvedValue({
      id: "review-1",
      status: ArtifactReviewStatus.PENDING,
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("atomically creates only a DRAFT Artifact, PENDING review, and minimal audit", async () => {
    const value = candidate();
    const artifactBundleId = deriveGovernedCandidateArtifactBundleId(
      workspaceId,
      value.candidateId,
    );
    const result = await materializeGovernedJudgementCandidate({
      workspaceId,
      candidate: value,
      capabilityGrant: capabilityGrant(),
    });

    expect(result).toEqual({
      artifactBundleId,
      artifactReviewId: "review-1",
      reused: false,
    });
    expect(dbMock.$transaction).toHaveBeenCalledOnce();
    expect(dbMock.artifactBundle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: artifactBundleId,
        workspaceId,
        status: ArtifactBundleStatus.DRAFT,
        systemOfRecordWrite: false,
        reviewPosture: "governed_intelligence_candidate_review_required",
      }),
    });
    expect(dbMock.artifactReview.create).toHaveBeenCalledWith({
      data: {
        workspaceId,
        artifactBundleId,
        status: ArtifactReviewStatus.PENDING,
      },
    });
    expect(dbMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId,
        actorType: ActorType.SYSTEM,
        actionType: "GOVERNED_INTELLIGENCE_CANDIDATE_MATERIALIZED",
        targetType: "ArtifactBundle",
        targetId: artifactBundleId,
      }),
    });
    const auditPayload = JSON.parse(
      dbMock.auditLog.create.mock.calls[0][0].data.payload,
    );
    expect(auditPayload).toEqual({
      candidateId: value.candidateId,
      candidateContentHash: value.contentHash,
      sourceCandidateRef: value.sourceCandidateRef,
      sourceCandidateContentHash: value.sourceCandidateContentHash,
      sourceBundleRef: value.sourceBundleRef,
      sourceBuildReceiptRef: value.sourceBuildReceiptRef,
      trajectoryReceiptRef: value.trajectoryReceipt.receiptId,
      artifactReviewId: "review-1",
    });
    expect(JSON.stringify(auditPayload)).not.toContain("nextSafeActions");
  });

  it("reuses an identical pending materialization without duplicate writes", async () => {
    const value = candidate();
    await materializeGovernedJudgementCandidate({
      workspaceId,
      candidate: value,
      capabilityGrant: capabilityGrant(),
    });
    const created = dbMock.artifactBundle.create.mock.calls[0][0].data;
    dbMock.artifactBundle.findUnique.mockResolvedValue({
      ...created,
      artifactReview: {
        id: "review-1",
        status: ArtifactReviewStatus.PENDING,
      },
    });
    dbMock.auditLog.findFirst.mockResolvedValue({ id: "audit-1" });

    const reused = await materializeGovernedJudgementCandidate({
      workspaceId,
      candidate: value,
      capabilityGrant: capabilityGrant(),
    });

    expect(reused.reused).toBe(true);
    expect(dbMock.artifactBundle.create).toHaveBeenCalledOnce();
    expect(dbMock.artifactReview.create).toHaveBeenCalledOnce();
    expect(dbMock.auditLog.create).toHaveBeenCalledOnce();
  });

  it("recovers a concurrent deterministic-id insert as an idempotent reuse", async () => {
    const value = candidate();
    await materializeGovernedJudgementCandidate({
      workspaceId,
      candidate: value,
      capabilityGrant: capabilityGrant(),
    });
    const created = dbMock.artifactBundle.create.mock.calls[0][0].data;
    const existing = {
      ...created,
      artifactReview: {
        id: "review-1",
        status: ArtifactReviewStatus.PENDING,
      },
    };

    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(
      async (run: (tx: typeof dbMock) => Promise<unknown>) => run(dbMock),
    );
    dbMock.artifactBundle.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    dbMock.artifactBundle.create.mockRejectedValue({ code: "P2002" });
    dbMock.auditLog.findFirst.mockResolvedValue({ id: "audit-1" });

    await expect(
      materializeGovernedJudgementCandidate({
        workspaceId,
        candidate: value,
        capabilityGrant: capabilityGrant(),
      }),
    ).resolves.toEqual({
      artifactBundleId: deriveGovernedCandidateArtifactBundleId(
        workspaceId,
        value.candidateId,
      ),
      artifactReviewId: "review-1",
      reused: true,
    });
    expect(dbMock.$transaction).toHaveBeenCalledTimes(2);
    expect(dbMock.artifactReview.create).not.toHaveBeenCalled();
    expect(dbMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("uses a workspace-scoped persistence id for identical candidate content", async () => {
    const value = candidate();
    await materializeGovernedJudgementCandidate({
      workspaceId,
      candidate: value,
      capabilityGrant: capabilityGrant(),
    });
    await materializeGovernedJudgementCandidate({
      workspaceId: "workspace-2",
      candidate: value,
      capabilityGrant: capabilityGrant({ scopeRef: "workspace:workspace-2" }),
    });

    const ids = dbMock.artifactBundle.create.mock.calls.map(
      ([{ data }]) => data.id,
    );
    expect(ids).toEqual([
      deriveGovernedCandidateArtifactBundleId(workspaceId, value.candidateId),
      deriveGovernedCandidateArtifactBundleId("workspace-2", value.candidateId),
    ]);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("fails closed on invalid capability or unsafe persisted text", async () => {
    await expect(
      materializeGovernedJudgementCandidate({
        workspaceId: "",
        candidate: candidate(),
        capabilityGrant: capabilityGrant(),
      }),
    ).rejects.toBeInstanceOf(GovernedCandidateMaterializationDeniedError);

    await expect(
      materializeGovernedJudgementCandidate({
        workspaceId,
        candidate: candidate(),
        capabilityGrant: capabilityGrant({ effectMode: "read_only" }),
      }),
    ).rejects.toBeInstanceOf(GovernedCandidateMaterializationDeniedError);

    await expect(
      materializeGovernedJudgementCandidate({
        workspaceId,
        candidate: candidate({
          proposal: {
            ...candidate().proposal,
            nextSafeActions: ["Call 13800138000 before review."],
          },
        }),
        capabilityGrant: capabilityGrant(),
      }),
    ).rejects.toBeInstanceOf(GovernedCandidateMaterializationDeniedError);

    await expect(
      materializeGovernedJudgementCandidate({
        workspaceId,
        candidate: candidate({
          verifiedEvidenceRefs: [evidenceRef, "secret:unused-evidence-token"],
        }),
        capabilityGrant: capabilityGrant(),
      }),
    ).rejects.toBeInstanceOf(GovernedCandidateMaterializationDeniedError);

    vi.setSystemTime(new Date("2026-07-14T00:00:00.000Z"));
    await expect(
      materializeGovernedJudgementCandidate({
        workspaceId,
        candidate: candidate(),
        capabilityGrant: capabilityGrant(),
      }),
    ).rejects.toBeInstanceOf(GovernedCandidateMaterializationDeniedError);
  });
});
