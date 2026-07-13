import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  getCurrentWorkspace: vi.fn(),
  getCurrentMembership: vi.fn(),
  canManageWorkspaceSetup: vi.fn(),
  getWorkspaceGovernanceDeniedMessage: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  writeAuditLog: vi.fn(),
  logEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

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
    workspaceSurfaceBinding: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
    },
  },
}));

vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/analytics", () => ({ logEvent: mocks.logEvent }));

import {
  __resetPackRegistryForTest,
  registerPackContributions,
} from "@/lib/extensions/registry-contract";
import { setWorkspaceSurfaceBindingAction } from "@/features/settings/surface-binding-actions";
import {
  SHELL_MAINLINE_SURFACE_KEY,
  SHELL_ROLE_HOME_ROUTING_CONTRACT_VERSION,
  SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
} from "@/lib/shell/resolve-shell-experience";

function registerRoutingProvider(
  providerId: string,
  contractVersion = SHELL_ROLE_HOME_ROUTING_CONTRACT_VERSION,
) {
  registerPackContributions("pack-under-test", {
    roleHomeRoutingProviders: [
      {
        providerId,
        contractVersion,
        priority: 10,
        provenance: "pack:rhr",
        stability: "experimental",
        getAccess: async () => ({ ok: true }),
        buildRoleHomeRouting: async () => ({
          routes: [],
          fallback: { kind: "generic" },
        }),
      },
    ],
  });
}

describe("setWorkspaceSurfaceBindingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPackRegistryForTest();
    mocks.requireCurrentUser.mockResolvedValue({ id: "user_1", name: "Tester" });
    mocks.getCurrentWorkspace.mockResolvedValue({
      id: "ws_1",
      defaultLocale: "zh-CN",
    });
    mocks.getCurrentMembership.mockResolvedValue({ role: "OWNER" });
    mocks.canManageWorkspaceSetup.mockReturnValue(true);
    mocks.getWorkspaceGovernanceDeniedMessage.mockReturnValue("no permission");
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue({});
    mocks.deleteMany.mockResolvedValue({ count: 0 });
  });
  afterEach(() => __resetPackRegistryForTest());

  it("rejects a non-single-winner surface without writing", async () => {
    const result = await setWorkspaceSurfaceBindingAction({
      surfaceKey: "attention",
      providerId: "whatever",
    });
    expect(result.ok).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("denies when the actor lacks MANAGE_WORKSPACE_SETUP", async () => {
    mocks.canManageWorkspaceSetup.mockReturnValue(false);
    const result = await setWorkspaceSurfaceBindingAction({
      surfaceKey: SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
      providerId: "prov-rhr",
    });
    expect(result).toEqual({ ok: false, error: "no permission" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects binding to an unregistered provider", async () => {
    // registry empty → provider not registered
    const result = await setWorkspaceSurfaceBindingAction({
      surfaceKey: SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
      providerId: "ghost",
    });
    expect(result.ok).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects binding to a contract-incompatible provider", async () => {
    registerRoutingProvider("prov-rhr", "role-home-routing.v0-legacy");
    const result = await setWorkspaceSurfaceBindingAction({
      surfaceKey: SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
      providerId: "prov-rhr",
    });
    expect(result.ok).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("binds a registered, compatible provider and writes audit", async () => {
    registerRoutingProvider("prov-rhr");
    const result = await setWorkspaceSurfaceBindingAction({
      surfaceKey: SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
      providerId: "prov-rhr",
    });
    expect(result).toEqual({
      ok: true,
      surfaceKey: SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
      providerId: "prov-rhr",
    });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          workspaceId: "ws_1",
          surfaceKey: SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
          providerId: "prov-rhr",
        },
      }),
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "WORKSPACE_SURFACE_BINDING_SET",
        targetId: SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
      }),
    );
    expect(mocks.logEvent).toHaveBeenCalledTimes(1);
  });

  it("clears the binding (Core default) when providerId is null", async () => {
    const result = await setWorkspaceSurfaceBindingAction({
      surfaceKey: SHELL_MAINLINE_SURFACE_KEY,
      providerId: null,
    });
    expect(result).toEqual({
      ok: true,
      surfaceKey: SHELL_MAINLINE_SURFACE_KEY,
      providerId: null,
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws_1", surfaceKey: SHELL_MAINLINE_SURFACE_KEY },
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(1);
  });
});
