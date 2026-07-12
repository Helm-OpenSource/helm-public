/**
 * 操作建议（operation suggestion）内部契约 —— 蓝图 Phase 4 / owner"查漏补缺"论断。
 *
 * 命题：**不频繁操作**（初始化 / 连接器接入 / 数据播种 / 一次性迁移 / 一次性配置）
 * **不必建专用 UI**，而是作为**结构化操作建议**呈现，由人**通过通用 Agent
 * （Claude Code / CodeX / 悟空 / WorkBuddy）执行**。Helm 决定"做什么"（建议），
 * 通用 Agent 执行"怎么做"（人监督），结果回流为证据。
 *
 * concat surface：多 provider 结果合并（聚合器同 attention，见 resolve-shell-experience）。
 *
 * 铁律（蓝图 §4.1 复用）：
 * - **建议 ≠ 执行**：条目只读/只导航，无动作回调字段；href 站内绝对路径、只导航。
 * - **agentBrief 是给通用 Agent 的声明式规格，不是可执行回调**；Helm 绝不代执行。
 * - **无 secret / PII**：title / rationale / agentBrief 一律脱敏，疑似令牌/密钥/凭据
 *   与疑似手机号/身份证/邮箱 fail-closed 拒（不放行）。
 * - 三态 ready | blocked_precondition | pending_source，禁造数。
 */

const CATEGORY_VALUES: ReadonlySet<string> = new Set([
  "initialization",
  "connector_setup",
  "data_seed",
  "migration",
  "one_off_config",
]);

/** 不频繁操作的类别词表。 */
export type OperationSuggestionCategory =
  | "initialization"
  | "connector_setup"
  | "data_seed"
  | "migration"
  | "one_off_config";

const READINESS_VALUES: ReadonlySet<string> = new Set([
  "ready",
  "blocked_precondition",
  "pending_source",
]);

/**
 * 就绪三态：ready = 可交通用 Agent 执行；blocked_precondition = 有未满足前置；
 * pending_source = 建议来源尚未接入（禁用推断值冒充 ready）。
 */
export type OperationSuggestionReadiness =
  | "ready"
  | "blocked_precondition"
  | "pending_source";

export type OperationSuggestion = {
  key: string;
  category: OperationSuggestionCategory;
  /** 已脱敏标题，无 PII。 */
  title: string;
  /** 为什么建议——简短理由/ref，无 PII。 */
  rationale: string;
  readiness: OperationSuggestionReadiness;
  /** 未满足前置的证据引用（仅 ref，无 PII）；readiness==="blocked_precondition" 时必须非空。 */
  preconditionRefs: ReadonlyArray<string>;
  /**
   * 给通用 Agent 的**声明式规格**（做什么），自足、可交 Claude Code/CodeX/悟空/
   * WorkBuddy 执行。**不含 secret/token/PII、不是可执行回调**——人把它交给通用 Agent，
   * Helm 不代执行。
   */
  agentBrief: string;
  /** 如何验证成功——ref 或站内 href（只导航）。 */
  verificationRef: string;
  /** 只导航到详情/文档页；不是动作。 */
  href: string | null;
  basisRef: string;
  pendingSourceNote?: string;
};

const PII_PATTERNS: ReadonlyArray<RegExp> = [
  /\b1[3-9]\d{9}\b/, // 中国大陆手机号
  /\b\d{15}(?:\d{2}[0-9Xx])?\b/, // 身份证号(15/18 位)
  /[\w.+-]+@[\w-]+\.[\w.-]+/, // 邮箱
];

/** 疑似 secret/凭据模式(fail-closed;宁误拒不放行到面向通用 Agent 的建议里)。 */
const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /\bsk-[A-Za-z0-9]{16,}\b/, // OpenAI 风格 key
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, // GitHub token
  /\b(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)\s*[:=]/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

function isInSitePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes(":") || value.includes("\\")) return false;
  return value.length <= 500;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function looksLikePii(value: string): boolean {
  return PII_PATTERNS.some((p) => p.test(value));
}

function looksLikeSecret(value: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(value));
}

export type OperationSuggestionConformanceIssue = {
  suggestionKey: string | null;
  issue: string;
};

/**
 * Conformance 校验（返回全部违规项；空数组 = 通过）。
 * 聚合入口对不通过的**单条**建议整体丢弃并记诊断（不部分渲染，不放行疑似 secret/PII）。
 */
export function validateOperationSuggestions(
  suggestions: ReadonlyArray<OperationSuggestion>,
): OperationSuggestionConformanceIssue[] {
  const issues: OperationSuggestionConformanceIssue[] = [];
  const seenKeys = new Set<string>();
  for (const s of suggestions) {
    const suggestionKey = isNonEmptyString(s.key) ? s.key : null;
    if (!isNonEmptyString(s.key)) issues.push({ suggestionKey, issue: "empty_key" });
    if (!isNonEmptyString(s.title)) issues.push({ suggestionKey, issue: "empty_title" });
    if (!isNonEmptyString(s.rationale))
      issues.push({ suggestionKey, issue: "empty_rationale" });
    if (!isNonEmptyString(s.agentBrief))
      issues.push({ suggestionKey, issue: "empty_agent_brief" });
    if (!isNonEmptyString(s.verificationRef))
      issues.push({ suggestionKey, issue: "empty_verification_ref" });
    if (!isNonEmptyString(s.basisRef))
      issues.push({ suggestionKey, issue: "empty_basis_ref" });
    if (suggestionKey) {
      if (seenKeys.has(suggestionKey)) issues.push({ suggestionKey, issue: "duplicate_key" });
      seenKeys.add(suggestionKey);
    }
    for (const [field, value] of Object.entries(s)) {
      if (typeof value === "function") {
        issues.push({ suggestionKey, issue: `callback_field:${field}` });
      }
    }
    if (!CATEGORY_VALUES.has(s.category as string))
      issues.push({ suggestionKey, issue: "unknown_category" });
    if (!READINESS_VALUES.has(s.readiness as string))
      issues.push({ suggestionKey, issue: "unknown_readiness" });
    // 建议≠执行 / 无 secret-PII:面向通用 Agent 的自由文本逐一脱敏检查。
    for (const [field, value] of [
      ["title", s.title],
      ["rationale", s.rationale],
      ["agent_brief", s.agentBrief],
    ] as const) {
      if (isNonEmptyString(value)) {
        if (looksLikePii(value)) issues.push({ suggestionKey, issue: `${field}_looks_like_pii` });
        if (looksLikeSecret(value))
          issues.push({ suggestionKey, issue: `${field}_looks_like_secret` });
      }
    }
    if (s.readiness === "blocked_precondition" && s.preconditionRefs.length === 0) {
      issues.push({ suggestionKey, issue: "blocked_without_precondition_refs" });
    }
    if (s.readiness === "pending_source" && !isNonEmptyString(s.pendingSourceNote)) {
      issues.push({ suggestionKey, issue: "pending_source_without_note" });
    }
    for (const ref of s.preconditionRefs) {
      if (!isNonEmptyString(ref)) {
        issues.push({ suggestionKey, issue: "empty_precondition_ref" });
        break;
      }
    }
    if (s.href !== null && !isInSitePath(s.href)) {
      issues.push({ suggestionKey, issue: "href_not_in_site" });
    }
  }
  return issues;
}

/**
 * Core 默认操作建议：Core 本体无不频繁操作数据源 → 诚实**空集**（开源镜像不造数）。
 * 真实建议由私有 Overlay provider 经 operationSuggestionSources 贡献。
 */
export function buildCoreDefaultOperationSuggestions(): ReadonlyArray<OperationSuggestion> {
  return [];
}
