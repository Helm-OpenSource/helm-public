/**
 * 角色 lens 解析 + 逐 preset 目的地目录（蓝图 §1.4 / 附录 B 的 Phase 1 内部化）。
 *
 * 授权先行：目录只决定"默认落地与主区内容"，不授予任何页面权限（权限由
 * WorkspaceRole + capability 决定，导航永远不授权）。
 * 解析失败/不可识别 → 独立 GENERIC 面（fail-safe 向最低信息面，不用
 * catalog 首项回退）。角色分流是 /dashboard 内容层的视图选择，无 redirect。
 *
 * 目录按**内置 preset 逐角色**定义（附录 B 逐行），不做粗粒度合并；
 * custom preset 由调用方先经 basePresetKey 归并。
 */

import type { RolePresetKey } from "@/lib/definitions/role-presets";

/** home 视图形态：管理=完整控制塔；一线=工位家；generic=最低信息面。 */
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
  /** 收纳（罕见与监督）——sidebar 端与既有设置区去重后渲染 */
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

/**
 * 附录 B 逐角色目录。href 映射到现存 canonical 路由：
 * - "我的承诺/跟进" → /capture（"我的今日跟进"判断卡所在页，见 STATUS）
 * - "成功检查" 无独立列表路由 → 由交付队列（/customer-success）承载
 * - "销售域过滤"等查询级过滤是 Phase 2+ 的工作台内能力，不在导航层伪造
 */
const CATALOG_BY_PRESET: Record<RolePresetKey, DestinationCatalog> = {
  FOUNDER_CEO: {
    primary: [
      D("/dashboard", "控制塔", "Control tower"),
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
  SALES_LEAD: {
    primary: [
      D("/opportunities", "机会队列", "Opportunity queue"),
      D("/approvals", "需拍板事项", "Calls that need you"),
      D("/meetings", "会议", "Meetings"),
      D("/reports", "复盘深链", "Review deep links"),
    ],
    secondary: [D("/companies", "客户档案", "Company records")],
    drawer: DRAWER_COMMON,
  },
  ACCOUNT_EXECUTIVE: {
    primary: [
      D("/opportunities", "我的机会队列", "My opportunity queue"),
      D("/meetings", "今日会议", "Today's meetings"),
      D("/inbox", "收件推进", "Inbox follow-through"),
      D("/capture", "我的承诺/跟进", "My commitments & follow-ups"),
    ],
    secondary: [D("/companies", "客户档案", "Company records")],
    drawer: DRAWER_COMMON,
  },
  RECRUITER: {
    // Core 默认无招聘工位（诚实标注）；收纳导航 + 搜索，不默认给拍板入口。
    primary: [D("/search", "搜索", "Search")],
    secondary: [],
    drawer: DRAWER_COMMON,
  },
  CUSTOMER_SUCCESS: {
    primary: [
      D("/customer-success", "交付队列（含成功检查）", "Delivery queue (incl. success checks)"),
      D("/approvals", "续费/扩展复核", "Renewal & expansion review"),
      D("/companies", "客户档案", "Company records"),
    ],
    secondary: [D("/reports", "周期复盘", "Periodic review")],
    drawer: DRAWER_COMMON,
  },
  DELIVERY_LEAD: {
    primary: [
      D("/customer-success", "交付队列（含成功检查）", "Delivery queue (incl. success checks)"),
      D("/approvals", "复核", "Review"),
      D("/reports", "复盘深链", "Review deep links"),
    ],
    secondary: [D("/companies", "客户档案", "Company records")],
    drawer: DRAWER_COMMON,
  },
  PRODUCT_ENGINEER: {
    // 无专属工位（诚实标注）；diagnostics/memory 为次区。
    primary: [D("/search", "搜索", "Search")],
    secondary: [
      D("/diagnostics", "诊断", "Diagnostics"),
      D("/memory", "记忆/改进", "Memory & improvements"),
    ],
    drawer: DRAWER_COMMON,
  },
  OPERATIONS_FINANCE: {
    primary: [
      D("/approvals", "复核队列", "Review queue"),
      D("/memory", "判断记录", "Judgement records"),
    ],
    secondary: [D("/reports", "周期复盘", "Periodic review")],
    drawer: DRAWER_COMMON,
  },
  GENERAL_OPERATOR: {
    primary: [
      D("/search", "搜索", "Search"),
      D("/approvals", "需拍板事项（可见子集）", "Calls that need you (visible subset)"),
    ],
    secondary: [],
    drawer: DRAWER_COMMON,
  },
};

/** 解析失败/未知 → 最低信息面（仅搜索 + 收纳；无拍板入口、无业务队列）。 */
const GENERIC_FALLBACK_CATALOG: DestinationCatalog = {
  primary: [D("/search", "搜索", "Search")],
  secondary: [],
  drawer: DRAWER_COMMON,
};

export function getDestinationCatalog(
  baseKey: string | null | undefined,
): DestinationCatalog {
  if (!baseKey) return GENERIC_FALLBACK_CATALOG;
  const catalog = (CATALOG_BY_PRESET as Record<string, DestinationCatalog | undefined>)[
    baseKey
  ];
  return catalog ?? GENERIC_FALLBACK_CATALOG;
}
