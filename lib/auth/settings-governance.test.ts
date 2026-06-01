import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@prisma/client";
import {
  canExportWorkspaceAdminSupportPack,
  canManageWorkspaceMembers,
  canManageWorkspaceOperationalControls,
  canManageWorkspacePolicies,
  canManageWorkspaceSetup,
  canReadWorkspaceAdminAudit,
  getAdminSupportPackExportDeniedMessage,
  getMembershipManagementDeniedMessage,
  getWorkspaceGovernanceDeniedMessage,
} from "@/lib/auth/settings-governance";

describe("settings governance auth seam", () => {
  it("keeps member management on owner, billing admin and admin roles", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.BILLING_ADMIN, WorkspaceRole.ADMIN]) {
      expect(canManageWorkspaceMembers(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.OPERATOR, WorkspaceRole.REVIEWER, WorkspaceRole.MEMBER]) {
      expect(canManageWorkspaceMembers(role)).toBe(false);
    }
  });

  it("keeps workspace governance controls on owner and admin roles", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]) {
      expect(canManageWorkspacePolicies(role)).toBe(true);
      expect(canManageWorkspaceSetup(role)).toBe(true);
      expect(canManageWorkspaceOperationalControls(role)).toBe(true);
    }

    for (const role of [
      WorkspaceRole.BILLING_ADMIN,
      WorkspaceRole.OPERATOR,
      WorkspaceRole.REVIEWER,
      WorkspaceRole.MEMBER,
    ]) {
      expect(canManageWorkspacePolicies(role)).toBe(false);
      expect(canManageWorkspaceSetup(role)).toBe(false);
      expect(canManageWorkspaceOperationalControls(role)).toBe(false);
    }
  });

  it("keeps org-admin audit read/export on admin-class roles", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.BILLING_ADMIN, WorkspaceRole.ADMIN]) {
      expect(canReadWorkspaceAdminAudit(role)).toBe(true);
      expect(canExportWorkspaceAdminSupportPack(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.OPERATOR, WorkspaceRole.REVIEWER, WorkspaceRole.MEMBER]) {
      expect(canReadWorkspaceAdminAudit(role)).toBe(false);
      expect(canExportWorkspaceAdminSupportPack(role)).toBe(false);
    }
  });

  it("returns localized deny messages", () => {
    expect(getMembershipManagementDeniedMessage(true)).toContain("Only owner");
    expect(getMembershipManagementDeniedMessage(false)).toContain("只有组织负责人");
    expect(getWorkspaceGovernanceDeniedMessage(true)).toContain("Only owner");
    expect(getWorkspaceGovernanceDeniedMessage(false)).toContain("只有组织负责人");
    expect(getAdminSupportPackExportDeniedMessage(true)).toContain("support pack");
    expect(getAdminSupportPackExportDeniedMessage(false)).toContain("支持包");
  });
});
