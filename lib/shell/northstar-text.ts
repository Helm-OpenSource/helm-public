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
  const shown = items.slice(0, 2).join(english ? " · " : "、");
  const prefix = english ? "North star: " : "北极星：";
  return `${prefix}${shown}`;
}
