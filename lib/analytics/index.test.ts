import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, conflictRetryMock, sessionMock } = vi.hoisted(() => ({
  dbMock: {
    eventLog: {
      create: vi.fn(),
    },
    dailyUsageSnapshot: {
      upsert: vi.fn(),
    },
  },
  conflictRetryMock: {
    runWithWriteConflictRetry: vi.fn(),
  },
  sessionMock: {
    getCurrentUser: vi.fn(),
    getCurrentWorkspaceSession: vi.fn(),
    getSessionId: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/db/conflict-aware-write", () => conflictRetryMock);
vi.mock("@/lib/auth/session", () => sessionMock);

import { logEvent } from "@/lib/analytics";
import { logCurrentWorkspaceEvent, logPageViewEvent } from "@/lib/analytics/session-events";

beforeEach(() => {
  vi.clearAllMocks();
  conflictRetryMock.runWithWriteConflictRetry.mockImplementation(
    (operation: () => unknown) => operation(),
  );
  dbMock.eventLog.create.mockResolvedValue({});
  dbMock.dailyUsageSnapshot.upsert.mockResolvedValue({});
});

describe("logEvent (session-free analytics seam)", () => {
  it("writes the event log row from explicit workspace input", async () => {
    await logEvent({
      workspaceId: "workspace-1",
      userId: "user-1",
      eventName: "policy_rule_changed",
      eventCategory: "governance",
    });

    expect(dbMock.eventLog.create).toHaveBeenCalledTimes(1);
    expect(dbMock.eventLog.create.mock.calls[0][0].data).toMatchObject({
      workspaceId: "workspace-1",
      userId: "user-1",
      eventName: "policy_rule_changed",
      eventCategory: "governance",
    });
  });

  it("increments the mapped daily usage counter for the acting user", async () => {
    await logEvent({
      workspaceId: "workspace-1",
      userId: "user-1",
      eventName: "policy_rule_changed",
      eventCategory: "governance",
    });

    expect(dbMock.dailyUsageSnapshot.upsert).toHaveBeenCalledTimes(1);
    expect(dbMock.dailyUsageSnapshot.upsert.mock.calls[0][0].update).toEqual({
      policyChanges: { increment: 1 },
    });
  });

  it("skips the per-user snapshot when there is no acting user", async () => {
    await logEvent({
      workspaceId: "workspace-1",
      eventName: "policy_rule_changed",
      eventCategory: "governance",
    });

    expect(dbMock.eventLog.create).toHaveBeenCalledTimes(1);
    expect(dbMock.dailyUsageSnapshot.upsert).not.toHaveBeenCalled();
  });

  it("never resolves the current session on behalf of the caller", async () => {
    await logEvent({
      workspaceId: "workspace-1",
      eventName: "policy_rule_changed",
      eventCategory: "governance",
    });

    expect(sessionMock.getCurrentUser).not.toHaveBeenCalled();
    expect(sessionMock.getCurrentWorkspaceSession).not.toHaveBeenCalled();
    expect(sessionMock.getSessionId).not.toHaveBeenCalled();
  });
});

describe("logCurrentWorkspaceEvent (session-bound analytics)", () => {
  it("resolves workspace, user, and session id from the current session", async () => {
    sessionMock.getCurrentUser.mockResolvedValue({ id: "user-1" });
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      workspace: { id: "workspace-1" },
    });
    sessionMock.getSessionId.mockResolvedValue("session-1");

    await logCurrentWorkspaceEvent({
      eventName: "dashboard_opened",
      eventCategory: "navigation",
    });

    expect(dbMock.eventLog.create).toHaveBeenCalledTimes(1);
    expect(dbMock.eventLog.create.mock.calls[0][0].data).toMatchObject({
      workspaceId: "workspace-1",
      userId: "user-1",
      sessionId: "session-1",
      eventName: "dashboard_opened",
      eventCategory: "navigation",
    });
  });

  it("records nothing when there is no signed-in user", async () => {
    sessionMock.getCurrentUser.mockResolvedValue(null);

    await logCurrentWorkspaceEvent({
      eventName: "dashboard_opened",
      eventCategory: "navigation",
    });

    expect(sessionMock.getCurrentWorkspaceSession).not.toHaveBeenCalled();
    expect(dbMock.eventLog.create).not.toHaveBeenCalled();
  });

  it("records nothing when the current session has no workspace", async () => {
    sessionMock.getCurrentUser.mockResolvedValue({ id: "user-1" });
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue(null);

    await logCurrentWorkspaceEvent({
      eventName: "dashboard_opened",
      eventCategory: "navigation",
    });

    expect(dbMock.eventLog.create).not.toHaveBeenCalled();
  });
});

describe("logPageViewEvent (session-bound analytics)", () => {
  it("defaults the page view target to the source page", async () => {
    sessionMock.getCurrentUser.mockResolvedValue({ id: "user-1" });
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      workspace: { id: "workspace-1" },
    });
    sessionMock.getSessionId.mockResolvedValue("session-1");

    await logPageViewEvent({
      eventName: "dashboard_opened",
      sourcePage: "/dashboard",
    });

    expect(dbMock.eventLog.create.mock.calls[0][0].data).toMatchObject({
      eventCategory: "page_view",
      targetType: "Page",
      targetId: "/dashboard",
      sourcePage: "/dashboard",
    });
  });
});
