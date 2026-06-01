import type {
  CustomerDemandBriefCustomerConfirmationStatus,
  CustomerDemandBriefEntryMode,
  CustomerDemandBriefReviewStatus,
} from "./types";

export function formatCustomerDemandBriefEntryModeLabel(
  value: CustomerDemandBriefEntryMode,
  english: boolean,
) {
  switch (value) {
    case "SALES_LED":
      return english ? "Sales-led" : "销售预填";
    case "SELF_SERVE":
      return english ? "Self-serve" : "客户自助";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function formatCustomerDemandBriefReviewStatusLabel(
  value: CustomerDemandBriefReviewStatus,
  english: boolean,
) {
  switch (value) {
    case "DRAFT":
      return english ? "Draft" : "草稿";
    case "REVIEW_REQUIRED":
      return english ? "Review required" : "等待人工复核";
    case "APPROVED_FOR_TRIAL_INIT":
      return english ? "Approved for trial init" : "已复核 · 可进入试用初始化";
    case "REJECTED":
      return english ? "Rejected" : "已拒绝";
    case "SUPERSEDED":
      return english ? "Superseded" : "已被新版本替代";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function formatCustomerDemandBriefCustomerConfirmationStatusLabel(
  value: CustomerDemandBriefCustomerConfirmationStatus,
  english: boolean,
) {
  switch (value) {
    case "NOT_INVITED":
      return english ? "Customer not invited" : "尚未邀请客户确认";
    case "PENDING_CUSTOMER":
      return english ? "Pending customer" : "等待客户回复";
    case "PARTIAL_CONFIRMED":
      return english ? "Partially confirmed" : "客户部分确认";
    case "FULLY_CONFIRMED":
      return english ? "Fully confirmed" : "客户已完全确认";
    case "CHANGE_REQUESTED":
      return english ? "Change requested" : "客户提出变更请求";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export type CustomerDemandBriefStatusBadgeVariant =
  | "neutral"
  | "info"
  | "approval"
  | "warning"
  | "success"
  | "danger";

export function formatCustomerDemandBriefReviewStatusBadgeVariant(
  status: CustomerDemandBriefReviewStatus,
): CustomerDemandBriefStatusBadgeVariant {
  switch (status) {
    case "DRAFT":
      return "info";
    case "REVIEW_REQUIRED":
      return "warning";
    case "APPROVED_FOR_TRIAL_INIT":
      return "success";
    case "REJECTED":
      return "danger";
    case "SUPERSEDED":
      return "neutral";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function formatCustomerDemandBriefCustomerConfirmationBadgeVariant(
  status: CustomerDemandBriefCustomerConfirmationStatus,
): CustomerDemandBriefStatusBadgeVariant {
  switch (status) {
    case "NOT_INVITED":
      return "neutral";
    case "PENDING_CUSTOMER":
      return "info";
    case "PARTIAL_CONFIRMED":
      return "approval";
    case "FULLY_CONFIRMED":
      return "success";
    case "CHANGE_REQUESTED":
      return "warning";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
