/**
 * 角色家路由 + 工位登记（roleHomeRouting / workstations）只读展示的**纯双语文案**。
 *
 * 这是 IA 路由的**可见性面**(只读):哪些角色的家落哪里、存在哪些工位。**不授权、不改路由**——
 * 导航不授权,目标页自行鉴权(§1.4)。fallback 恒为 generic(fail-safe)。
 */

import type { RoleHomeDestination } from "@/lib/shell/role-home-routing";

type Bi = { zh: string; en: string };

export function t(copy: Bi, english: boolean): string {
  return english ? copy.en : copy.zh;
}

const DEST_KIND_COPY = {
  control_tower: { zh: "控制塔", en: "Control tower" } satisfies Bi,
  generic: { zh: "通用面(最低信息面)", en: "Generic (minimal)" } satisfies Bi,
};

export function destinationLabel(dest: RoleHomeDestination, english: boolean): string {
  if (dest.kind === "workstation") {
    return english ? `Workstation: ${dest.workstationKey}` : `工位: ${dest.workstationKey}`;
  }
  return t(DEST_KIND_COPY[dest.kind], english);
}

export const ROUTING_SECTION_COPY = {
  title: { zh: "工位与角色路由", en: "Workstations & role routing" } satisfies Bi,
  subtitle: {
    zh: "只读 IA 视图:哪些角色的家落哪里、存在哪些工位、导航怎么显示。单一生效路由无绑定即 Core 默认。",
    en: "Read-only IA view: whose home lands where, which workstations exist, how navigation shows. The single-winner routing is Core-default without a binding.",
  } satisfies Bi,
  boundary: {
    zh: "只读可见性,不授权、不改路由;导航不授权,目标页自行鉴权;fallback 恒为通用面(fail-safe)。",
    en: "Read-only visibility — no authorization, no routing changes; navigation does not authorize; the fallback is always generic (fail-safe).",
  } satisfies Bi,
  routingTitle: { zh: "角色家路由", en: "Role-home routing" } satisfies Bi,
  workstationTitle: { zh: "工位登记", en: "Workstation registry" } satisfies Bi,
  fallbackLabel: { zh: "兜底(未命中)", en: "Fallback (unmatched)" } satisfies Bi,
  rolesLabel: { zh: "适用角色", en: "Roles" } satisfies Bi,
  workstationEmpty: { zh: "无登记工位(Core 无内置工位;由 Overlay provider 贡献)。", en: "No registered workstations (Core has none; provided by overlays)." } satisfies Bi,
};
