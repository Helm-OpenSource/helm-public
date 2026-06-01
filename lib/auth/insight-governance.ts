import { WorkspaceRole } from "@prisma/client";
import { WORKSPACE_CAPABILITIES, workspaceRoleHasCapability } from "@/lib/auth/authorization";

export function canManageWorkspaceInsights(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_INSIGHTS);
}

export function getInsightGovernanceDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, or operator can generate tenant-scoped reports or record recommendation feedback."
    : "只有组织负责人、管理员或运营角色可以生成工作区周报，或记录判断建议反馈。";
}
