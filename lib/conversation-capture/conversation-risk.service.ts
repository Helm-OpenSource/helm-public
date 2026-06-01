export type ConversationRiskDraft = {
  title: string;
  content: string;
  severity: number;
  sourceSegmentIndexes: number[];
};

const riskPatterns: Array<{
  matcher: RegExp;
  title: string;
  severity: number;
  consequence: string;
}> = [
  {
    matcher: /预算|财务|付款|回款/,
    title: "预算或付款口径仍未收口",
    severity: 82,
    consequence: "如果继续推进方案而不先处理付款与预算口径，机会容易停在内部审批阶段。",
  },
  {
    matcher: /薪资|薪酬|package/,
    title: "薪资预期存在 gap",
    severity: 80,
    consequence: "如果不先对齐薪资边界，候选人推进会很快降温。",
  },
  {
    matcher: /排期|资源|冲突|人手/,
    title: "内部资源或排期存在冲突",
    severity: 78,
    consequence: "如果不先解决内部资源问题，对外承诺很容易失真。",
  },
  {
    matcher: /法务|合同|条款|合规/,
    title: "法务或条款审查会拖慢推进",
    severity: 76,
    consequence: "如果不提前把法务和条款带进来，后续推进会被动延长。",
  },
  {
    matcher: /顾虑|犹豫|担心|不确定|还没拍板/,
    title: "对方仍有未显式收口的顾虑",
    severity: 72,
    consequence: "如果不尽快回应核心顾虑，关系温度和推进意愿都会下滑。",
  },
  {
    matcher: /48小时|24小时|尽快|下周三前|本周内|今天内/,
    title: "存在明确时间窗口压力",
    severity: 74,
    consequence: "如果错过当前时间窗口，后续需要更高成本重新拉回节奏。",
  },
];

export function extractConversationRiskDrafts(lines: string[]) {
  const drafts: ConversationRiskDraft[] = [];

  riskPatterns.forEach((pattern) => {
    const matchedIndexes = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => pattern.matcher.test(line))
      .map(({ index }) => index);

    if (!matchedIndexes.length) {
      return;
    }

    drafts.push({
      title: pattern.title,
      content: pattern.consequence,
      severity: pattern.severity,
      sourceSegmentIndexes: matchedIndexes.slice(0, 3),
    });
  });

  return Array.from(new Map(drafts.map((draft) => [draft.title, draft])).values()).sort((left, right) => right.severity - left.severity);
}

export function buildNoReplyConsequence(input: {
  objectType?: string | null;
  hasHighSeverityRisk: boolean;
  hasOverdueSignal: boolean;
}) {
  if (input.hasHighSeverityRisk) {
    return "这次会话已经暴露出关键阻塞，如果今天不推进，最有可能先失去的是节奏和信任。";
  }

  if (input.hasOverdueSignal) {
    return "这次会话里已经出现明确时限信号，继续拖延会直接把承诺转成逾期。";
  }

  if (input.objectType === "RECRUITING") {
    return "如果不在 24 到 48 小时内推进，候选人很可能转向其他机会。";
  }

  return "如果会后没有明确动作，这次交流很容易停留在纪要里，后续需要更高成本重新推动。";
}
