// CustomerContextUpdateRequest — V2.3 §7.3 客户改写跟踪。
//
// 两类 use case：
//   - initial_confirmation：注册后、试用初始化前的确认与补全
//   - in_usage_update：使用中的补充事实 / 申请改写
//
// 永久边界（V2.3 §10.9 Customer Confirmation ≠ Internal Truth Override）：
//   1. minor (联系人 / 目标 / 参与人 / 资料可得性补充) → DIRECT_APPLY
//   2. material (pain tag / control line / 关键资源可用性 / trial premise /
//      owner/reviewer) → REVIEW_REQUIRED，必须人工 ACCEPT
//   3. 客户永远不能改：internalSalesNotes / contribution / accrual /
//      settlement / reviewer decision —— proposedChanges keys 必须经过
//      forbidden-key 守卫
//   4. material 改动 ACCEPTED 后，相关对象（brief / control line）必须重审，
//      不允许静默覆盖 trial premise

import type {
  CustomerContextUpdateRequestMateriality,
  CustomerContextUpdateRequestOrigin,
  CustomerContextUpdateRequestReviewStatus,
  CustomerContextUpdateRequestScope,
} from "@prisma/client";

export type {
  CustomerContextUpdateRequestMateriality,
  CustomerContextUpdateRequestOrigin,
  CustomerContextUpdateRequestReviewStatus,
  CustomerContextUpdateRequestScope,
};

export const CUSTOMER_CONTEXT_UPDATE_REQUEST_ORIGINS = [
  "CUSTOMER",
  "INTERNAL",
] as const satisfies readonly CustomerContextUpdateRequestOrigin[];

export const CUSTOMER_CONTEXT_UPDATE_REQUEST_SCOPES = [
  "ROLES",
  "GOALS",
  "RESOURCES",
  "CONTROL_LINE",
  "TRIAL_PAYLOAD",
  "OTHER",
] as const satisfies readonly CustomerContextUpdateRequestScope[];

export const CUSTOMER_CONTEXT_UPDATE_REQUEST_MATERIALITIES = [
  "MINOR",
  "MATERIAL",
] as const satisfies readonly CustomerContextUpdateRequestMateriality[];

export const CUSTOMER_CONTEXT_UPDATE_REQUEST_REVIEW_STATUSES = [
  "DIRECT_APPLY",
  "REVIEW_REQUIRED",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
] as const satisfies readonly CustomerContextUpdateRequestReviewStatus[];

// V2.3 §10.9 字段-级 minor/material 判断表。caller 在 inferMateriality() 中查。
export const SCOPE_TO_DEFAULT_MATERIALITY: Record<
  CustomerContextUpdateRequestScope,
  CustomerContextUpdateRequestMateriality
> = {
  ROLES: "MINOR",                          // 参与人 / 角色补充默认 minor
  GOALS: "MINOR",                          // 目标 / 成功标准细化默认 minor
  RESOURCES: "MATERIAL",                   // 关键资源可用性变化是 material
  CONTROL_LINE: "MATERIAL",                // 控制线模板变更必须 review
  TRIAL_PAYLOAD: "MATERIAL",               // 试用前提变更必须 review
  OTHER: "MATERIAL",                       // 默认保守
};

export function inferMateriality(
  scope: CustomerContextUpdateRequestScope,
): CustomerContextUpdateRequestMateriality {
  return SCOPE_TO_DEFAULT_MATERIALITY[scope];
}

// V2.3 §10.9 客户绝不可写入的内部字段。一旦 proposedChanges 命中这些 key
// 模式，update request 必须被拒绝。
const FORBIDDEN_PROPOSED_CHANGE_KEY_PATTERNS = [
  /internal[_-]?note/i,
  /sales[_-]?note/i,
  /reviewer[_-]?decision/i,
  /reviewer[_-]?judg(e)?ment/i,
  /contribution/i,
  /accrual/i,
  /settlement/i,
  /commission/i,
  /payable/i,
  /payout/i,
  /equity/i,
  /internal[_-]?scoring/i,
];

export function proposedChangesHaveForbiddenKeys(
  proposed: Record<string, unknown> | null | undefined,
): string[] {
  if (!proposed) return [];
  const violations: string[] = [];
  for (const key of Object.keys(proposed)) {
    if (FORBIDDEN_PROPOSED_CHANGE_KEY_PATTERNS.some((re) => re.test(key))) {
      violations.push(key);
    }
  }
  return violations;
}

export type CustomerContextUpdateRequestSourceTraceEntry = {
  ts: string;
  origin:
    | "customer_initial_confirmation"
    | "customer_in_usage_supplement"
    | "customer_change_request"
    | "internal_review";
  actor: string;
  note: string;
};

export type CustomerContextUpdateRequestRecord = {
  id: string;
  workspaceId: string;
  leadId: string;
  briefId: string | null;
  controlLineCandidateId: string | null;
  requestKey: string;
  origin: CustomerContextUpdateRequestOrigin;
  scope: CustomerContextUpdateRequestScope;
  proposedChanges: Record<string, unknown>;
  materiality: CustomerContextUpdateRequestMateriality;
  reviewStatus: CustomerContextUpdateRequestReviewStatus;
  reviewerActor: string | null;
  reviewerDecisionNote: string | null;
  appliedAt: string | null;
  supersededByRequestId: string | null;
  sourceTrace: CustomerContextUpdateRequestSourceTraceEntry[];
  createdAt: string;
  updatedAt: string;
};

export type CustomerContextUpdateRequestCreateInput = {
  workspaceId: string;
  leadId: string;
  briefId?: string | null;
  controlLineCandidateId?: string | null;
  requestKey: string;
  origin: CustomerContextUpdateRequestOrigin;
  scope: CustomerContextUpdateRequestScope;
  proposedChanges: Record<string, unknown>;
  // 不让 caller 直接 set materiality；由 inferMateriality(scope) 决定，
  // caller 想强制 MATERIAL 可以传 explicitMaterialityOverride。
  explicitMaterialityOverride?: CustomerContextUpdateRequestMateriality;
  initialSourceTrace?: readonly CustomerContextUpdateRequestSourceTraceEntry[];
};

// V2.3 §8.3 Customer-Sourced Update Flow 状态机。
export const REVIEW_STATUS_TRANSITIONS: Record<
  CustomerContextUpdateRequestReviewStatus,
  readonly CustomerContextUpdateRequestReviewStatus[]
> = {
  // DIRECT_APPLY 是 minor 改动的终态，但仍可被新 request 替换为 SUPERSEDED。
  DIRECT_APPLY: ["SUPERSEDED"],
  REVIEW_REQUIRED: ["ACCEPTED", "REJECTED", "SUPERSEDED"],
  ACCEPTED: ["SUPERSEDED"],
  REJECTED: ["SUPERSEDED"],
  SUPERSEDED: [],
};

export function isValidReviewStatusTransition(
  from: CustomerContextUpdateRequestReviewStatus,
  to: CustomerContextUpdateRequestReviewStatus,
) {
  if (from === to) return true;
  return REVIEW_STATUS_TRANSITIONS[from].includes(to);
}

// V2.3 §10.9 cascade：当 material change 被 ACCEPTED 时，相关 brief / control
// line 应该被回到 review。这个函数只声明 caller 需要执行的 downgrade 动作；
// 真正调用 brief/control line 的 update 由 actions.ts 安排。
export type CustomerContextUpdateAcceptanceCascade = {
  shouldDowngradeBrief: boolean;             // brief.reviewStatus → REVIEW_REQUIRED
  shouldDowngradeControlLine: boolean;       // control line.status → REVIEW_REQUIRED
};

export function inferAcceptanceCascade(input: {
  scope: CustomerContextUpdateRequestScope;
  materiality: CustomerContextUpdateRequestMateriality;
  hasBriefRef: boolean;
  hasControlLineRef: boolean;
}): CustomerContextUpdateAcceptanceCascade {
  if (input.materiality !== "MATERIAL") {
    return { shouldDowngradeBrief: false, shouldDowngradeControlLine: false };
  }
  return {
    shouldDowngradeBrief:
      input.hasBriefRef &&
      (input.scope === "RESOURCES" ||
        input.scope === "CONTROL_LINE" ||
        input.scope === "TRIAL_PAYLOAD"),
    shouldDowngradeControlLine:
      input.hasControlLineRef &&
      (input.scope === "RESOURCES" || input.scope === "CONTROL_LINE"),
  };
}
