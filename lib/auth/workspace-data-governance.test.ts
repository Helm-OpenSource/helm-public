import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@prisma/client";
import {
  canManageWorkspaceInternalActions,
  canManageWorkspaceRecords,
  getWorkspaceAssignableOwnerDeniedMessage,
  getWorkspaceInternalActionDeniedMessage,
  getWorkspaceRecordManagementDeniedMessage,
  getWorkspaceScopedRecordUnavailableMessage,
} from "@/lib/auth/workspace-data-governance";

describe("workspace data governance", () => {
  it("keeps workspace record governance on owner/admin/operator", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]) {
      expect(canManageWorkspaceRecords(role)).toBe(true);
      expect(canManageWorkspaceInternalActions(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.REVIEWER, WorkspaceRole.MEMBER]) {
      expect(canManageWorkspaceRecords(role)).toBe(false);
      expect(canManageWorkspaceInternalActions(role)).toBe(false);
    }
  });

  it("returns explicit deny wording", () => {
    expect(getWorkspaceRecordManagementDeniedMessage(true)).toContain("workspace records");
    expect(getWorkspaceRecordManagementDeniedMessage(false)).toContain("工作区记录");
    expect(getWorkspaceInternalActionDeniedMessage(true)).toContain("internal workspace actions");
    expect(getWorkspaceInternalActionDeniedMessage(false)).toContain("内部动作");
    expect(getWorkspaceScopedRecordUnavailableMessage(true, "thread")).toContain("thread");
    expect(getWorkspaceScopedRecordUnavailableMessage(false)).toContain("当前工作区");
    expect(getWorkspaceAssignableOwnerDeniedMessage(true)).toContain("active member");
    expect(getWorkspaceAssignableOwnerDeniedMessage(false)).toContain("有效成员");
  });
});
