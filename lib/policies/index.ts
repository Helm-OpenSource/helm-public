import { ActionExecutionMode, type ActionType, type PolicyRule, RiskLevel } from "@prisma/client";

export type PolicyDecision = {
  mode: ActionExecutionMode;
  requiresApproval: boolean;
  blocked: boolean;
  reason: string;
  appliedPolicyName: string | null;
  appliedPolicyMode: ActionExecutionMode | null;
  appliedRiskThreshold: RiskLevel | null;
  resolvedBy: "risk_override" | "default_fallback" | "policy_forbidden" | "policy_suggest_only" | "policy_auto" | "policy_requires_approval";
};

const riskOrder: Record<RiskLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function isHighRisk(riskLevel: RiskLevel) {
  return riskOrder[riskLevel] >= riskOrder.HIGH;
}

export function resolvePolicyDecision(args: {
  actionType: ActionType;
  riskLevel: RiskLevel;
  policy?: PolicyRule | null;
}) {
  const { actionType, riskLevel, policy } = args;

  if (isHighRisk(riskLevel)) {
    return {
      mode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      blocked: false,
      reason: "高风险动作必须审批。",
      appliedPolicyName: policy?.name ?? null,
      appliedPolicyMode: policy?.mode ?? null,
      appliedRiskThreshold: policy?.riskThreshold ?? null,
      resolvedBy: "risk_override",
    } satisfies PolicyDecision;
  }

  if (!policy || !policy.enabled) {
    return {
      mode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      blocked: false,
      reason: `${actionType} 未配置策略，默认进入逐条审批。`,
      appliedPolicyName: null,
      appliedPolicyMode: null,
      appliedRiskThreshold: null,
      resolvedBy: "default_fallback",
    } satisfies PolicyDecision;
  }

  if (policy.mode === ActionExecutionMode.FORBIDDEN) {
    return {
      mode: ActionExecutionMode.FORBIDDEN,
      requiresApproval: false,
      blocked: true,
      reason: "当前策略禁止此类动作执行。",
      appliedPolicyName: policy.name,
      appliedPolicyMode: policy.mode,
      appliedRiskThreshold: policy.riskThreshold,
      resolvedBy: "policy_forbidden",
    } satisfies PolicyDecision;
  }

  if (policy.mode === ActionExecutionMode.SUGGEST_ONLY) {
    return {
      mode: ActionExecutionMode.SUGGEST_ONLY,
      requiresApproval: false,
      blocked: false,
      reason: "策略设为仅建议，不会自动创建执行动作。",
      appliedPolicyName: policy.name,
      appliedPolicyMode: policy.mode,
      appliedRiskThreshold: policy.riskThreshold,
      resolvedBy: "policy_suggest_only",
    } satisfies PolicyDecision;
  }

  if (policy.mode === ActionExecutionMode.AUTO_WITHIN_THRESHOLD) {
    const withinThreshold = riskOrder[riskLevel] <= riskOrder[policy.riskThreshold];

    if (withinThreshold) {
      return {
        mode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
        requiresApproval: false,
        blocked: false,
        reason: "动作风险在自动执行阈值内。",
        appliedPolicyName: policy.name,
        appliedPolicyMode: policy.mode,
        appliedRiskThreshold: policy.riskThreshold,
        resolvedBy: "policy_auto",
      } satisfies PolicyDecision;
    }

    return {
      mode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      blocked: false,
      reason: "动作超出自动执行阈值，转入审批。",
      appliedPolicyName: policy.name,
      appliedPolicyMode: policy.mode,
      appliedRiskThreshold: policy.riskThreshold,
      resolvedBy: "policy_auto",
    } satisfies PolicyDecision;
  }

  return {
    mode: ActionExecutionMode.REQUIRES_APPROVAL,
    requiresApproval: true,
    blocked: false,
    reason: "策略要求逐条审批。",
    appliedPolicyName: policy.name,
    appliedPolicyMode: policy.mode,
    appliedRiskThreshold: policy.riskThreshold,
    resolvedBy: "policy_requires_approval",
  } satisfies PolicyDecision;
}
