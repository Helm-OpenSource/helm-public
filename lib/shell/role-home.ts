/**
 * 角色 lens 解析 + 目的地目录（蓝图 §1.4 / 附录 B 的 Phase 1 内部化）。
 *
 * 授权先行：目录只决定"默认落地与主区内容"，不授予任何页面权限（权限由
 * WorkspaceRole + capability 决定，导航永远不授权）。
 * 解析失败/不可识别 → 独立 GENERIC 面（fail-safe 向低信息面，不用
 * catalog 首项回退）。角色分流是 /dashboard 内容层的视图选择，无 redirect。
 */

import type { RolePresetKey } from "@/lib/definitions/role-presets";

export type RoleLens =
  | "control_tower"
  | "advance_desk"
  | "delivery_desk"
  | "review_desk"
  | "generic";

const LENS_BY_PRESET: Record<RolePresetKey, RoleLens> = {
  FOUNDER_CEO: "control_tower",
  SALES_LEAD: "advance_desk",
  ACCOUNT_EXECUTIVE: "advance_desk",
  RECRUITER: "generic",
  CUSTOMER_SUCCESS: "delivery_desk",
  DELIVERY_LEAD: "delivery_desk",
  PRODUCT_ENGINEER: "generic",
  OPERATIONS_FINANCE: "review_desk",
  GENERAL_OPERATOR: "generic",
};

/**
 * baseKey 为已经过 custom preset → basePresetKey 归并的内置 key；
 * 传 null/未知值 → GENERIC（fail-safe）。
 */
export function resolveRoleLens(baseKey: string | null | undefined): RoleLens {
  if (!baseKey) return "generic";
  const lens = (LENS_BY_PRESET as Record<string, RoleLens | undefined>)[baseKey];
  return lens ?? "generic";
}

export type DestinationEntry = { href: string; labelZh: string; labelEn: string };

export type DestinationCatalog = {
  /** 主区（每日核心，≤4） */
  primary: ReadonlyArray<DestinationEntry>;
  /** 次区（周期使用） */
  secondary: ReadonlyArray<DestinationEntry>;
  /** 收纳（罕见与监督） */
  drawer: ReadonlyArray<DestinationEntry>;
};

const D = (href: string, labelZh: string, labelEn: string): DestinationEntry => ({
  href,
  labelZh,
  labelEn,
});

const DRAWER_COMMON: DestinationEntry[] = [
  D("/imports", "数据接入", "Imports"),
  D("/diagnostics", "诊断", "Diagnostics"),
  D("/settings", "设置", "Settings"),
];

const CATALOG: Record<RoleLens, DestinationCatalog> = {
  control_tower: {
    primary: [
      D("/dashboard?stay=1", "控制塔", "Control tower"),
      D("/approvals", "复核队列", "Review queue"),
      D("/opportunities", "推进工作台", "Advance desk"),
      D("/customer-success", "交付工作台", "Delivery desk"),
    ],
    secondary: [
      D("/reports", "周期复盘", "Periodic review"),
      D("/memory", "改进候选", "Improvement candidates"),
    ],
    drawer: DRAWER_COMMON,
  },
  advance_desk: {
    primary: [
      D("/opportunities", "我的机会队列", "My opportunity queue"),
      D("/meetings", "今日会议", "Today's meetings"),
      D("/inbox", "收件推进", "Inbox follow-through"),
      D("/approvals", "需拍板事项", "Calls that need you"),
    ],
    secondary: [D("/companies", "客户档案", "Company records")],
    drawer: DRAWER_COMMON,
  },
  delivery_desk: {
    primary: [
      D("/customer-success", "交付队列", "Delivery queue"),
      D("/approvals", "续费/扩展复核", "Renewal & expansion review"),
      D("/companies", "客户档案", "Company records"),
    ],
    secondary: [D("/reports", "周期复盘", "Periodic review")],
    drawer: DRAWER_COMMON,
  },
  review_desk: {
    primary: [
      D("/approvals", "复核队列", "Review queue"),
      D("/memory", "判断记录", "Judgement records"),
    ],
    secondary: [D("/reports", "周期复盘", "Periodic review")],
    drawer: DRAWER_COMMON,
  },
  generic: {
    primary: [
      D("/dashboard?stay=1", "工作台", "Workspace home"),
      D("/search", "搜索", "Search"),
      D("/approvals", "需拍板事项", "Calls that need you"),
    ],
    secondary: [],
    drawer: DRAWER_COMMON,
  },
};

export function getDestinationCatalog(lens: RoleLens): DestinationCatalog {
  return CATALOG[lens] ?? CATALOG.generic;
}
