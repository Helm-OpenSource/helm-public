/**
 * 工位登记（workstation descriptor）内部契约 —— 蓝图 §4.2 / §4.1.5 / Phase 3。
 *
 * concat surface（多 provider 合并）：契约只登记"存在哪些工位、谁的家在哪、
 * 导航怎么显示"，**工位页面本体不进契约**（§4.1.5，继续走既有 overlay routes）。
 *
 * 铁律（§4.1 复用）：只读/只导航；无动作回调字段；href 站内绝对路径、只导航；
 * roleCategories 为角色过滤维度（哪些角色的家可落此工位）。
 */

function isInSitePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes(":") || value.includes("\\")) return false;
  return value.length <= 500;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export type WorkstationDescriptor = {
  key: string;
  label: string;
  /** 只导航到工位页面；null = 仅登记存在、无独立导航目标。 */
  href: string | null;
  /** 哪些角色的家可落此工位（角色过滤维度）。 */
  roleCategories: ReadonlyArray<string>;
};

export type WorkstationConformanceIssue = { workstationKey: string | null; issue: string };

/**
 * Conformance 校验（返回全部违规项；空数组 = 通过）。
 * 聚合入口对不通过的**单条**工位整体丢弃并记诊断（不部分渲染）。
 */
export function validateWorkstations(
  workstations: ReadonlyArray<WorkstationDescriptor>,
): WorkstationConformanceIssue[] {
  const issues: WorkstationConformanceIssue[] = [];
  const seen = new Set<string>();
  for (const ws of workstations) {
    const workstationKey = isNonEmptyString(ws.key) ? ws.key : null;
    if (!isNonEmptyString(ws.key)) issues.push({ workstationKey, issue: "empty_key" });
    if (!isNonEmptyString(ws.label)) issues.push({ workstationKey, issue: "empty_label" });
    if (workstationKey) {
      if (seen.has(workstationKey)) issues.push({ workstationKey, issue: "duplicate_key" });
      seen.add(workstationKey);
    }
    for (const [field, value] of Object.entries(ws)) {
      if (typeof value === "function") {
        issues.push({ workstationKey, issue: `callback_field:${field}` });
      }
    }
    if (!Array.isArray(ws.roleCategories)) {
      issues.push({ workstationKey, issue: "role_categories_not_array" });
    } else {
      for (const rc of ws.roleCategories) {
        if (!isNonEmptyString(rc)) {
          issues.push({ workstationKey, issue: "empty_role_category" });
          break;
        }
      }
    }
    if (ws.href !== null && !isInSitePath(ws.href)) {
      issues.push({ workstationKey, issue: "href_not_in_site" });
    }
  }
  return issues;
}

/**
 * Core 默认工位：Core 本体无工位 → 诚实**空集**（真实工位由 Overlay provider
 * 贡献，例如某租户的催收/复核/质检工位）。开源镜像不造数。
 */
export function buildCoreDefaultWorkstations(): ReadonlyArray<WorkstationDescriptor> {
  return [];
}
