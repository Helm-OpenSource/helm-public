import type {
  OperatingSignalQualityGrade,
  OperatingSignalQualitySubjectKind,
} from "./types";

// 双语 label 集中表。
// 保持 reserved-only 边界口径：评估快照、非绩效合约、非结算依据、AI 输出归人类。

export type OperatingSignalQualityScoreDimension =
  | "delivery"
  | "signal"
  | "readiness"
  | "collaboration"
  | "noise"
  | "prInflation";

export function formatOperatingSignalQualityGradeLabel(
  grade: OperatingSignalQualityGrade,
  english: boolean,
) {
  switch (grade) {
    case "high_value":
      return english ? "High value" : "高价值";
    case "useful":
      return english ? "Useful" : "有用";
    case "weak":
      return english ? "Weak" : "偏弱";
    case "harmful":
      return english ? "Harmful" : "造成干扰";
    default: {
      const exhaustive: never = grade;
      return exhaustive;
    }
  }
}

// 与 Badge variant 对齐（success / approval / warning / danger）；调用方在 UI 层使用。
// 这层不引用 React 也不直接 import Badge，让本文件保持 server / shared 可用。
export type OperatingSignalQualityGradeBadgeVariant =
  | "success"
  | "approval"
  | "warning"
  | "danger";

export function formatOperatingSignalQualityGradeBadgeVariant(
  grade: OperatingSignalQualityGrade,
): OperatingSignalQualityGradeBadgeVariant {
  switch (grade) {
    case "high_value":
      return "success";
    case "useful":
      return "approval";
    case "weak":
      return "warning";
    case "harmful":
      return "danger";
    default: {
      const exhaustive: never = grade;
      return exhaustive;
    }
  }
}

export function formatOperatingSignalQualitySubjectKindLabel(
  kind: OperatingSignalQualitySubjectKind,
  english: boolean,
) {
  switch (kind) {
    case "contributor":
      return english ? "Contributor" : "贡献者";
    case "delivery_batch":
      return english ? "Delivery batch" : "交付批次";
    case "data_source":
      return english ? "Data source" : "数据来源";
    case "operating_signal_source":
      return english ? "Operating signal source" : "经营信号来源";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function formatOperatingSignalQualityDimensionLabel(
  dimension: OperatingSignalQualityScoreDimension,
  english: boolean,
) {
  switch (dimension) {
    case "delivery":
      return english ? "Delivery effect" : "交付效果";
    case "signal":
      return english ? "Signal quality" : "经营信号质量";
    case "readiness":
      return english ? "Operational readiness" : "上线 / 配置 / 初始化";
    case "collaboration":
      return english ? "Collaboration" : "团队协同";
    case "noise":
      return english ? "Noise penalty" : "噪声惩罚";
    case "prInflation":
      return english ? "PR inflation penalty" : "PR 膨胀惩罚";
    default: {
      const exhaustive: never = dimension;
      return exhaustive;
    }
  }
}

// 评估快照非承诺类边界，前后端复用同一份。
export function formatOperatingSignalQualityBoundaryFooter(english: boolean) {
  return english
    ? "Reserved-tenant snapshot only · not a performance contract · not a financial settlement input · AI output is attributed to the human GitHub account."
    : "仅作为保留租户内部评估快照；不是绩效合约，不是结算依据，AI 产出归对应 GitHub 人类账号。";
}

// 用于卡片头部小标记。
export function formatOperatingSignalQualityReadoutHeadline(
  grade: OperatingSignalQualityGrade,
  english: boolean,
) {
  switch (grade) {
    case "high_value":
      return english
        ? "Keep doing this — high signal density, low noise."
        : "继续保持——信号密度高、噪声受控。";
    case "useful":
      return english
        ? "Useful, but noise or readiness is dragging the total down."
        : "总体有用，但噪声或上线准备拖低了总分。";
    case "weak":
      return english
        ? "Weak: too many positives are still missing or noise is creeping in."
        : "偏弱：正面项还没补齐，或者噪声开始拖累。";
    case "harmful":
      return english
        ? "Harmful: noise / misleading signals outweigh whatever volume was produced."
        : "正在造成干扰：噪声与误导信号已经压过产出体量。";
    default: {
      const exhaustive: never = grade;
      return exhaustive;
    }
  }
}
