import { WorkspaceRole } from "@prisma/client";
import { WORKSPACE_CAPABILITIES, workspaceRoleHasCapability } from "@/lib/auth/authorization";

export function canExportMemory(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.EXPORT_MEMORY);
}

export function canManageWorkspaceMemory(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_MEMORY_FACTS);
}

export function canManageMemoryFacts(role: WorkspaceRole | null | undefined) {
  return canManageWorkspaceMemory(role);
}

export function getMemoryExportDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, operator or reviewer can export workspace memory."
    : "只有组织负责人、管理员、运营角色或复核人可以导出工作区记忆。";
}

export function getMemoryManagementDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, operator or reviewer can manage workspace memory records."
    : "只有组织负责人、管理员、运营角色或复核人可以管理工作区记忆记录。";
}

export function getMemoryFactManagementDeniedMessage(english: boolean) {
  return getMemoryManagementDeniedMessage(english);
}
