import { ActionType, ObjectType, OpportunityStage, RiskLevel } from "@prisma/client";
import type { RecommendationCandidate, RecommendationEvidence, RecommendationObjectContext } from "@/lib/recommendations/types";

function escalateRiskLevel(current: RiskLevel, next: RiskLevel) {
  const order: Record<RiskLevel, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };

  return order[next] > order[current] ? next : current;
}

function buildContactCandidates(context: RecommendationObjectContext, evidence: RecommendationEvidence) {
  const topBlocker = evidence.blockers[0];
  const overdueCommitment = evidence.commitments.find((item) => item.overdueFlag);
  const topFact = evidence.supportingFacts[0];
  const riskLevel = topBlocker?.severity && topBlocker.severity >= 80 ? RiskLevel.HIGH : context.baseRiskLevel;

  const candidates: RecommendationCandidate[] = [
    {
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      title: `给 ${context.objectLabel} 发结构化跟进`,
      description: overdueCommitment
        ? `先把“${overdueCommitment.title}”补齐，避免关系继续降温。`
        : `把当前进展和下一步收口成一封更清晰的跟进邮件。`,
      aiReason: overdueCommitment
        ? "联系人侧已经出现逾期承诺，优先用明确跟进收回节奏。"
        : "联系人页最容易掉的是跟进节奏，结构化外发比继续停留在备注里更有效。",
      draftContent: `${context.objectLabel} 你好，我把我们最近讨论的重点和下一步建议整理成了更短的一版，方便你快速确认。`,
      resultPreview: "会按策略进入审批或自动执行，并写回联系人时间线与最近互动时间。",
      riskLevel,
      outbound: true,
      usesCommitment: Boolean(overdueCommitment),
      addressesBlocker: false,
      sortHint: "relationship",
    },
    {
      actionType: ActionType.CREATE_MEETING,
      title: `安排与 ${context.objectLabel} 的下一轮同步`,
      description: topBlocker
        ? `通过一场短会集中确认“${topBlocker.title}”怎么解。`
        : "如果关系仍在推进窗口，先占住下一次同步节奏。",
      aiReason: "当问题需要实时澄清时，直接约会比继续来回猜测更稳。",
      metadata: {
        createMeetingTitle: `${context.objectLabel} 后续推进会`,
        agenda: topBlocker ? `集中确认：${topBlocker.title}` : "确认下一步动作和时间窗口",
      },
      resultPreview: "通过后会创建会议占位，并把会议写入联系人与机会时间线。",
      riskLevel: context.baseRiskLevel,
      outbound: false,
      usesCommitment: false,
      addressesBlocker: Boolean(topBlocker),
      sortHint: "control",
    },
    {
      actionType: ActionType.CREATE_TASK,
      title: `为 ${context.objectLabel} 创建内部跟进提醒`,
      description: topFact
        ? `围绕“${topFact.title}”先拆一个内部准备动作，避免下一次接触时还没准备好。`
        : "先把这位联系人的下一步整理成内部待办，避免继续靠人记。",
      aiReason: "先把内部动作拆出来，后续外发和会议安排会更稳。",
      metadata: {
        generatedFrom: "recommendation_engine",
      },
      resultPreview: "动作会写入联系人和机会时间线，用于后续追踪。",
      riskLevel: RiskLevel.LOW,
      outbound: false,
      usesCommitment: false,
      addressesBlocker: Boolean(topBlocker),
      sortHint: "clarity",
    },
  ];

  return candidates;
}

function buildCompanyCandidates(context: RecommendationObjectContext, evidence: RecommendationEvidence) {
  const topBlocker = evidence.blockers[0];
  const overdueCommitment = evidence.commitments.find((item) => item.overdueFlag);

  return [
    {
      actionType: ActionType.CREATE_TASK,
      title: `为 ${context.objectLabel} 发起内部账户复核`,
      description: topBlocker
        ? `先围绕“${topBlocker.title}”组织一次内部对齐。`
        : "整理这家公司当前成熟度、风险和下一步推进分工。",
      aiReason: "公司级视角更适合先做内部对齐，再决定是否外发或升维推进。",
      metadata: {
        generatedFrom: "recommendation_engine",
      },
      resultPreview: "会写入公司时间线，并帮助机会和联系人页保持同一上下文。",
      riskLevel: topBlocker?.severity && topBlocker.severity >= 80 ? RiskLevel.HIGH : context.baseRiskLevel,
      outbound: false,
      usesCommitment: Boolean(overdueCommitment),
      addressesBlocker: Boolean(topBlocker),
      sortHint: "control",
    },
    {
      actionType: ActionType.CREATE_MEETING,
      title: `安排 ${context.objectLabel} 的账户复盘会`,
      description: "通过一次短会集中确认关键人、阻塞与下一轮合作窗口。",
      aiReason: "公司页更适合做账户级复盘，而不是只盯单个联系人。",
      metadata: {
        createMeetingTitle: `${context.objectLabel} Account Review`,
        agenda: "复盘合作成熟度、关键阻塞和下一步推进路径",
      },
      resultPreview: "通过后会创建会议占位，并把关键动作挂回公司与相关机会。",
      riskLevel: context.baseRiskLevel,
      outbound: false,
      usesCommitment: false,
      addressesBlocker: Boolean(topBlocker),
      sortHint: "control",
    },
    {
      actionType: ActionType.DRAFT_INTERNAL_NOTE,
      title: `生成 ${context.objectLabel} 账户简报`,
      description: overdueCommitment
        ? "把逾期承诺、高风险阻塞和当前成熟度压成一页简报。"
        : "先输出一版公司级简报，方便管理者快速判断是否加码推进。",
      aiReason: "对管理者来说，能快速看懂账户成熟度比散落信息更重要。",
      resultPreview: "内部纪要可按策略自动执行，并作为后续简报的依据。",
      riskLevel: RiskLevel.LOW,
      outbound: false,
      usesCommitment: Boolean(overdueCommitment),
      addressesBlocker: Boolean(topBlocker),
      sortHint: "clarity",
    },
  ] satisfies RecommendationCandidate[];
}

function getOpportunityNextStage(stage: string) {
  if (stage === OpportunityStage.NEW) return OpportunityStage.CONTACTED;
  if (stage === OpportunityStage.CONTACTED) return OpportunityStage.ADVANCING;
  if (stage === OpportunityStage.ADVANCING) return OpportunityStage.WAITING_THEM;
  if (stage === OpportunityStage.WAITING_THEM) return OpportunityStage.ADVANCING;
  return OpportunityStage.INTERNAL_SYNC;
}

function buildOpportunityCandidates(context: RecommendationObjectContext, evidence: RecommendationEvidence) {
  const topBlocker = evidence.blockers[0];
  const overdueCommitment = evidence.commitments.find((item) => item.overdueFlag);
  const nextStage = getOpportunityNextStage(context.stageLabel ?? "");
  const messageRisk = escalateRiskLevel(context.baseRiskLevel, overdueCommitment ? RiskLevel.HIGH : RiskLevel.MEDIUM);

  return [
    {
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      title: `发送 ${context.objectLabel} 的下一步跟进`,
      description: overdueCommitment
        ? `先补齐“${overdueCommitment.title}”，避免机会继续降温。`
        : "用一封结构化跟进把下一步动作和时间窗口明确下来。",
      aiReason: "机会停在面板里最大的风险，不是信息不足，而是没有明确外发推进。",
      draftContent: `${context.objectLabel} 相关内容我已经整理成一版更短的推进摘要，想先和你确认下一步与时间安排。`,
      metadata: {
        nextStage,
      },
      resultPreview: "审批通过后会写入时间线，并在条件满足时同步机会阶段。",
      riskLevel: messageRisk,
      outbound: true,
      usesCommitment: Boolean(overdueCommitment),
      addressesBlocker: false,
      sortHint: "speed",
    },
    {
      actionType: ActionType.UPDATE_OPPORTUNITY_STAGE,
      title: `同步 ${context.objectLabel} 当前阶段`,
      description: topBlocker
        ? `先把“${topBlocker.title}”反映到机会阶段和下一步动作里。`
        : "让机会面板和实际推进节奏保持一致。",
      aiReason: "阶段如果不及时同步，后续排序、审批和周报都会失真。",
      metadata: {
        nextStage,
        nextAction: topBlocker ? `先解除阻塞：${topBlocker.title}` : "根据当前推荐推进下一步",
      },
      resultPreview: "通过后会更新机会阶段，并同步时间线和审计记录。",
      riskLevel: context.baseRiskLevel,
      outbound: false,
      usesCommitment: false,
      addressesBlocker: Boolean(topBlocker),
      sortHint: "clarity",
    },
    {
      actionType: ActionType.CREATE_TASK,
      title: `为 ${context.objectLabel} 发起内部协同`,
      description: topBlocker
        ? `先拆一个内部动作去解决“${topBlocker.title}”。`
        : "如果这条机会需要内部资源，先把协同动作拉起来。",
      aiReason: "真正掉单的机会，很多不是没人跟，而是内部没人接住关键阻塞。",
      metadata: {
        generatedFrom: "recommendation_engine",
      },
      resultPreview: "内部协同动作会写入机会与相关对象时间线。",
      riskLevel: topBlocker?.severity && topBlocker.severity >= 70 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
      outbound: false,
      usesCommitment: false,
      addressesBlocker: Boolean(topBlocker),
      sortHint: "control",
    },
    {
      actionType: ActionType.CREATE_MEETING,
      title: `安排 ${context.objectLabel} 的下一轮确认会`,
      description: "如果下一步需要多人确认，用短会比继续来回等待更稳。",
      aiReason: "当阶段已经接近卡顿时，安排下一次确认会通常比继续等待更有效。",
      metadata: {
        createMeetingTitle: `${context.objectLabel} 下一轮确认会`,
        agenda: topBlocker ? `集中确认：${topBlocker.title}` : "确认机会推进条件和下一步节奏",
      },
      resultPreview: "通过后会创建会议占位，并同步机会时间线。",
      riskLevel: context.baseRiskLevel,
      outbound: false,
      usesCommitment: false,
      addressesBlocker: Boolean(topBlocker),
      sortHint: "relationship",
    },
  ] satisfies RecommendationCandidate[];
}

function buildMeetingCandidates(context: RecommendationObjectContext, evidence: RecommendationEvidence) {
  const topBlocker = evidence.blockers[0];
  const topCommitment = evidence.commitments[0];

  return [
    {
      actionType: ActionType.SEND_MEETING_SUMMARY,
      title: `发送《${context.objectLabel}》纪要`,
      description: topCommitment
        ? `把“${topCommitment.title}”和关键结论一起发出去，减少信息流失。`
        : "会后 24 小时内发纪要，最容易把会议变成动作。",
      aiReason: "纪要是会议闭环里最容易被拖延的一步，也是最值得自动化的一步。",
      resultPreview: "会按策略自动执行或进入审批，并同步会议时间线。",
      riskLevel: context.baseRiskLevel,
      outbound: false,
      usesCommitment: Boolean(topCommitment),
      addressesBlocker: false,
      sortHint: "speed",
    },
    {
      actionType: ActionType.CREATE_TASK,
      title: `拆解 ${context.objectLabel} 的会后动作`,
      description: topBlocker
        ? `先围绕“${topBlocker.title}”拆一条明确 动作item。`
        : "让会议结论变成能追踪的后续动作，而不是停在纪要里。",
      aiReason: "会议真正有价值的，不是记录了什么，而是后面有人接着做什么。",
      metadata: {
        generatedFrom: "recommendation_engine",
      },
      resultPreview: "会后动作会根据策略决定是仅建议、审批还是自动执行。",
      riskLevel: context.baseRiskLevel,
      outbound: false,
      usesCommitment: Boolean(topCommitment),
      addressesBlocker: Boolean(topBlocker),
      sortHint: "clarity",
    },
    {
      actionType: ActionType.CREATE_MEETING,
      title: `创建《${context.objectLabel}》后续会议`,
      description: "如果今天结论还没有收口，先把 follow-up 时间占住。",
      aiReason: "很多会议不是信息不够，而是结束后没有下一次明确触点。",
      metadata: {
        createMeetingTitle: `${context.objectLabel} Follow-up`,
        agenda: topBlocker ? `复盘并解决：${topBlocker.title}` : "确认会后动作与下一步节点",
      },
      resultPreview: "会创建后续会议占位，并同步写入会议和机会时间线。",
      riskLevel: context.baseRiskLevel,
      outbound: false,
      usesCommitment: false,
      addressesBlocker: Boolean(topBlocker),
      sortHint: "relationship",
    },
  ] satisfies RecommendationCandidate[];
}

export function getRecommendationCandidates(input: {
  context: RecommendationObjectContext;
  evidence: RecommendationEvidence;
}) {
  const { context, evidence } = input;

  switch (context.objectType) {
    case ObjectType.CONTACT:
      return buildContactCandidates(context, evidence);
    case ObjectType.COMPANY:
      return buildCompanyCandidates(context, evidence);
    case ObjectType.OPPORTUNITY:
      return buildOpportunityCandidates(context, evidence);
    case ObjectType.MEETING:
      return buildMeetingCandidates(context, evidence);
    default:
      return [];
  }
}
