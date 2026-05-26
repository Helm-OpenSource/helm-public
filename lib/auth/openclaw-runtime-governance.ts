import { WorkspaceRole } from "@prisma/client";
import { WORKSPACE_CAPABILITIES, workspaceRoleHasCapability } from "@/lib/auth/authorization";

export function canManageOpenClawRuntime(role: WorkspaceRole | null | undefined) {
  return workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_RUNTIME);
}

export function getOpenClawRuntimeDeniedMessage(english: boolean) {
  return english
    ? "Only owner, admin, or operator can manage OpenClaw host-local sync runtime."
    : "只有组织负责人、管理员或运营角色可以管理 OpenClaw 宿主机本地同步运行时。";
}
