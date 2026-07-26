import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    decisionWorkPacketClaim: { findFirst: vi.fn() },
    externalMemoryRecord: { findUnique: vi.fn(), create: vi.fn() },
    observationSource: { findFirst: vi.fn() },
    auditLog: { create: vi.fn(), findFirst: vi.fn() },
    decisionRecord: { findMany: vi.fn() },
    supervisionSignalRecord: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  executeQoderWorkTool,
  serverProposalPayloadHash,
} from "./tool-executor";

const AUTH = {
  connectionId: "connection-1",
  workspaceId: "workspace-1",
  userId: "user-1",
  deviceRef: "device:synthetic-1",
  observationProgramId: "program-1",
  scopes: ["work-packet:read", "draft:propose"] as const,
  allowedSourceIds: ["source-1"],
  allowedObjectTypes: ["opportunity"],
  maxDataClassification: "internal",
  approvedModelProfileRefs: [],
};

const DRAFT = {
  schemaVersion: "1.0",
  correlationRef: "corr_draft_001",
  idempotencyKey: "idem_draft_001",
  workPacketRef: "work-packet:synthetic-1",
  objectRef: { type: "opportunity", id: "opportunity:synthetic-1" },
  draftKind: "customer_follow_up",
  summary: "Synthetic customer follow-up draft",
  evidenceRefs: ["evidence:synthetic-1"],
  contentHash: `sha256:${"a".repeat(64)}`,
  redactionStatus: "redacted",
};

describe("QoderWork governed tool executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation((callback: (tx: typeof dbMock) => unknown) => callback(dbMock));
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue({
      id: "work-packet:synthetic-1",
      decisionRecord: { contextRefs: JSON.stringify(["opportunity:synthetic-1"]) },
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("reads a dispatched but owner-confirmed Work Packet", async () => {
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue({
      id: "work-packet:synthetic-1",
      actionItemId: "action-1",
      ownerCommandJson: "{}",
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
      decisionRecord: {
        id: "decision-1",
        contextRefs: JSON.stringify(["opportunity:synthetic-1"]),
      },
      actionItem: { id: "action-1", status: "PENDING" },
    });

    const result = await executeQoderWorkTool({
      auth: AUTH,
      toolName: "get_work_packet",
      arguments: {
        schemaVersion: "1.0",
        correlationRef: "corr_read_001",
        idempotencyKey: "idem_read_001",
        workPacketRef: "work-packet:synthetic-1",
        objectRef: { type: "opportunity", id: "synthetic-1" },
      },
    });

    expect(result.status).toBe("accepted");
    expect(dbMock.decisionWorkPacketClaim.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-1",
          decisionRecord: expect.objectContaining({
            ownerConfirmedAt: { not: null },
            status: { in: ["OWNER_CONFIRMED", "DISPATCHED"] },
          }),
        }),
      }),
    );
  });

  it("returns the original candidate for the same idempotency key and content", async () => {
    dbMock.externalMemoryRecord.findUnique.mockResolvedValue({
      id: "candidate-1",
      checksum: DRAFT.contentHash,
      rawMetadata: JSON.stringify({
        disposition: "accept_as_draft_candidate",
        reasonCodes: ["requires_human_review"],
        serverPayloadHash: serverProposalPayloadHash(DRAFT),
      }),
    });
    dbMock.auditLog.findFirst.mockResolvedValue({ id: "audit-original", requestId: "request-original" });

    const result = await executeQoderWorkTool({
      auth: AUTH,
      toolName: "propose_draft_artifact",
      arguments: DRAFT,
    });

    expect(result).toMatchObject({
      status: "accepted",
      acceptedArtifactRefs: ["candidate-1"],
      receiptRef: "audit-original",
      warnings: expect.arrayContaining(["requires_human_review", "DUPLICATE"]),
    });
    expect(dbMock.externalMemoryRecord.create).not.toHaveBeenCalled();
  });

  it("routes a divergent payload under a matching declared hash to CONFLICT (reviewer bypass)", async () => {
    // Same idempotency key, same caller-declared contentHash, but the
    // stored server-computed payload hash belongs to a DIFFERENT payload:
    // the server must refuse the replay instead of answering with the old
    // artifact.
    dbMock.externalMemoryRecord.findUnique.mockResolvedValue({
      id: "candidate-1",
      checksum: DRAFT.contentHash,
      rawMetadata: JSON.stringify({
        disposition: "accept_as_draft_candidate",
        reasonCodes: ["requires_human_review"],
        serverPayloadHash: serverProposalPayloadHash({
          ...DRAFT,
          contentSummary: "a different summary the caller tried to swap in",
        }),
      }),
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit-conflict" });

    const result = await executeQoderWorkTool({
      auth: AUTH,
      toolName: "propose_draft_artifact",
      arguments: DRAFT,
    });

    expect(result).toMatchObject({
      status: "rejected",
      warnings: expect.arrayContaining(["CONFLICT"]),
    });
    expect(dbMock.externalMemoryRecord.create).not.toHaveBeenCalled();
  });

  it("fails closed to CONFLICT when the stored candidate has no server payload hash", async () => {
    dbMock.externalMemoryRecord.findUnique.mockResolvedValue({
      id: "candidate-1",
      checksum: DRAFT.contentHash,
      rawMetadata: JSON.stringify({
        disposition: "accept_as_draft_candidate",
        reasonCodes: ["requires_human_review"],
      }),
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit-conflict" });

    const result = await executeQoderWorkTool({
      auth: AUTH,
      toolName: "propose_draft_artifact",
      arguments: DRAFT,
    });

    expect(result).toMatchObject({
      status: "rejected",
      warnings: expect.arrayContaining(["CONFLICT"]),
    });
  });

  it("preserves quarantine on an idempotent replay", async () => {
    dbMock.externalMemoryRecord.findUnique.mockResolvedValue({
      id: "candidate-1",
      checksum: DRAFT.contentHash,
      rawMetadata: JSON.stringify({
        disposition: "quarantine",
        reasonCodes: ["authority_exceeded"],
        serverPayloadHash: serverProposalPayloadHash(DRAFT),
      }),
    });
    dbMock.auditLog.findFirst.mockResolvedValue({ id: "audit-original", requestId: "request-original" });

    const result = await executeQoderWorkTool({
      auth: AUTH,
      toolName: "propose_draft_artifact",
      arguments: DRAFT,
    });

    expect(result).toMatchObject({
      status: "quarantined",
      acceptedArtifactRefs: ["candidate-1"],
      receiptRef: "audit-original",
      warnings: expect.arrayContaining(["authority_exceeded", "DUPLICATE"]),
    });
  });

  it("rejects a read outside the connection object scope before querying business data", async () => {
    const result = await executeQoderWorkTool({
      auth: AUTH,
      toolName: "get_context_pack",
      arguments: {
        schemaVersion: "1.0",
        correlationRef: "corr_read_scope_001",
        idempotencyKey: "idem_read_scope_001",
        objectRef: { type: "company", id: "synthetic-1" },
      },
    });

    expect(result).toMatchObject({
      status: "rejected",
      warnings: ["object_type_out_of_scope"],
    });
    expect(dbMock.decisionRecord.findMany).not.toHaveBeenCalled();
    expect(dbMock.supervisionSignalRecord.findMany).not.toHaveBeenCalled();
  });

  it("fails closed and records an immutable audit when a key is reused with different content", async () => {
    dbMock.externalMemoryRecord.findUnique.mockResolvedValue({
      id: "candidate-1",
      checksum: "sha256:different",
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit-conflict" });

    const result = await executeQoderWorkTool({
      auth: AUTH,
      toolName: "propose_draft_artifact",
      arguments: DRAFT,
    });

    expect(result).toMatchObject({
      status: "rejected",
      acceptedArtifactRefs: [],
      receiptRef: "audit-conflict",
      warnings: ["CONFLICT"],
    });
    expect(dbMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        actionType: "QODERWORK_IDEMPOTENCY_CONFLICT",
      }),
    });
  });
});
