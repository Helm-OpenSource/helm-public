import "server-only";

import { db } from "@/lib/db";

import {
  getRegisteredMainlineProviders,
  getRegisteredRoleHomeRoutingProviders,
} from "@/lib/extensions/registry-contract";
import type { SurfaceBinding } from "./provider-selection";
import {
  SHELL_MAINLINE_CONTRACT_VERSION,
  SHELL_MAINLINE_SURFACE_KEY,
  SHELL_ROLE_HOME_ROUTING_CONTRACT_VERSION,
  SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
} from "./resolve-shell-experience";

/**
 * 单一生效 shell surface 的绑定授权存取(蓝图 §4.3 绑定即授权)。
 *
 * 每 (workspace, surfaceKey) 至多一条绑定,持久化在 WorkspaceSurfaceBinding 表。
 * 读侧:resolveWorkspaceSurfaceBinding → 交给 selectSingleWinner;无绑定/失效/越权/
 * 版本不兼容在 resolve 时 fail-open 回 Core default(§4.3.4)。写侧授权由 capability
 * (MANAGE_WORKSPACE_SETUP)决定,见 surface-binding-actions.ts。
 *
 * 只有**单一生效** surface 需要绑定(mainline / role-home-routing);concat surface
 * (attention / northstar-kpi / workstation / operation-suggestion)聚合全部合格 source,
 * 不走绑定,故不在此登记。
 */

export const SINGLE_WINNER_SURFACE_KEYS = [
  SHELL_MAINLINE_SURFACE_KEY,
  SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
] as const;

export type SingleWinnerSurfaceKey =
  (typeof SINGLE_WINNER_SURFACE_KEYS)[number];

export function isSingleWinnerSurfaceKey(
  surfaceKey: string,
): surfaceKey is SingleWinnerSurfaceKey {
  return (SINGLE_WINNER_SURFACE_KEYS as ReadonlyArray<string>).includes(
    surfaceKey,
  );
}

/** 该 surface 的候选 provider 必须精确匹配的契约版本(§4.3.2)。 */
export function requiredContractVersionForSurface(
  surfaceKey: SingleWinnerSurfaceKey,
): string {
  return surfaceKey === SHELL_MAINLINE_SURFACE_KEY
    ? SHELL_MAINLINE_CONTRACT_VERSION
    : SHELL_ROLE_HOME_ROUTING_CONTRACT_VERSION;
}

export type BindableProviderDescriptor = {
  providerId: string;
  contractVersion: string;
  provenance: string;
};

/**
 * 该 surface 当前已注册的 provider 描述(供绑定写入面校验候选 + 诊断展示)。
 * 注意:这里只反映"已注册",access 合格性在 resolve 时按 workspace 主体重新评估——
 * 与 §4.3.2 一致(可绑定前提 enabled+access+compatibility 中的 access 属运行时)。
 */
export function listBindableProvidersForSurface(
  surfaceKey: SingleWinnerSurfaceKey,
): ReadonlyArray<BindableProviderDescriptor> {
  const providers =
    surfaceKey === SHELL_MAINLINE_SURFACE_KEY
      ? getRegisteredMainlineProviders()
      : getRegisteredRoleHomeRoutingProviders();
  return providers.map((p) => ({
    providerId: p.providerId,
    contractVersion: p.contractVersion,
    provenance: p.provenance,
  }));
}

/**
 * 读某 workspace 某 surface 的绑定;无 → null(读侧回 Core default)。
 * 返回 Core selectSingleWinner 期望的 SurfaceBinding 形状。
 */
export async function resolveWorkspaceSurfaceBinding(
  workspaceId: string,
  surfaceKey: string,
): Promise<SurfaceBinding | null> {
  if (!isSingleWinnerSurfaceKey(surfaceKey)) return null;
  const row = await db.workspaceSurfaceBinding.findUnique({
    where: {
      workspaceId_surfaceKey: { workspaceId, surfaceKey },
    },
    select: { surfaceKey: true, providerId: true },
  });
  if (!row) return null;
  return { surfaceKey: row.surfaceKey, providerId: row.providerId };
}
