import type { BusinessAssetType } from "@/features/business-assets/hrefs";

export type BusinessAssetJudgementChain = {
  signal: string;
  judgement: string;
  action: string;
  review: string;
  learn: string;
};

const ENGLISH_BUSINESS_ASSET_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /客户还未明确付款节奏和采购评估顺序，导致方案粒度难以最终收口。/g,
    "Customer has not clarified the payment cadence or procurement evaluation order, so proposal scope cannot be closed yet.",
  ],
  [
    /Acme 当前更关心付款周期和采购节奏，而不是一次性总价。/g,
    "Acme is more focused on payment cadence and procurement rhythm than one-time total price.",
  ],
  [
    /在下周三前向 Acme 发送结构化方案初稿。/g,
    "Send Acme a clear proposal draft before next Wednesday.",
  ],
  [
    /客户一周没有确认方案/g,
    "Customer has not confirmed the proposal for one week",
  ],
  [/机会正在降温/g, "Opportunity momentum is cooling"],
  [/先补一次确认会议/g, "Schedule a confirmation meeting first"],
  [/这条承诺现在已经变成信任风险/g, "This promise is now a trust risk"],
  [
    /这条承诺仍在影响下一步推进/g,
    "This promise is still shaping the next move",
  ],
  [
    /这条承诺可作为已关闭证据复用/g,
    "This promise can be reused as closed evidence",
  ],
  [
    /这个风险会拖慢或阻断关联经营对象/g,
    "This risk can slow or stop the linked business object",
  ],
  [
    /这个风险已经可见，但还不是主导压力/g,
    "This risk is visible but not yet dominant",
  ],
  [
    /先确认这条承诺今天还能不能兑现。/g,
    "Confirm whether this promise can still be fulfilled today.",
  ],
  [
    /在关闭前，把承诺负责人和截止时间保持可见。/g,
    "Keep the promise owner and due date visible until it is closed.",
  ],
  [
    /把这条承诺作为后续判断依据。/g,
    "Use this promise as evidence for future judgement.",
  ],
  [/客户资产记忆/g, "customer asset memory"],
  [/机会资产记忆/g, "opportunity asset memory"],
  [/承诺履约记录/g, "promise fulfillment history"],
  [/风险处理记录/g, "risk handling history"],
];

export function formatBusinessAssetDisplayText(
  value: string | null | undefined,
  english: boolean,
) {
  const text = value ?? "";
  if (!text || !english) return text;

  return ENGLISH_BUSINESS_ASSET_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  ).trim();
}

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
  const signal = formatBusinessAssetDisplayText(input.signal, input.english);
  const judgement = formatBusinessAssetDisplayText(
    input.judgement,
    input.english,
  );
  const action = formatBusinessAssetDisplayText(input.action, input.english);
  const learningTarget = formatBusinessAssetDisplayText(
    input.learningTarget,
    input.english,
  );

  if (input.english) {
    return {
      signal: `Signal seen: ${signal}`,
      judgement: `Current judgement: ${judgement}`,
      action: `Recommended move: ${action}`,
      review: input.needsReview
        ? "Human review is required before this becomes an external move."
        : "Safe to prepare as a draft; external commitment still needs confirmation.",
      learn: `After handling, the result should write back to ${learningTarget}.`,
    };
  }

  return {
    signal: `看见信号：${signal}`,
    judgement: `当前判断：${judgement}`,
    action: `建议动作：${action}`,
    review: input.needsReview
      ? "需要人工复核后，才能进入对外动作。"
      : "可以先准备草稿；形成对外承诺前仍要确认。",
    learn: `处理结果会写回：${learningTarget}。`,
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
