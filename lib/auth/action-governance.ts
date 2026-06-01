import { WorkspaceRole } from "@prisma/client";
import { WORKSPACE_CAPABILITIES, workspaceRoleHasCapability } from "@/lib/auth/authorization";

export function canManageWorkspaceGovernedActions(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_GOVERNED_ACTIONS);
}

export function canReviewWorkspaceGovernedActions(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS);
}

export function getGovernedActionManagementDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, or operator can create or update governed workspace actions."
    : "只有组织负责人、管理员或运营角色可以创建或更新受治理的工作区动作。";
}

export function getGovernedActionReviewDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, operator, or reviewer can review governed workspace actions."
    : "只有组织负责人、管理员、运营角色或复核人可以复核受治理的工作区动作。";
}
