import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { WORKSPACE_CAPABILITIES, workspaceRoleHasCapability } from "@/lib/auth/authorization";
import { db } from "@/lib/db";

export function canManageWorkspaceConnectors(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_CONNECTORS);
}

export function canManageWorkspaceImports(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_IMPORTS);
}

export function canResolveWorkspaceImportConflicts(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.RESOLVE_IMPORT_CONFLICTS);
}

export function getConnectorManagementDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, or operator can manage workspace connectors."
    : "只有组织负责人、管理员或运营角色可以管理工作区连接器。";
}

export function getImportManagementDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, or operator can run workspace imports."
    : "只有组织负责人、管理员或运营角色可以执行工作区导入。";
}

export function getImportConflictResolutionDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, operator, or reviewer can resolve import conflicts."
    : "只有组织负责人、管理员、运营角色或复核人可以处理导入冲突。";
}

export async function getWorkspaceRoleForUser(args: {
  workspaceId: string;
  userId: string;
}) {
  const membership = await db.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: args.workspaceId,
        userId: args.userId,
      },
    },
    select: {
      role: true,
      status: true,
    },
  });

  if (!membership || membership.status === MembershipStatus.INACTIVE) {
    return null;
  }

  return membership.role;
}
