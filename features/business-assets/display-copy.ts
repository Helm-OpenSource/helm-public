import type { BusinessAssetType } from "@/features/business-assets/hrefs";

export type BusinessAssetJudgementChain = {
  signal: string;
  judgement: string;
  action: string;
  review: string;
  learn: string;
};

export function formatBusinessAssetTypeLabel(
  type: BusinessAssetType,
  english: boolean,
) {
  switch (type) {
    case "customer":
      return english ? "Customer asset" : "客户资产";
    case "opportunity":
      return english ? "Opportunity asset" : "机会资产";
    case "commitment":
      return english ? "Commitment asset" : "承诺资产";
    case "risk":
      return english ? "Risk asset" : "风险资产";
  }
}

export function buildBusinessAssetJudgementChain(input: {
  english: boolean;
  signal: string;
  judgement: string;
  action: string;
  needsReview: boolean;
  learningTarget: string;
}): BusinessAssetJudgementChain {
  if (input.english) {
    return {
      signal: `Signal seen: ${input.signal}`,
      judgement: `Current judgement: ${input.judgement}`,
      action: `Recommended move: ${input.action}`,
      review: input.needsReview
        ? "Human review is required before this becomes an external move."
        : "Safe to prepare as a draft; external commitment still needs confirmation.",
      learn: `After handling, the result should write back to ${input.learningTarget}.`,
    };
  }

  return {
    signal: `看见信号：${input.signal}`,
    judgement: `当前判断：${input.judgement}`,
    action: `建议动作：${input.action}`,
    review: input.needsReview
      ? "需要人工复核后，才能进入对外动作。"
      : "可以先准备草稿；形成对外承诺前仍要确认。",
    learn: `处理结果会写回：${input.learningTarget}。`,
  };
}

export function buildBusinessAssetEmptyCopy(input: {
  type: BusinessAssetType;
  english: boolean;
}) {
  const typeLabel = formatBusinessAssetTypeLabel(input.type, input.english);
  return {
    title: input.english
      ? `${typeLabel} not found`
      : `没有找到这条${typeLabel}`,
    description: input.english
      ? "It may have been removed, moved to another workspace, or not yet connected to this workspace."
      : "它可能已被删除、属于其他工作区，或还没有接入当前工作区。",
  };
}
