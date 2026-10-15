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

const SETTINGS_ADMINISTRATION_CAPABILITIES = [
  WORKSPACE_CAPABILITIES.MANAGE_MEMBERS,
  WORKSPACE_CAPABILITIES.MANAGE_BILLING,
  WORKSPACE_CAPABILITIES.MANAGE_POLICIES,
  WORKSPACE_CAPABILITIES.MANAGE_WORKSPACE_SETUP,
  WORKSPACE_CAPABILITIES.MANAGE_OPERATIONAL_CONTROLS,
  WORKSPACE_CAPABILITIES.MANAGE_CONNECTORS,
  WORKSPACE_CAPABILITIES.MANAGE_IMPORTS,
  WORKSPACE_CAPABILITIES.READ_ADMIN_AUDIT,
] as const;

/**
 * Whether the viewer administers any part of /settings (owner, billing admin,
 * admin, operator). Everyone else — members and reviewers — gets the light
 * settings view: organisation facts, their own identity, notifications,
 * organisation switching and the team list, without the workspace-wide
 * connector, billing, policy and readiness loads or the live LLM probe.
 *
 * 是否管理 /settings 的任一部分。其余角色（成员、复核人）只看组织信息、本人身份、
 * 通知、组织切换和团队名单，不触发全工作区的连接器、计费、规则、就绪度加载和
 * 模型实时探测。
 */
export function canAdministerWorkspaceSettings(role: WorkspaceRole | null | undefined) {
  return SETTINGS_ADMINISTRATION_CAPABILITIES.some((capability) =>
    workspaceRoleHasCapability(role, capability),
  );
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
