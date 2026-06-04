import type {
  ConversationDetailAudienceMode,
  ConversationDetailEvidenceGroup,
  ConversationDetailIntent,
  ConversationDetailMode,
  ConversationDetailReportingContract,
  ConversationDetailRiskSignal,
  ConversationDetailSendabilityMode,
} from "@/lib/presentation/conversation-detail-contract";
import type { PageNextAction } from "@/lib/presentation/reporting-protocol";
import {
  createConversationDetailReportingContract,
} from "@/lib/presentation/conversation-detail-contract";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import { formatConversationRelativeLabel } from "./date-labels";
import { formatRelative, trimText } from "@/lib/utils";

export function buildConversationDetailPageContract({
  detail,
  english,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
}): ConversationDetailReportingContract {
  const signals = summarizeSignals(detail);
  const mode = getConversationMode(detail, signals);
  const audienceMode = getAudienceMode(mode);
  const sendabilityMode = getSendabilityMode(mode);
  const intent = getIntent(mode);
  const riskSignal = mapRiskSignal(detail.riskLevel, signals);

  return createConversationDetailReportingContract({
    conversationDetailJudgement: buildJudgement(mode, sendabilityMode, english),
    conversationDetailJudgementReason:
      detail.briefingSnapshot?.payload.summary ??
      (english
        ? "The current conversation surface already brings active deal pressure, role handoff pressure, boundary notes and the latest usable follow-up context together."
        : "当前这张对话决策面已经把机会压力、角色接力压力、边界备注和最近可用的跟进上下文收在一起。"),
    conversationDetailActionSummary: [
      english
        ? "The current conversation page already separates founder-, sales- and delivery-safe talk tracks."
        : "当前对话页面已经把创始人、销售和交付可用的话术层分开了。",
      signals.pendingApprovalCount
        ? english
          ? `${signals.pendingApprovalCount} approval-sensitive moves still remain open, so conversation wording cannot quietly harden into commitment.`
          : `当前仍有 ${signals.pendingApprovalCount} 条审批敏感动作未收口，所以对话措辞不能悄悄变成承诺。`
        : english
          ? "The current conversation scene, sendability gate and next-step ask are already grouped into one review surface."
          : "当前对话场景、发送评估闸口和下一步请求都已经被收进同一页复核面。",
      english
        ? "You do not need to reconstruct scene, role and boundary from packs first; the current conversation mode is already explicit."
        : "你不需要先从资料里重拼场景、角色和边界；当前对话模式已经说清楚了。",
    ],
    conversationDetailDecisionRequest: [
      english
        ? `Confirm whether this should stay ${labelForMode(mode, true)} or step back into ${fallbackLabel(mode, true)} before the next external move.`
        : `确认当前是继续停在「${labelForMode(mode, false)}」，还是在下一步对外动作前先退回「${fallbackLabel(mode, false)}」。`,
      english
        ? "Confirm whether founder, sales or delivery owns the next spoken move, and whether review-before-send is still required."
        : "确认下一句到底由创始人、销售还是交付接手，以及是否仍必须先发送前复核。",
    ],
    conversationDetailBoundarySummary: [
      english
        ? "Conversation guidance can change emphasis, pacing and scene fit, but it still cannot silently turn discussion-safe wording into commitment."
        : "对话指引可以改变重点、节奏和场景适配，但它仍然不能悄悄把仅讨论措辞变成承诺。",
      buildBoundaryLine(mode, sendabilityMode, english),
      english
        ? "Boundary, prerequisite, dependency and non-commitment cues must stay visible before anyone reuses this wording in a customer-facing moment."
        : "在任何人把这些话复用到客户可见场景前，边界、前置、依赖和非承诺线索都必须继续可见。",
    ],
    conversationDetailEvidenceSummary: [
      english
        ? `${detail.auditLogs.length} audit changes, ${detail.memoryFacts.length} memory facts and the full conversation trace are grouped below without interrupting the main narrative.`
        : `当前 ${detail.auditLogs.length} 条审计变化、${detail.memoryFacts.length} 条经营记忆事实和完整对话轨迹已经分组收在下面，不会打断主叙事。`,
      english
        ? "Replay, audit, memory, worker output, boundary trace, sendability trace, conversation trace, scenario trace and historical changes remain available on demand."
        : "回放、审计、经营记忆、执行输出、边界轨迹、发送评估轨迹、对话轨迹、场景轨迹和历史变更都保留在附注层按需可看。",
    ],
    conversationDetailWorkerSummary: [
      english
        ? "Sales worker keeps first-contact, follow-up and objection-safe wording aligned to the same commercial line."
        : "销售执行会持续把首次接触、跟进和异议安全措辞对齐到同一条商业推进线上。",
      english
        ? "Founder / delivery review keeps trust-sensitive, scope-sensitive and dependency-sensitive phrasing from getting buried."
        : "创始人 / 交付复核会持续防止信任敏感、范围-敏感和依赖-敏感措辞被埋掉。",
    ],
    conversationDetailNextAction: buildNextActions({
      id: detail.id,
      mode,
      english,
    }),
    conversationDetailRiskSignal: riskSignal,
    conversationDetailAudienceMode: audienceMode,
    conversationDetailIntent: intent,
    conversationDetailMode: mode,
    conversationDetailSendabilityMode: sendabilityMode,
    conversationDetailEvidenceGroups: buildEvidenceGroups(
      detail,
      mode,
      sendabilityMode,
      english,
    ),
    conversationDetailFounderCue: buildFounderCue(mode, english),
    conversationDetailSalesCue: buildSalesCue(mode, english),
    conversationDetailDeliveryCue: buildDeliveryCue(mode, english),
    pageWhyItMatters: [
      english
        ? `The opportunity is already in ${detail.stageLabel}, so the next conversation now directly changes trust, pace and whether the chain keeps moving.`
        : `当前机会已经进入「${detail.stageLabel}」窗口，所以下一次对话会直接改变信任、节奏以及这条链能不能继续往前。`,
      signals.openCommitmentCount
        ? english
          ? `${signals.openCommitmentCount} open commitments are still shaping trust pressure, so the next spoken move cannot pretend certainty that has not been earned.`
          : `当前仍有 ${signals.openCommitmentCount} 条开放承诺在塑造信任压力，所以下一句不能假装已经获得了还没被兑现的确定性。`
        : english
          ? "There is room to keep the conversation warm, but only if the wording still keeps the non-commitment and boundary line visible."
          : "当前确实存在继续升温对话的空间，但前提是措辞仍然把非承诺和边界话术挂在前台。",
      english
        ? "The current page already separates founder-, sales- and delivery-safe talk tracks, so the remaining value is choosing the right scene, not rediscovering context."
        : "当前页已经把创始人、销售和交付可用的话术层分开了，所以现在真正的价值在于选对场景，而不是重新拼上下文。",
    ],
    pageEscalationHint:
      sendabilityMode === "review-before-send" ||
      sendabilityMode === "not-ready-for-customer"
        ? english
          ? "If anyone wants to harden timing, outcome or scope certainty in the next conversation, escalate into review before the wording travels outward."
          : "如果任何人想在下一次对话里把时点、结果或范围确定性说实，就先升级进复核，再允许这句话往外走。"
        : english
          ? "If trust pressure, dependency pressure or founder risk rises, step back from the current scene and return to package or offer review first."
          : "如果信任压力、依赖压力或创始人风险开始上升，就先从当前场景退回，回到方案包或报价复核。",
    pageEvidenceLinks: [
      {
        label: english ? "Open package page" : "打开方案包页面",
        href: `/packages/${detail.id}`,
      },
      {
        label: english ? "Open customer offer page" : "打开客户可见报价页面",
        href: `/offers/${detail.id}`,
      },
      {
        label: english ? "Open external narrative page" : "打开对外叙事页面",
        href: `/external-narratives/${detail.id}`,
      },
    ],
  });
}

function summarizeSignals(detail: ProposalPackageCommercialDetail) {
  const blockerCount = detail.blockers.length;
  const openCommitmentCount = detail.commitments.filter(
    (item) => item.status !== "FULFILLED",
  ).length;
  const pendingApprovalCount = detail.actionItems.filter(
    (item) => item.approvalTask?.status === "PENDING",
  ).length;
  const missingPrerequisiteCount = [detail.ownerName ? 0 : 1, detail.nextAction ? 0 : 1]
    .reduce((sum, value) => sum + value, 0);
  const workerPreparedCount =
    detail.actionItems.length +
    (detail.briefingSnapshot?.payload.recommendedNextSteps?.length ?? 0) +
    (detail.briefingSnapshot?.payload.summary ? 1 : 0);

  return {
    blockerCount,
    openCommitmentCount,
    pendingApprovalCount,
    missingPrerequisiteCount,
    workerPreparedCount,
  };
}

function getConversationMode(
  detail: ProposalPackageCommercialDetail,
  signals: ReturnType<typeof summarizeSignals>,
): ConversationDetailMode {
  if (detail.riskLevel === "CRITICAL" || signals.pendingApprovalCount > 1) {
    return "review-before-send";
  }
  if (signals.missingPrerequisiteCount > 0) {
    return "prerequisite-clarification";
  }
  if (signals.blockerCount > 0) {
    return detail.riskLevel === "HIGH"
      ? "boundary-clarification"
      : "dependency-clarification";
  }
  if (signals.openCommitmentCount > 1) {
    return "non-commitment-clarification";
  }

  switch (detail.stageCode) {
    case "NEW":
      return signals.workerPreparedCount > 3
        ? "founder-demo"
        : "sales-first-contact";
    case "CONTACTED":
      return "sales-follow-up";
    case "ADVANCING":
      return detail.riskLevel === "HIGH"
        ? "founder-meeting"
        : "proposal-walkthrough";
    case "WAITING_THEM":
      return "objection-handling";
    case "INTERNAL_SYNC":
      return "internal-prep-only";
    case "DONE":
      return "sales-follow-up";
    default:
      return "boundary-clarification";
  }
}

function getAudienceMode(mode: ConversationDetailMode): ConversationDetailAudienceMode {
  switch (mode) {
    case "founder-meeting":
    case "founder-demo":
      return "founder-led";
    case "sales-first-contact":
    case "sales-follow-up":
    case "objection-handling":
    case "proposal-walkthrough":
      return "sales-led";
    case "boundary-clarification":
    case "prerequisite-clarification":
    case "dependency-clarification":
      return "delivery-led";
    case "internal-prep-only":
      return "internal-only";
    default:
      return "shared-review";
  }
}

function getSendabilityMode(
  mode: ConversationDetailMode,
): ConversationDetailSendabilityMode {
  switch (mode) {
    case "founder-demo":
      return "customer-visible";
    case "founder-meeting":
    case "sales-follow-up":
    case "proposal-walkthrough":
    case "non-commitment-clarification":
      return "safe-with-boundary";
    case "prerequisite-clarification":
      return "safe-with-prerequisite";
    case "dependency-clarification":
      return "safe-with-dependency";
    case "review-before-send":
      return "review-before-send";
    case "internal-prep-only":
      return "internal-only";
    case "boundary-clarification":
      return "not-ready-for-customer";
    default:
      return "discussion-only";
  }
}

function getIntent(mode: ConversationDetailMode): ConversationDetailIntent {
  switch (mode) {
    case "sales-first-contact":
    case "founder-demo":
      return "warm-up-context";
    case "sales-follow-up":
      return "advance-follow-up";
    case "objection-handling":
      return "handle-objection";
    case "proposal-walkthrough":
    case "founder-meeting":
      return "walkthrough-package";
    case "boundary-clarification":
      return "clarify-boundary";
    case "prerequisite-clarification":
      return "clarify-prerequisite";
    case "dependency-clarification":
      return "clarify-dependency";
    default:
      return "protect-non-commitment";
  }
}

function mapRiskSignal(
  riskLevel: ProposalPackageCommercialDetail["riskLevel"],
  signals: ReturnType<typeof summarizeSignals>,
): ConversationDetailRiskSignal {
  if (
    riskLevel === "CRITICAL" ||
    riskLevel === "HIGH" ||
    signals.pendingApprovalCount > 0
  ) {
    return "high";
  }
  if (riskLevel === "MEDIUM" || signals.blockerCount > 0) {
    return "caution";
  }
  return "watch";
}

function buildJudgement(
  mode: ConversationDetailMode,
  sendabilityMode: ConversationDetailSendabilityMode,
  english: boolean,
) {
  if (english) {
    return `Keep the conversation in ${labelForMode(mode, true)} with ${labelForSendability(sendabilityMode, true)}, not stronger promise wording.`;
  }

  return `当前对话应停在「${labelForMode(mode, false)}」，并保持「${labelForSendability(sendabilityMode, false)}」，而不是继续把承诺说硬。`;
}

function buildBoundaryLine(
  mode: ConversationDetailMode,
  sendabilityMode: ConversationDetailSendabilityMode,
  english: boolean,
) {
  if (english) {
    return `Current scene: ${labelForMode(mode, true)}. Current sendability: ${labelForSendability(sendabilityMode, true)}.`;
  }

  return `当前场景是「${labelForMode(mode, false)}」，当前发送评估是「${labelForSendability(sendabilityMode, false)}」。`;
}

function buildFounderCue(mode: ConversationDetailMode, english: boolean) {
  if (english) {
    return mode === "founder-meeting" || mode === "founder-demo"
      ? "Founder should lead with operating judgement, risk framing and reversible confidence instead of premature promise language."
      : "Founder should only step in when trust, pace or boundary risk needs a higher-confidence frame.";
  }

  return mode === "founder-meeting" || mode === "founder-demo"
    ? "创始人这时最适合先讲经营判断、风险措辞和可回退的信心，而不是过早说成承诺。"
    : "创始人只在信任、节奏或边界风险需要更高层措辞时介入。";
}

function buildSalesCue(mode: ConversationDetailMode, english: boolean) {
  if (english) {
    return mode === "sales-first-contact" || mode === "sales-follow-up"
      ? "Sales should keep the line warm, confirm the next move and repeat only boundary-safe customer-visible wording."
      : "Sales should translate the current judgement into the next safe follow-up without hardening it into commitment.";
  }

  return mode === "sales-first-contact" || mode === "sales-follow-up"
    ? "销售这时最适合继续升温、确认下一动作，并只复用边界安全的客户可见措辞。"
    : "销售应把当前判断翻成下一步安全跟进，而不是把它说成承诺。";
}

function buildDeliveryCue(mode: ConversationDetailMode, english: boolean) {
  if (english) {
    return mode === "boundary-clarification" ||
      mode === "prerequisite-clarification" ||
      mode === "dependency-clarification"
      ? "Delivery should surface scope, prerequisite and dependency caveats before the next external conversation."
      : "Delivery should protect scope clarity and implementation caveats whenever the conversation starts touching expectations.";
  }

  return mode === "boundary-clarification" ||
    mode === "prerequisite-clarification" ||
    mode === "dependency-clarification"
    ? "交付这时最适合先把范围、前置和依赖注脚说清，再允许下一次对外对话。"
    : "只要对话开始触碰预期，交付就该先保护范围清晰度和实施注脚。";
}

function buildNextActions({
  id,
  mode,
  english,
}: {
  id: string;
  mode: ConversationDetailMode;
  english: boolean;
}): PageNextAction[] {
  return [
    {
      label: english ? "Open external narrative detail" : "打开对外叙事页面",
      href: `/external-narratives/${id}`,
    },
    {
      label:
        mode === "founder-meeting" || mode === "founder-demo"
          ? english
            ? "Open customer-facing offer page"
            : "打开客户可见报价页面"
          : english
            ? "Open package page"
            : "打开方案包页面",
      href:
        mode === "founder-meeting" || mode === "founder-demo"
          ? `/offers/${id}`
          : `/packages/${id}`,
      variant: "secondary" as const,
    },
    {
      label: english ? "Open evidence" : "查看依据",
      href: `/memory?objectType=OPPORTUNITY&objectId=${id}`,
      variant: "ghost" as const,
    },
  ];
}

function buildEvidenceGroups(
  detail: ProposalPackageCommercialDetail,
  mode: ConversationDetailMode,
  sendabilityMode: ConversationDetailSendabilityMode,
  english: boolean,
): ConversationDetailEvidenceGroup[] {
  const latestMemory =
    detail.memoryFacts[0]?.title ?? detail.memoryEntries[0]?.title ?? (english ? "No memory yet" : "当前还没有新的记忆");
  const latestAudit =
    detail.auditLogs[0]?.summary ?? (english ? "No recent audit change." : "当前没有新的审计变化。");
  const latestAction =
    detail.actionItems[0]?.title ?? detail.nextAction ?? (english ? "Next action still needs confirmation." : "当前下一步动作仍待确认。");
  const topBlocker =
    detail.blockers[0]?.title ?? (english ? "No active blocker in the front row." : "当前前台没有新的阻塞。");
  const topCommitment =
    detail.commitments[0]?.title ?? (english ? "No open commitment pressure." : "当前没有新的承诺压力。");
  const summary =
    trimText(detail.briefingSnapshot?.payload.summary, 160) ??
    (english ? "No structured summary yet." : "当前还没有新的结构化摘要。");

  return [
    {
      groupId: "replay",
      label: english ? "Replay" : "回放",
      items: [
        english
          ? `Use the current scene ${labelForMode(mode, true)} to replay the next spoken move.`
          : `可按当前场景「${labelForMode(mode, false)}」回放下一句该怎么说。`,
      ],
    },
    {
      groupId: "audit",
      label: english ? "Audit" : "审计",
      items: [latestAudit],
    },
    {
      groupId: "memory",
      label: english ? "Memory" : "经营记忆",
      items: [latestMemory],
    },
    {
      groupId: "worker_output",
      label: english ? "Worker output" : "执行输出",
      items: [latestAction],
    },
    {
      groupId: "boundary_trace",
      label: english ? "Boundary trace" : "边界轨迹",
      items: [topBlocker],
    },
    {
      groupId: "sendability_trace",
      label: english ? "Sendability trace" : "发送评估轨迹",
      items: [
        english
          ? `Current sendability remains ${labelForSendability(sendabilityMode, true)}.`
          : `当前发送评估仍停在「${labelForSendability(sendabilityMode, false)}」。`,
      ],
    },
    {
      groupId: "conversation_trace",
      label: english ? "Conversation trace" : "对话轨迹",
      items: [summary],
    },
    {
      groupId: "scenario_trace",
      label: english ? "Scenario trace" : "场景轨迹",
      items: [
        english
          ? `Related cues: founder-risk-clarification / sales-objection-response / proposal-shaping-review / delivery_activation_checklist.`
          : "相关线索：创始人风险澄清 / 销售异议回应 / 提案构形复核 / 交付激活清单。",
      ],
    },
    {
      groupId: "historical_changes",
      label: english ? "Historical changes" : "历史变化",
      items: [
        english
          ? `${topCommitment} · updated ${formatConversationRelativeLabel(detail.updatedAt, true)}`
          : `${topCommitment} · 最近更新于 ${formatRelative(detail.updatedAt)}`,
      ],
    },
  ];
}

function labelForMode(mode: ConversationDetailMode, english: boolean) {
  switch (mode) {
    case "founder-meeting":
      return english ? "founder meeting" : "创始人会议";
    case "founder-demo":
      return english ? "founder demo" : "创始人演示";
    case "sales-first-contact":
      return english ? "sales first contact" : "销售首次接触";
    case "sales-follow-up":
      return english ? "sales follow-up" : "销售跟进";
    case "objection-handling":
      return english ? "objection handling" : "异议处理";
    case "proposal-walkthrough":
      return english ? "proposal walkthrough" : "方案走查";
    case "boundary-clarification":
      return english ? "boundary clarification" : "边界澄清";
    case "prerequisite-clarification":
      return english ? "prerequisite clarification" : "前置条件澄清";
    case "dependency-clarification":
      return english ? "dependency clarification" : "依赖澄清";
    case "non-commitment-clarification":
      return english ? "non-commitment clarification" : "非承诺澄清";
    case "review-before-send":
      return english ? "review before send" : "发送前复核";
    default:
      return english ? "internal prep only" : "仅内部准备";
  }
}

function fallbackLabel(mode: ConversationDetailMode, english: boolean) {
  switch (mode) {
    case "founder-demo":
    case "sales-first-contact":
    case "sales-follow-up":
    case "objection-handling":
    case "proposal-walkthrough":
      return english ? "boundary clarification" : "边界澄清";
    case "boundary-clarification":
    case "prerequisite-clarification":
    case "dependency-clarification":
      return english ? "internal prep only" : "仅内部准备";
    default:
      return english ? "review before send" : "发送前复核";
  }
}

function labelForSendability(
  mode: ConversationDetailSendabilityMode,
  english: boolean,
) {
  switch (mode) {
    case "customer-visible":
      return english ? "customer-visible" : "可客户可见";
    case "safe-with-boundary":
      return english ? "safe with boundary" : "带边界可说";
    case "safe-with-prerequisite":
      return english ? "safe with prerequisite" : "先补前置再说";
    case "safe-with-dependency":
      return english ? "safe with dependency" : "必须带依赖才能说";
    case "discussion-only":
      return english ? "discussion only" : "只适合讨论";
    case "review-before-send":
      return english ? "review before send" : "先复核再发";
    case "internal-only":
      return english ? "internal only" : "仅内部";
    default:
      return english ? "not ready for customer" : "暂不适合对客户说";
  }
}
