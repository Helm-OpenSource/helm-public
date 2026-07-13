/**
 * 注意力流（attention feed）内部契约 —— 蓝图 §4.2 / §4.4 / Phase 2。
 *
 * concat surface：多 provider 结果并发收集后合并（聚合语义见 §4.4，实现于
 * resolve-shell-experience.ts）。
 *
 * 铁律（§4.1）：
 * - 只读/只导航：无动作回调字段；href 必须站内绝对路径。
 * - **label 已脱敏、仅 ref**：不含 PII；证据在 basisRef。
 * - roleCategory 用于按角色过滤；severity 无执行态语义。
 * - 无个人排名形状。
 */

const SEVERITY_VALUES: ReadonlySet<string> = new Set([
  "critical",
  "warning",
  "info",
]);

export type AttentionSeverity = "critical" | "warning" | "info";

export type AttentionItem = {
  /** 跨源去重键的组成部分（provider 侧稳定标识，非 PII）。 */
  key: string;
  severity: AttentionSeverity;
  /** 已脱敏的展示文案——仅 ref，不含 PII。 */
  label: string;
  /** 角色过滤维度（roleCategory → 该条目对哪类角色可见/相关）。 */
  roleCategory: string;
  /** 只导航到既有人审流程；导航不授权，目标页自行重新鉴权（§1.4）。 */
  href: string | null;
  /** 证据引用（仅 ref）。 */
  basisRef: string;
};

const PII_PATTERNS: ReadonlyArray<RegExp> = [
  /\b1[3-9]\d{9}\b/, // 中国大陆手机号
  /\b\d{15}(?:\d{2}[0-9Xx])?\b/, // 身份证号(15/18 位)
  /[\w.+-]+@[\w-]+\.[\w.-]+/, // 邮箱
];

function isInSitePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes(":") || value.includes("\\")) return false;
  return value.length <= 500;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export type AttentionConformanceIssue = { itemKey: string | null; issue: string };

/**
 * Conformance 校验（返回全部违规项；空数组 = 通过）。
 * 聚合入口对不通过的**单条**条目整体丢弃并记诊断（不部分渲染，不放行疑似 PII）。
 */
export function validateAttentionItems(
  items: ReadonlyArray<AttentionItem>,
): AttentionConformanceIssue[] {
  const issues: AttentionConformanceIssue[] = [];
  const seenKeys = new Set<string>();
  for (const item of items) {
    const itemKey = isNonEmptyString(item.key) ? item.key : null;
    if (!isNonEmptyString(item.key)) issues.push({ itemKey, issue: "empty_key" });
    if (!isNonEmptyString(item.label)) issues.push({ itemKey, issue: "empty_label" });
    if (!isNonEmptyString(item.basisRef))
      issues.push({ itemKey, issue: "empty_basis_ref" });
    if (!isNonEmptyString(item.roleCategory))
      issues.push({ itemKey, issue: "empty_role_category" });
    if (itemKey) {
      if (seenKeys.has(itemKey)) issues.push({ itemKey, issue: "duplicate_key" });
      seenKeys.add(itemKey);
    }
    for (const [field, value] of Object.entries(item)) {
      if (typeof value === "function") {
        issues.push({ itemKey, issue: `callback_field:${field}` });
      }
    }
    if (!SEVERITY_VALUES.has(item.severity as string))
      issues.push({ itemKey, issue: "unknown_severity" });
    // label 脱敏铁律:疑似 PII 直接判违规(fail-closed,不放行)。
    if (isNonEmptyString(item.label)) {
      for (const pattern of PII_PATTERNS) {
        if (pattern.test(item.label)) {
          issues.push({ itemKey, issue: "label_looks_like_pii" });
          break;
        }
      }
    }
    if (item.href !== null && !isInSitePath(item.href)) {
      issues.push({ itemKey, issue: "href_not_in_site" });
    }
  }
  return issues;
}

/** 跨源去重键（§4.4 item key 规范）:providerId + item.key,provider 内 key 自负唯一。 */
export function attentionDedupeKey(providerId: string, item: AttentionItem): string {
  return `${providerId}::${item.key}`;
}

/**
 * 合成"来源未返回"条目（§4.4:未在预算内返回的源以"来源 X 未返回"条目显示，
 * 不静默吞掉）。severity=info,label 无 PII,basisRef 指向聚合器诊断。
 */
export function makeUnreturnedSourceItem(input: {
  providerId: string;
  english: boolean;
  reason: "timeout" | "error" | "deadline";
}): AttentionItem {
  const { providerId, english, reason } = input;
  const reasonZh =
    reason === "timeout" ? "超时" : reason === "deadline" ? "超总预算" : "出错";
  const reasonEn =
    reason === "timeout" ? "timed out" : reason === "deadline" ? "over budget" : "errored";
  return {
    key: `unreturned:${providerId}:${reason}`,
    severity: "info",
    label: english
      ? `Attention source "${providerId}" ${reasonEn}; showing available sources only`
      : `注意力来源「${providerId}」${reasonZh},仅展示已返回来源`,
    roleCategory: "all",
    href: null,
    basisRef: `shell-attention-aggregator:unreturned:${providerId}:${reason}`,
  };
}

/**
 * Core 默认注意力流：Core 本体无注意力数据源 → 诚实**空集**（开源镜像不造数）。
 * 真实条目由私有 Overlay provider 经 attentionSources 贡献。
 */
export function buildCoreDefaultAttention(): ReadonlyArray<AttentionItem> {
  return [];
}
