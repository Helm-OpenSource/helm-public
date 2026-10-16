import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    approvalTask: { findMany: vi.fn() },
    memoryFact: { findMany: vi.fn() },
    blocker: { findMany: vi.fn() },
    commitment: { findMany: vi.fn() },
    emailThread: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  getApprovalTasksData,
  resolveApprovalOriginThreadId,
} from "@/features/approvals/queries";

function task(
  id: string,
  actionItem: { metadata?: string | null; sourceType?: string | null; sourceId?: string | null },
) {
  return {
    id,
    actionItem: {
      metadata: actionItem.metadata ?? null,
      sourceType: actionItem.sourceType ?? null,
      sourceId: actionItem.sourceId ?? null,
      recommendationLog: null,
      createdBy: { id: "user-1", name: "Ada", email: "ada@example.test" },
    },
  };
}

describe("approval origin thread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the thread id from action metadata, then from an EMAIL_THREAD source", () => {
    expect(
      resolveApprovalOriginThreadId({
        metadata: JSON.stringify({ threadId: "thread-1" }),
        sourceType: "SYSTEM_INFERENCE",
        sourceId: "opp-1",
      }),
    ).toBe("thread-1");
    expect(
      resolveApprovalOriginThreadId({
        metadata: null,
        sourceType: "EMAIL_THREAD",
        sourceId: "thread-2",
      }),
    ).toBe("thread-2");
    expect(
      resolveApprovalOriginThreadId({
        metadata: JSON.stringify({ createMeetingTitle: "Sync" }),
        sourceType: "SYSTEM_INFERENCE",
        sourceId: "Reply draft",
      }),
    ).toBeNull();
  });

  it("links only threads the viewer may open, with one batched thread read", async () => {
    dbMock.approvalTask.findMany.mockResolvedValue([
      task("task-1", { metadata: JSON.stringify({ threadId: "thread-1" }) }),
      task("task-2", { sourceType: "EMAIL_THREAD", sourceId: "thread-hidden" }),
      task("task-3", { metadata: JSON.stringify({ threadId: "thread-1" }) }),
      task("task-4", {}),
    ]);
    dbMock.emailThread.findMany.mockResolvedValue([
      { id: "thread-1", subject: "Pilot scope" },
    ]);

    const tasks = await getApprovalTasksData("workspace-1", false, {
      viewerEmail: "Ada@Example.test",
    });

    expect(dbMock.emailThread.findMany).toHaveBeenCalledTimes(1);
    const query = dbMock.emailThread.findMany.mock.calls[0][0];
    expect(query.select).toEqual({ id: true, subject: true });
    expect(query.where.AND[1]).toEqual({
      id: { in: ["thread-1", "thread-hidden"] },
    });
    expect(JSON.stringify(query.where.AND[0])).toContain("ada@example.test");
    expect(query.where.AND[0].workspaceId).toBe("workspace-1");

    expect(tasks.map((item) => item.originThread)).toEqual([
      { id: "thread-1", subject: "Pilot scope" },
      null,
      { id: "thread-1", subject: "Pilot scope" },
      null,
    ]);
    expect(tasks[0].actionItem.createdBy).toEqual({
      id: "user-1",
      name: "Ada",
      email: "ada@example.test",
    });
  });

  it("skips the thread read when no action names a thread", async () => {
    dbMock.approvalTask.findMany.mockResolvedValue([task("task-1", {})]);

    const tasks = await getApprovalTasksData("workspace-1");

    expect(dbMock.emailThread.findMany).not.toHaveBeenCalled();
    expect(tasks[0].originThread).toBeNull();
  });

  it("selects the initiator on the action item", async () => {
    dbMock.approvalTask.findMany.mockResolvedValue([]);

    await getApprovalTasksData("workspace-1");

    const query = dbMock.approvalTask.findMany.mock.calls[0][0];
    expect(query.include.actionItem.include.createdBy).toEqual({
      select: { id: true, name: true, email: true },
    });
  });
});
