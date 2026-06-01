import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, auditMock } = vi.hoisted(() => ({
  dbMock: {
    actionItem: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    approvalTask: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  auditMock: {
    writeAuditLog: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));

import {
  listTenantResourceManualProofRecords,
  reviewTenantResourceManualProof,
  startTenantResourceManualProofReview,
  submitTenantResourceManualProof,
  withdrawTenantResourceManualProof,
} from "@/lib/tenant-resources/manual-proof-runtime";

const workspaceId = "workspace-1";
const resourceKey = "crm_import:proof";
const resourceName = "CRM Import";
const actionRef = "settings-resource-evidence:crm_import:proof";
const provider = "crm_import";

function buildMetadata(input: {
  proofStatus: "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewStartedBy?: string | null;
  reviewStartedAt?: string | null;
  expiresAt?: string | null;
  failureReason?: string | null;
  note?: string | null;
}) {
  return JSON.stringify(
    {
      kind: "tenant_resource_manual_proof",
      version: 1,
      resourceKey,
      resourceName,
      actionRef,
      provider,
      proofStatus: input.proofStatus,
      evidenceRefs: ["connector:1", "import:1"],
      submittedBy: input.submittedBy ?? "Submitter",
      submittedAt: input.submittedAt ?? "2026-04-25T00:00:00.000Z",
      reviewedBy: input.reviewedBy ?? null,
      reviewedAt: input.reviewedAt ?? null,
      reviewStartedBy: input.reviewStartedBy ?? null,
      reviewStartedAt: input.reviewStartedAt ?? null,
      expiresAt: input.expiresAt ?? "2026-12-31T00:00:00.000Z",
      failureReason: input.failureReason ?? null,
      note: input.note ?? "Operator note",
    },
    null,
    2,
  );
}

describe("tenant resource manual proof runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T00:00:00.000Z"));
    dbMock.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === "function") {
        return input(dbMock);
      }
      return Promise.all(input as Promise<unknown>[]);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("submits proof into the local persistence seam and lists it back as SUBMITTED", async () => {
    dbMock.actionItem.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "proof-1",
          metadata: buildMetadata({ proofStatus: "SUBMITTED", submittedBy: "Submitter" }),
          approvalTask: { id: "task-1" },
        },
      ]);
    dbMock.actionItem.create.mockResolvedValue({
      id: "proof-1",
    });
    dbMock.approvalTask.create.mockResolvedValue({
      id: "task-1",
    });

    const created = await submitTenantResourceManualProof({
      workspaceId,
      actorUserId: "user-1",
      actorName: "Submitter",
      resourceKey,
      resourceName,
      provider,
      actionRef,
      evidenceRefs: ["connector:1", "import:1"],
      note: "Uploaded screenshot and local operator note for the manual step.",
    });
    const records = await listTenantResourceManualProofRecords(workspaceId);

    expect(created).toEqual({
      proofId: "proof-1",
      approvalTaskId: "task-1",
    });
    expect(dbMock.actionItem.create).toHaveBeenCalledOnce();
    expect(dbMock.approvalTask.create).toHaveBeenCalledOnce();
    expect(records[0]).toMatchObject({
      proofId: "proof-1",
      resourceKey,
      actionRef,
      status: "SUBMITTED",
      submittedBy: "Submitter",
    });
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "TENANT_RESOURCE_MANUAL_PROOF_SUBMITTED",
      }),
    );
  });

  it("marks a submitted proof as UNDER_REVIEW when review starts", async () => {
    dbMock.actionItem.findFirst.mockResolvedValue({
      id: "proof-1",
      metadata: buildMetadata({ proofStatus: "SUBMITTED" }),
      approvalTask: {
        id: "task-1",
        approverId: null,
      },
    });
    dbMock.actionItem.update.mockResolvedValue({});
    dbMock.approvalTask.update.mockResolvedValue({});

    await startTenantResourceManualProofReview({
      workspaceId,
      reviewerId: "reviewer-1",
      reviewerName: "Reviewer",
      proofId: "proof-1",
    });

    const startReviewUpdate = dbMock.actionItem.update.mock.calls[0]?.[0];
    expect(dbMock.actionItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proof-1" },
        data: expect.objectContaining({
          executionStatus: "tenant_resource_manual_proof_under_review",
          metadata: expect.any(String),
        }),
      }),
    );
    expect(startReviewUpdate.data.metadata).toContain('"proofStatus": "UNDER_REVIEW"');
    expect(startReviewUpdate.data.metadata).toContain('"reviewStartedBy": "Reviewer"');
    expect(dbMock.approvalTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1" },
        data: { approverId: "reviewer-1" },
      }),
    );
  });

  it("accepts and rejects proof through the narrow review seam", async () => {
    dbMock.actionItem.findFirst
      .mockResolvedValueOnce({
        id: "proof-accept",
        metadata: buildMetadata({ proofStatus: "UNDER_REVIEW" }),
        approvalTask: {
          id: "task-accept",
          approverId: "reviewer-1",
        },
      })
      .mockResolvedValueOnce({
        id: "proof-reject",
        metadata: buildMetadata({ proofStatus: "SUBMITTED" }),
        approvalTask: {
          id: "task-reject",
          approverId: null,
        },
      });
    dbMock.actionItem.update.mockResolvedValue({});
    dbMock.approvalTask.update.mockResolvedValue({});

    await reviewTenantResourceManualProof({
      workspaceId,
      reviewerId: "reviewer-1",
      reviewerName: "Reviewer",
      proofId: "proof-accept",
      mode: "accept",
      note: "Proof is sufficient for follow-through evidence.",
    });
    await reviewTenantResourceManualProof({
      workspaceId,
      reviewerId: "reviewer-1",
      reviewerName: "Reviewer",
      proofId: "proof-reject",
      mode: "reject",
      note: "Need a fresher screenshot and clearer operator note.",
    });

    const acceptedUpdate = dbMock.actionItem.update.mock.calls[0]?.[0];
    const rejectedUpdate = dbMock.actionItem.update.mock.calls[1]?.[0];
    expect(dbMock.actionItem.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "proof-accept" },
        data: expect.objectContaining({
          status: "EXECUTED",
          executionStatus: "tenant_resource_manual_proof_accepted",
          metadata: expect.any(String),
        }),
      }),
    );
    expect(dbMock.actionItem.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "proof-reject" },
        data: expect.objectContaining({
          status: "REJECTED",
          executionStatus: "tenant_resource_manual_proof_rejected",
          metadata: expect.any(String),
        }),
      }),
    );
    expect(acceptedUpdate.data.metadata).toContain('"proofStatus": "ACCEPTED"');
    expect(rejectedUpdate.data.metadata).toContain('"proofStatus": "REJECTED"');
    expect(rejectedUpdate.data.metadata).toContain("Need a fresher screenshot");
  });

  it("withdraws pending or rejected proof and blocks duplicate open submissions", async () => {
    dbMock.actionItem.findFirst.mockResolvedValue({
      id: "proof-1",
      metadata: buildMetadata({ proofStatus: "REJECTED" }),
      approvalTask: {
        id: "task-1",
        approverId: "reviewer-1",
      },
    });
    dbMock.actionItem.update.mockResolvedValue({});
    dbMock.approvalTask.update.mockResolvedValue({});

    await withdrawTenantResourceManualProof({
      workspaceId,
      actorUserId: "user-1",
      actorName: "Submitter",
      proofId: "proof-1",
      note: "Will resubmit after refreshing evidence.",
    });

    const withdrawUpdate = dbMock.actionItem.update.mock.calls[0]?.[0];
    expect(dbMock.actionItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proof-1" },
        data: expect.objectContaining({
          status: "WITHDRAWN",
          executionStatus: "tenant_resource_manual_proof_withdrawn",
          metadata: expect.any(String),
        }),
      }),
    );
    expect(withdrawUpdate.data.metadata).toContain('"proofStatus": "WITHDRAWN"');

    dbMock.actionItem.findMany.mockResolvedValueOnce([
      {
        id: "proof-open",
        metadata: buildMetadata({ proofStatus: "SUBMITTED" }),
        approvalTask: { id: "task-open" },
      },
    ]);

    await expect(
      submitTenantResourceManualProof({
        workspaceId,
        actorUserId: "user-1",
        actorName: "Submitter",
        resourceKey,
        resourceName,
        provider,
        actionRef,
        evidenceRefs: ["connector:1", "import:1"],
        note: "Duplicate proof submission should fail.",
      }),
    ).rejects.toThrow("tenant_resource_manual_proof_already_open");
  });
});
