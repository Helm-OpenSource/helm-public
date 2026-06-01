import { WorkspaceRole } from "@prisma/client";
import { WORKSPACE_CAPABILITIES, workspaceRoleHasCapability } from "@/lib/auth/authorization";

export function canManageWorkspaceCaptureSessions(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_CAPTURE_SESSIONS);
}

export function canManageWorkspaceRuntime(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_RUNTIME);
}

export function canReviewWorkspaceRuntime(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.REVIEW_RUNTIME);
}

export function getCaptureManagementDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, or operator can start, ingest, or process tenant-scoped capture sessions."
    : "只有组织负责人、管理员或运营角色可以启动、导入或处理租户范围内的记录会话。";
}

export function getRuntimeManagementDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, or operator can run tenant-scoped runtime mutations."
    : "只有组织负责人、管理员或运营角色可以运行租户范围内的运行变更。";
}

export function getRuntimeReviewDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, operator, or reviewer can review tenant-scoped runtime outputs."
    : "只有组织负责人、管理员、运营角色或复核人可以复核租户范围内的运行输出。";
}
