import { WorkspaceRole } from "@prisma/client";
import { WORKSPACE_CAPABILITIES, workspaceRoleHasCapability } from "@/lib/auth/authorization";

export function canManageWorkspaceBilling(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_BILLING);
}

export function canReadContributionRegistry(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.READ_CONTRIBUTION_REGISTRY);
}

export function canManageContributionRegistry(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_CONTRIBUTION_REGISTRY);
}

export function canManageManualSettlement(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_MANUAL_SETTLEMENT);
}

export function canManageParticipantPortal(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_PARTICIPANT_PORTAL);
}

export function canManageProgramApplications(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_PROGRAM_APPLICATIONS);
}

export function getBillingManagementDeniedMessage(
  english: boolean,
  scope: "checkout" | "portal" | "refresh" | "billing" = "billing",
) {
  if (english) {
    if (scope === "checkout") {
      return "Only owner or billing admin can start organization checkout";
    }

    if (scope === "portal") {
      return "Only owner or billing admin can open the billing portal";
    }

    if (scope === "refresh") {
      return "Only owner or billing admin can refresh billing status";
    }

    return "Only owner or billing admin can manage organization billing";
  }

  if (scope === "checkout") {
    return "只有组织负责人或计费管理员可以发起组织订阅购买";
  }

  if (scope === "portal") {
    return "只有组织负责人或计费管理员可以打开订阅管理入口";
  }

  if (scope === "refresh") {
    return "只有组织负责人或计费管理员可以刷新订阅状态";
  }

  return "只有组织负责人或计费管理员可以管理组织订阅";
}

export function getContributionRegistryManagementDeniedMessage(english: boolean) {
  return english
    ? "Only owner, billing admin or admin can manage contributor registry records"
    : "只有组织负责人、计费管理员或管理员可以管理贡献方登记记录";
}

export function getManualSettlementManagementDeniedMessage(
  english: boolean,
  scope: "registry" | "settlement" = "settlement",
) {
  if (english) {
    return scope === "registry"
      ? "Only owner, billing admin or admin can manage settlement registry records"
      : "Only owner, billing admin or admin can manage manual settlement";
  }

  return scope === "registry"
    ? "只有组织负责人、计费管理员或管理员可以管理结算登记记录"
    : "只有组织负责人、计费管理员或管理员可以管理手工结算";
}

export function getParticipantPortalManagementDeniedMessage(english: boolean) {
  return english
    ? "Only owner, billing admin or admin can manage participant portal access"
    : "只有组织负责人、计费管理员或管理员可以管理贡献方门户访问";
}

export function getProgramApplicationManagementDeniedMessage(english: boolean) {
  return english
    ? "Only owner, billing admin, or admin can review applications or issue participant invites."
    : "只有组织负责人、计费管理员或管理员可以审核申请或发放参与邀请。";
}
