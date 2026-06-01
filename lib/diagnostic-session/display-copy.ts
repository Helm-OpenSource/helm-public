import type {
  DiagnosticSessionStatus,
  FirstLoopType,
} from "./types";

export function formatFirstLoopTypeLabel(value: FirstLoopType, english: boolean) {
  switch (value) {
    case "LEAD_FOLLOW_UP":
      return english ? "Lead follow-up" : "线索跟进";
    case "CUSTOMER_REVIEW":
      return english ? "Customer review" : "客户复盘";
    case "DELIVERY_RISK":
      return english ? "Delivery risk" : "交付风险";
    case "OPPORTUNITY_JUDGEMENT":
      return english ? "Opportunity judgement" : "机会判断";
    case "RENEWAL_EXPANSION":
      return english ? "Renewal / expansion" : "续费 / 扩容";
    case "OTHER":
      return english ? "Other" : "其他";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function formatDiagnosticSessionStatusLabel(
  value: DiagnosticSessionStatus,
  english: boolean,
) {
  switch (value) {
    case "DRAFT":
      return english ? "Draft" : "草稿";
    case "REVIEWED":
      return english ? "Reviewed" : "已复核";
    case "FIRST_LOOP_SELECTED":
      return english ? "First loop selected" : "已选定首个闭环";
    case "BLOCKED":
      return english ? "Blocked" : "被阻塞";
    case "SUPERSEDED":
      return english ? "Superseded" : "已被新版本替代";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export type DiagnosticSessionBadgeVariant =
  | "neutral"
  | "info"
  | "approval"
  | "warning"
  | "success"
  | "danger";

export function formatDiagnosticSessionStatusBadgeVariant(
  status: DiagnosticSessionStatus,
): DiagnosticSessionBadgeVariant {
  switch (status) {
    case "DRAFT":
      return "info";
    case "REVIEWED":
      return "approval";
    case "FIRST_LOOP_SELECTED":
      return "success";
    case "BLOCKED":
      return "warning";
    case "SUPERSEDED":
      return "neutral";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
