/**
 * 北极星 KPI（northstar KPI）只读展示的**纯双语文案 + 单位格式化**。
 *
 * 铁律(方法论 + 契约):**金额只给分档**——currency_band 只展示 bandLabel,契约无原始金额;
 * 三态禁造数(measured|pending_source|no_data);direction 只表达好坏方向(信息性),不评阈值。
 */

import type { NorthstarKpi, NorthstarKpiDirection } from "@/lib/shell/northstar-kpi";

type Bi = { zh: string; en: string };

export function t(copy: Bi, english: boolean): string {
  return english ? copy.en : copy.zh;
}

export const DIRECTION_COPY: Record<
  NorthstarKpiDirection,
  { arrow: string; tone: "up" | "down" | "neutral" }
> = {
  up_good: { arrow: "↑", tone: "up" },
  down_good: { arrow: "↓", tone: "down" },
  neutral: { arrow: "·", tone: "neutral" },
};

/**
 * 单位感知的值格式化。**currency_band → bandLabel(无原始金额)**;非 measured → 占位/说明。
 * 返回 { text, isPending } —— isPending 用于弱化色。
 */
export function formatKpiValue(kpi: NorthstarKpi, english: boolean): { text: string; muted: boolean } {
  if (kpi.status === "no_data") return { text: "—", muted: true };
  if (kpi.status === "pending_source") {
    return { text: kpi.pendingSourceNote ?? (english ? "Source pending" : "接入中"), muted: true };
  }
  // measured
  if (kpi.unit === "currency_band") {
    return { text: kpi.bandLabel ?? "—", muted: false }; // 金额只给分档
  }
  const v = kpi.value;
  if (v === null || !Number.isFinite(v)) return { text: "—", muted: true };
  switch (kpi.unit) {
    case "percent":
      return { text: `${v}%`, muted: false };
    case "ratio":
      return { text: String(v), muted: false };
    case "duration_seconds":
      return { text: english ? `${v}s` : `${v} 秒`, muted: false };
    case "days":
      return { text: english ? `${v}d` : `${v} 天`, muted: false };
    case "count":
    default:
      return { text: String(v), muted: false };
  }
}

export const KPI_SECTION_COPY = {
  title: { zh: "北极星 KPI", en: "Northstar KPIs" } satisfies Bi,
  boundary: {
    zh: "只读经营指标(信息性):金额只给分档、三态禁造数、方向仅表达好坏不评阈值;未接源诚实标注。",
    en: "Read-only operating metrics (informational): money shown as bands only, three honest states, direction shows good/bad not thresholds; unsourced metrics are honestly marked.",
  } satisfies Bi,
  empty: {
    zh: "当前无北极星 KPI。真实指标由已接入的 Overlay provider 贡献;未接入时诚实留空,不造数。",
    en: "No northstar KPIs right now. Real metrics come from a registered overlay provider; honestly empty until one is wired.",
  } satisfies Bi,
};
