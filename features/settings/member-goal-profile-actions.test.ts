import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  getCurrentWorkspace: vi.fn(),
  getCurrentMembership: vi.fn(),
  canManageWorkspaceMembers: vi.fn(),
  getMembershipManagementDeniedMessage: vi.fn(),
  findFirstMembershipWithExistingUser: vi.fn(),
  updateMembership: vi.fn(),
  writeAuditLog: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    requireCurrentUser: mocks.requireCurrentUser,
    getCurrentWorkspace: mocks.getCurrentWorkspace,
    getCurrentMembership: mocks.getCurrentMembership,
  };
});

vi.mock("@/lib/auth/settings-governance", () => ({
  canManageWorkspaceMembers: mocks.canManageWorkspaceMembers,
  canManageWorkspaceOperationalControls: vi.fn(),
  canManageWorkspacePolicies: vi.fn(),
  canManageWorkspaceSetup: vi.fn(),
  getMembershipManagementDeniedMessage: mocks.getMembershipManagementDeniedMessage,
  getWorkspaceGovernanceDeniedMessage: vi.fn(),
}));

vi.mock("@/lib/auth/membership-with-user", () => ({
  findFirstMembershipWithExistingUser: mocks.findFirstMembershipWithExistingUser,
}));

vi.mock("@/lib/db", () => ({
  db: {
    membership: {
      update: mocks.updateMembership,
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

import { updateOrganizationMemberGoalProfileAction } from "@/features/settings/actions";

describe("updateOrganizationMemberGoalProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUser.mockResolvedValue({ id: "user_1", name: "Admin" });
    mocks.getCurrentWorkspace.mockResolvedValue({ id: "ws_1", defaultLocale: "zh-CN" });
    mocks.getCurrentMembership.mockResolvedValue({ id: "m-admin", role: "OWNER", userId: "user_1" });
    mocks.canManageWorkspaceMembers.mockReturnValue(true);
    mocks.getMembershipManagementDeniedMessage.mockReturnValue("denied");
    mocks.findFirstMembershipWithExistingUser.mockResolvedValue({
      id: "m-target",
      workspaceId: "ws_1",
      user: {
        id: "user_2",
        email: "member@example.com",
      },
    });
    mocks.updateMembership.mockResolvedValue({
      id: "m-target",
      goalTitle: "目标A",
      goalDescription: "描述A",
      goalItemsJson: JSON.stringify(["条目1"]),
      jobResponsibilities: "职责A",
    });
    mocks.writeAuditLog.mockResolvedValue(undefined);
  });

  it("rejects caller without member management permission", async () => {
    mocks.canManageWorkspaceMembers.mockReturnValue(false);

    const result = await updateOrganizationMemberGoalProfileAction({
      membershipId: "m-target",
      goalTitle: "目标A",
      goalDescription: "描述A",
      goalItems: ["条目1"],
      jobResponsibilities: "职责A",
    });

    expect(result).toEqual({ ok: false, error: "denied" });
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });

  it("rejects membership outside current workspace", async () => {
    mocks.findFirstMembershipWithExistingUser.mockResolvedValue(null);

    const result = await updateOrganizationMemberGoalProfileAction({
      membershipId: "m-target",
      goalTitle: "目标A",
      goalDescription: "描述A",
      goalItems: ["条目1"],
      jobResponsibilities: "职责A",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("没有找到该团队成员");
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });

  it("saves goal profile and supports clearing all fields", async () => {
    const result = await updateOrganizationMemberGoalProfileAction({
      membershipId: "m-target",
      goalTitle: "目标A",
      goalDescription: "描述A",
      goalItems: ["条目1", "条目2"],
      jobResponsibilities: "职责A",
    });

    expect(result.ok).toBe(true);
    expect(mocks.updateMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m-target" },
        data: expect.objectContaining({
          goalTitle: "目标A",
          goalDescription: "描述A",
          goalItemsJson: JSON.stringify(["条目1", "条目2"]),
          jobResponsibilities: "职责A",
        }),
      }),
    );

    await updateOrganizationMemberGoalProfileAction({
      membershipId: "m-target",
      goalTitle: "",
      goalDescription: "",
      goalItems: [],
      jobResponsibilities: "",
    });

    expect(mocks.updateMembership).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          goalTitle: null,
          goalDescription: null,
          goalItemsJson: null,
          jobResponsibilities: null,
        }),
      }),
    );
    expect(mocks.writeAuditLog).toHaveBeenCalled();
  });

  it("rejects invalid goal items payload", async () => {
    const result = await updateOrganizationMemberGoalProfileAction({
      membershipId: "m-target",
      goalTitle: "目标A",
      goalDescription: "描述A",
      goalItems: [""],
      jobResponsibilities: "职责A",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("参数错误");
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });
});
