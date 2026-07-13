/**
 * 角色家路由（role-home routing）内部契约 —— 蓝图 §4.2 / Phase 3。
 *
 * 单一生效 surface（同 mainline）：roleCategory → control_tower | workstationKey；
 * **fallback 必填且指向 GENERIC 面**（§4.1 fail-safe 向最低信息面）。
 *
 * 与 Phase 1 的 resolveRoleLens 关系：roleHomeRouting 决定"这个角色的家落在
 * 控制塔还是某工位"；若落控制塔，再由 resolveRoleLens 选 lens 渲染。二者互补，
 * 本 surface **不改** role-home.ts 既有消费（纯新增契约层，待未来消费者接入）。
 *
 * 铁律（§4.1 复用）：只读/只导航语义；无动作回调字段；workstation 目的地只登记
 * workstationKey（工位页面本体不进契约，§4.1.5）；destination 只有三类，禁造第四类。
 */

import { ROLE_PRESET_KEYS } from "@/lib/definitions/role-presets";

import { resolveRoleLens } from "./role-home";

/**
 * 家目的地：控制塔 / 最低信息面 / 具体工位（只给 key，页面本体不进契约）。
 * 无第四类；急停/改进循环等能力**不进公开契约**（§4.1.3-4，留 Overlay 级）。
 */
export type RoleHomeDestination =
  | { kind: "control_tower" }
  | { kind: "generic" }
  | { kind: "workstation"; workstationKey: string };

export type RoleHomeRoute = {
  roleCategory: string;
  destination: RoleHomeDestination;
};

export type RoleHomeRoutingTable = {
  routes: ReadonlyArray<RoleHomeRoute>;
  /** 未命中路由的兜底；**必须为 { kind: "generic" }**（fail-safe 向 GENERIC 面）。 */
  fallback: RoleHomeDestination;
};

const DESTINATION_KINDS: ReadonlySet<string> = new Set([
  "control_tower",
  "generic",
  "workstation",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateDestination(
  destination: RoleHomeDestination,
  where: string,
  issues: RoleHomeRoutingConformanceIssue[],
  roleCategory: string | null,
): void {
  if (typeof destination !== "object" || destination === null) {
    issues.push({ roleCategory, issue: `${where}_not_object` });
    return;
  }
  if (!DESTINATION_KINDS.has(destination.kind as string)) {
    issues.push({ roleCategory, issue: `${where}_unknown_kind` });
    return;
  }
  if (destination.kind === "workstation" && !isNonEmptyString(destination.workstationKey)) {
    issues.push({ roleCategory, issue: `${where}_empty_workstation_key` });
  }
}

export type RoleHomeRoutingConformanceIssue = {
  roleCategory: string | null;
  issue: string;
};

/**
 * Conformance 校验（返回全部违规项；空数组 = 通过）。
 * 不通过整表丢弃回 Core default（fail-safe，见 resolveShellRoleHomeRouting）。
 */
export function validateRoleHomeRoutingTable(
  table: RoleHomeRoutingTable,
): RoleHomeRoutingConformanceIssue[] {
  const issues: RoleHomeRoutingConformanceIssue[] = [];
  // fallback 必填且必须指向 GENERIC 面(fail-safe 方向性,§4.1)。
  if (typeof table.fallback !== "object" || table.fallback === null) {
    issues.push({ roleCategory: null, issue: "fallback_missing" });
  } else if (table.fallback.kind !== "generic") {
    issues.push({ roleCategory: null, issue: "fallback_not_generic" });
  }
  const seen = new Set<string>();
  for (const route of table.routes) {
    const roleCategory = isNonEmptyString(route.roleCategory) ? route.roleCategory : null;
    if (!isNonEmptyString(route.roleCategory)) {
      issues.push({ roleCategory, issue: "empty_role_category" });
    } else {
      if (seen.has(route.roleCategory)) {
        issues.push({ roleCategory, issue: "duplicate_role_category" });
      }
      seen.add(route.roleCategory);
    }
    validateDestination(route.destination, "destination", issues, roleCategory);
  }
  return issues;
}

/**
 * 在路由表里解析某 roleCategory 的家目的地；未命中 → fallback（GENERIC）。
 * 纯查表,确定性,无副作用。
 */
export function resolveRoleHomeDestination(
  table: RoleHomeRoutingTable,
  roleCategory: string | null | undefined,
): RoleHomeDestination {
  if (isNonEmptyString(roleCategory)) {
    const route = table.routes.find((r) => r.roleCategory === roleCategory);
    if (route) return route.destination;
  }
  return table.fallback;
}

/**
 * Core 默认路由：由 Phase 1 的 resolveRoleLens 逐 preset 派生——非 generic lens
 * 的角色家 = 控制塔（desk lens 在控制塔内以对应 lens 渲染）；generic lens → GENERIC 面。
 * Core 本体无工位 → 无 workstation 目的地（工位由 Overlay provider 贡献）。fallback = generic。
 */
export function buildCoreDefaultRoleHomeRouting(): RoleHomeRoutingTable {
  const routes: RoleHomeRoute[] = ROLE_PRESET_KEYS.map((key) => {
    const lens = resolveRoleLens(key);
    const destination: RoleHomeDestination =
      lens === "generic" ? { kind: "generic" } : { kind: "control_tower" };
    return { roleCategory: key, destination };
  });
  return { routes, fallback: { kind: "generic" } };
}
