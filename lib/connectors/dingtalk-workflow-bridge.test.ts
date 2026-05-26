import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbMock,
  createGovernedActionMock,
  writeAuditLogMock,
  logEventMock,
} = vi.hoisted(() => ({
  dbMock: {
    actionItem: {
      findFirst: vi.fn(),
    },
  },
  createGovernedActionMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
  logEventMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/policies/engine", () => ({
  createGovernedAction: createGovernedActionMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: logEventMock,
}));

import { bridgeDingTalkSignalsToWorkflow } from "@/lib/connectors/dingtalk-workflow-bridge";

describe("dingtalk workflow bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.actionItem.findFirst.mockResolvedValue(null);
    createGovernedActionMock.mockResolvedValue({
      actionItemId: "action-1",
      requiresApproval: true,
      status: "PENDING_APPROVAL",
      reason: "policy",
    });
    writeAuditLogMock.mockResolvedValue(undefined);
    logEventMock.mockResolvedValue(undefined);
  });

  it("creates governed action for matched signal when auto create is enabled", async () => {
    const result = await bridgeDingTalkSignalsToWorkflow({
      workspaceId: "workspace-1",
      actorName: "Helm",
      actorUserId: "user-1",
      english: false,
      sourcePage: "/settings",
      autoCreateActions: true,
      signals: [
        {
          scope: "TODO",
          sourceId: "todo-1",
          sourceType: "todo_task",
          label: "跟进客户",
          summary: "需要补齐材料",
          opportunityId: "opportunity-1",
          meetingId: null,
          companyId: null,
          objectLinkState: "matched",
          objectLinkReason: "title match",
          extractedFields: null,
        },
      ],
    });

    expect(createGovernedActionMock).toHaveBeenCalledTimes(1);
    expect(result.actionCreatedCount).toBe(1);
    expect(result.approvalEnqueuedCount).toBe(1);
    expect(result.matchedObjectCount).toBe(1);
  });

  it("skips auto create when disabled and keeps candidate in audit trail", async () => {
    const result = await bridgeDingTalkSignalsToWorkflow({
      workspaceId: "workspace-1",
      actorName: "Helm",
      actorUserId: "user-1",
      english: true,
      sourcePage: "/settings",
      autoCreateActions: false,
      signals: [
        {
          scope: "WORK",
          sourceId: "report-1",
          sourceType: "work_report",
          label: "Weekly report",
          summary: "weekly report summary",
          opportunityId: "opportunity-1",
          meetingId: null,
          companyId: null,
          objectLinkState: "matched",
          objectLinkReason: "company match",
          extractedFields: null,
        },
      ],
    });

    expect(createGovernedActionMock).not.toHaveBeenCalled();
    expect(result.skippedCount).toBe(1);
    expect(writeAuditLogMock).toHaveBeenCalled();
  });

  it("deduplicates by stable source key", async () => {
    dbMock.actionItem.findFirst.mockResolvedValueOnce({ id: "existing-action" });

    const result = await bridgeDingTalkSignalsToWorkflow({
      workspaceId: "workspace-1",
      actorName: "Helm",
      actorUserId: "user-1",
      english: true,
      sourcePage: "/settings",
      autoCreateActions: true,
      signals: [
        {
          scope: "PROJECTS",
          sourceId: "project-task-1",
          sourceType: "project_item",
          label: "Project task",
          summary: "stage change",
          opportunityId: "opportunity-1",
          meetingId: null,
          companyId: null,
          objectLinkState: "matched",
          objectLinkReason: "project title",
          extractedFields: null,
        },
      ],
    });

    expect(createGovernedActionMock).not.toHaveBeenCalled();
    expect(result.dedupSkippedCount).toBe(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
