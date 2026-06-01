import { beforeEach, describe, expect, it, vi } from "vitest";

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
  acknowledgeTenantResourceGuardedWritePilot,
  listTenantResourceGuardedWritePilotRecords,
  requestTenantResourceGuardedWritePilot,
  reviewTenantResourceGuardedWritePilot,
} from "@/lib/tenant-resources/guarded-write-pilot-runtime";

const workspaceId = "workspace-1";
const resourceKey = "crm_import:pilot";
const resourceName = "CRM Import";
const actionRef = "settings-resource-evidence:crm_import:pilot";

function buildMetadata(input: {
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "ACKNOWLEDGED";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  note?: string | null;
}) {
  return JSON.stringify(
    {
      kind: "tenant_resource_guarded_write_pilot",
      version: 1,
      resourceKey,
      resourceName,
      actionRef,
      provider: "crm_import",
      proofId: "proof-1",
      status: input.status,
      requestedBy: "Operator",
      requestedAt: "2026-04-25T00:00:00.000Z",
      reviewedBy: input.reviewedBy ?? null,
      reviewedAt: input.reviewedAt ?? null,
      acknowledgedBy: input.acknowledgedBy ?? null,
      acknowledgedAt: input.acknowledgedAt ?? null,
      evidenceRefs: ["connector:1", "proof:1"],
      note: input.note ?? null,
    },
    null,
    2,
  );
}

describe("tenant resource guarded write pilot runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === "function") {
        return input(dbMock);
      }
      return Promise.all(input as Promise<unknown>[]);
    });
  });

  it("requests the local pilot and lists it back as pending review", async () => {
    dbMock.actionItem.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "pilot-1",
          metadata: buildMetadata({ status: "PENDING_REVIEW" }),
          approvalTask: { id: "task-1" },
        },
      ]);
    dbMock.actionItem.create.mockResolvedValue({ id: "pilot-1" });
    dbMock.approvalTask.create.mockResolvedValue({ id: "task-1" });

    const created = await requestTenantResourceGuardedWritePilot({
      workspaceId,
      actorUserId: "user-1",
      actorName: "Operator",
      resourceKey,
      resourceName,
      provider: "crm_import",
      actionRef,
      proofId: "proof-1",
      evidenceRefs: ["connector:1", "proof:1"],
      note: "Accepted proof is ready for the local guarded-write pilot.",
    });
    const records = await listTenantResourceGuardedWritePilotRecords(workspaceId);

    expect(created).toEqual({
      pilotId: "pilot-1",
      approvalTaskId: "task-1",
    });
    expect(records[0]).toMatchObject({
      pilotId: "pilot-1",
      status: "PENDING_REVIEW",
      resourceKey,
    });
  });

  it("approves, rejects and acknowledges the local pilot lifecycle", async () => {
    dbMock.actionItem.findFirst
      .mockResolvedValueOnce({
        id: "pilot-approve",
        metadata: buildMetadata({ status: "PENDING_REVIEW" }),
        approvalTask: { id: "task-approve" },
      })
      .mockResolvedValueOnce({
        id: "pilot-reject",
        metadata: buildMetadata({ status: "PENDING_REVIEW" }),
        approvalTask: { id: "task-reject" },
      })
      .mockResolvedValueOnce({
        id: "pilot-ack",
        metadata: buildMetadata({ status: "APPROVED", reviewedBy: "Reviewer" }),
        approvalTask: { id: "task-ack" },
      });
    dbMock.actionItem.update.mockResolvedValue({});
    dbMock.approvalTask.update.mockResolvedValue({});

    await reviewTenantResourceGuardedWritePilot({
      workspaceId,
      reviewerId: "reviewer-1",
      reviewerName: "Reviewer",
      pilotId: "pilot-approve",
      mode: "approve",
      note: "Pilot may proceed to local acknowledgement.",
    });
    await reviewTenantResourceGuardedWritePilot({
      workspaceId,
      reviewerId: "reviewer-1",
      reviewerName: "Reviewer",
      pilotId: "pilot-reject",
      mode: "reject",
      note: "Proof is fine, but mapping conflict still needs review.",
    });
    await acknowledgeTenantResourceGuardedWritePilot({
      workspaceId,
      actorUserId: "user-1",
      actorName: "Operator",
      pilotId: "pilot-ack",
      note: "Local pilot closeout acknowledged.",
    });

    const approvedUpdate = dbMock.actionItem.update.mock.calls[0]?.[0];
    const rejectedUpdate = dbMock.actionItem.update.mock.calls[1]?.[0];
    const acknowledgedUpdate = dbMock.actionItem.update.mock.calls[2]?.[0];

    expect(approvedUpdate.data.metadata).toContain('"status": "APPROVED"');
    expect(rejectedUpdate.data.metadata).toContain('"status": "REJECTED"');
    expect(acknowledgedUpdate.data.metadata).toContain('"status": "ACKNOWLEDGED"');
    expect(acknowledgedUpdate.data.executionStatus).toBe(
      "tenant_resource_guarded_write_pilot_acknowledged",
    );
  });

  it("blocks duplicate open pilots for the same resource action", async () => {
    dbMock.actionItem.findMany.mockResolvedValueOnce([
      {
        id: "pilot-open",
        metadata: buildMetadata({ status: "PENDING_REVIEW" }),
        approvalTask: { id: "task-open" },
      },
    ]);

    await expect(
      requestTenantResourceGuardedWritePilot({
        workspaceId,
        actorUserId: "user-1",
        actorName: "Operator",
        resourceKey,
        resourceName,
        provider: "crm_import",
        actionRef,
        proofId: "proof-1",
        evidenceRefs: ["connector:1", "proof:1"],
      }),
    ).rejects.toThrow("tenant_resource_guarded_write_pilot_already_open");
  });
});
