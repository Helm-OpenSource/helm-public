import "server-only";

import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { resolveMemberBasePresetKey } from "@/lib/definitions/workspace-role-preset-catalog";
import { resolveWorkspaceSurfaceBinding } from "@/lib/shell/surface-binding-store";
import {
  SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
  resolveShellRoleHomeRouting,
  resolveShellWorkstations,
} from "@/lib/shell/resolve-shell-experience";
import { resolveRoleHomeDestination } from "@/lib/shell/role-home-routing";

const DEFAULT_LANDING = "/dashboard";

/**
 * 工作区着陆路径(角色感知)—— role-home-routing surface 的读侧消费者(蓝图 §4.2 Phase 3）。
 *
 * 按注册的 role-home-routing 目的地为当前成员选落点:
 *  - workstation 目的地 → 该工位 href（overlay 贡献的站内原生页;工位 key 与 href 均由 provider 提供）。
 *  - control_tower / generic / 无绑定 / 任何异常 → `/dashboard`（Core 默认，逐字节零回归）。
 *
 * 单一生效 + 绑定授权（§4.3）:仅当某租户显式绑定 role-home-routing→provider 且解析出 workstation
 * 目的地时才非默认;**Core 默认路由无 workstation 目的地**，故未绑定的租户恒 `/dashboard`。
 * 本模块租户无关:不硬编码任何租户/工位,一切经注册表 + 绑定解析。fail-safe:任一步抛错 → `/dashboard`。
 */
export async function resolveWorkspaceLandingPath(): Promise<string> {
  try {
    const { workspace, user } = await getCurrentWorkspaceSession();
    const membership = await db.membership.findFirst({
      where: { workspaceId: workspace.id, userId: user.id },
      select: { rolePresetKey: true, role: true },
    });
    if (!membership) return DEFAULT_LANDING;

    const presetKey = resolveMemberBasePresetKey({
      rolePresetKey: membership.rolePresetKey,
      workspaceRole: membership.role,
      rawConfiguration: workspace.configuration,
    });

    const binding = await resolveWorkspaceSurfaceBinding(
      workspace.id,
      SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
    );
    const { table } = await resolveShellRoleHomeRouting({
      workspace,
      english: false,
      binding,
    });
    const destination = resolveRoleHomeDestination(table, presetKey);

    if (destination.kind === "workstation") {
      const { workstations } = await resolveShellWorkstations({ workspace, english: false });
      const target = workstations.find((w) => w.key === destination.workstationKey);
      if (target?.href) return target.href;
    }
    return DEFAULT_LANDING;
  } catch {
    return DEFAULT_LANDING;
  }
}
