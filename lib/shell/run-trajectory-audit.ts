/**
 * 运行轨迹审计（run-trajectory audit）内部契约 —— 蓝图 Phase 5 / owner"查漏补缺"。
 *
 * 为既有 agent 运行证据层（AgentRunCapsule / trajectory-eval / SARP receipt）补
 * **只读审计 UI surface**：把一次 agent 运行投影为脱敏、只读、只导航的审计条目。
 *
 * concat surface（多 provider 合并，聚合器同 attention/workstations）。
 *
 * 铁律（§4.1 复用 + 审计特有）：
 * - **只读、无控制语义**：verdict 是陈述性结论，**无 approve/stop/rerun 等动作**；
 *   无动作回调字段；href 站内绝对路径、只导航到只读详情。
 * - **无 secret / PII**：actor / intentSummary 一律脱敏，疑似令牌/密钥/凭据与
 *   手机号/身份证/邮箱一律 fail-closed 拒（审计面泄漏尤其严重）。
 * - 计数为非负整数聚合，无个人排名形状。
 */

const VERDICT_VALUES: ReadonlySet<string> = new Set([
  "pass",
  "advisory",
  "blocked",
  "escalate",
  "quarantined",
  "pending",
]);

/**
 * 审计结论词表(投影自 SARP verdict + capsule 状态)：
 * pass/advisory/blocked/escalate 对齐 SARP；quarantined = capsule 隔离；
 * pending = 尚无 SARP receipt。**均为陈述,无控制语义**。
 */
export type AgentRunAuditVerdict =
  | "pass"
  | "advisory"
  | "blocked"
  | "escalate"
  | "quarantined"
  | "pending";

export type AgentRunAuditEntry = {
  runId: string;
  /** 脱敏的执行者/角色 ref,无 PII。 */
  actor: string;
  /** agent 实现模式标签。 */
  mode: string;
  /** 意图摘要——短、脱敏、无 PII/secret。 */
  intentSummary: string;
  /** ISO-8601 运行时刻。 */
  asOf: string;
  verdict: AgentRunAuditVerdict;
  /** 轨迹失败类标签(投影自 detectTrajectoryFailures),仅类名不含明细 PII。 */
  trajectoryFailureClasses: ReadonlyArray<string>;
  /** 边界决策条数(团队/运行级聚合)。 */
  boundaryDecisionCount: number;
  /** 被阻断动作条数。 */
  blockedActionCount: number;
  quarantined: boolean;
  /** 只导航到只读审计详情;null = 无独立详情页。 */
  href: string | null;
  basisRef: string;
};

const PII_PATTERNS: ReadonlyArray<RegExp> = [
  /\b1[3-9]\d{9}\b/, // 中国大陆手机号
  /\b\d{15}(?:\d{2}[0-9Xx])?\b/, // 身份证号(15/18 位)
  /[\w.+-]+@[\w-]+\.[\w.-]+/, // 邮箱
];

const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\b(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)\s*[:=]/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function isParsableIso(value: string): boolean {
  return ISO_TIMESTAMP_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function isInSitePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes(":") || value.includes("\\")) return false;
  return value.length <= 500;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeInt(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function looksLikePii(value: string): boolean {
  return PII_PATTERNS.some((p) => p.test(value));
}

function looksLikeSecret(value: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(value));
}

export type AgentRunAuditConformanceIssue = { runId: string | null; issue: string };

/**
 * Conformance 校验（返回全部违规项；空数组 = 通过）。
 * 聚合入口对不通过的**单条**审计条目整体丢弃并记诊断（不部分渲染，不放行疑似 secret/PII）。
 */
export function validateAgentRunAuditEntries(
  entries: ReadonlyArray<AgentRunAuditEntry>,
): AgentRunAuditConformanceIssue[] {
  const issues: AgentRunAuditConformanceIssue[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const runId = isNonEmptyString(entry.runId) ? entry.runId : null;
    if (!isNonEmptyString(entry.runId)) issues.push({ runId, issue: "empty_run_id" });
    if (!isNonEmptyString(entry.actor)) issues.push({ runId, issue: "empty_actor" });
    if (!isNonEmptyString(entry.mode)) issues.push({ runId, issue: "empty_mode" });
    if (!isNonEmptyString(entry.intentSummary))
      issues.push({ runId, issue: "empty_intent_summary" });
    if (!isNonEmptyString(entry.basisRef)) issues.push({ runId, issue: "empty_basis_ref" });
    if (runId) {
      if (seen.has(runId)) issues.push({ runId, issue: "duplicate_run_id" });
      seen.add(runId);
    }
    for (const [field, value] of Object.entries(entry)) {
      if (typeof value === "function") {
        issues.push({ runId, issue: `callback_field:${field}` });
      }
    }
    if (!VERDICT_VALUES.has(entry.verdict as string))
      issues.push({ runId, issue: "unknown_verdict" });
    if (!isParsableIso(entry.asOf)) issues.push({ runId, issue: "asOf_not_iso8601" });
    // 无 secret/PII:审计自由文本逐一脱敏检查(泄漏尤其严重,fail-closed)。
    for (const [field, value] of [
      ["actor", entry.actor],
      ["intent_summary", entry.intentSummary],
    ] as const) {
      if (isNonEmptyString(value)) {
        if (looksLikePii(value)) issues.push({ runId, issue: `${field}_looks_like_pii` });
        if (looksLikeSecret(value)) issues.push({ runId, issue: `${field}_looks_like_secret` });
      }
    }
    if (!Array.isArray(entry.trajectoryFailureClasses)) {
      issues.push({ runId, issue: "failure_classes_not_array" });
    } else {
      for (const fc of entry.trajectoryFailureClasses) {
        if (!isNonEmptyString(fc)) {
          issues.push({ runId, issue: "empty_failure_class" });
          break;
        }
      }
    }
    if (!isNonNegativeInt(entry.boundaryDecisionCount)) {
      issues.push({ runId, issue: "invalid_boundary_decision_count" });
    }
    if (!isNonNegativeInt(entry.blockedActionCount)) {
      issues.push({ runId, issue: "invalid_blocked_action_count" });
    }
    if (typeof entry.quarantined !== "boolean") {
      issues.push({ runId, issue: "quarantined_not_boolean" });
    }
    if (entry.href !== null && !isInSitePath(entry.href)) {
      issues.push({ runId, issue: "href_not_in_site" });
    }
  }
  return issues;
}

/**
 * Core 默认运行轨迹审计：Core 本体不投影任何 agent 运行 → 诚实**空集**。
 * 真实审计条目由私有 Overlay provider 从其 AgentRunCapsule / SARP receipt 投影贡献。
 */
export function buildCoreDefaultRunTrajectoryAudit(): ReadonlyArray<AgentRunAuditEntry> {
  return [];
}
