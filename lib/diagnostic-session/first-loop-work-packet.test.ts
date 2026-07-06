import { ActionStatus, ActionType, SourceType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, engineMock } = vi.hoisted(() => ({
  dbMock: {
    diagnosticSession: {
      findFirst: vi.fn(),
    },
    actionItem: {
      findFirst: vi.fn(),
    },
  },
  engineMock: {
    createGovernedAction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/policies/engine", () => ({
  createGovernedAction: engineMock.createGovernedAction,
}));

import {
  DiagnosticFirstLoopGateNotPassedError,
  buildDiagnosticSessionWorkPacketSourceId,
  createFirstLoopWorkPacketFromDiagnosticSession,
} from "@/lib/diagnostic-session/first-loop-work-packet";
import { DiagnosticSessionReservedOnlyError } from "@/lib/diagnostic-session/queries";

const RESERVED_WORKSPACE = {
  workspaceClass: "HELM_RESERVED" as const,
  systemKey: "helm_reserved_primary",
};

const CUSTOMER_WORKSPACE = {
  workspaceClass: "CUSTOMER" as const,
  systemKey: null,
};

function buildSession(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "session-1",
    workspaceId: "workspace-1",
    diagnosticKey: "diag-2026-07-lead",
    businessGoal: "把美业连锁的到店复购率提升 10%",
    firstLoopCandidateType: "LEAD_FOLLOW_UP",
    firstLoopCandidateNote: "先跑通 3 家门店的线索跟进闭环",
    status: "FIRST_LOOP_SELECTED",
    ...overrides,
  };
}

describe("createFirstLoopWorkPacketFromDiagnosticSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.actionItem.findFirst.mockResolvedValue(null);
    engineMock.createGovernedAction.mockResolvedValue({
      actionItemId: "action-1",
      approvalTaskId: "task-1",
      status: ActionStatus.PENDING_APPROVAL,
      requiresApproval: true,
      reason: "requires approval",
    });
  });

  it("turns a gate-passed session into one governed review-first work packet", async () => {
    dbMock.diagnosticSession.findFirst.mockResolvedValue(buildSession());

    const result = await createFirstLoopWorkPacketFromDiagnosticSession({
      workspace: RESERVED_WORKSPACE,
      workspaceId: "workspace-1",
      sessionId: "session-1",
      actorName: "Founder",
      actorUserId: "user-1",
    });

    expect(result).toEqual({ actionItemId: "action-1", approvalTaskId: "task-1", created: true });
    expect(engineMock.createGovernedAction).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        actionType: ActionType.CREATE_TASK,
        title: expect.stringContaining("首环启动"),
        sourceType: SourceType.SYSTEM_INFERENCE,
        sourceId: buildDiagnosticSessionWorkPacketSourceId("session-1"),
        metadata: expect.objectContaining({
          diagnosticSessionId: "session-1",
          firstLoopCandidateType: "LEAD_FOLLOW_UP",
        }),
      }),
    );
  });

  it("is idempotent: an existing packet for the session is returned, not duplicated", async () => {
    dbMock.diagnosticSession.findFirst.mockResolvedValue(buildSession());
    dbMock.actionItem.findFirst.mockResolvedValue({
      id: "action-existing",
      approvalTask: { id: "task-existing" },
    });

    const result = await createFirstLoopWorkPacketFromDiagnosticSession({
      workspace: RESERVED_WORKSPACE,
      workspaceId: "workspace-1",
      sessionId: "session-1",
      actorName: "Founder",
      actorUserId: "user-1",
    });

    expect(result).toEqual({
      actionItemId: "action-existing",
      approvalTaskId: "task-existing",
      created: false,
    });
    expect(engineMock.createGovernedAction).not.toHaveBeenCalled();
  });

  it("refuses sessions that have not passed the first-loop gate", async () => {
    dbMock.diagnosticSession.findFirst.mockResolvedValue(
      buildSession({ status: "REVIEWED" }),
    );

    await expect(
      createFirstLoopWorkPacketFromDiagnosticSession({
        workspace: RESERVED_WORKSPACE,
        workspaceId: "workspace-1",
        sessionId: "session-1",
        actorName: "Founder",
      }),
    ).rejects.toBeInstanceOf(DiagnosticFirstLoopGateNotPassedError);

    dbMock.diagnosticSession.findFirst.mockResolvedValue(
      buildSession({ firstLoopCandidateType: null }),
    );

    await expect(
      createFirstLoopWorkPacketFromDiagnosticSession({
        workspace: RESERVED_WORKSPACE,
        workspaceId: "workspace-1",
        sessionId: "session-1",
        actorName: "Founder",
      }),
    ).rejects.toBeInstanceOf(DiagnosticFirstLoopGateNotPassedError);

    expect(engineMock.createGovernedAction).not.toHaveBeenCalled();
  });

  it("stays reserved-workspace-only", async () => {
    await expect(
      createFirstLoopWorkPacketFromDiagnosticSession({
        workspace: CUSTOMER_WORKSPACE,
        workspaceId: "workspace-1",
        sessionId: "session-1",
        actorName: "Founder",
      }),
    ).rejects.toBeInstanceOf(DiagnosticSessionReservedOnlyError);

    expect(dbMock.diagnosticSession.findFirst).not.toHaveBeenCalled();
  });
});
