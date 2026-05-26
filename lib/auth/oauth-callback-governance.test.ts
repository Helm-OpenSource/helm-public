import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceRole } from "@prisma/client";

const { importGovernanceMock } = vi.hoisted(() => ({
  importGovernanceMock: {
    canManageWorkspaceConnectors: vi.fn(),
    canManageWorkspaceImports: vi.fn(),
    getConnectorManagementDeniedMessage: vi.fn(),
    getImportManagementDeniedMessage: vi.fn(),
    getWorkspaceRoleForUser: vi.fn(),
  },
}));

vi.mock("@/lib/auth/import-governance", () => ({
  canManageWorkspaceConnectors: importGovernanceMock.canManageWorkspaceConnectors,
  canManageWorkspaceImports: importGovernanceMock.canManageWorkspaceImports,
  getConnectorManagementDeniedMessage:
    importGovernanceMock.getConnectorManagementDeniedMessage,
  getImportManagementDeniedMessage:
    importGovernanceMock.getImportManagementDeniedMessage,
  getWorkspaceRoleForUser: importGovernanceMock.getWorkspaceRoleForUser,
}));

import { resolveWorkspaceOauthCallbackContext } from "@/lib/auth/oauth-callback-governance";

describe("oauth callback governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importGovernanceMock.getConnectorManagementDeniedMessage.mockReturnValue("connector denied");
    importGovernanceMock.getImportManagementDeniedMessage.mockReturnValue("import denied");
    importGovernanceMock.canManageWorkspaceConnectors.mockReturnValue(false);
    importGovernanceMock.canManageWorkspaceImports.mockReturnValue(false);
    importGovernanceMock.getWorkspaceRoleForUser.mockResolvedValue(null);
  });

  it("returns missing-state when callback state is absent", async () => {
    await expect(
      resolveWorkspaceOauthCallbackContext({
        rawState: null,
        stateParam: "state-1",
        currentUser: { id: "user-1", name: "Owner" },
        capability: "connectors",
        english: true,
      }),
    ).resolves.toEqual({
      ok: false,
      status: "missing-state",
    });
  });

  it("returns invalid-state when callback state cannot be trusted", async () => {
    await expect(
      resolveWorkspaceOauthCallbackContext({
        rawState: JSON.stringify({
          state: "state-1",
          userId: "user-2",
          workspaceId: "workspace-1",
        }),
        stateParam: "state-1",
        currentUser: { id: "user-1", name: "Owner" },
        capability: "imports",
        english: true,
      }),
    ).resolves.toEqual({
      ok: false,
      status: "invalid-state",
    });
  });

  it("returns forbidden when the user lacks workspace capability for the callback", async () => {
    importGovernanceMock.getWorkspaceRoleForUser.mockResolvedValue(WorkspaceRole.MEMBER);
    importGovernanceMock.canManageWorkspaceImports.mockReturnValue(false);

    await expect(
      resolveWorkspaceOauthCallbackContext({
        rawState: JSON.stringify({
          state: "state-1",
          userId: "user-1",
          workspaceId: "workspace-1",
        }),
        stateParam: "state-1",
        currentUser: { id: "user-1", name: "Owner" },
        capability: "imports",
        english: true,
      }),
    ).resolves.toEqual({
      ok: false,
      status: "forbidden",
      message: "import denied",
    });
  });

  it("returns normalized workspace callback context once capability and tenant ownership are confirmed", async () => {
    importGovernanceMock.getWorkspaceRoleForUser.mockResolvedValue(WorkspaceRole.ADMIN);
    importGovernanceMock.canManageWorkspaceConnectors.mockReturnValue(true);

    await expect(
      resolveWorkspaceOauthCallbackContext({
        rawState: JSON.stringify({
          state: "state-1",
          userId: "user-1",
          workspaceId: "workspace-1",
          provider: "gmail",
        }),
        stateParam: "state-1",
        currentUser: { id: "user-1", name: "Owner" },
        capability: "connectors",
        english: true,
      }),
    ).resolves.toEqual({
      ok: true,
      workspaceId: "workspace-1",
      userId: "user-1",
      role: WorkspaceRole.ADMIN,
      user: {
        id: "user-1",
        name: "Owner",
      },
    });
  });
});
