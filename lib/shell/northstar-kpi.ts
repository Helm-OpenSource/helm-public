/**
 * 北极星 KPI（northstar KPI）内部契约 —— 蓝图 §4.2 / Phase 2。
 *
 * concat surface：多 provider 结果合并（不同于单一生效的 mainline）。
 *
 * 铁律（§4.1）：
 * - 只读/只导航：无动作回调字段；href 必须站内绝对路径。
 * - 三态 measured | pending_source | no_data，禁止用推断值冒充 measured。
 * - **金额只给分档**（`currency_band`），契约里不存在原始金额字段——currency_band
 *   单位的 KPI 只带 `bandLabel`（分档标签），`value` 必须为 null。
 * - 无个人排名形状（KPI 为 team/workspace 级聚合）。
 */

import type { ShellReadoutStatus } from "./operating-mainline";

const STATUS_VALUES: ReadonlySet<string> = new Set([
  "measured",
  "pending_source",
  "no_data",
]);

/** 好坏方向（UI 据此上色/箭头，不含阈值语义）。 */
export type NorthstarKpiDirection = "up_good" | "down_good" | "neutral";

const DIRECTION_VALUES: ReadonlySet<string> = new Set([
  "up_good",
  "down_good",
  "neutral",
]);

/**
 * 单位词表。`currency_band` = 金额分档（无原始金额）；其余为可直接展示的
 * 无量纲/时间量。契约里刻意没有 raw currency / amount 字段。
 */
export type NorthstarKpiUnit =
  | "count"
  | "percent"
  | "ratio"
  | "currency_band"
  | "duration_seconds"
  | "days";

const UNIT_VALUES: ReadonlySet<string> = new Set([
  "count",
  "percent",
  "ratio",
  "currency_band",
  "duration_seconds",
  "days",
]);

export type NorthstarKpi = {
  key: string;
  label: string;
  status: ShellReadoutStatus;
  unit: NorthstarKpiUnit;
  /**
   * 数值型单位（count/percent/ratio/duration_seconds/days）的测量值；
   * status!=="measured" 时必须为 null；unit==="currency_band" 时**必须为 null**
   * （金额只给分档，见 bandLabel）。
   */
  value: number | null;
  /**
   * 金额分档标签（如 "¥10k–50k"）；unit==="currency_band" 且 measured 时必填，
   * 其余单位必须为 null。契约里不存在原始金额字段。
   */
  bandLabel: string | null;
  direction: NorthstarKpiDirection;
  href: string | null;
  basisRef: string;
  pendingSourceNote?: string;
};

function isInSitePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes(":") || value.includes("\\")) return false;
  return value.length <= 500;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: number | null): boolean {
  return value === null || Number.isFinite(value);
}

export type NorthstarKpiConformanceIssue = { kpiKey: string | null; issue: string };

/**
 * Conformance 校验（返回全部违规项；空数组 = 通过）。
 * 聚合入口对不通过的**单条** KPI 整体丢弃（不部分渲染残缺条目），
 * 由 resolve-shell-experience 在合并前逐条过滤并记诊断。
 */
export function validateNorthstarKpis(
  kpis: ReadonlyArray<NorthstarKpi>,
): NorthstarKpiConformanceIssue[] {
  const issues: NorthstarKpiConformanceIssue[] = [];
  const seenKeys = new Set<string>();
  for (const kpi of kpis) {
    const kpiKey = isNonEmptyString(kpi.key) ? kpi.key : null;
    if (!isNonEmptyString(kpi.key)) issues.push({ kpiKey, issue: "empty_key" });
    if (!isNonEmptyString(kpi.label)) issues.push({ kpiKey, issue: "empty_label" });
    if (!isNonEmptyString(kpi.basisRef))
      issues.push({ kpiKey, issue: "empty_basis_ref" });
    if (kpiKey) {
      if (seenKeys.has(kpiKey)) issues.push({ kpiKey, issue: "duplicate_key" });
      seenKeys.add(kpiKey);
    }
    for (const [field, value] of Object.entries(kpi)) {
      if (typeof value === "function") {
        issues.push({ kpiKey, issue: `callback_field:${field}` });
      }
    }
    if (!STATUS_VALUES.has(kpi.status as string))
      issues.push({ kpiKey, issue: "unknown_status" });
    if (!UNIT_VALUES.has(kpi.unit as string))
      issues.push({ kpiKey, issue: "unknown_unit" });
    if (!DIRECTION_VALUES.has(kpi.direction as string))
      issues.push({ kpiKey, issue: "unknown_direction" });
    // 非 measured 不得携带值。
    if (kpi.status !== "measured" && (kpi.value !== null || kpi.bandLabel !== null)) {
      issues.push({ kpiKey, issue: "non_measured_carries_value" });
    }
    // 金额只给分档:currency_band 必须走 bandLabel、value 恒 null;其余单位 bandLabel 恒 null。
    if (kpi.unit === "currency_band") {
      if (kpi.value !== null) issues.push({ kpiKey, issue: "currency_band_carries_raw_value" });
      if (kpi.status === "measured" && !isNonEmptyString(kpi.bandLabel)) {
        issues.push({ kpiKey, issue: "currency_band_missing_band_label" });
      }
    } else if (kpi.bandLabel !== null) {
      issues.push({ kpiKey, issue: "band_label_on_non_currency_unit" });
    }
    if (!isFiniteNumber(kpi.value)) issues.push({ kpiKey, issue: "non_finite_value" });
    if (
      kpi.status === "pending_source" &&
      !isNonEmptyString(kpi.pendingSourceNote)
    ) {
      issues.push({ kpiKey, issue: "pending_source_without_note" });
    }
    if (kpi.href !== null && !isInSitePath(kpi.href)) {
      issues.push({ kpiKey, issue: "href_not_in_site" });
    }
  }
  return issues;
}

/**
 * Core 默认北极星 KPI：Core 本体无 KPI 数据源 → 诚实**空集**（开源镜像不造数）。
 * 真实 KPI 由私有 Overlay provider 经 northstarKpiSources 贡献。
 */
export function buildCoreDefaultNorthstarKpis(): ReadonlyArray<NorthstarKpi> {
  return [];
}
