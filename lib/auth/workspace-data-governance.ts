import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { WORKSPACE_CAPABILITIES, workspaceRoleHasCapability } from "@/lib/auth/authorization";
import { db } from "@/lib/db";

export function canManageWorkspaceRecords(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_WORKSPACE_RECORDS);
}

export function canManageWorkspaceInternalActions(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_INTERNAL_ACTIONS);
}

export function getWorkspaceRecordManagementDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, or operator can change tenant-scoped workspace records."
    : "只有组织负责人、管理员或运营角色可以修改租户范围内的工作区记录。";
}

export function getWorkspaceInternalActionDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, or operator can approve or execute internal workspace actions."
    : "只有组织负责人、管理员或运营角色可以批准或执行工作区内部动作。";
}

export function getWorkspaceScopedRecordUnavailableMessage(english: boolean, label = "record") {
  return english
    ? `The selected ${label} is not available in the current workspace.`
    : "所选对象不属于当前工作区或已不可用。";
}

export function getWorkspaceAssignableOwnerDeniedMessage(english: boolean) {
  return english
    ? "The selected owner is not an active member of the current workspace."
    : "所选负责人不是当前工作区的有效成员。";
}

export async function resolveWorkspaceAssignableOwnerId(input: {
  workspaceId: string;
  requestedOwnerId?: string | null;
  fallbackUserId: string;
}) {
  if (!input.requestedOwnerId || input.requestedOwnerId === input.fallbackUserId) {
    return input.fallbackUserId;
  }

  const membership = await db.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId: input.requestedOwnerId,
      },
    },
    select: {
      status: true,
    },
  });

  if (!membership || membership.status === MembershipStatus.INACTIVE) {
    return null;
  }

  return input.requestedOwnerId;
}
