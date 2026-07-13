import {
  ActorType,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    artifactBundle: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    artifactReview: { create: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
    humanActionExecution: { create: vi.fn() },
    connector: { create: vi.fn(), update: vi.fn() },
    memoryCandidate: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  buildGovernedConnectorScopeCandidate,
  buildGovernedExternalSendDraftCandidate,
} from "@/lib/governed-intelligence/capability-closeout-contracts";
import {
  GOVERNED_CLOSEOUT_CANDIDATE_MATERIALIZER_PRINCIPAL,
  GOVERNED_CONNECTOR_SCOPE_ARTIFACT_TYPE,
  GOVERNED_CONNECTOR_SCOPE_MATERIALIZE_CAPABILITY,
  GOVERNED_EXTERNAL_SEND_ARTIFACT_TYPE,
  GOVERNED_EXTERNAL_SEND_MATERIALIZE_CAPABILITY,
  GovernedCapabilityCloseoutMaterializationError,
  materializeGovernedConnectorScopeCandidate,
  materializeGovernedExternalSendDraftCandidate,
} from "@/lib/governed-intelligence/capability-closeout-materializer";
import { GOVERNED_CANDIDATE_ARTIFACT_TYPE } from "@/lib/governed-intelligence/governed-candidate-artifact";

const workspaceId = "workspace-1";
const sourceArtifactBundleId = "artifact:synthetic:confirmed-source";
const sourceArtifactReviewId = "review:synthetic:confirmed-source";
const now = "2026-07-13T01:00:00.000Z";

function sourceArtifact() {
  return {
    id: sourceArtifactBundleId,
    workspaceId,
    artifactType: GOVERNED_CANDIDATE_ARTIFACT_TYPE,
    status: ArtifactBundleStatus.CONFIRMED,
    systemOfRecordWrite: false,
    artifactReview: {
      id: sourceArtifactReviewId,
      workspaceId,
      status: ArtifactReviewStatus.CONFIRMED,
      reviewedByUserId: "reviewer-1",
    },
  };
}

function capabilityGrant(capabilityRef: string, overrides = {}) {
  return {
    grantRef: `grant:${capabilityRef}:1`,
    principalRef: GOVERNED_CLOSEOUT_CANDIDATE_MATERIALIZER_PRINCIPAL,
    capabilityRef,
    scopeRef: `workspace:${workspaceId}`,
    effectMode: "draft_only",
    policyVersion: "policy:governed-intelligence:v4",
    isolationProfileRef: "isolation:review-worker:v1",
    entitlementRef: null,
    killSwitchRef: "kill-switch:governed-intelligence:v1",
    issuedAt: "2026-07-13T00:00:00.000Z",
    expiresAt: "2026-07-14T00:00:00.000Z",
    revokedAt: null,
    ...overrides,
  };
}

function externalSendCandidate() {
  const recipientHash = `sha256:${"a".repeat(64)}`;
  const messageContentHash = `sha256:${"b".repeat(64)}`;
  return buildGovernedExternalSendDraftCandidate({
    sourceArtifactBundleId,
    sourceArtifactReviewId,
    meetingId: "meeting:synthetic:1",
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
      expiresAt: "2026-07-13T01:05:00.000Z",
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
    requestedScopes: ["contacts.read", "opportunities.read"],
    riskClass: "medium",
    rationale: ["Read-only evidence is required."],
    evidenceRefs: ["evidence:synthetic:connector-1"],
    missingEvidence: ["Confirm the tenant-side OAuth owner."],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  dbMock.$transaction.mockImplementation(
    async (run: (tx: typeof dbMock) => Promise<unknown>) => run(dbMock),
  );
  dbMock.artifactBundle.findFirst.mockResolvedValue(sourceArtifact());
  dbMock.artifactBundle.findUnique.mockResolvedValue(null);
  dbMock.artifactBundle.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => data,
  );
  dbMock.artifactReview.create.mockResolvedValue({
    id: "review:synthetic:closeout-1",
    status: ArtifactReviewStatus.PENDING,
  });
  dbMock.auditLog.create.mockResolvedValue({ id: "audit:synthetic:1" });
});

describe("governed capability closeout materializer", () => {
  it("materializes an external-send draft as DRAFT/PENDING only", async () => {
    const result = await materializeGovernedExternalSendDraftCandidate({
      workspaceId,
      candidate: externalSendCandidate(),
      capabilityGrant: capabilityGrant(
        GOVERNED_EXTERNAL_SEND_MATERIALIZE_CAPABILITY,
      ),
    });

    expect(result).toMatchObject({
      artifactReviewId: "review:synthetic:closeout-1",
      reused: false,
    });
    expect(dbMock.artifactBundle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        artifactType: GOVERNED_EXTERNAL_SEND_ARTIFACT_TYPE,
        status: ArtifactBundleStatus.DRAFT,
        systemOfRecordWrite: false,
      }),
    });
    expect(dbMock.artifactReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId,
        status: ArtifactReviewStatus.PENDING,
      }),
    });
    expect(dbMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: ActorType.SYSTEM,
        actionType: "GOVERNED_EXTERNAL_SEND_DRAFT_MATERIALIZED",
      }),
    });
    expect(dbMock.humanActionExecution.create).not.toHaveBeenCalled();
    expect(dbMock.connector.create).not.toHaveBeenCalled();
    expect(dbMock.memoryCandidate.create).not.toHaveBeenCalled();
  });

  it("materializes connector scope/risk as a candidate Artifact only", async () => {
    await materializeGovernedConnectorScopeCandidate({
      workspaceId,
      candidate: connectorCandidate(),
      capabilityGrant: capabilityGrant(
        GOVERNED_CONNECTOR_SCOPE_MATERIALIZE_CAPABILITY,
      ),
    });

    expect(dbMock.artifactBundle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        artifactType: GOVERNED_CONNECTOR_SCOPE_ARTIFACT_TYPE,
        status: ArtifactBundleStatus.DRAFT,
        systemOfRecordWrite: false,
      }),
    });
    expect(dbMock.connector.create).not.toHaveBeenCalled();
    expect(dbMock.connector.update).not.toHaveBeenCalled();
  });

  it("rejects foreign, unconfirmed, rejected-by-guard, and mismatched grants", async () => {
    dbMock.artifactBundle.findFirst.mockResolvedValueOnce(null);
    await expect(
      materializeGovernedExternalSendDraftCandidate({
        workspaceId,
        candidate: externalSendCandidate(),
        capabilityGrant: capabilityGrant(
          GOVERNED_EXTERNAL_SEND_MATERIALIZE_CAPABILITY,
        ),
      }),
    ).rejects.toMatchObject({ code: "source_not_confirmed" });

    await expect(
      materializeGovernedConnectorScopeCandidate({
        workspaceId,
        candidate: {
          ...connectorCandidate(),
          reviewState: "rejected_by_guard",
        },
        capabilityGrant: capabilityGrant(
          GOVERNED_CONNECTOR_SCOPE_MATERIALIZE_CAPABILITY,
        ),
      }),
    ).rejects.toBeInstanceOf(GovernedCapabilityCloseoutMaterializationError);

    await expect(
      materializeGovernedConnectorScopeCandidate({
        workspaceId,
        candidate: connectorCandidate(),
        capabilityGrant: capabilityGrant(
          GOVERNED_EXTERNAL_SEND_MATERIALIZE_CAPABILITY,
        ),
      }),
    ).rejects.toMatchObject({ code: "capability_denied" });

    expect(dbMock.artifactBundle.create).not.toHaveBeenCalled();
  });
});
