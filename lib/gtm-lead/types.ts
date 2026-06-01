// GTMLead — V2.3 §7.1 的 product-level 起点对象。
//
// 边界（永久保留）：
// - reserved-only：只允许在 Helm reserved workspace 内可见、写入；不替代普通客户租户的 CRM；
// - recommendation ≠ commitment：next action / blocker / stage 都是判断快照，不构成承诺；
// - 永远不自动外发：所有客户可见动作都需要人工授权后才能进入 trial workspace；
// - 不带 referral / settlement / contribution 字段；这些进入后续 Contribution 链路。

import type {
  GtmLeadIcpFit,
  GtmLeadReadinessStage,
  GtmLeadSourceType,
  GtmLeadStage,
} from "@prisma/client";

export type {
  GtmLeadIcpFit,
  GtmLeadReadinessStage,
  GtmLeadSourceType,
  GtmLeadStage,
};

export const GTM_LEAD_SOURCE_TYPES = [
  "COLD_OUTREACH",
  "INBOUND_FORM",
  "REFERRAL",
  "PARTNER",
  "EVENT",
  "COMMUNITY",
  "CONTENT",
  "OTHER",
] as const satisfies readonly GtmLeadSourceType[];

export const GTM_LEAD_ICP_FITS = [
  "STRONG",
  "MEDIUM",
  "WEAK",
  "UNKNOWN",
] as const satisfies readonly GtmLeadIcpFit[];

export const GTM_LEAD_READINESS_STAGES = [
  "UNKNOWN",
  "EXPLORING",
  "PILOT_READY",
  "TRIAL_IN_PROGRESS",
  "POST_TRIAL",
] as const satisfies readonly GtmLeadReadinessStage[];

// V2.3 §8.1 完整状态机；从 CAPTURED 起步，按 review-first 推进。
export const GTM_LEAD_STAGES = [
  "CAPTURED",
  "QUALIFIED",
  "GUIDED_INTAKE",
  "DEMAND_BRIEF_READY",
  "CUSTOMER_CONFIRMATION_PENDING",
  "TRIAL_INITIALIZATION_READY",
  "FIRST_LOOP_PROPOSED",
  "FIRST_LOOP_ACTIVE",
  "PROOF_READY",
  "CONVERTED",
  "NURTURED",
  "LOST",
  "DISQUALIFIED",
] as const satisfies readonly GtmLeadStage[];

export type GtmLeadRecord = {
  id: string;
  workspaceId: string;
  leadKey: string;
  sourceType: GtmLeadSourceType;
  sourceRef: string | null;
  referrerMembershipId: string | null;
  companyName: string;
  industry: string | null;
  icpFit: GtmLeadIcpFit;
  readinessStage: GtmLeadReadinessStage;
  ownerMembershipId: string | null;
  stage: GtmLeadStage;
  nextAction: string | null;
  blocker: string | null;
  evidenceRefs: string[];          // 反序列化好的字符串数组
  internalNotes: string | null;
  createdAt: string;               // ISO
  updatedAt: string;               // ISO
};

export type GtmLeadCreateInput = {
  workspaceId: string;
  leadKey: string;
  sourceType: GtmLeadSourceType;
  sourceRef?: string | null;
  referrerMembershipId?: string | null;
  companyName: string;
  industry?: string | null;
  icpFit?: GtmLeadIcpFit;
  readinessStage?: GtmLeadReadinessStage;
  ownerMembershipId?: string | null;
  stage?: GtmLeadStage;
  nextAction?: string | null;
  blocker?: string | null;
  evidenceRefs?: readonly string[];
  internalNotes?: string | null;
};

export type GtmLeadUpdateInput = {
  stage?: GtmLeadStage;
  icpFit?: GtmLeadIcpFit;
  readinessStage?: GtmLeadReadinessStage;
  ownerMembershipId?: string | null;
  nextAction?: string | null;
  blocker?: string | null;
  evidenceRefs?: readonly string[];
  internalNotes?: string | null;
};

// V2.3 §8.1 Lead Flow 推进规则。
// 这里只声明"哪些过渡是允许的"，不做自动推进；任何 transition 都必须经过人工或 review-first
// 的 action（actions.ts 在调用时会校验）。
export const GTM_LEAD_STAGE_TRANSITIONS: Record<GtmLeadStage, readonly GtmLeadStage[]> = {
  CAPTURED: ["QUALIFIED", "NURTURED", "LOST", "DISQUALIFIED"],
  QUALIFIED: ["GUIDED_INTAKE", "NURTURED", "LOST", "DISQUALIFIED"],
  GUIDED_INTAKE: [
    "DEMAND_BRIEF_READY",
    "NURTURED",
    "LOST",
    "DISQUALIFIED",
  ],
  DEMAND_BRIEF_READY: [
    "CUSTOMER_CONFIRMATION_PENDING",
    "NURTURED",
    "LOST",
    "DISQUALIFIED",
  ],
  CUSTOMER_CONFIRMATION_PENDING: [
    "TRIAL_INITIALIZATION_READY",
    "DEMAND_BRIEF_READY",        // 客户改写关键字段 → 回到 brief 重审
    "NURTURED",
    "LOST",
    "DISQUALIFIED",
  ],
  TRIAL_INITIALIZATION_READY: [
    "FIRST_LOOP_PROPOSED",
    "CUSTOMER_CONFIRMATION_PENDING", // 试用前提变化时回退
    "NURTURED",
    "LOST",
  ],
  FIRST_LOOP_PROPOSED: ["FIRST_LOOP_ACTIVE", "LOST", "NURTURED"],
  FIRST_LOOP_ACTIVE: ["PROOF_READY", "LOST", "NURTURED"],
  PROOF_READY: ["CONVERTED", "NURTURED", "LOST"],
  CONVERTED: [],                  // terminal
  NURTURED: ["QUALIFIED", "LOST", "DISQUALIFIED"], // 重新激活路径
  LOST: ["NURTURED"],
  DISQUALIFIED: [],               // terminal
};

export function isValidGtmLeadStageTransition(
  from: GtmLeadStage,
  to: GtmLeadStage,
) {
  if (from === to) return true;
  return GTM_LEAD_STAGE_TRANSITIONS[from].includes(to);
}
