// CustomerDemandBrief — V2.3 §7.2 reserved tenant 内部 handoff 对象。
//
// 三层分离原则（V2.3 §10.7 Clean Handoff into Trial）：
//   internalSalesNotes        → 只允许 Helm reserved tenant 内部可见，禁止进入客户工作区
//   customerVisibleSummary    → 经过 review 后才能进入客户沟通 / proposal
//   trialInitializationPayload→ 经过 review gate 后才能复制进试用 workspace 初始化
//
// 永久边界：
//   - reserved-only：caller 必须在 surface 层先做 workspace gating；
//   - recommendation ≠ commitment：reviewStatus / customerConfirmationStatus 都是判断快照；
//   - 永不带 referral / settlement / contribution 字段进 trialInitializationPayload；
//   - V2.3 §10.10 append-first：所有 reviewer / customer 决策都通过 sourceTrace 追加，不静默覆盖。

import type {
  CustomerDemandBriefCustomerConfirmationStatus,
  CustomerDemandBriefEntryMode,
  CustomerDemandBriefReviewStatus,
} from "@prisma/client";

export type {
  CustomerDemandBriefCustomerConfirmationStatus,
  CustomerDemandBriefEntryMode,
  CustomerDemandBriefReviewStatus,
};

export const CUSTOMER_DEMAND_BRIEF_ENTRY_MODES = [
  "SALES_LED",
  "SELF_SERVE",
] as const satisfies readonly CustomerDemandBriefEntryMode[];

export const CUSTOMER_DEMAND_BRIEF_REVIEW_STATUSES = [
  "DRAFT",
  "REVIEW_REQUIRED",
  "APPROVED_FOR_TRIAL_INIT",
  "REJECTED",
  "SUPERSEDED",
] as const satisfies readonly CustomerDemandBriefReviewStatus[];

export const CUSTOMER_DEMAND_BRIEF_CUSTOMER_CONFIRMATION_STATUSES = [
  "NOT_INVITED",
  "PENDING_CUSTOMER",
  "PARTIAL_CONFIRMED",
  "FULLY_CONFIRMED",
  "CHANGE_REQUESTED",
] as const satisfies readonly CustomerDemandBriefCustomerConfirmationStatus[];

// 资源证据的 4 档 readiness（V2.3 §6.4 Evidence Validation 状态机）。
export type ResourceEvidenceReadinessLevel =
  | "declared"
  | "partial"
  | "ready"
  | "verified";

export type ResourceEvidenceReadinessEntry = {
  resource: string;                          // e.g. "CRM" / "表格" / "会议记录"
  readiness: ResourceEvidenceReadinessLevel;
  notes?: string;
};

// V2.3 §6.2 step 4 的角色地图。
export type CustomerDemandBriefRoleMap = {
  decisionMakers: string[];                  // 谁决策
  endUsers: string[];                        // 谁用
  executors: string[];                       // 谁执行
  reviewers: string[];                       // 谁复核
};

// 试用初始化 payload 的允许字段（V2.3 §10.7 white-list）。
// 严禁包含 referral / settlement / contribution / 内部销售备注 / 内部 scoring。
export type TrialInitializationPayload = {
  workspaceProfileType?: string | null;
  acceptedBusinessGoals: string[];
  acceptedRoles: string[];
  acceptedResources: string[];
  acceptedFirstLoopType?: string | null;
  acceptedSuccessCriteria: string[];
  riskBoundaryNotes: string[];
  prerequisiteNotes: string[];
};

// SourceTrace：append-first 来源轨迹，每条记录一段。
export type CustomerDemandBriefSourceTraceEntry = {
  ts: string;                                // ISO timestamp
  origin:
    | "sales_prefill"
    | "customer_confirmation"
    | "customer_supplement"
    | "customer_change_request"
    | "internal_review";
  actor: string;                             // membershipId / customer email / "system"
  note: string;
};

export type CustomerDemandBriefRecord = {
  id: string;
  workspaceId: string;
  leadId: string;
  briefKey: string;
  entryMode: CustomerDemandBriefEntryMode;
  prefillSource: string | null;
  customerSummary: string;
  businessPressureTags: string[];
  currentResourceTags: string[];
  resourceEvidenceReadiness: ResourceEvidenceReadinessEntry[];
  painToControlLineCandidates: string[];
  roleMap: CustomerDemandBriefRoleMap;
  firstLoopCandidates: string[];
  successCriteria: string;
  riskBoundaryTags: string[];
  customerVisibleSummary: string;
  internalSalesNotes: string | null;
  trialInitializationPayload: TrialInitializationPayload | null;
  sourceTrace: CustomerDemandBriefSourceTraceEntry[];
  reviewStatus: CustomerDemandBriefReviewStatus;
  customerConfirmationStatus: CustomerDemandBriefCustomerConfirmationStatus;
  createdAt: string;
  updatedAt: string;
};

export type CustomerDemandBriefCreateInput = {
  workspaceId: string;
  leadId: string;
  briefKey: string;
  entryMode: CustomerDemandBriefEntryMode;
  prefillSource?: string | null;
  customerSummary: string;
  businessPressureTags?: readonly string[];
  currentResourceTags?: readonly string[];
  resourceEvidenceReadiness?: readonly ResourceEvidenceReadinessEntry[];
  painToControlLineCandidates?: readonly string[];
  roleMap?: CustomerDemandBriefRoleMap;
  firstLoopCandidates?: readonly string[];
  successCriteria: string;
  riskBoundaryTags?: readonly string[];
  customerVisibleSummary: string;
  internalSalesNotes?: string | null;
  // 创建时不允许直接给 trialInitializationPayload；只能 review 通过后由 actions 写入。
  initialSourceTrace?: readonly CustomerDemandBriefSourceTraceEntry[];
};

// V2.3 §8 Lead-to-Trial Initialization Flow 中 brief 的合法 review 推进。
export const CUSTOMER_DEMAND_BRIEF_REVIEW_TRANSITIONS: Record<
  CustomerDemandBriefReviewStatus,
  readonly CustomerDemandBriefReviewStatus[]
> = {
  DRAFT: ["REVIEW_REQUIRED", "REJECTED", "SUPERSEDED"],
  REVIEW_REQUIRED: [
    "APPROVED_FOR_TRIAL_INIT",
    "REJECTED",
    "DRAFT",                                 // 复核退回销售再补
    "SUPERSEDED",
  ],
  APPROVED_FOR_TRIAL_INIT: [
    "REVIEW_REQUIRED",                       // 客户改写关键字段 → 重审
    "SUPERSEDED",
  ],
  REJECTED: ["DRAFT", "SUPERSEDED"],         // 销售可补正后重启
  SUPERSEDED: [],                            // terminal
};

export function isValidCustomerDemandBriefReviewTransition(
  from: CustomerDemandBriefReviewStatus,
  to: CustomerDemandBriefReviewStatus,
) {
  if (from === to) return true;
  return CUSTOMER_DEMAND_BRIEF_REVIEW_TRANSITIONS[from].includes(to);
}

// 客户确认状态的合法推进（V2.3 §6.3 Customer Confirmation Layer）。
export const CUSTOMER_DEMAND_BRIEF_CUSTOMER_CONFIRMATION_TRANSITIONS: Record<
  CustomerDemandBriefCustomerConfirmationStatus,
  readonly CustomerDemandBriefCustomerConfirmationStatus[]
> = {
  NOT_INVITED: ["PENDING_CUSTOMER"],
  PENDING_CUSTOMER: [
    "PARTIAL_CONFIRMED",
    "FULLY_CONFIRMED",
    "CHANGE_REQUESTED",
  ],
  PARTIAL_CONFIRMED: ["FULLY_CONFIRMED", "CHANGE_REQUESTED"],
  FULLY_CONFIRMED: ["CHANGE_REQUESTED"],
  CHANGE_REQUESTED: ["PARTIAL_CONFIRMED", "FULLY_CONFIRMED"],
};

export function isValidCustomerDemandBriefCustomerConfirmationTransition(
  from: CustomerDemandBriefCustomerConfirmationStatus,
  to: CustomerDemandBriefCustomerConfirmationStatus,
) {
  if (from === to) return true;
  return CUSTOMER_DEMAND_BRIEF_CUSTOMER_CONFIRMATION_TRANSITIONS[from].includes(to);
}

export function emptyRoleMap(): CustomerDemandBriefRoleMap {
  return {
    decisionMakers: [],
    endUsers: [],
    executors: [],
    reviewers: [],
  };
}

// 拒绝把任何 referral / settlement / contribution / 内部备注塞进 trial payload。
const TRIAL_PAYLOAD_BLOCKED_KEY_PATTERNS = [
  /referral/i,
  /settlement/i,
  /accrual/i,
  /commission/i,
  /contribution/i,
  /payable/i,
  /payout/i,
  /equity/i,
  /internal[_-]?note/i,
  /sales[_-]?note/i,
];

export function trialInitializationPayloadHasForbiddenKeys(
  payload: Record<string, unknown> | null | undefined,
): string[] {
  if (!payload) return [];
  const violations: string[] = [];
  for (const key of Object.keys(payload)) {
    if (TRIAL_PAYLOAD_BLOCKED_KEY_PATTERNS.some((re) => re.test(key))) {
      violations.push(key);
    }
  }
  return violations;
}
