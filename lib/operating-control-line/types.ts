// OperatingControlLineCandidate — V2.3 §7.4 Phase 3 关键转译层。
//
// 这一层回答：客户痛点 + 现有资源 + 初步证据，能否转成一条"可验证 / 可复核 /
// 可初始化试用"的经营改善控制线候选。
//
// 永久边界（V2.3 §10.8 Pain is not Evidence）：
//   1. 客户口头痛点默认是 hypothesis，永不直接当事实；
//   2. 销售收集的现有资源默认是 declared resource，不代表 connected resource；
//   3. 只有客户确认 / 系统样本 / 导出数据 / 会议记录 / 表格 / 截图 / 文档 /
//      人工复核能让 evidenceReadiness 进入 VERIFIED；
//   4. 没有 evidence 的控制线只能停留在 DRAFT / EVIDENCE_NEEDED；
//   5. 资源证据冲突或过期时必须降级为 REVIEW_REQUIRED 或停留在 EVIDENCE_NEEDED，
//      不得直接进入 TRIAL_PREMISE。
//
// 第二阶段字段（V2.3 §7.4 Phase 4/5 延后）：missingEvidence /
// helmJudgementScope / humanReviewRequirement / manualActionPlan /
// verificationSignal / nonCommitmentNotes。

import type {
  OperatingControlLineCandidateEvidenceReadiness,
  OperatingControlLineCandidateStatus,
  OperatingControlLineCandidateTemplate,
} from "@prisma/client";

export type {
  OperatingControlLineCandidateEvidenceReadiness,
  OperatingControlLineCandidateStatus,
  OperatingControlLineCandidateTemplate,
};

export const OPERATING_CONTROL_LINE_TEMPLATES = [
  "LEAD_FOLLOW_UP",
  "CUSTOMER_REVIEW",
  "DELIVERY_RISK",
  "OPPORTUNITY_JUDGEMENT",
  "RENEWAL_EXPANSION",
  "OTHER",
] as const satisfies readonly OperatingControlLineCandidateTemplate[];

export const OPERATING_CONTROL_LINE_EVIDENCE_READINESS_LEVELS = [
  "DECLARED",
  "PARTIAL",
  "READY",
  "VERIFIED",
] as const satisfies readonly OperatingControlLineCandidateEvidenceReadiness[];

export const OPERATING_CONTROL_LINE_STATUSES = [
  "DRAFT",
  "EVIDENCE_NEEDED",
  "REVIEW_REQUIRED",
  "TRIAL_PREMISE",
  "REJECTED",
] as const satisfies readonly OperatingControlLineCandidateStatus[];

// V2.3 §6.4 control-line templates 的语义说明（caller 端做 UI 时可复用）。
export const CONTROL_LINE_TEMPLATE_META: Record<
  OperatingControlLineCandidateTemplate,
  {
    applicablePainSummaryZh: string;
    typicalResourcesZh: string[];
    successCriteriaHintZh: string;
  }
> = {
  LEAD_FOLLOW_UP: {
    applicablePainSummaryZh: "线索跟进混乱 / 转化低",
    typicalResourcesZh: ["CRM", "表格", "企业微信", "销售记录"],
    successCriteriaHintZh: "跟进完成率、下一步明确率",
  },
  CUSTOMER_REVIEW: {
    applicablePainSummaryZh: "客户复盘缺失 / 流失风险",
    typicalResourcesZh: ["CRM", "会议", "邮件", "服务记录"],
    successCriteriaHintZh: "风险是否确认、行动是否落地",
  },
  DELIVERY_RISK: {
    applicablePainSummaryZh: "交付不稳定 / 责任不清",
    typicalResourcesZh: ["项目表", "工单", "聊天记录"],
    successCriteriaHintZh: "阻塞是否解除、责任人是否明确",
  },
  OPPORTUNITY_JUDGEMENT: {
    applicablePainSummaryZh: "销售机会判断不准",
    typicalResourcesZh: ["商机", "沟通记录", "报价材料"],
    successCriteriaHintZh: "阶段是否更新、下一步是否明确",
  },
  RENEWAL_EXPANSION: {
    applicablePainSummaryZh: "续费扩容机会被遗漏",
    typicalResourcesZh: ["合同", "使用记录", "客户反馈"],
    successCriteriaHintZh: "是否生成复核结论或方案草案",
  },
  OTHER: {
    applicablePainSummaryZh: "通用 / 未归类",
    typicalResourcesZh: [],
    successCriteriaHintZh: "由人工指定",
  },
};

export type OperatingControlLineCandidateEvidenceNote = {
  ts: string;                              // ISO timestamp
  origin: "sales_intake" | "customer_confirmation" | "internal_review";
  actor: string;
  beforeReadiness: OperatingControlLineCandidateEvidenceReadiness;
  afterReadiness: OperatingControlLineCandidateEvidenceReadiness;
  note: string;
};

export type OperatingControlLineCandidateRecord = {
  id: string;
  workspaceId: string;
  briefId: string;
  candidateKey: string;
  painTag: string;
  controlLineTemplate: OperatingControlLineCandidateTemplate;
  targetBusinessObject: string;
  resourceInputs: string[];                // 简化：单层 tag 列表
  evidenceReadiness: OperatingControlLineCandidateEvidenceReadiness;
  status: OperatingControlLineCandidateStatus;
  evidenceNotes: OperatingControlLineCandidateEvidenceNote[];
  reviewerNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OperatingControlLineCandidateCreateInput = {
  workspaceId: string;
  briefId: string;
  candidateKey: string;
  painTag: string;
  controlLineTemplate: OperatingControlLineCandidateTemplate;
  targetBusinessObject: string;
  resourceInputs?: readonly string[];
  // 创建时只能 DECLARED 起步（V2.3 §10.8：销售收集的资源默认是 declared）。
  // 提升 evidenceReadiness 必须经过 updateEvidenceReadiness（带 actor + note）。
};

// V2.3 §6.4 evidence readiness 状态机：单调递增 + 可降级。
// VERIFIED 不可降级到 DECLARED/PARTIAL（这会丢失人工复核的信号）；只能转入 status=REVIEW_REQUIRED
// 表示需要重审，readiness 字段本身保留为最后已知值。
export const EVIDENCE_READINESS_TRANSITIONS: Record<
  OperatingControlLineCandidateEvidenceReadiness,
  readonly OperatingControlLineCandidateEvidenceReadiness[]
> = {
  DECLARED: ["PARTIAL", "READY", "VERIFIED"],
  PARTIAL: ["DECLARED", "READY", "VERIFIED"],            // 资源样本被否决可回到 DECLARED
  READY: ["PARTIAL", "VERIFIED"],
  VERIFIED: ["READY"],                                    // 仅允许有保留的撤回 verified
};

export function isValidEvidenceReadinessTransition(
  from: OperatingControlLineCandidateEvidenceReadiness,
  to: OperatingControlLineCandidateEvidenceReadiness,
) {
  if (from === to) return true;
  return EVIDENCE_READINESS_TRANSITIONS[from].includes(to);
}

// V2.3 §8.4 status 状态机（PAIN → CONTROL LINE）。
// TRIAL_PREMISE 只能从 REVIEW_REQUIRED 进入；任何其他路径都不允许直接跳 TRIAL_PREMISE。
export const CONTROL_LINE_STATUS_TRANSITIONS: Record<
  OperatingControlLineCandidateStatus,
  readonly OperatingControlLineCandidateStatus[]
> = {
  DRAFT: ["EVIDENCE_NEEDED", "REVIEW_REQUIRED", "REJECTED"],
  EVIDENCE_NEEDED: ["DRAFT", "REVIEW_REQUIRED", "REJECTED"],
  REVIEW_REQUIRED: ["EVIDENCE_NEEDED", "TRIAL_PREMISE", "REJECTED", "DRAFT"],
  TRIAL_PREMISE: ["REVIEW_REQUIRED", "REJECTED"],         // 试用前提变化时回到 review
  REJECTED: ["DRAFT"],                                    // 销售可补正
};

export function isValidControlLineStatusTransition(
  from: OperatingControlLineCandidateStatus,
  to: OperatingControlLineCandidateStatus,
) {
  if (from === to) return true;
  return CONTROL_LINE_STATUS_TRANSITIONS[from].includes(to);
}

// V2.3 §10.8 硬约束：只有 VERIFIED 证据才能进 TRIAL_PREMISE。
// EVIDENCE_NEEDED 状态下，无论 caller 如何要求，trial premise 不可达。
export function canEnterTrialPremise(
  evidenceReadiness: OperatingControlLineCandidateEvidenceReadiness,
  nextStatus: OperatingControlLineCandidateStatus,
) {
  if (nextStatus !== "TRIAL_PREMISE") return true;
  return evidenceReadiness === "VERIFIED";
}
