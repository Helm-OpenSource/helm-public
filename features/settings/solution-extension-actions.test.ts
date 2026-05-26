import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  getCurrentWorkspace: vi.fn(),
  getCurrentMembership: vi.fn(),
  canManageWorkspaceSetup: vi.fn(),
  getWorkspaceGovernanceDeniedMessage: vi.fn(),
  findExtension: vi.fn(),
  upsertExtension: vi.fn(),
  writeAuditLog: vi.fn(),
  logEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: mocks.requireCurrentUser,
  getCurrentWorkspace: mocks.getCurrentWorkspace,
  getCurrentMembership: mocks.getCurrentMembership,
}));

vi.mock("@/lib/auth/settings-governance", () => ({
  canManageWorkspaceSetup: mocks.canManageWorkspaceSetup,
  getWorkspaceGovernanceDeniedMessage: mocks.getWorkspaceGovernanceDeniedMessage,
}));

vi.mock("@/lib/db", () => ({
  db: {
    workspaceSolutionExtension: {
      findUnique: mocks.findExtension,
      upsert: mocks.upsertExtension,
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: mocks.logEvent,
}));

import { setWorkspaceSolutionExtensionStatusAction } from "@/features/settings/solution-extension-actions";
import { SOLUTION_EXTENSION_CATALOG } from "@/lib/extensions/solution-extension-catalog";

const primaryExtensionKey = SOLUTION_EXTENSION_CATALOG[0]!.extensionKey;
const reportExtensionKey = SOLUTION_EXTENSION_CATALOG[1]!.extensionKey;

describe("setWorkspaceSolutionExtensionStatusAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUser.mockResolvedValue({ id: "user_1", name: "Admin" });
    mocks.getCurrentWorkspace.mockResolvedValue({
      id: "ws_1",
      defaultLocale: "zh-CN",
    });
    mocks.getCurrentMembership.mockResolvedValue({ role: "OWNER" });
    mocks.canManageWorkspaceSetup.mockReturnValue(true);
    mocks.getWorkspaceGovernanceDeniedMessage.mockReturnValue("denied");
    mocks.findExtension.mockResolvedValue(null);
    mocks.upsertExtension.mockResolvedValue({ id: "ext_1" });
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.logEvent.mockResolvedValue(undefined);
  });

  it("enables a known extension and writes ACTIVE status + audit log", async () => {
    const result = await setWorkspaceSolutionExtensionStatusAction({
      extensionKey: primaryExtensionKey,
      enabled: true,
    });

    expect(result).toEqual({
      ok: true,
      extensionKey: primaryExtensionKey,
      status: "ACTIVE",
    });
    expect(mocks.upsertExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "ACTIVE",
          disabledAt: null,
        }),
        create: expect.objectContaining({
          extensionKey: primaryExtensionKey,
          kind: "TENANT_CUSTOM",
          status: "ACTIVE",
        }),
      }),
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "WORKSPACE_SOLUTION_EXTENSION_TOGGLED",
        targetId: primaryExtensionKey,
        payload: expect.objectContaining({
          after: "ACTIVE",
          before: null,
        }),
      }),
    );
  });

  it("disables a known extension and stamps disabledAt on update path", async () => {
    mocks.findExtension.mockResolvedValue({ status: "ACTIVE" });

    const result = await setWorkspaceSolutionExtensionStatusAction({
      extensionKey: reportExtensionKey,
      enabled: false,
    });

    expect(result).toEqual({
      ok: true,
      extensionKey: reportExtensionKey,
      status: "DISABLED",
    });
    const upsertCall = mocks.upsertExtension.mock.calls[0][0];
    expect(upsertCall.update.status).toBe("DISABLED");
    expect(upsertCall.update.disabledAt).toBeInstanceOf(Date);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ before: "ACTIVE", after: "DISABLED" }),
      }),
    );
  });

  it("rejects extensions not in the catalog", async () => {
    const result = await setWorkspaceSolutionExtensionStatusAction({
      extensionKey: "unknown-extension",
      enabled: true,
    });

    expect(result.ok).toBe(false);
    expect(mocks.upsertExtension).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects callers without workspace setup permission", async () => {
    mocks.canManageWorkspaceSetup.mockReturnValue(false);

    const result = await setWorkspaceSolutionExtensionStatusAction({
      extensionKey: primaryExtensionKey,
      enabled: true,
    });

    expect(result).toEqual({ ok: false, error: "denied" });
    expect(mocks.upsertExtension).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects empty extensionKey via schema", async () => {
    const result = await setWorkspaceSolutionExtensionStatusAction({
      extensionKey: "",
      enabled: true,
    });

    expect(result.ok).toBe(false);
    expect(mocks.upsertExtension).not.toHaveBeenCalled();
  });
});
