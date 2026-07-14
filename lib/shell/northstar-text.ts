import type { MainlineAssetScopeControl } from "@/lib/shell/operating-mainline";

/**
 * 北极星一行的文案解析（蓝图 §2 段①）。
 * 数据源 = workspace.focusAreas（既有配置字段）；未配置/解析失败 → null，
 * UI 渲染"未设定目标 → 去设置"（诚实降级，不造目标）。
 */
export function resolveNorthstarText(
  focusAreas: string | null | undefined,
  english: boolean,
): string | null {
  if (typeof focusAreas !== "string" || focusAreas.trim().length === 0) {
    return null;
  }
  let items: string[] = [];
  try {
    const parsed: unknown = JSON.parse(focusAreas);
    if (Array.isArray(parsed)) {
      items = parsed.filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      );
    } else if (typeof parsed === "string" && parsed.trim().length > 0) {
      items = [parsed];
    }
  } catch {
    items = [focusAreas.trim()];
  }
  if (items.length === 0) return null;
  const shown = items
    .slice(0, 2)
    .map((item) => localizeNorthstarItem(item, english))
    .join(english ? " · " : "、");
  const prefix = english ? "North star: " : "北极星：";
  return `${prefix}${shown}`;
}

export function resolveAssetScopedNorthstarText(
  northstarText: string | null,
  assetScope: MainlineAssetScopeControl | undefined,
): string | null {
  if (!northstarText || !assetScope || assetScope.options.length < 2) {
    return northstarText;
  }
  const current = assetScope.options.find((option) => option.current);
  const currentLabel = current?.label || assetScope.currentValue;
  if (!currentLabel.trim()) return northstarText;

  let scoped = northstarText;
  for (const option of assetScope.options) {
    if (option.value === assetScope.currentValue) continue;
    for (const candidate of [option.label, option.value]) {
      if (!candidate || candidate === currentLabel) continue;
      scoped = scoped.replace(
        new RegExp(`(^|\\D)${escapeRegExp(candidate)}(?!\\d)`, "g"),
        (_match, prefix: string) => `${prefix}${currentLabel}`,
      );
    }
  }
  return scoped;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function localizeNorthstarItem(item: string, english: boolean): string {
  if (!english) return item;
  return item
    .replace(/^(\d{4})资产冷启动/g, "$1 asset cold start")
    .replace(/^(\d{4})资产/g, "$1 asset ")
    .replace(/资产冷启动/g, "asset cold start")
    .replace(/资产日切/g, "asset daily cut")
    .replace(/逾期口径/g, "overdue-calculation policy")
    .replace(/与/g, " and ");
}
