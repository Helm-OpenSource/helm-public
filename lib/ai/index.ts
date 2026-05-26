import { OpportunityStage, OpportunityType, RiskLevel, ThreadStatus } from "@prisma/client";
import { safeParseJson } from "@/lib/utils";

type BriefMeetingNote = {
  relationshipSummary?: string | null;
  previousConclusion?: string | null;
  meetingGoal?: string | null;
  recommendedQuestions?: string | null;
  riskAlerts?: string | null;
  confirmations?: string | null;
};

type BriefOpportunity = {
  type: OpportunityType;
  stage: OpportunityStage;
  riskLevel: RiskLevel;
  nextAction?: string | null;
};

type BriefingInput = {
  note?: BriefMeetingNote | null;
  opportunity?: BriefOpportunity | null;
  attendees: string[];
};

export function generateMeetingBriefing(input: BriefingInput) {
  const { note, opportunity, attendees } = input;

  return {
    attendees,
    relationshipSummary:
      note?.relationshipSummary ??
      `${attendees.join("、")} 过去 14 天内均有互动，当前关系温度适合推进下一步。`,
    previousConclusion:
      note?.previousConclusion ??
      "上次沟通已明确问题和方向，本次目标是收敛到可执行的下一步。",
    meetingGoal:
      note?.meetingGoal ??
      opportunity?.nextAction ??
      "确认是否进入下一阶段，并为会后动作收口。",
    recommendedQuestions: splitLines(
      note?.recommendedQuestions ??
        "如果本周必须推进一步，最关键的阻力是什么？\n什么信息会帮助你更快做判断？",
    ),
    riskAlerts: splitLines(
      note?.riskAlerts ??
        `${opportunity?.riskLevel === RiskLevel.HIGH || opportunity?.riskLevel === RiskLevel.CRITICAL ? "当前机会风险较高，需要在会后 24 小时内跟进。" : "注意把会议结论转成明确责任人和截止时间。"}`,
    ),
  };
}

export function generatePostMeetingActionSuggestions(args: {
  opportunity?: BriefOpportunity | null;
  note?: BriefMeetingNote | null;
}) {
  const { opportunity, note } = args;
  const base = splitLines(note?.confirmations ?? "整理会后纪要\n确认责任人与截止时间");

  if (!opportunity) return base;

  if (opportunity.type === OpportunityType.RECRUITING) {
    return [
      ...base,
      "生成后续面试安排动作",
      "同步候选人简报给面试官",
    ];
  }

  if (opportunity.type === OpportunityType.CLIENT) {
    return [...base, "发送会后跟进邮件", "根据反馈更新机会阶段"];
  }

  if (opportunity.type === OpportunityType.PARTNERSHIP) {
    return [...base, "发送合作摘要", "确认下一次合作评审会议"];
  }

  return [...base, "同步内部纪要", "收口冲突事项的唯一负责人"];
}

export function generateContactNextSteps(args: {
  contact: {
    name: string;
    relationshipWarmth: "COLD" | "WARM" | "HOT" | "CHAMPION";
  };
  opportunities: Array<{
    type: OpportunityType;
  }>;
  meetingsCount: number;
}) {
  const { contact, opportunities, meetingsCount } = args;
  const mainOpportunity = opportunities[0];

  const suggestions = [
    `${contact.name} 最近 ${meetingsCount > 0 ? "参与了会议" : "未参与新会议"}，建议在 24 小时内完成下一次触达。`,
  ];

  if (mainOpportunity?.type === OpportunityType.RECRUITING) {
    suggestions.push("优先生成候选人/面试 follow-up 草稿，减少流程断档。");
  } else if (mainOpportunity?.type === OpportunityType.CLIENT) {
    suggestions.push("用结果导向语言跟进，不要只复述会议内容。");
  } else if (mainOpportunity?.type === OpportunityType.PARTNERSHIP) {
    suggestions.push("把合作提案压缩成 1 页，让对方更容易内部转述。");
  } else {
    suggestions.push("把关系中的关键约束写进时间线，减少内部信息偏差。");
  }

  if (contact.relationshipWarmth === "COLD") {
    suggestions.push("先降低推进压力，使用轻触达方式恢复联系。");
  }

  return suggestions;
}

export function generateOpportunitySignals(opportunity: BriefOpportunity) {
  const riskHints: string[] = [];

  if (opportunity.riskLevel === RiskLevel.CRITICAL) {
    riskHints.push("这是关键风险事项，需要明确唯一负责人与本周收口时间。");
  }
  if (opportunity.stage === OpportunityStage.WAITING_THEM) {
    riskHints.push("当前在等对方，建议设置 48 小时提醒避免空转。");
  }
  if (opportunity.stage === OpportunityStage.INTERNAL_SYNC) {
    riskHints.push("内部协同是阻塞点，先解决内部对齐再对外推进。");
  }
  if (opportunity.stage === OpportunityStage.LOST) {
    riskHints.push("建议记录流失原因并保留再激活条件。");
  }

  const suggestedStage =
    opportunity.stage === OpportunityStage.CONTACTED && opportunity.riskLevel !== RiskLevel.HIGH
      ? OpportunityStage.ADVANCING
      : opportunity.stage === OpportunityStage.ADVANCING && opportunity.riskLevel === RiskLevel.MEDIUM
        ? OpportunityStage.WAITING_THEM
        : opportunity.stage;

  return {
    riskHints,
    suggestedStage,
    nextMove:
      opportunity.type === OpportunityType.CLIENT
        ? "优先输出一封结构化跟进，再安排内部资源确认。"
        : opportunity.type === OpportunityType.RECRUITING
          ? "把面试安排和候选人体验视为同一条推进链路。"
          : opportunity.type === OpportunityType.PARTNERSHIP
            ? "先收口合作边界，再讨论渠道扩展。"
            : "先做优先级裁决，再通知相关责任人。",
  };
}

export function generateThreadAnalysis(args: {
  thread: {
    subject: string;
    status: ThreadStatus;
    waitingOn?: string | null;
    opportunityId?: string | null;
  };
  messages: Array<{
    body: string;
    isInbound: boolean;
  }>;
  opportunity?: BriefOpportunity | null;
}) {
  const { thread, messages, opportunity } = args;
  const last = messages[messages.length - 1];
  const lastInbound = [...messages].reverse().find((message) => message.isInbound);
  const shouldUpgrade =
    !thread.opportunityId && ["合作", "试点", "面试", "评估"].some((keyword) => thread.subject.includes(keyword));

  const status =
    thread.status === ThreadStatus.WAITING_US
      ? "线程已进入待我方动作状态。"
      : thread.status === ThreadStatus.WAITING_THEM
        ? "当前在等待对方回应。"
        : "线程仍处于开放状态，需要判断是否升级为正式机会。";

  const waitingOn =
    thread.waitingOn ?? (last?.isInbound ? "我方" : "对方");

  const draftGuide =
    opportunity?.type === OpportunityType.RECRUITING
      ? "用清晰时间窗口和面试目标回复。"
      : opportunity?.type === OpportunityType.CLIENT
        ? "回复里要强调价值和下一步，而不是只确认收到。"
        : "给出明确下一步和责任人。";

  return {
    status,
    waitingOn,
    recommendedAction: lastInbound ? `优先回应“${trimText(lastInbound.body, 28)}”这一点。` : "补一条收口消息。",
    draftGuide,
    shouldUpgrade,
  };
}

export function parseWorkspaceList(value?: string | null) {
  return safeParseJson<string[]>(value, []);
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function trimText(value: string, max = 40) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
