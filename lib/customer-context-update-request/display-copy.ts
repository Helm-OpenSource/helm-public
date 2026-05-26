import type {
  CustomerContextUpdateRequestMateriality,
  CustomerContextUpdateRequestOrigin,
  CustomerContextUpdateRequestReviewStatus,
  CustomerContextUpdateRequestScope,
} from "./types";

export function formatCustomerContextUpdateRequestOriginLabel(
  value: CustomerContextUpdateRequestOrigin,
  english: boolean,
) {
  switch (value) {
    case "CUSTOMER":
      return english ? "Customer-initiated" : "客户发起";
    case "INTERNAL":
      return english ? "Internal-initiated" : "内部发起";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function formatCustomerContextUpdateRequestScopeLabel(
  value: CustomerContextUpdateRequestScope,
  english: boolean,
) {
  switch (value) {
    case "ROLES":
      return english ? "Roles / participants" : "角色 / 参与人";
    case "GOALS":
      return english ? "Goals / success criteria" : "目标 / 成功标准";
    case "RESOURCES":
      return english ? "Resources" : "现有资源";
    case "CONTROL_LINE":
      return english ? "Control line" : "控制线";
    case "TRIAL_PAYLOAD":
      return english ? "Trial payload" : "试用初始化载荷";
    case "OTHER":
      return english ? "Other" : "其他";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function formatCustomerContextUpdateRequestMaterialityLabel(
  value: CustomerContextUpdateRequestMateriality,
  english: boolean,
) {
  switch (value) {
    case "MINOR":
      return english ? "Minor" : "次要变更";
    case "MATERIAL":
      return english ? "Material (review required)" : "重大变更 · 需复核";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function formatCustomerContextUpdateRequestReviewStatusLabel(
  value: CustomerContextUpdateRequestReviewStatus,
  english: boolean,
) {
  switch (value) {
    case "DIRECT_APPLY":
      return english ? "Applied directly" : "已直接生效";
    case "REVIEW_REQUIRED":
      return english ? "Review required" : "等待人工复核";
    case "ACCEPTED":
      return english ? "Accepted" : "已接受";
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

export type CustomerContextUpdateRequestBadgeVariant =
  | "neutral"
  | "info"
  | "approval"
  | "warning"
  | "success"
  | "danger";

export function formatCustomerContextUpdateRequestReviewStatusBadgeVariant(
  status: CustomerContextUpdateRequestReviewStatus,
): CustomerContextUpdateRequestBadgeVariant {
  switch (status) {
    case "DIRECT_APPLY":
      return "info";
    case "REVIEW_REQUIRED":
      return "warning";
    case "ACCEPTED":
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

export function formatCustomerContextUpdateRequestMaterialityBadgeVariant(
  materiality: CustomerContextUpdateRequestMateriality,
): CustomerContextUpdateRequestBadgeVariant {
  switch (materiality) {
    case "MINOR":
      return "neutral";
    case "MATERIAL":
      return "warning";
    default: {
      const exhaustive: never = materiality;
      return exhaustive;
    }
  }
}
