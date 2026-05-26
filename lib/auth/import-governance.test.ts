import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipStatus, WorkspaceRole } from "@prisma/client";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    membership: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  canManageWorkspaceConnectors,
  canManageWorkspaceImports,
  canResolveWorkspaceImportConflicts,
  getConnectorManagementDeniedMessage,
  getImportConflictResolutionDeniedMessage,
  getImportManagementDeniedMessage,
  getWorkspaceRoleForUser,
} from "@/lib/auth/import-governance";

describe("import governance auth seam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps connector and import management on owner/admin/operator roles", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]) {
      expect(canManageWorkspaceConnectors(role)).toBe(true);
      expect(canManageWorkspaceImports(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.REVIEWER, WorkspaceRole.MEMBER]) {
      expect(canManageWorkspaceConnectors(role)).toBe(false);
      expect(canManageWorkspaceImports(role)).toBe(false);
    }
  });

  it("keeps conflict resolution on admin and review roles only", () => {
    for (const role of [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OPERATOR,
      WorkspaceRole.REVIEWER,
    ]) {
      expect(canResolveWorkspaceImportConflicts(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.MEMBER]) {
      expect(canResolveWorkspaceImportConflicts(role)).toBe(false);
    }
  });

  it("returns null for inactive or missing memberships", async () => {
    dbMock.membership.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      role: WorkspaceRole.ADMIN,
      status: MembershipStatus.INACTIVE,
    });

    await expect(
      getWorkspaceRoleForUser({ workspaceId: "workspace-1", userId: "user-1" }),
    ).resolves.toBeNull();
    await expect(
      getWorkspaceRoleForUser({ workspaceId: "workspace-1", userId: "user-1" }),
    ).resolves.toBeNull();
  });

  it("returns the active workspace role for a user", async () => {
    dbMock.membership.findUnique.mockResolvedValue({
      role: WorkspaceRole.OPERATOR,
      status: MembershipStatus.ACTIVE,
    });

    await expect(
      getWorkspaceRoleForUser({ workspaceId: "workspace-1", userId: "user-1" }),
    ).resolves.toBe(WorkspaceRole.OPERATOR);
  });

  it("keeps denial copy narrow and capability-specific", () => {
    expect(getConnectorManagementDeniedMessage(true)).toContain("connectors");
    expect(getImportManagementDeniedMessage(true)).toContain("imports");
    expect(getImportConflictResolutionDeniedMessage(true)).toContain("import conflicts");
    expect(getImportManagementDeniedMessage(false)).toContain("组织负责人、管理员或运营角色");
    expect(getImportConflictResolutionDeniedMessage(false)).toContain("复核人");
  });
});
