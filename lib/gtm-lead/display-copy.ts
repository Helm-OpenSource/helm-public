import type {
  GtmLeadIcpFit,
  GtmLeadReadinessStage,
  GtmLeadSourceType,
  GtmLeadStage,
} from "./types";

export function formatGtmLeadSourceTypeLabel(
  value: GtmLeadSourceType,
  english: boolean,
) {
  switch (value) {
    case "COLD_OUTREACH":
      return english ? "Cold outreach" : "陌生触达";
    case "INBOUND_FORM":
      return english ? "Inbound form" : "表单进线";
    case "REFERRAL":
      return english ? "Referral" : "客户/伙伴转介绍";
    case "PARTNER":
      return english ? "Partner" : "渠道合作伙伴";
    case "EVENT":
      return english ? "Event" : "活动/路演";
    case "COMMUNITY":
      return english ? "Community" : "社群";
    case "CONTENT":
      return english ? "Content" : "内容触达";
    case "OTHER":
      return english ? "Other" : "其他";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function formatGtmLeadIcpFitLabel(
  value: GtmLeadIcpFit,
  english: boolean,
) {
  switch (value) {
    case "STRONG":
      return english ? "Strong fit" : "强匹配";
    case "MEDIUM":
      return english ? "Medium fit" : "中匹配";
    case "WEAK":
      return english ? "Weak fit" : "弱匹配";
    case "UNKNOWN":
      return english ? "Unknown" : "待判断";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function formatGtmLeadReadinessStageLabel(
  value: GtmLeadReadinessStage,
  english: boolean,
) {
  switch (value) {
    case "UNKNOWN":
      return english ? "Readiness unknown" : "可行性待评估";
    case "EXPLORING":
      return english ? "Exploring" : "在了解 Helm";
    case "PILOT_READY":
      return english ? "Pilot ready" : "可启动试点";
    case "TRIAL_IN_PROGRESS":
      return english ? "Trial in progress" : "试点进行中";
    case "POST_TRIAL":
      return english ? "Post-trial" : "试点后续";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function formatGtmLeadStageLabel(
  value: GtmLeadStage,
  english: boolean,
) {
  switch (value) {
    case "CAPTURED":
      return english ? "Captured" : "已记录";
    case "QUALIFIED":
      return english ? "Qualified" : "已认定";
    case "GUIDED_INTAKE":
      return english ? "Guided intake" : "引导式收集中";
    case "DEMAND_BRIEF_READY":
      return english ? "Demand brief ready" : "需求简报就绪";
    case "CUSTOMER_CONFIRMATION_PENDING":
      return english ? "Customer confirmation pending" : "等待客户确认";
    case "TRIAL_INITIALIZATION_READY":
      return english ? "Trial init ready" : "试用初始化就绪";
    case "FIRST_LOOP_PROPOSED":
      return english ? "First loop proposed" : "第一条闭环已提案";
    case "FIRST_LOOP_ACTIVE":
      return english ? "First loop active" : "第一条闭环运行中";
    case "PROOF_READY":
      return english ? "Proof ready" : "证据包就绪";
    case "CONVERTED":
      return english ? "Converted" : "已转化";
    case "NURTURED":
      return english ? "Nurtured" : "持续培育中";
    case "LOST":
      return english ? "Lost" : "已流失";
    case "DISQUALIFIED":
      return english ? "Disqualified" : "判定不匹配";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export type GtmLeadStageBadgeVariant =
  | "neutral"
  | "info"
  | "approval"
  | "warning"
  | "success"
  | "danger";

export function formatGtmLeadStageBadgeVariant(
  stage: GtmLeadStage,
): GtmLeadStageBadgeVariant {
  switch (stage) {
    case "CAPTURED":
    case "QUALIFIED":
    case "GUIDED_INTAKE":
      return "info";
    case "DEMAND_BRIEF_READY":
    case "CUSTOMER_CONFIRMATION_PENDING":
    case "TRIAL_INITIALIZATION_READY":
    case "FIRST_LOOP_PROPOSED":
      return "approval";
    case "FIRST_LOOP_ACTIVE":
    case "PROOF_READY":
      return "warning";
    case "CONVERTED":
      return "success";
    case "NURTURED":
      return "neutral";
    case "LOST":
    case "DISQUALIFIED":
      return "danger";
    default: {
      const exhaustive: never = stage;
      return exhaustive;
    }
  }
}
