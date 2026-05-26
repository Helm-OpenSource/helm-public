import { WorkspaceRole } from "@prisma/client";
import { WORKSPACE_CAPABILITIES, workspaceRoleHasCapability } from "@/lib/auth/authorization";

export function canManageWorkspaceMembers(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_MEMBERS);
}

export function canManageWorkspacePolicies(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_POLICIES);
}

export function canManageWorkspaceSetup(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_WORKSPACE_SETUP);
}

export function canManageWorkspaceOperationalControls(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_OPERATIONAL_CONTROLS);
}

export function canReadWorkspaceAdminAudit(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.READ_ADMIN_AUDIT);
}

export function canExportWorkspaceAdminSupportPack(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.EXPORT_ADMIN_SUPPORT_PACK);
}

export function getMembershipManagementDeniedMessage(english: boolean) {
  return english
    ? "Only owner, billing admin or admin can manage organization members"
    : "只有组织负责人、计费管理员或管理员可以管理组织成员";
}

export function getWorkspaceGovernanceDeniedMessage(english: boolean) {
  return english
    ? "Only owner or admin can change workspace governance controls"
    : "只有组织负责人或管理员可以修改工作区治理控制";
}

export function getAdminSupportPackExportDeniedMessage(english: boolean) {
  return english
    ? "Only owner, billing admin, or admin can export the org-admin support pack."
    : "只有组织负责人、计费管理员或管理员可以导出组织治理支持包。";
}
