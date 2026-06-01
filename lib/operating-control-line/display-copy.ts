import type {
  OperatingControlLineCandidateEvidenceReadiness,
  OperatingControlLineCandidateStatus,
  OperatingControlLineCandidateTemplate,
} from "./types";

export function formatControlLineTemplateLabel(
  value: OperatingControlLineCandidateTemplate,
  english: boolean,
) {
  switch (value) {
    case "LEAD_FOLLOW_UP":
      return english ? "Lead follow-up" : "线索跟进控制线";
    case "CUSTOMER_REVIEW":
      return english ? "Customer review" : "客户复盘控制线";
    case "DELIVERY_RISK":
      return english ? "Delivery risk" : "交付风险控制线";
    case "OPPORTUNITY_JUDGEMENT":
      return english ? "Opportunity judgement" : "机会判断控制线";
    case "RENEWAL_EXPANSION":
      return english ? "Renewal / expansion" : "续费 / 扩容控制线";
    case "OTHER":
      return english ? "Other" : "其他";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function formatEvidenceReadinessLabel(
  value: OperatingControlLineCandidateEvidenceReadiness,
  english: boolean,
) {
  switch (value) {
    case "DECLARED":
      return english ? "Declared (hypothesis)" : "声明 · 待证实";
    case "PARTIAL":
      return english ? "Partial sample" : "部分样本";
    case "READY":
      return english ? "Evidence ready" : "证据就绪";
    case "VERIFIED":
      return english ? "Verified" : "已复核确认";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function formatControlLineStatusLabel(
  value: OperatingControlLineCandidateStatus,
  english: boolean,
) {
  switch (value) {
    case "DRAFT":
      return english ? "Draft" : "草稿";
    case "EVIDENCE_NEEDED":
      return english ? "Evidence needed" : "需补证据";
    case "REVIEW_REQUIRED":
      return english ? "Review required" : "需人工复核";
    case "TRIAL_PREMISE":
      return english ? "Trial premise accepted" : "已作为试用前提";
    case "REJECTED":
      return english ? "Rejected" : "已拒绝";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export type OperatingControlLineCandidateBadgeVariant =
  | "neutral"
  | "info"
  | "approval"
  | "warning"
  | "success"
  | "danger";

export function formatControlLineStatusBadgeVariant(
  status: OperatingControlLineCandidateStatus,
): OperatingControlLineCandidateBadgeVariant {
  switch (status) {
    case "DRAFT":
      return "info";
    case "EVIDENCE_NEEDED":
      return "warning";
    case "REVIEW_REQUIRED":
      return "approval";
    case "TRIAL_PREMISE":
      return "success";
    case "REJECTED":
      return "danger";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function formatEvidenceReadinessBadgeVariant(
  value: OperatingControlLineCandidateEvidenceReadiness,
): OperatingControlLineCandidateBadgeVariant {
  switch (value) {
    case "DECLARED":
      return "neutral";
    case "PARTIAL":
      return "warning";
    case "READY":
      return "approval";
    case "VERIFIED":
      return "success";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}
