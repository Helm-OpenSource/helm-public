import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: {
    requireCurrentUser: vi.fn(),
    getCurrentWorkspace: vi.fn(),
    getCurrentWorkspaceSession: vi.fn(),
  },
  runtime: {
    getRuntimeSessionTrace: vi.fn(),
    resumeRuntimeCheckpoint: vi.fn(),
  },
  governance: {
    canManageWorkspaceRuntime: vi.fn(),
    getRuntimeManagementDeniedMessage: vi.fn(),
  },
  ownership: {
    assertWorkspaceRuntimeCheckpointOwnership: vi.fn(),
    isWorkspaceOwnershipError: vi.fn(),
  },
  db: {
    sessionCheckpoint: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: mocks.session.requireCurrentUser,
  getCurrentWorkspace: mocks.session.getCurrentWorkspace,
  getCurrentWorkspaceSession: mocks.session.getCurrentWorkspaceSession,
}));

vi.mock("@/lib/helm-v2/runtime-upgrade", () => ({
  getRuntimeSessionTrace: mocks.runtime.getRuntimeSessionTrace,
  resumeRuntimeCheckpoint: mocks.runtime.resumeRuntimeCheckpoint,
}));

vi.mock("@/lib/auth/capture-runtime-governance", () => ({
  canManageWorkspaceRuntime: mocks.governance.canManageWorkspaceRuntime,
  getRuntimeManagementDeniedMessage: mocks.governance.getRuntimeManagementDeniedMessage,
}));

vi.mock("@/lib/auth/tenant-ownership", () => ({
  assertWorkspaceRuntimeCheckpointOwnership:
    mocks.ownership.assertWorkspaceRuntimeCheckpointOwnership,
  isWorkspaceOwnershipError: mocks.ownership.isWorkspaceOwnershipError,
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

import { GET as getRuntimeSessionTraceRoute } from "@/app/api/helm-v2/runtime/sessions/[id]/trace/route";
import { POST as resumeRuntimeCheckpointRoute } from "@/app/api/helm-v2/runtime/checkpoints/[id]/resume/route";

describe("Helm v2 runtime route copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.requireCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.session.getCurrentWorkspace.mockResolvedValue({
      id: "workspace-1",
      defaultLocale: "zh-CN",
    });
    mocks.session.getCurrentWorkspaceSession.mockResolvedValue({
      membership: { role: "OWNER" },
      workspace: { id: "workspace-1", defaultLocale: "zh-CN" },
    });
    mocks.governance.canManageWorkspaceRuntime.mockReturnValue(true);
    mocks.governance.getRuntimeManagementDeniedMessage.mockReturnValue("denied");
    mocks.ownership.assertWorkspaceRuntimeCheckpointOwnership.mockResolvedValue(undefined);
    mocks.ownership.isWorkspaceOwnershipError.mockReturnValue(false);
  });

  it("localizes runtime trace missing-session fallback from workspace default locale", async () => {
    mocks.runtime.getRuntimeSessionTrace.mockResolvedValue(null);

    const response = await getRuntimeSessionTraceRoute(new Request("http://localhost"), {
      params: Promise.resolve({ id: "session-1" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "运行时 session 不存在",
    });
  });

  it("localizes checkpoint resume missing-checkpoint fallback from workspace default locale", async () => {
    mocks.db.sessionCheckpoint.findFirst.mockResolvedValue(null);

    const response = await resumeRuntimeCheckpointRoute(new Request("http://localhost"), {
      params: Promise.resolve({ id: "checkpoint-1" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "checkpoint 续传失败",
    });
    expect(mocks.runtime.resumeRuntimeCheckpoint).not.toHaveBeenCalled();
  });
});
