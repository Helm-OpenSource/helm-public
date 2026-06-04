import type { PageReportingProtocol } from "@/lib/presentation/reporting-protocol";
import type {
  AgentAttentionState,
  AgentAuthorityState,
  AgentSurfaceSections,
} from "@/lib/presentation/agent-primitives";
import {
  formatAgentAttentionState,
  formatAgentAuthorityState,
  toneForAgentAttentionState,
  toneForAgentAuthorityState,
} from "@/lib/presentation/agent-primitives";
import {
  createFollowupDetailReportingContract,
  createInboxDetailReportingContract,
  createReviewRequestDetailReportingContract,
  toFollowupDetailPageReportingProtocol,
  toInboxDetailPageReportingProtocol,
  toReviewRequestDetailPageReportingProtocol,
  type FollowupDetailReportingContract,
  type InboxDetailReportingContract,
  type InboxFollowupReviewRequestEvidenceGroup,
  type InboxFollowupReviewRequestRiskSignal,
  type ReviewRequestDetailReportingContract,
} from "@/lib/presentation/inbox-followup-review-request-detail-contract";
import {
  createUnifiedDetailNavigationModel,
  type CrossDetailHandoff,
  type CrossDetailHandoffVisibilityMode,
  type UnifiedDetailNavigationModel,
} from "@/lib/presentation/unified-detail-navigation";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import { actionTypeLabels } from "@/data/constants";
import { formatDateLabel, trimText } from "@/lib/utils";

type HeaderLink = {
  label: string;
  href: string;
  variant?: "default" | "secondary" | "ghost";
};

type EvidenceGroup = {
  groupId: string;
  label: string;
  items: string[];
};

type Chip = {
  label: string;
  tone: "sky" | "violet" | "amber" | "emerald";
};

type SecondarySummaryItem = {
  label: string;
  value: string;
};

type PageKind = "inbox-detail" | "follow-up-detail" | "review-request-detail";

function formatReviewRequestActionType(actionType: string, english: boolean) {
  if (english) return actionType.replace(/_/g, " ").toLowerCase();
  return (
    actionTypeLabels[actionType as keyof typeof actionTypeLabels] ??
    actionType.replace(/_/g, " ")
  );
}

type ReviewRequestAgentSurfaceModel = AgentSurfaceSections & {
  authorityState: AgentAuthorityState;
  attentionState: AgentAttentionState;
};

export type InboxFollowupReviewRequestPageModel = AgentSurfaceSections & {
  rootDataAttributes: Record<string, string>;
  eyebrow: string;
  title: string;
  description: string;
  actions: HeaderLink[];
  briefingLabel: string;
  navigation: UnifiedDetailNavigationModel;
  protocol: PageReportingProtocol;
  chips: Chip[];
  secondarySummaryItems: SecondarySummaryItem[];
  boundaryLabel: string;
  actionLabel: string;
  evidenceLabel: string;
  evidenceCountLabel: string;
  evidenceGroups: EvidenceGroup[];
  stageBadge: string;
  authorityState?: AgentAuthorityState;
  attentionState?: AgentAttentionState;
};

type InboxThreadDetail = {
  id: string;
  subject: string;
  counterpart: string;
  summary: string | null;
  source: string;
  status: "OPEN" | "WAITING_US" | "WAITING_THEM" | "CLOSED";
  waitingOn: string | null;
  shouldReply: boolean;
  updatedAt: Date;
  contact: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
  opportunity: {
    id: string;
    title: string;
    type: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    stage:
      | "NEW"
      | "CONTACTED"
      | "ADVANCING"
      | "WAITING_THEM"
      | "INTERNAL_SYNC"
      | "DONE"
      | "LOST";
    nextAction: string | null;
  } | null;
  messages: Array<{
    id: string;
    sender: string;
    senderEmail: string;
    body: string;
    isInbound: boolean;
    sentAt: Date;
  }>;
};

type ReviewRequestDetail = {
  id: string;
  status: "PENDING" | "EXECUTED" | "REJECTED" | "WITHDRAWN";
  channel: string | null;
  isHighRisk: boolean;
  autoExecute: boolean;
  contextSnapshot: string | null;
  reasoning: string | null;
  editableContent: string | null;
  resultPreview: string | null;
  createdAt: Date;
  updatedAt: Date;
  approver: { name: string } | null;
  reviewedBy: { name: string } | null;
  actionItem: {
    id: string;
    title: string;
    actionType: string;
    description: string | null;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    suggestedExecutionAt: Date | null;
    executionMode: string;
    opportunity: {
      id: string;
      title: string;
      company: { id: string; name: string } | null;
    } | null;
    contact: { id: string; name: string } | null;
    meeting: { id: string; title: string } | null;
  };
  recommendationFacts: Array<{
    id: string;
    title: string;
    content: string;
    updatedAt: Date;
  }>;
  recommendationBlockers: Array<{
    id: string;
    title: string;
    blockerText: string;
    updatedAt: Date;
  }>;
  recommendationCommitments: Array<{
    id: string;
    title: string;
    status: string;
    overdueFlag: boolean;
    updatedAt: Date;
  }>;
};

export function buildInboxDetailPageModel({
  thread,
  english,
  hasReviewRequest,
}: {
  thread: InboxThreadDetail;
  english: boolean;
  hasReviewRequest: boolean;
}): InboxFollowupReviewRequestPageModel {
  const scene =
    thread.contact || thread.company || thread.opportunity
      ? "inbox-customer-thread"
      : "inbox-internal-thread";
  const audienceMode =
    scene === "inbox-customer-thread" ? "customer-visible" : "internal-only";
  const sendabilityMode =
    scene === "inbox-internal-thread"
      ? "internal-only"
      : thread.shouldReply || thread.status === "WAITING_US"
        ? "review-before-send"
        : thread.opportunity
          ? "safe-with-boundary"
          : "discussion-only";
  const riskSignal = mapRiskSignal(
    thread.opportunity?.riskLevel ?? "MEDIUM",
    thread.shouldReply,
  );
  const replyUrgent = thread.shouldReply || thread.status === "WAITING_US";
  const contract = createInboxDetailReportingContract({
    inboxDetailJudgement: english
      ? replyUrgent
        ? "Use inbox detail as the current thread judgement layer before anyone drafts or sends a follow-up."
        : "Use inbox detail to decide whether this thread still belongs in internal prep, package clarification or the next conversation handoff."
      : replyUrgent
        ? "当前应先把收件箱详情面当作线程判断层，再决定是否进入跟进或发送。"
        : "当前应先用收件箱详情面判断这条线程究竟还停在内部准备、方案包澄清，还是已经该交给下一段对话交接。",
    inboxDetailJudgementReason:
      thread.summary ??
      (english
        ? `${thread.counterpart} is already attached to ${thread.opportunity?.title ?? "a partial commercial context"}, so this page now needs to tell the team whether the next move is review, follow-up or boundary clarification.`
        : `${thread.counterpart} 当前已经挂到${thread.opportunity?.title ?? "一条部分商业上下文"}上，所以这页现在要先告诉团队：下一步究竟是复核、跟进，还是边界澄清。`),
    inboxDetailActionSummary: [
      english
        ? "The current inbox-detail surface already groups the thread summary, counterpart, linked account objects and the latest visible reply pressure."
        : "当前这张收件箱详情面已经把线程摘要、对方、已绑定对象和最近一次可见回复压力收在一起。",
      thread.opportunity
        ? english
          ? "The linked opportunity already exists, so inbox no longer needs to behave like a neutral message container."
          : "当前已经存在关联机会，所以收件箱不该再像中性的消息容器。"
        : english
          ? "The thread still lacks a full opportunity frame, so this page keeps the account and boundary context visible before any outward move."
          : "当前线程还没有完整机会框架，所以这页会先把账户和边界上下文挂在前台，再决定是否对外动作。",
      english
        ? "The coordination handoff, boundary note and next likely handoff already sit here before the team re-opens raw messages."
        : "在团队重新翻原始消息前，协作分工、边界备注和下一步交接已经先挂在这里。",
    ],
    inboxDetailDecisionRequest: [
      english
        ? "Confirm whether the next move should stay review-before-send, or whether this thread is already clean enough to hand into follow-up."
        : "确认下一步是继续停在发送前复核，还是这条线程已经足够干净，可以交给跟进。",
      english
        ? "Confirm whether this thread still needs package / proposal boundary clarification before anyone replies outward."
        : "确认在任何人对外回复前，这条线程是否还需要先回到方案包 / 提案边界澄清。",
    ],
    inboxDetailBoundarySummary: [
      english
        ? "Inbox detail can sharpen reply timing, ownership and handoff, but it still cannot quietly turn thread pressure into external commitment."
        : "收件箱详情面可以提高回复时点、负责人和交接清晰度，但它仍然不能悄悄把线程压力写成对外承诺。",
      english
        ? "Any outward wording that can be misread as commitment must stay inside boundary, prerequisite, dependency or review-before-send framing."
        : "任何可能被误读成承诺的对外措辞，都必须继续停在边界、前置、依赖或发送前复核结构里。",
      english
        ? "Internal-only counterpart context, routing notes and object-binding uncertainty must never be lifted into customer-facing wording."
        : "仅内部可见的对方上下文、路由备注和对象绑定不确定性，不能直接抬到客户可见措辞。",
    ],
    inboxDetailEvidenceSummary: [
      english
        ? `${thread.messages.length} messages, thread summary and the current handoff trace stay grouped below without interrupting the main narrative.`
        : `当前 ${thread.messages.length} 条消息、线程摘要和交接轨迹都已经分组收在下面，不会打断主叙事。`,
      english
        ? "Replay, memory, sendability trace, worker notes and historical changes remain available on demand."
        : "回放、经营记忆、发送评估轨迹、执行备注和历史变更都保留在附注层按需可看。",
    ],
    inboxDetailWorkerSummary: [
      english
        ? "Inbox worker keeps reply pressure, binding status and the next likely route aligned to the same judgement-first thread view."
        : "收件箱执行会持续把回应压力、绑定状态和下一条最可能的路线对齐到同一张判断优先线程视图上。",
      english
        ? "Commercial review keeps package, proposal and conversation boundary lines visible before the next outward move."
        : "商业复核会在下一次对外动作前继续把方案包、提案和对话的边界线挂在前台。",
    ],
    inboxDetailNextAction: buildInboxActions({
      thread,
      english,
      hasReviewRequest,
    }),
    inboxDetailRiskSignal: riskSignal,
    inboxDetailAudienceMode: audienceMode,
    inboxDetailScene: scene,
    inboxDetailSendabilityMode: sendabilityMode,
    inboxDetailEvidenceGroups: buildEvidenceGroups({
      english,
      replayItems: thread.messages
        .slice(-3)
        .map((message) =>
          english
            ? `${message.sender} · ${message.isInbound ? "Inbound" : "Outbound"} · ${trimText(message.body, 120)}`
            : `${message.sender} · ${message.isInbound ? "收到" : "发出"} · ${trimText(message.body, 120)}`,
        ),
      auditItems: [
        english
          ? `Last thread update: ${formatDateLabel(thread.updatedAt)}`
          : `最近一次线程更新时间：${formatDateLabel(thread.updatedAt)}`,
      ],
      memoryItems: [
        thread.summary ??
          (english
            ? "No summary has been written yet."
            : "当前还没有线程摘要。"),
      ],
      workerItems: [
        english
          ? "Inbox worker already grouped the current thread pressure and next likely route."
          : "收件箱执行已经先把当前线程压力和下一条最可能路线分组好了。",
      ],
      boundaryItems: [
        english
          ? "Reply-safe wording still needs explicit boundary and non-commitment framing."
          : "可回复措辞仍然需要显式保留边界与非承诺措辞。",
      ],
      sendabilityItems: [
        english
          ? `Current sendability stays at ${sendabilityMode}.`
          : `当前发送评估停在 ${formatSendabilityMode(sendabilityMode, false)}。`,
      ],
      handoffItems: [
        english
          ? "The next move can now route into follow-up, package clarification or review request depending on the thread pressure."
          : "下一步现在可以根据线程压力路由到跟进、方案包澄清或复核请求。",
      ],
      historyItems: [
        english
          ? `Thread source: ${thread.source}`
          : `线程来源：${thread.source}`,
      ],
    }),
    pageWhyItMatters: [
      english
        ? "Inbox should not read like a message list first. It should first tell the team whether this thread changes the current commercial chain."
        : "收件箱不应该先像消息列表；它应该先告诉团队，这条线程是否已经改变了当前商业推进链。",
      replyUrgent
        ? english
          ? "The thread is already waiting on us, so weak routing here will directly slow follow-up and review."
          : "当前线程已经进入待我方动作窗口，所以这里如果路由不清，会直接拖慢跟进和复核。"
        : english
          ? "Even when no immediate reply is needed, the thread still changes which boundary, package or follow-up layer should take over next."
          : "即使现在不需要立刻回复，这条线程仍会改变下一步该由哪一层边界、方案包或跟进接手。",
      english
        ? "The real thread context is already attached here, so the remaining work is choosing the right handoff instead of reopening raw mail history."
        : "当前真实线程上下文已经挂在这里，所以剩下真正的工作是选对交接，而不是再回去重看原始邮件历史。",
    ],
    pageEvidenceLinks: buildInboxEvidenceLinks({ thread, english }),
    pageEscalationHint: english
      ? "If the thread starts touching scope, price, timing or outcome certainty, step back into package / proposal / review before any outward reply."
      : "如果这条线程开始触碰范围、价格、时点或结果确定性，就先退回方案包 / 提案 / 复核，再决定是否对外回复。",
  });
  const protocol = toInboxDetailPageReportingProtocol(contract);
  const navigation = createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType: "inbox-detail",
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: formatThreadStage(thread, english),
      detailNodeBoundary: protocol.pageBoundarySummary[0],
      detailNodeAudienceMode: formatAudienceMode(audienceMode, english),
      detailNodeSendabilityMode: formatSendabilityMode(
        sendabilityMode,
        english,
      ),
      detailNodeStrengthMode: null,
      detailNodePrev: thread.opportunity
        ? {
            type: "conversation",
            href: `/conversations/${thread.opportunity.id}`,
            label: english ? "Conversation detail" : "对话详情",
            summary: english
              ? "Return to conversation when the team still needs a shared talk track, not thread-specific routing."
              : "如果团队仍需要共享话术层，而不是线程级路由，就回到对话。",
          }
        : thread.company
          ? {
              type: "company-detail",
              href: `/companies/${thread.company.id}`,
              label: english ? "Company detail" : "公司详情",
              summary: english
                ? "Return to the company route when account binding still matters more than reply motion."
                : "如果账户绑定比回复动作更重要，就回到公司路由。",
            }
          : null,
      detailNodeNext: thread.opportunity
        ? {
            type: "follow-up-detail",
            href: `/follow-ups/${thread.opportunity.id}`,
            label: english ? "Follow-up detail" : "跟进详情",
            summary: english
              ? "Move here once the thread context is clear and the team needs the next follow-up judgement."
              : "当线程上下文已经收住，而团队需要下一步跟进判断时，切到这里。",
          }
        : thread.contact
          ? {
              type: "contact-detail",
              href: `/contacts/${thread.contact.id}`,
              label: english ? "Contact detail" : "联系人详情",
              summary: english
                ? "Move here when contact ownership still matters more than reply drafting."
                : "如果联系人负责人比回复草拟更重要，就切到联系人详情。",
            }
          : null,
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority: priorityForRisk(riskSignal),
      detailNodeNavigationHint: english
        ? "Use inbox detail when the team needs to decide whether a real thread should stay as context, become follow-up work or step back into review."
        : "当团队需要判断一条真实线程究竟是继续保留为上下文、升级成跟进，还是退回复核时，停在收件箱详情面。",
    },
    handoffs: buildInboxHandoffs({
      thread,
      english,
      protocol,
      hasReviewRequest,
    }),
  });

  return createPageModel({
    kind: "inbox-detail",
    eyebrow: english
      ? "Communication chain / Inbox detail"
      : "沟通链 / 收件箱详情",
    title: english
      ? `${thread.subject} inbox detail`
      : `${thread.subject} 收件箱详情页`,
    description: english
      ? `${thread.counterpart} · ${formatThreadStage(thread, true)}`
      : `${thread.counterpart} · ${formatThreadStage(thread, false)}`,
    actions: buildHeaderActions({
      english,
      kind: "inbox-detail",
      primaryHref: `/inbox?threadId=${thread.id}`,
      relatedHref: thread.opportunity
        ? `/follow-ups/${thread.opportunity.id}`
        : null,
      evidenceHref: thread.opportunity
        ? `/memory?objectType=OPPORTUNITY&objectId=${thread.opportunity.id}`
        : thread.contact
          ? `/memory?objectType=CONTACT&objectId=${thread.contact.id}`
          : null,
    }),
    briefingLabel: english ? "Inbox judgement" : "收件箱判断",
    navigation,
    protocol,
    chips: [
      {
        label: formatThreadScene(scene, english),
        tone: scene === "inbox-customer-thread" ? "sky" : "violet",
      },
      {
        label: formatSendabilityMode(sendabilityMode, english),
        tone: toneForSendability(sendabilityMode),
      },
      {
        label: formatRiskSignal(riskSignal, english),
        tone: riskSignal === "high" ? "amber" : "violet",
      },
    ],
    secondarySummaryItems: [
      {
        label: english ? "Scene" : "当前场景",
        value: formatThreadScene(scene, english),
      },
      {
        label: english ? "Audience mode" : "当前受众",
        value: formatAudienceMode(audienceMode, english),
      },
      {
        label: english ? "Sendability" : "当前发送评估",
        value: formatSendabilityMode(sendabilityMode, english),
      },
      {
        label: english ? "Linked opportunity" : "关联机会",
        value: thread.opportunity?.title ?? (english ? "Unlinked" : "未绑定"),
      },
      {
        label: english ? "Linked company" : "关联公司",
        value: thread.company?.name ?? (english ? "Unlinked" : "未绑定"),
      },
      {
        label: english ? "Reply pressure" : "当前回复压力",
        value: replyUrgent
          ? english
            ? "Waiting on us"
            : "待我方动作"
          : english
            ? "Watch"
            : "继续观察",
      },
    ],
    boundaryLabel: english ? "Boundary and sendability" : "边界与发送评估",
    actionLabel: english ? "Available next actions" : "可直接执行的动作",
    evidenceLabel: english ? "Evidence drawer" : "证据抽屉",
    evidenceCountLabel: english
      ? `${contract.inboxDetailEvidenceGroups.length} grouped tracks`
      : `${contract.inboxDetailEvidenceGroups.length} 组依据`,
    evidenceGroups: contract.inboxDetailEvidenceGroups,
    stageBadge: formatThreadStage(thread, english),
  });
}

export function buildFollowupDetailPageModel({
  detail,
  english,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
}): InboxFollowupReviewRequestPageModel {
  const pendingApproval =
    detail.actionItems.find(
      (item) => item.approvalTask?.status === "PENDING",
    ) ?? null;
  const blockerCount = detail.blockers.length;
  const missingBasics = [
    detail.ownerName ? 0 : 1,
    detail.nextAction ? 0 : 1,
  ].reduce((sum, value) => sum + value, 0);
  const scene = pendingApproval
    ? "followup-review-before-send"
    : detail.stageCode === "INTERNAL_SYNC"
      ? "internal-prep-only"
      : blockerCount > 0 || missingBasics > 0
        ? "followup-ready-to-review"
        : "followup-draft";
  const audienceMode =
    scene === "internal-prep-only"
      ? "internal-only"
      : scene === "followup-review-before-send"
        ? "shared-review"
        : "customer-visible";
  const sendabilityMode =
    scene === "internal-prep-only"
      ? "internal-only"
      : scene === "followup-review-before-send"
        ? "review-before-send"
        : scene === "followup-ready-to-review"
          ? "safe-with-boundary"
          : "customer-visible";
  const riskSignal = mapRiskSignal(
    detail.riskLevel,
    Boolean(pendingApproval || blockerCount),
  );
  const contract = createFollowupDetailReportingContract({
    followupDetailJudgement: english
      ? `Keep this follow-up in ${formatFollowupScene(scene, true)} with ${formatSendabilityMode(sendabilityMode, true)}, not stronger promise wording.`
      : `当前跟进应停在「${formatFollowupScene(scene, false)}」，并保持「${formatSendabilityMode(sendabilityMode, false)}」，而不是继续把承诺说硬。`,
    followupDetailJudgementReason:
      detail.briefingSnapshot?.payload.summary ??
      (english
        ? "The current follow-up surface already separates follow-up drafting, review gates, package boundary and the next likely review request."
        : "当前这张跟进面已经把跟进起草、复核闸口、方案包边界和下一条最可能的复核请求分开了。"),
    followupDetailActionSummary: [
      english
        ? "The current detail page already groups follow-up copy pressure, package boundary and the approval-sensitive next step."
        : "当前详情页已经把跟进文案压力、方案包边界和审批敏感的下一步动作收在一起。",
      pendingApproval
        ? english
          ? "A pending approval is already attached to one action item, so follow-up can no longer pretend to be a free draft."
          : "当前已经有待审批动作挂在动作项上，所以跟进不能再假装只是自由草稿。"
        : english
          ? "There is still room to refine the next outbound move before it becomes a review request."
          : "在它升级成复核请求之前，当前仍有空间先把下一次对外动作收清。",
      english
        ? "The coordination handoff, sendability, fallback and the next review handoff are already visible before anyone reopens raw copy."
        : "协作分工、发送评估、兜底和下一条复核交接已经先可见，不需要先回去翻原始文案。",
    ],
    followupDetailDecisionRequest: [
      english
        ? "Confirm whether the next move can stay in follow-up drafting, or whether it should already escalate into review request."
        : "确认下一步是继续停在跟进起草，还是现在就该升级成复核请求。",
      english
        ? "Confirm whether the next follow-up still belongs in customer-visible-with-boundary, or should step back into review-before-send first."
        : "确认下一次跟进现在还能否保持客户可见且带边界，还是需要退回发送前复核。",
    ],
    followupDetailBoundarySummary: [
      english
        ? "Follow-up detail can sharpen pacing, ask framing and handoff timing, but it still cannot quietly turn draft pressure into commitment."
        : "跟进详情面可以提高节奏、请求措辞和交接时点的清晰度，但它仍然不能悄悄把草稿压力写成承诺。",
      english
        ? "Any outward wording that touches scope, timing, pricing or outcome certainty must keep boundary, prerequisite, dependency or review cues visible."
        : "任何触碰范围、时点、价格或结果确定性的对外措辞，都必须继续保留边界、前置、依赖或复核线索。",
      english
        ? "Internal-only preparation, fallback lines and approval-sensitive notes must never leak into customer-facing phrasing."
        : "仅内部的准备态、兜底话术和审批敏感备注，不能直接漏进客户可见措辞。",
    ],
    followupDetailEvidenceSummary: [
      english
        ? `${detail.actionItems.length} action items, ${detail.auditLogs.length} audit changes and follow-up traces are grouped below without interrupting the main narrative.`
        : `当前 ${detail.actionItems.length} 条动作项、${detail.auditLogs.length} 条审计变化和跟进轨迹都已经收在下面，不会打断主叙事。`,
      english
        ? "Replay, audit, memory, worker output, sendability trace, handoff trace and historical changes stay available on demand."
        : "回放、审计、经营记忆、执行输出、发送评估轨迹、交接轨迹和历史变更都保留在附注层按需可看。",
    ],
    followupDetailWorkerSummary: [
      english
        ? "Sales and conversation workers keep follow-up framing, review pressure and next-step routing aligned to the same judgement-first page."
        : "销售与对话执行会持续把跟进措辞、复核压力和下一步路由对齐到同一张判断优先页面上。",
      english
        ? "Commercial review keeps boundary, non-commitment and approval-sensitive wording from disappearing behind a stronger draft."
        : "商业复核会持续防止边界、非承诺和审批敏感措辞被更强的草稿盖掉。",
    ],
    followupDetailNextAction: buildFollowupActions({
      detail,
      english,
      pendingApprovalId: pendingApproval?.approvalTask?.id ?? null,
    }),
    followupDetailRiskSignal: riskSignal,
    followupDetailAudienceMode: audienceMode,
    followupDetailScene: scene,
    followupDetailSendabilityMode: sendabilityMode,
    followupDetailEvidenceGroups: buildEvidenceGroups({
      english,
      replayItems: detail.actionItems
        .slice(0, 3)
        .map((item) =>
          english
            ? `${item.title} · ${item.status}${item.approvalTask ? " · review attached" : ""}`
            : `${item.title} · ${item.status}${item.approvalTask ? " · 已挂复核" : ""}`,
        ),
      auditItems: detail.auditLogs
        .slice(0, 3)
        .map((item) =>
          english
            ? `${item.summary} · ${formatDateLabel(item.createdAt)}`
            : `${item.summary} · ${formatDateLabel(item.createdAt)}`,
        ),
      memoryItems: detail.memoryFacts.slice(0, 3).map((item) => item.title),
      workerItems: [
        english
          ? `${detail.actionItems.length} action items and the current briefing snapshot are already grouped for the next follow-up decision.`
          : `当前 ${detail.actionItems.length} 条动作项和简报快照已经被分组收好，供下一次跟进决策使用。`,
      ],
      boundaryItems: detail.blockers
        .slice(0, 3)
        .map((item) =>
          english
            ? `${item.title} · ${item.blockerText}`
            : `${item.title} · ${item.blockerText}`,
        ),
      sendabilityItems: [
        english
          ? `Current follow-up sendability stays at ${sendabilityMode}.`
          : `当前跟进发送评估停在 ${formatSendabilityMode(sendabilityMode, false)}。`,
      ],
      handoffItems: [
        pendingApproval
          ? english
            ? "The next likely handoff now goes into review request before anything travels outward."
            : "当前最可能的下一步交接是先进入复核请求，再决定是否对外。"
          : english
            ? "The next likely handoff still stays in follow-up drafting before it hardens into review."
            : "当前最可能的下一步交接仍停在跟进起草，再决定是否升级进复核。",
      ],
      historyItems: [
        english
          ? `Current stage: ${detail.stageLabel}`
          : `当前阶段：${detail.stageLabel}`,
      ],
    }),
    pageWhyItMatters: [
      english
        ? `The opportunity is already in ${detail.stageLabel}, so the next follow-up now directly changes pace, trust and whether the chain moves into review.`
        : `当前机会已经进入「${detail.stageLabel}」，所以下一次跟进会直接改变节奏、信任以及这条链是否进入复核。`,
      pendingApproval
        ? english
          ? "A review-sensitive action is already open, so follow-up wording can no longer behave like a harmless draft."
          : "当前已经有复核敏感动作打开，所以跟进措辞不能再被当成无害草稿。"
        : english
          ? "There is still room to improve the next ask, but only if boundary and non-commitment stay visible."
          : "当前仍有空间继续改进下一次请求，但前提是边界和非承诺还挂在前台。",
      english
        ? "The current page already groups package, offer, proposal and conversation context around this follow-up, so the remaining work is choosing the right next detail."
        : "当前页已经把方案包、报价、提案和对话上下文挂在这次跟进周围，所以剩下真正的工作是选对下一张详情面。",
    ],
    pageEvidenceLinks: [
      {
        label: english ? "Open package detail" : "打开方案包页面",
        href: `/packages/${detail.id}`,
      },
      {
        label: english ? "Open offer detail" : "打开提案页面",
        href: `/offers/${detail.id}`,
      },
      {
        label: english ? "Open conversation detail" : "打开对话页面",
        href: `/conversations/${detail.id}`,
      },
    ],
    pageEscalationHint: english
      ? "If the next follow-up starts hardening certainty, scope or timing, step into review request before the wording travels outward."
      : "如果下一次跟进开始把确定性、范围或时点说硬，就先升级进复核请求，再允许措辞往外走。",
  });
  const protocol = toFollowupDetailPageReportingProtocol(contract);
  const navigation = createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType: "follow-up-detail",
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: detail.stageLabel,
      detailNodeBoundary: protocol.pageBoundarySummary[0],
      detailNodeAudienceMode: formatAudienceMode(audienceMode, english),
      detailNodeSendabilityMode: formatSendabilityMode(
        sendabilityMode,
        english,
      ),
      detailNodeStrengthMode: null,
      detailNodePrev: {
        type: "conversation",
        href: `/conversations/${detail.id}`,
        label: english ? "Conversation detail" : "对话详情",
        summary: english
          ? "Return to conversation when the team still needs the shared scene rather than a follow-up-specific page."
          : "如果团队仍需要共享场景，而不是跟进专属页面，就回到对话。",
      },
      detailNodeNext: pendingApproval?.approvalTask
        ? {
            type: "review-request-detail",
            href: `/review-requests/${pendingApproval.approvalTask.id}`,
            label: english ? "Review request detail" : "复核请求详情",
            summary: english
              ? "Move here once the follow-up can no longer travel outward without review."
              : "当跟进已经不能在没有复核的情况下继续往外走时，切到这里。",
          }
        : {
            type: "customer-facing-offer",
            href: `/offers/${detail.id}`,
            label: english
              ? "Customer-facing offer detail"
              : "客户面向报价详情",
            summary: english
              ? "Move here if the next follow-up is already stable enough to inherit the outward offer surface."
              : "如果下一次跟进已经足够稳定，可以继承对外报价面，就切到这里。",
          },
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority: priorityForRisk(riskSignal),
      detailNodeNavigationHint: english
        ? "Use follow-up detail when the team needs to decide whether the next outbound move is still a draft, already review-sensitive or ready for the next commercial surface."
        : "当团队需要判断下一次对外动作仍是草稿、已经变成复核敏感，还是已经能进入下一层商业表面时，停在跟进详情面。",
    },
    handoffs: buildFollowupHandoffs({
      detail,
      english,
      protocol,
      pendingApprovalId: pendingApproval?.approvalTask?.id ?? null,
    }),
  });

  return createPageModel({
    kind: "follow-up-detail",
    eyebrow: english
      ? "Communication chain / Follow-up detail"
      : "沟通链 / 跟进详情",
    title: english
      ? `${detail.title} follow-up detail`
      : `${detail.title} 跟进详情页`,
    description: english
      ? `${detail.companyName ?? "No linked company"} · ${formatFollowupScene(scene, true)}`
      : `${detail.companyName ?? "未关联公司"} · ${formatFollowupScene(scene, false)}`,
    actions: buildHeaderActions({
      english,
      kind: "follow-up-detail",
      primaryHref: `/sales-followups/${detail.id}`,
      relatedHref: pendingApproval?.approvalTask?.id
        ? `/review-requests/${pendingApproval.approvalTask.id}`
        : `/offers/${detail.id}`,
      evidenceHref: `/memory?objectType=OPPORTUNITY&objectId=${detail.id}`,
    }),
    briefingLabel: english ? "Follow-up judgement" : "跟进判断",
    navigation,
    protocol,
    chips: [
      { label: formatFollowupScene(scene, english), tone: "sky" },
      {
        label: formatSendabilityMode(sendabilityMode, english),
        tone: toneForSendability(sendabilityMode),
      },
      {
        label: formatRiskSignal(riskSignal, english),
        tone: riskSignal === "high" ? "amber" : "violet",
      },
    ],
    secondarySummaryItems: [
      {
        label: english ? "Scene" : "当前场景",
        value: formatFollowupScene(scene, english),
      },
      {
        label: english ? "Audience mode" : "当前受众",
        value: formatAudienceMode(audienceMode, english),
      },
      {
        label: english ? "Sendability" : "当前发送评估",
        value: formatSendabilityMode(sendabilityMode, english),
      },
      {
        label: english ? "Current owner" : "当前负责人",
        value: detail.ownerName ?? (english ? "Unassigned" : "未分配"),
      },
      {
        label: english ? "Next action" : "当前下一步动作",
        value: detail.nextAction ?? (english ? "Not set" : "未设置"),
      },
      {
        label: english ? "Pending review" : "待复核状态",
        value: pendingApproval
          ? english
            ? "Approval-sensitive follow-up exists"
            : "当前已存在审批敏感跟进"
          : english
            ? "No pending review task"
            : "当前没有待审批任务",
      },
    ],
    boundaryLabel: english ? "Boundary and review mode" : "边界与复核模式",
    actionLabel: english ? "Available next actions" : "可直接执行的动作",
    evidenceLabel: english ? "Evidence drawer" : "证据抽屉",
    evidenceCountLabel: english
      ? `${contract.followupDetailEvidenceGroups.length} grouped tracks`
      : `${contract.followupDetailEvidenceGroups.length} 组依据`,
    evidenceGroups: contract.followupDetailEvidenceGroups,
    stageBadge: `${detail.stageLabel} · ${detail.riskLabel}`,
  });
}

export function buildReviewRequestDetailPageModel({
  task,
  english,
}: {
  task: ReviewRequestDetail;
  english: boolean;
}): InboxFollowupReviewRequestPageModel {
  const scene =
    task.status !== "PENDING"
      ? "review-request-blocked"
      : task.isHighRisk
        ? "review-request-escalated"
        : "review-request-pending";
  const audienceMode =
    scene === "review-request-pending" || scene === "review-request-escalated"
      ? "shared-review"
      : "internal-only";
  const sendabilityMode =
    scene === "review-request-blocked"
      ? "boundary-only"
      : scene === "review-request-escalated"
        ? "review-before-send"
        : "internal-only";
  const riskSignal = mapRiskSignal(task.actionItem.riskLevel, task.isHighRisk);
  const primaryOwner =
    task.actionItem.meeting != null
      ? "delivery"
      : task.channel?.includes("EMAIL") || task.actionItem.opportunity != null
        ? "sales"
        : "founder";
  const primaryOwnerLabel = formatPrimaryOwner(primaryOwner, english);
  const agentSurface = buildReviewRequestAgentSurface({
    task,
    primaryOwner,
    sendabilityMode,
    english,
  });
  const contract = createReviewRequestDetailReportingContract({
    reviewRequestDetailJudgement: english
      ? `Use review request detail as the escalation layer before ${primaryOwner} takes the next move.`
      : `当前应先把复核请求详情当作升级判断层，再决定下一步由 ${primaryOwnerLabel} 接手。`,
    reviewRequestDetailJudgementReason:
      task.reasoning ??
      (english
        ? "The current review surface already groups approval-sensitive wording, action content, approver context and the next role handoff."
        : "当前这张复核面已经把审批敏感表达、动作内容、审批人上下文和下一位角色交接收在一起。"),
    reviewRequestDetailActionSummary: [
      english
        ? "The current page already separates review status, action content, reasoning and the next role handoff, so it no longer behaves like a raw approval shell."
        : "当前页已经把复核状态、动作内容、判断依据和下一位角色交接拆开了，所以不再只是审批壳层。",
      task.resultPreview
        ? english
          ? "A result preview already exists, so the team can judge the next move without reopening raw request payloads."
          : "当前已经有结果预览，团队不需要先翻原始请求内容就能判断下一步。"
        : english
          ? "Even without a result preview, the current review request still carries enough context to decide owner, boundary and next action."
          : "即使当前还没有结果预览，这条复核请求也已经带了足够上下文，可以先决定接手人、边界和下一步。",
      english
        ? "Founder, sales, delivery and dedicated customer success follow-through can all be framed from here without pretending review is already closed."
        : "从这里已经可以继续把创始人、销售、交付以及客户成功的后续推进接起来，但不会假装复核已经结束。",
    ],
    reviewRequestDetailDecisionRequest: [
      english
        ? `Confirm whether ${primaryOwner} should take the next move now, or whether this review request still needs shared review.`
        : `确认下一步现在是否该由 ${primaryOwnerLabel} 接手，还是这条复核请求仍需停在共同复核。`,
      english
        ? "Confirm whether the request should route into founder / sales / delivery detail now, or step back into package, proposal or external narrative first."
        : "确认当前是直接把请求交给创始人、销售或交付详情，还是需要退回方案包、提案或对外叙事。",
    ],
    reviewRequestDetailBoundarySummary: [
      english
        ? "Review request detail can clarify who should approve, edit or take over next, but it still does not equal execution or external commitment."
        : "复核请求详情可以澄清谁该审批、编辑或接手下一步，但它仍然不等于已经执行，更不等于对外承诺。",
      english
        ? "Any high-risk wording still needs boundary, prerequisite, dependency, non-commitment or review-before-send framing before it travels outward."
        : "任何高风险表达在对外前，仍然必须先挂上边界、前提、依赖、非承诺或发送前复核结构。",
      english
        ? "Internal approver context, editable draft notes and blocked review rationale must never leak into customer-facing phrasing."
        : "内部审批人上下文、可编辑草稿备注和被阻塞的复核理由，不能直接漏进面向客户的话术。",
    ],
    reviewRequestDetailEvidenceSummary: [
      english
        ? `${task.recommendationFacts.length} recommendation facts, ${task.recommendationBlockers.length} blockers and the review trace are grouped below without interrupting the main narrative.`
        : `当前 ${task.recommendationFacts.length} 条建议事实、${task.recommendationBlockers.length} 条阻塞和复核记录都已经收在下面，不会打断主叙事。`,
      english
        ? "Replay, audit, memory, worker output, boundary trace, sendability trace, handoff trace and historical changes stay available on demand."
        : "回放、审计、记忆、工作结果、边界记录、发送边界记录、交接记录和历史变化都保留在附注层按需可看。",
    ],
    reviewRequestDetailWorkerSummary: [
      english
        ? "Approval and communication workers keep the request, boundary and next owner aligned to one judgement-first review page."
        : "审批和沟通工作项会持续把请求、边界和下一位接手人对齐到同一张先判断的复核页面上。",
      english
        ? "Customer success now owns the dedicated follow-through surface, while company / meeting detail stays as context rather than proxy."
        : "客户成功现在已经有独立的后续推进面，公司和会议详情会回到上下文页，而不是继续代替接手判断。",
    ],
    reviewRequestDetailNextAction: buildReviewRequestActions({
      task,
      english,
      primaryOwner,
    }),
    reviewRequestDetailRiskSignal: riskSignal,
    reviewRequestDetailAudienceMode: audienceMode,
    reviewRequestDetailScene: scene,
    reviewRequestDetailSendabilityMode: sendabilityMode,
    reviewRequestDetailEvidenceGroups: buildEvidenceGroups({
      english,
      replayItems: [
        task.editableContent ??
          task.actionItem.description ??
          (english ? "No editable content yet." : "当前还没有可编辑内容。"),
      ],
      auditItems: [
        english
          ? `Review status: ${task.status} · updated ${formatDateLabel(task.updatedAt)}`
          : `当前复核状态：${task.status} · 更新时间 ${formatDateLabel(task.updatedAt)}`,
      ],
      memoryItems: task.recommendationFacts
        .slice(0, 3)
        .map((item) => item.title),
      workerItems: [
        task.reasoning ??
          (english
            ? "No extra worker reasoning yet."
            : "当前还没有更多工作判断。"),
      ],
      boundaryItems: task.recommendationBlockers
        .slice(0, 3)
        .map((item) =>
          english
            ? `${item.title} · ${item.blockerText}`
            : `${item.title} · ${item.blockerText}`,
        ),
      sendabilityItems: [
        english
          ? `Current review sendability stays at ${sendabilityMode}.`
          : `当前发送边界停在 ${formatSendabilityMode(sendabilityMode, false)}。`,
      ],
      handoffItems: [
        english
          ? "The next move can now route into founder, sales, delivery or account follow-through without pretending the request is already resolved."
          : "下一步现在可以转给创始人、销售、交付或账户跟进，但不会假装这个请求已经解决。",
      ],
      historyItems: [
        english
          ? `Created at ${formatDateLabel(task.createdAt)}`
          : `创建于 ${formatDateLabel(task.createdAt)}`,
      ],
    }),
    pageWhyItMatters: [
      english
        ? "Review request should not read like a raw approval shell. It should first tell the team why this request exists and who should take over next."
        : "复核请求不应该先像原始审批壳层；它应该先告诉团队为什么这条请求存在，以及下一步该由谁接手。",
      task.isHighRisk
        ? english
          ? "The request is already high-risk, so weak review framing here will directly spill into trust, sendability and role handoff mistakes."
          : "当前请求已经进入高风险窗口，所以这里如果复核措辞不清，会直接外溢成信任、发送评估和角色接手错误。"
        : english
          ? "Even a lower-risk request still changes whether the next move belongs in follow-up, founder framing, delivery clarification or account follow-through."
          : "即使是较低风险请求，它也会改变下一步究竟该停在跟进、创始人措辞、交付澄清还是账户跟进。",
      english
        ? "The current page already groups the action content, approval reason and handoff options here, so the remaining work is choosing the right owner and boundary."
        : "当前页已经把动作内容、审批原因和交接选项收在这里，所以剩下真正的工作是选对负责人和边界。",
    ],
    pageEvidenceLinks: buildReviewEvidenceLinks({ task, english }),
    pageEscalationHint: english
      ? "If anyone wants to skip review and speak as if approval already happened, step back into boundary-first handling immediately."
      : "如果任何人想跳过复核，直接按“已批准”去说，就立刻退回边界优先处理。",
  });
  const protocol = toReviewRequestDetailPageReportingProtocol(contract);
  const navigation = createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType: "review-request-detail",
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: formatReviewStage(task, english),
      detailNodeBoundary: protocol.pageBoundarySummary[0],
      detailNodeAudienceMode: formatAudienceMode(audienceMode, english),
      detailNodeSendabilityMode: formatSendabilityMode(
        sendabilityMode,
        english,
      ),
      detailNodeStrengthMode: null,
      detailNodePrev: task.actionItem.opportunity
        ? {
            type: "follow-up-detail",
            href: `/follow-ups/${task.actionItem.opportunity.id}`,
            label: english ? "Follow-up detail" : "跟进详情",
            summary: english
              ? "Return to follow-up when the team still needs to rework the draft before review closes."
              : "如果团队还需要先重做草稿，再关闭复核，就回到跟进。",
          }
        : {
            type: "conversation",
            href: task.actionItem.contact
              ? `/contacts/${task.actionItem.contact.id}`
              : "/approvals",
            label: english ? "Prior chain detail" : "上一段链路",
            summary: english
              ? "Return to the prior chain owner before review hardens the next move."
              : "在复核把下一步收紧之前，先回到上一段链路负责人。",
          },
      detailNodeNext:
        primaryOwner === "founder"
          ? {
              type: "founder-conversation",
              href: task.actionItem.opportunity
                ? `/founder-conversations/${task.actionItem.opportunity.id}`
                : "/approvals",
              label: english
                ? "Founder conversation detail"
                : "创始人对话详情",
              summary: english
                ? "Move here once the request needs founder-owned framing."
                : "当请求需要创始人亲自承接措辞时，切到这里。",
            }
          : primaryOwner === "delivery"
            ? {
                type: "delivery-conversation",
                href: task.actionItem.opportunity
                  ? `/delivery-conversations/${task.actionItem.opportunity.id}`
                  : "/approvals",
                label: english
                  ? "Delivery conversation detail"
                  : "交付对话详情",
                summary: english
                  ? "Move here once the request needs delivery-owned clarification."
                  : "当请求需要交付亲自承接澄清时，切到这里。",
              }
            : {
                type: "sales-conversation",
                href: task.actionItem.opportunity
                  ? `/sales-conversations/${task.actionItem.opportunity.id}`
                  : "/approvals",
                label: english
                  ? "Sales conversation detail"
                  : "销售对话详情",
                summary: english
                  ? "Move here once the request needs sales-owned follow-through."
                  : "当请求需要销售亲自承接跟进闭环时，切到这里。",
              },
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority: priorityForRisk(riskSignal),
      detailNodeNavigationHint: english
        ? "Use review request detail when the team needs to decide who should take over next, what boundary still applies and whether review can be closed at all."
        : "当团队需要判断下一步该由谁接手、当前边界还在什么位置、以及复核到底能不能关闭时，停在复核请求详情面。",
    },
    handoffs: buildReviewRequestHandoffs({
      task,
      english,
      protocol,
      primaryOwner,
    }),
  });

  return createPageModel({
    kind: "review-request-detail",
    eyebrow: english
      ? "Communication chain / Review request detail"
      : "沟通链 / 复核请求详情",
    title: english
      ? `${task.actionItem.title} review request detail`
      : `${task.actionItem.title} 复核请求详情页`,
    description: english
      ? `${task.actionItem.opportunity?.title ?? "No linked opportunity"} · ${formatReviewScene(scene, true)}`
      : `${task.actionItem.opportunity?.title ?? "未关联机会"} · ${formatReviewScene(scene, false)}`,
    actions: buildHeaderActions({
      english,
      kind: "review-request-detail",
      primaryHref: `/approvals?approvalId=${task.id}`,
      relatedHref: task.actionItem.opportunity
        ? `/follow-ups/${task.actionItem.opportunity.id}`
        : task.actionItem.meeting
          ? `/meetings/${task.actionItem.meeting.id}`
          : null,
      evidenceHref: task.actionItem.opportunity
        ? `/memory?objectType=OPPORTUNITY&objectId=${task.actionItem.opportunity.id}`
        : task.actionItem.contact
          ? `/memory?objectType=CONTACT&objectId=${task.actionItem.contact.id}`
          : null,
    }),
    briefingLabel: english ? "Review request judgement" : "复核请求判断",
    navigation,
    protocol,
    chips: [
      {
        label: english ? "Prepared review surface" : "待复核结果面",
        tone: "sky",
      },
      {
        label: formatAgentAuthorityState(agentSurface.authorityState, english),
        tone: toneForAgentAuthorityState(agentSurface.authorityState),
      },
      {
        label: formatAgentAttentionState(agentSurface.attentionState, english),
        tone: toneForAgentAttentionState(agentSurface.attentionState),
      },
      { label: formatReviewScene(scene, english), tone: "sky" },
      {
        label: formatSendabilityMode(sendabilityMode, english),
        tone: toneForSendability(sendabilityMode),
      },
      {
        label: formatRiskSignal(riskSignal, english),
        tone: riskSignal === "high" ? "amber" : "violet",
      },
    ],
    secondarySummaryItems: [
      {
        label: english ? "Scene" : "当前场景",
        value: formatReviewScene(scene, english),
      },
      {
        label: english ? "Audience mode" : "当前受众",
        value: formatAudienceMode(audienceMode, english),
      },
      {
        label: english ? "Sendability" : "当前发送评估",
        value: formatSendabilityMode(sendabilityMode, english),
      },
      {
        label: english ? "Approver" : "当前审批人",
        value: task.approver?.name ?? (english ? "Unassigned" : "未分配"),
      },
      {
        label: english ? "Suggested owner" : "建议接手人",
        value:
          primaryOwner === "founder"
            ? english
              ? "Founder"
              : "创始人"
            : primaryOwner === "delivery"
              ? english
                ? "Delivery"
                : "交付"
              : english
                ? "Sales"
                : "销售",
      },
      {
        label: english ? "Action type" : "动作类型",
        value: formatReviewRequestActionType(
          task.actionItem.actionType,
          english,
        ),
      },
    ],
    boundaryLabel: english
      ? "Boundary, review mode and handoff"
      : "边界、复核模式与交接",
    actionLabel: english ? "Available next actions" : "可直接执行的动作",
    evidenceLabel: english ? "Evidence drawer" : "证据抽屉",
    evidenceCountLabel: english
      ? `${contract.reviewRequestDetailEvidenceGroups.length} grouped tracks`
      : `${contract.reviewRequestDetailEvidenceGroups.length} 组依据`,
    evidenceGroups: contract.reviewRequestDetailEvidenceGroups,
    stageBadge: formatReviewStage(task, english),
    authorityState: agentSurface.authorityState,
    attentionState: agentSurface.attentionState,
    recentChangesLabel: agentSurface.recentChangesLabel,
    recentChangesItems: agentSurface.recentChangesItems,
    resurfaceReasonLabel: agentSurface.resurfaceReasonLabel,
    resurfaceReasonItems: agentSurface.resurfaceReasonItems,
    policyLabel: agentSurface.policyLabel,
    policyItems: agentSurface.policyItems,
    progressTraceLabel: agentSurface.progressTraceLabel,
    progressTraceItems: agentSurface.progressTraceItems,
  });
}

function buildReviewRequestAgentSurface({
  task,
  primaryOwner,
  sendabilityMode,
  english,
}: {
  task: ReviewRequestDetail;
  primaryOwner: "sales" | "founder" | "delivery";
  sendabilityMode: ReviewRequestDetailReportingContract["reviewRequestDetailSendabilityMode"];
  english: boolean;
}): ReviewRequestAgentSurfaceModel {
  const authorityState = deriveReviewRequestAuthorityState(task);
  const attentionState = deriveReviewRequestAttentionState(task);
  const reviewedAt = task.reviewedBy ? task.updatedAt : null;
  const reviewerName = task.reviewedBy?.name ?? null;

  const recentChangesItems = compactItems([
    task.status === "EXECUTED"
      ? english
        ? `${reviewerName ?? "A reviewer"} closed the review line on ${formatDateLabel(reviewedAt ?? task.updatedAt)} and moved the next bounded move to ${formatPrimaryOwner(primaryOwner, true)}.`
        : `${reviewerName ?? "有复核人"} 在 ${formatDateLabel(reviewedAt ?? task.updatedAt)} 关闭了复核线，并把下一条有边界的动作交给 ${formatPrimaryOwner(primaryOwner, false)}。`
      : task.status === "REJECTED"
        ? english
          ? `${reviewerName ?? "A reviewer"} requested revision on ${formatDateLabel(reviewedAt ?? task.updatedAt)} before this can move honestly.`
          : `${reviewerName ?? "有复核人"} 在 ${formatDateLabel(reviewedAt ?? task.updatedAt)} 提出了修改请求，这条线现在还不能直接往前推。`
        : task.status === "WITHDRAWN"
          ? english
            ? `The prior review route was withdrawn on ${formatDateLabel(task.updatedAt)} and now needs a narrower next handoff.`
            : `上一条复核路径在 ${formatDateLabel(task.updatedAt)} 被撤回，当前需要一条更窄的下一步交接。`
          : english
            ? `This review request is still waiting for explicit human review as of ${formatDateLabel(task.updatedAt)}.`
            : `截至 ${formatDateLabel(task.updatedAt)}，这条复核请求仍在等待显式人工复核。`,
    task.resultPreview
      ? english
        ? "A bounded result preview is already prepared so the reviewer can judge the next move without reopening raw payloads."
        : "当前已经准备好一版有边界的结果预览，复核人不必回到原始数据载荷才能判断下一步。"
      : task.editableContent
        ? english
          ? "Editable review content remains available if the next move still needs bounded revision."
          : "如果下一步仍需要有边界的修订，当前可编辑复核内容仍然可用。"
        : null,
  ]);

  const resurfaceReasonItems = compactItems([
    task.status === "PENDING"
      ? english
        ? "This is back because the next outward move still needs explicit human review before anyone speaks with more certainty."
        : "这条线回到这里，是因为下一次对外动作仍需要显式人工复核，之后任何人才可以说得更确定。"
      : task.status === "REJECTED"
        ? english
          ? "This is back because revision is now the honest next move and the current wording is still boundary-limited."
          : "这条线回到这里，是因为当前最诚实的下一步已经变成修改，而现有措辞仍然受边界限制。"
        : task.status === "EXECUTED"
          ? english
            ? `This is back because review is no longer the blocker; the next bounded handoff now belongs with ${formatPrimaryOwner(primaryOwner, true)}.`
            : `这条线回到这里，是因为复核已经不再是阻塞；下一条有边界的交接现在属于 ${formatPrimaryOwner(primaryOwner, false)}。`
          : english
            ? "This is back because the prior review path changed and the next bounded owner still needs to be made explicit."
            : "这条线回到这里，是因为上一条复核路径已经变化，而下一位有边界的负责人仍需要被显式说出来。",
    task.isHighRisk
      ? english
        ? "High-risk wording still needs boundary-first handling here; this page cannot quietly act like approval equals commitment."
        : "当前高风险措辞仍需要边界优先处理；这页不能悄悄把审批讲成承诺。"
      : null,
  ]);

  const policyItems = compactItems([
    english
      ? "This review line can stay prepared, summarized and visible here, but it still does not close review or send externally."
      : "这条复核线当前可以继续保持已准备、已汇总且可见，但它仍然不会替你关闭复核，也不会对外发送。",
    task.status === "PENDING"
      ? english
        ? "Human review is still required before any outward move is even considered."
        : "在考虑任何对外动作之前，当前仍然必须先经过人工复核。"
      : task.status === "REJECTED"
        ? english
          ? "Revision is required before the request can honestly move back into follow-through."
          : "在这条请求能够诚实回到跟进闭环之前，当前仍必须先完成修改。"
        : english
          ? `The next move now belongs to ${formatPrimaryOwner(primaryOwner, true)}, but this page still remains review-only and non-commitment.`
          : `下一步现在属于 ${formatPrimaryOwner(primaryOwner, false)}，但这页仍然保持仅复核和非承诺。`,
    english
      ? `Current review posture stays at ${sendabilityMode}, so external send remains disabled on this page.`
      : `当前复核姿态停在 ${formatSendabilityMode(sendabilityMode, false)}，所以这页仍然禁止外部发送。`,
    english
      ? "Commitment remains disabled until the next owner reframes this outside raw review posture."
      : "在下一位负责人把这条线从原始复核姿态中重新表述出来之前，承诺仍然保持禁用。",
  ]);

  const progressTraceItems = compactItems([
    english
      ? "A bounded review request surface is already prepared."
      : "当前已经准备好一张有边界的复核请求面。",
    task.status === "EXECUTED"
      ? english
        ? `${reviewerName ?? "A reviewer"} reviewed this and released the next bounded handoff to ${formatPrimaryOwner(primaryOwner, true)}.`
        : `${reviewerName ?? "有复核人"} 已完成复核，并把下一条有边界的交接交给 ${formatPrimaryOwner(primaryOwner, false)}。`
      : task.status === "REJECTED"
        ? english
          ? `${reviewerName ?? "A reviewer"} requested revision before this could move out of review posture.`
          : `${reviewerName ?? "有复核人"} 已提出修改请求，这条线暂时不能离开复核姿态。`
        : task.status === "WITHDRAWN"
          ? english
            ? "The prior review route was withdrawn and now needs a narrower next owner and boundary."
            : "上一条复核路线已经撤回，当前需要更窄的下一位负责人和边界。"
          : english
            ? "Still waiting on a human reviewer before the next move becomes explicit."
            : "当前仍在等待人工复核人，之后下一步才会变得明确。",
  ]);

  return {
    authorityState,
    attentionState,
    recentChangesLabel: english ? "Since last seen" : "自上次查看以来",
    recentChangesItems,
    resurfaceReasonLabel: english
      ? "Why this is back now"
      : "为什么这条线又回到这里",
    resurfaceReasonItems,
    policyLabel: english
      ? "What stays available now / what remains blocked"
      : "当前仍可做什么 / 当前还被什么卡住",
    policyItems,
    progressTraceLabel: english ? "Progress trace" : "进度轨迹",
    progressTraceItems,
  };
}

function deriveReviewRequestAuthorityState(
  task: ReviewRequestDetail,
): AgentAuthorityState {
  if (task.status === "EXECUTED") {
    return "user-backed";
  }

  if (
    task.reviewedBy != null ||
    task.status === "REJECTED" ||
    task.status === "WITHDRAWN"
  ) {
    return "user-reviewed";
  }

  return "helm-prepared";
}

function deriveReviewRequestAttentionState(
  task: ReviewRequestDetail,
): AgentAttentionState {
  switch (task.status) {
    case "EXECUTED":
      return "pushing";
    case "REJECTED":
      return "blocked";
    case "PENDING":
      return "review-before-send";
    default:
      return "watching";
  }
}

function formatPrimaryOwner(
  owner: "sales" | "founder" | "delivery",
  english: boolean,
) {
  if (owner === "founder") {
    return english ? "Founder" : "创始人";
  }

  if (owner === "delivery") {
    return english ? "Delivery" : "交付";
  }

  return english ? "Sales" : "销售";
}

function compactItems(items: Array<string | null>) {
  return items.filter((item): item is string => item != null);
}

function createPageModel({
  kind,
  eyebrow,
  title,
  description,
  actions,
  briefingLabel,
  navigation,
  protocol,
  chips,
  secondarySummaryItems,
  boundaryLabel,
  actionLabel,
  evidenceLabel,
  evidenceCountLabel,
  evidenceGroups,
  stageBadge,
  authorityState,
  attentionState,
  recentChangesLabel,
  recentChangesItems,
  resurfaceReasonLabel,
  resurfaceReasonItems,
  policyLabel,
  policyItems,
  progressTraceLabel,
  progressTraceItems,
}: {
  kind: PageKind;
  eyebrow: string;
  title: string;
  description: string;
  actions: HeaderLink[];
  briefingLabel: string;
  navigation: UnifiedDetailNavigationModel;
  protocol: PageReportingProtocol;
  chips: Chip[];
  secondarySummaryItems: SecondarySummaryItem[];
  boundaryLabel: string;
  actionLabel: string;
  evidenceLabel: string;
  evidenceCountLabel: string;
  evidenceGroups: EvidenceGroup[];
  stageBadge: string;
  authorityState?: AgentAuthorityState;
  attentionState?: AgentAttentionState;
  recentChangesLabel?: string;
  recentChangesItems?: string[];
  resurfaceReasonLabel?: string;
  resurfaceReasonItems?: string[];
  policyLabel?: string;
  policyItems?: string[];
  progressTraceLabel?: string;
  progressTraceItems?: string[];
}): InboxFollowupReviewRequestPageModel {
  return {
    rootDataAttributes: {
      "data-inbox-followup-review-request-page": "true",
      "data-inbox-followup-review-request-kind": kind,
      ...(kind === "review-request-detail"
        ? { "data-shared-agent-surface": "review-request-detail" }
        : {}),
    },
    eyebrow,
    title,
    description,
    actions,
    briefingLabel,
    navigation,
    protocol,
    chips,
    secondarySummaryItems,
    boundaryLabel,
    actionLabel,
    evidenceLabel,
    evidenceCountLabel,
    evidenceGroups,
    stageBadge,
    authorityState,
    attentionState,
    recentChangesLabel,
    recentChangesItems,
    resurfaceReasonLabel,
    resurfaceReasonItems,
    policyLabel,
    policyItems,
    progressTraceLabel,
    progressTraceItems,
  };
}

function buildHeaderActions({
  english,
  kind,
  primaryHref,
  relatedHref,
  evidenceHref,
}: {
  english: boolean;
  kind: PageKind;
  primaryHref: string;
  relatedHref: string | null;
  evidenceHref: string | null;
}): HeaderLink[] {
  const primaryLabel =
    kind === "inbox-detail"
      ? english
        ? "Open inbox list"
        : "打开收件箱"
      : kind === "follow-up-detail"
        ? english
          ? "Open role follow-up page"
          : "打开角色跟进页"
        : english
          ? "Open approvals list"
          : "打开复核与边界";

  const relatedLabel =
    kind === "inbox-detail"
      ? english
        ? "Open follow-up detail"
        : "打开跟进详情"
      : kind === "follow-up-detail"
        ? english
          ? "Open review request detail"
          : "打开复核请求详情"
        : english
          ? "Open prior chain detail"
          : "打开上一段链路详情";

  return [
    { label: primaryLabel, href: primaryHref },
    ...(relatedHref
      ? [
          {
            label: relatedLabel,
            href: relatedHref,
            variant: "secondary" as const,
          },
        ]
      : []),
    ...(evidenceHref
      ? [
          {
            label: english ? "Open evidence" : "查看依据",
            href: evidenceHref,
            variant: "ghost" as const,
          },
        ]
      : []),
  ];
}

function buildInboxActions({
  thread,
  english,
  hasReviewRequest,
}: {
  thread: InboxThreadDetail;
  english: boolean;
  hasReviewRequest: boolean;
}): HeaderLink[] {
  const actions: HeaderLink[] = [
    {
      label: english ? "Return to inbox list" : "回到收件箱列表",
      href: `/inbox?threadId=${thread.id}`,
      variant: "default" as const,
    },
  ];

  if (thread.opportunity) {
    actions.push({
      label: english ? "Open follow-up detail" : "打开跟进详情",
      href: `/follow-ups/${thread.opportunity.id}`,
      variant: "secondary" as const,
    });
  }

  if (hasReviewRequest && thread.opportunity) {
    actions.push({
      label: english
        ? "Open review request from follow-up"
        : "从跟进详情打开复核请求",
      href: `/follow-ups/${thread.opportunity.id}`,
      variant: "ghost" as const,
    });
  } else if (thread.opportunity) {
    actions.push({
      label: english ? "Open package detail" : "打开方案包",
      href: `/packages/${thread.opportunity.id}`,
      variant: "ghost" as const,
    });
  }

  return actions;
}

function buildInboxEvidenceLinks({
  thread,
  english,
}: {
  thread: InboxThreadDetail;
  english: boolean;
}) {
  const links = [
    {
      label: english ? "Open inbox list" : "打开收件箱列表",
      href: `/inbox?threadId=${thread.id}`,
    },
  ];

  if (thread.opportunity) {
    links.push(
      {
        label: english ? "Open proposal detail" : "打开提案页面",
        href: `/proposals/${thread.opportunity.id}`,
      },
      {
        label: english
          ? "Open external narrative detail"
          : "打开对外叙事页面",
        href: `/external-narratives/${thread.opportunity.id}`,
      },
    );
  }

  return links;
}

function buildInboxHandoffs({
  thread,
  english,
  protocol,
  hasReviewRequest,
}: {
  thread: InboxThreadDetail;
  english: boolean;
  protocol: PageReportingProtocol;
  hasReviewRequest: boolean;
}): CrossDetailHandoff[] {
  const visibilityMode: CrossDetailHandoffVisibilityMode =
    thread.shouldReply || thread.status === "WAITING_US"
      ? "review-before-send"
      : thread.opportunity
        ? "customer-facing-with-boundary"
        : "internal-only";

  const handoffs: CrossDetailHandoff[] = [
    {
      handoffSource: "conversation" as const,
      handoffTarget: "inbox-detail" as const,
      handoffReason: english
        ? "The next move now needs the real thread context instead of one abstract conversation layer."
        : "下一步现在需要真实线程上下文，而不是继续停在抽象对话层。",
      handoffBoundary: protocol.pageBoundarySummary[0],
      handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
      handoffDependency: protocol.pageBoundarySummary[2] ?? null,
      handoffRisk: english
        ? "Raw thread pressure can still be misread as commitment if boundary and non-commitment cues disappear."
        : "如果边界与非承诺线索消失，原始线程压力仍可能被误读成承诺。",
      handoffDecisionRequest: protocol.pageDecisionRequest[0],
      handoffNextAction: english ? "Open inbox detail." : "打开收件箱详情面。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: visibilityMode,
      handoffHref: `/inbox/${thread.id}`,
    },
  ];

  if (thread.opportunity) {
    handoffs.push(
      {
        handoffSource: "inbox-detail" as const,
        handoffTarget: "customer-success" as const,
        handoffReason: english
          ? "Route back to customer success when the thread is only one part of the current success follow-through, issue or escalation picture."
          : "当线程只是当前客户成功跟进闭环、问题或升级画面中的一部分时，就回到客户成功。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "If the team keeps reading the thread as the whole story, it can lose the wider success boundary and overstate certainty."
          : "如果团队把线程本身当成全部故事，就可能丢失更宽的客户成功边界，并把确定性说过头。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open customer success handoff."
          : "打开客户成功交接。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          visibilityMode === "customer-facing-with-boundary"
            ? "internal-only"
            : visibilityMode,
        handoffHref: `/customer-success/${thread.opportunity.id}`,
      },
      {
        handoffSource: "inbox-detail" as const,
        handoffTarget: "follow-up-detail" as const,
        handoffReason: english
          ? "The thread context is already clear enough that the next useful move is follow-up judgement, not more inbox reading."
          : "当前线程上下文已经足够清楚，下一步最有价值的是跟进判断，而不是继续停在收件箱。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "If follow-up wording gets ahead of the thread boundary, it can overstate certainty."
          : "如果跟进措辞超过当前线程边界，就可能过度夸大确定性。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open follow-up detail."
          : "打开跟进详情面。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: visibilityMode,
        handoffHref: `/follow-ups/${thread.opportunity.id}`,
      },
      {
        handoffSource: "inbox-detail" as const,
        handoffTarget: "package" as const,
        handoffReason: english
          ? "Route back to package shaping when the thread exposes scope, prerequisite or dependency pressure that copy alone cannot solve."
          : "如果这条线程暴露的是范围、前置或依赖压力，而不是单靠话术能解决的问题，就回到方案包构形。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "Package gaps can still be misread as promise gaps if the team answers too quickly from the inbox."
          : "如果团队从收件箱里太快给答复，方案包缺口仍可能被误读成承诺缺口。",
        handoffDecisionRequest:
          protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open package detail."
          : "打开方案包详情。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: "internal-only",
        handoffHref: `/packages/${thread.opportunity.id}`,
      },
      {
        handoffSource: "inbox-detail" as const,
        handoffTarget: "external-narrative" as const,
        handoffReason: english
          ? "Route into external narrative only when the thread is no longer the problem and a reusable outward explanation is needed."
          : "只有当线程本身已经不是问题，而且已经需要一层可复用的对外解释时，才切到对外叙事。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "If narrative gets stronger than the inbox boundary allows, it can be misread as commitment."
          : "如果叙事强到超过收件箱当前边界，它就可能被误读成承诺。",
        handoffDecisionRequest:
          protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open external narrative detail."
          : "打开对外叙事详情面。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          visibilityMode === "review-before-send"
            ? "review-before-send"
            : "customer-facing-with-boundary",
        handoffHref: `/external-narratives/${thread.opportunity.id}`,
      },
    );
  }

  if (hasReviewRequest && thread.opportunity) {
    handoffs.push({
      handoffSource: "inbox-detail" as const,
      handoffTarget: "review-request-detail" as const,
      handoffReason: english
        ? "Thread pressure already shows review-sensitive wording, so the next stop may need review request rather than a free outbound reply."
        : "当前线程压力已经暴露复核-敏感措辞，所以下一步可能需要先过复核请求，而不是直接对外回复。",
      handoffBoundary: protocol.pageBoundarySummary[0],
      handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
      handoffDependency: protocol.pageBoundarySummary[2] ?? null,
      handoffRisk: english
        ? "Skipping review here can turn thread handling into accidental commitment."
        : "如果这里跳过复核，就可能把线程处理直接滑成意外承诺。",
      handoffDecisionRequest: protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open follow-up and review path."
        : "打开跟进 / 复核路径。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: "review-before-send",
      handoffHref: `/follow-ups/${thread.opportunity.id}`,
    });
  }

  return handoffs;
}

function buildFollowupActions({
  detail,
  english,
  pendingApprovalId,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  pendingApprovalId: string | null;
}): HeaderLink[] {
  const actions: HeaderLink[] = [
    {
      label: english ? "Open role follow-up page" : "打开角色跟进页面",
      href: `/sales-followups/${detail.id}`,
      variant: "default" as const,
    },
    {
      label: english ? "Open conversation detail" : "打开对话页面",
      href: `/conversations/${detail.id}`,
      variant: "secondary" as const,
    },
  ];

  if (pendingApprovalId) {
    actions.push({
      label: english
        ? "Open review request detail"
        : "打开复核请求详情",
      href: `/review-requests/${pendingApprovalId}`,
      variant: "ghost" as const,
    });
  } else {
    actions.push({
      label: english ? "Open offer detail" : "打开提案页面",
      href: `/offers/${detail.id}`,
      variant: "ghost" as const,
    });
  }

  return actions;
}

function buildFollowupHandoffs({
  detail,
  english,
  protocol,
  pendingApprovalId,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  protocol: PageReportingProtocol;
  pendingApprovalId: string | null;
}): CrossDetailHandoff[] {
  const visibilityMode: CrossDetailHandoffVisibilityMode =
    pendingApprovalId != null
      ? "review-before-send"
      : "customer-facing-with-boundary";

  const handoffs: CrossDetailHandoff[] = [
    {
      handoffSource: "conversation" as const,
      handoffTarget: "follow-up-detail" as const,
      handoffReason: english
        ? "The shared conversation scene is stable enough to decide the concrete follow-up move."
        : "当前共享对话场景已经足够稳定，可以进一步决定具体跟进动作。",
      handoffBoundary: protocol.pageBoundarySummary[0],
      handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
      handoffDependency: protocol.pageBoundarySummary[2] ?? null,
      handoffRisk: english
        ? "If the follow-up gets stronger than the conversation boundary, it can be misread as commitment."
        : "如果跟进强到超过当前对话边界，就可能被误读成承诺。",
      handoffDecisionRequest: protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open follow-up detail."
        : "打开跟进详情面。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: visibilityMode,
      handoffHref: `/follow-ups/${detail.id}`,
    },
    {
      handoffSource: "follow-up-detail" as const,
      handoffTarget: pendingApprovalId
        ? "review-request-detail"
        : "customer-facing-offer",
      handoffReason: pendingApprovalId
        ? english
          ? "The next move now needs review before it travels outward."
          : "下一步现在需要先过复核，之后才能继续往外走。"
        : english
          ? "The follow-up is stable enough to inherit the lighter customer-facing offer surface."
          : "当前跟进已经足够稳定，可以继承更轻的客户可见报价表面。",
      handoffBoundary: protocol.pageBoundarySummary[0],
      handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
      handoffDependency: protocol.pageBoundarySummary[2] ?? null,
      handoffRisk: pendingApprovalId
        ? english
          ? "Skipping review here can turn follow-up pressure into accidental commitment."
          : "如果这里跳过复核，就可能把跟进压力直接滑成意外承诺。"
        : english
          ? "Offer wording can still overstate certainty if the boundary line disappears."
          : "如果边界线消失，报价措辞仍可能过度夸大确定性。",
      handoffDecisionRequest: protocol.pageDecisionRequest[0],
      handoffNextAction: pendingApprovalId
        ? english
          ? "Open review request detail."
          : "打开复核请求详情面。"
        : english
          ? "Open offer detail."
          : "打开提案详情面。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: pendingApprovalId
        ? "review-before-send"
        : "customer-facing-with-boundary",
      handoffHref: pendingApprovalId
        ? `/review-requests/${pendingApprovalId}`
        : `/offers/${detail.id}`,
    },
    {
      handoffSource: "follow-up-detail" as const,
      handoffTarget: "proposal" as const,
      handoffReason: english
        ? "Route back to proposal when the next follow-up still depends on clearer scope, terms or next-phase framing."
        : "如果下一次跟进仍依赖更清楚的范围、条款或下一阶段措辞，就回到提案。",
      handoffBoundary: protocol.pageBoundarySummary[0],
      handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
      handoffDependency: protocol.pageBoundarySummary[2] ?? null,
      handoffRisk: english
        ? "If proposal ambiguity is answered inside follow-up copy, the team can over-promise without noticing."
        : "如果提案歧义被塞进跟进文案里回答，团队就可能在不知不觉中过度承诺。",
      handoffDecisionRequest:
        protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open proposal detail."
        : "打开提案详情。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: "internal-only",
      handoffHref: `/proposals/${detail.id}`,
    },
    {
      handoffSource: "follow-up-detail" as const,
      handoffTarget: "external-narrative" as const,
      handoffReason: english
        ? "Route into external narrative when the next follow-up already needs a reusable outward story, not just one draft."
        : "如果下一次跟进已经需要一层可复用的对外故事，而不只是一次草稿，就切到对外叙事。",
      handoffBoundary: protocol.pageBoundarySummary[0],
      handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
      handoffDependency: protocol.pageBoundarySummary[2] ?? null,
      handoffRisk: english
        ? "Narrative can still get ahead of the follow-up boundary and be misread as commitment."
        : "叙事仍可能跑到跟进边界前面，被误读成承诺。",
      handoffDecisionRequest:
        protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open external narrative detail."
        : "打开对外叙事详情面。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: visibilityMode,
      handoffHref: `/external-narratives/${detail.id}`,
    },
  ];

  return handoffs;
}

function buildReviewRequestActions({
  task,
  english,
  primaryOwner,
}: {
  task: ReviewRequestDetail;
  english: boolean;
  primaryOwner: "founder" | "sales" | "delivery";
}): HeaderLink[] {
  const actions: HeaderLink[] = [
    {
      label: english ? "Open approvals list" : "打开复核与边界",
      href: `/approvals?approvalId=${task.id}`,
      variant: "default" as const,
    },
  ];

  if (task.actionItem.opportunity) {
    actions.push({
      label:
        primaryOwner === "founder"
          ? english
            ? "Open founder conversation detail"
            : "打开创始人沟通详情"
          : primaryOwner === "delivery"
            ? english
              ? "Open delivery conversation detail"
              : "打开交付沟通详情"
            : english
              ? "Open sales conversation detail"
              : "打开销售沟通详情",
      href:
        primaryOwner === "founder"
          ? `/founder-conversations/${task.actionItem.opportunity.id}`
          : primaryOwner === "delivery"
            ? `/delivery-conversations/${task.actionItem.opportunity.id}`
            : `/sales-conversations/${task.actionItem.opportunity.id}`,
      variant: "secondary" as const,
    });
  }

  if (task.actionItem.opportunity) {
    actions.push({
      label: english ? "Open follow-up detail" : "打开跟进详情",
      href: `/follow-ups/${task.actionItem.opportunity.id}`,
      variant: "ghost" as const,
    });
  }

  return actions;
}

function buildReviewEvidenceLinks({
  task,
  english,
}: {
  task: ReviewRequestDetail;
  english: boolean;
}) {
  const links = [
    {
      label: english ? "Open approvals list" : "打开复核与边界",
      href: `/approvals?approvalId=${task.id}`,
    },
  ];

  if (task.actionItem.opportunity) {
    links.push(
      {
        label: english ? "Open proposal detail" : "打开提案页面",
        href: `/proposals/${task.actionItem.opportunity.id}`,
      },
      {
        label: english
          ? "Open external narrative detail"
          : "打开对外叙事页面",
        href: `/external-narratives/${task.actionItem.opportunity.id}`,
      },
    );
  }

  return links;
}

function buildReviewRequestHandoffs({
  task,
  english,
  protocol,
  primaryOwner,
}: {
  task: ReviewRequestDetail;
  english: boolean;
  protocol: PageReportingProtocol;
  primaryOwner: "founder" | "sales" | "delivery";
}): CrossDetailHandoff[] {
  const handoffs: CrossDetailHandoff[] = [];

  if (task.actionItem.opportunity) {
    handoffs.push({
      handoffSource: "follow-up-detail" as const,
      handoffTarget: "review-request-detail" as const,
      handoffReason: english
        ? "The next move is approval-sensitive enough that follow-up should pass into review request instead of traveling outward directly."
        : "当前下一步已经足够审批敏感，所以跟进应先交给复核请求，而不是直接对外。",
      handoffBoundary: protocol.pageBoundarySummary[0],
      handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
      handoffDependency: protocol.pageBoundarySummary[2] ?? null,
      handoffRisk: english
        ? "Skipping this review can turn a draft into accidental commitment."
        : "如果跳过这次复核，就可能把草稿直接滑成意外承诺。",
      handoffDecisionRequest: protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open review request detail."
        : "打开复核请求详情面。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: "review-before-send",
      handoffHref: `/review-requests/${task.id}`,
    });

    if (primaryOwner === "founder") {
      handoffs.push({
        handoffSource: "review-request-detail" as const,
        handoffTarget: "founder-conversation" as const,
        handoffReason: english
          ? "Founder should now take the next trust-sensitive framing."
          : "下一步现在应由创始人接手信任敏感措辞。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "If the next owner forgets the review boundary, the request can be mistaken for approval-complete commitment."
          : "如果下一位负责人忘了当前复核边界，这条请求就可能被误当成“已批准的承诺”。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open founder conversation detail."
          : "打开创始人对话详情。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: "review-before-send",
        handoffHref: `/founder-conversations/${task.actionItem.opportunity.id}`,
      });
    } else if (primaryOwner === "delivery") {
      handoffs.push({
        handoffSource: "review-request-detail" as const,
        handoffTarget: "delivery-conversation" as const,
        handoffReason: english
          ? "Delivery should now take the next scope or rollout clarification."
          : "下一步现在应由交付接手范围或上线节奏澄清。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "If the next owner forgets the review boundary, the request can be mistaken for approval-complete commitment."
          : "如果下一位负责人忘了当前复核边界，这条请求就可能被误当成“已批准的承诺”。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open delivery conversation detail."
          : "打开交付对话详情。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: "review-before-send",
        handoffHref: `/delivery-conversations/${task.actionItem.opportunity.id}`,
      });
    } else {
      handoffs.push({
        handoffSource: "review-request-detail" as const,
        handoffTarget: "sales-conversation" as const,
        handoffReason: english
          ? "Sales should now take the next follow-through once review is clear enough."
          : "当复核已经足够清楚时，下一步应由销售接手跟进闭环。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "If the next owner forgets the review boundary, the request can be mistaken for approval-complete commitment."
          : "如果下一位负责人忘了当前复核边界，这条请求就可能被误当成“已批准的承诺”。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open sales conversation detail."
          : "打开销售对话详情。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: "review-before-send",
        handoffHref: `/sales-conversations/${task.actionItem.opportunity.id}`,
      });
    }

    handoffs.push({
      handoffSource: "review-request-detail" as const,
      handoffTarget: "customer-success" as const,
      handoffReason: english
        ? "This review request now belongs on a dedicated customer success handoff surface instead of hiding behind company-level proxy routing."
        : "这条复核请求现在应该进入专门的客户成功交接面，而不是继续躲在公司级代理路由后面。",
      handoffBoundary: protocol.pageBoundarySummary[0],
      handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
      handoffDependency: protocol.pageBoundarySummary[2] ?? null,
      handoffRisk: english
        ? "If customer success inherits this as if review were already closed, the chain can slide into accidental commitment."
        : "如果客户成功按“复核已经结束”去继承这条请求，这条链就可能滑向意外承诺。",
      handoffDecisionRequest:
        protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open customer success handoff."
        : "打开客户成功交接。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: "review-before-send",
      handoffHref: `/customer-success/${task.actionItem.opportunity.id}`,
    });

    handoffs.push({
      handoffSource: "review-request-detail" as const,
      handoffTarget: "company-detail" as const,
      handoffReason: english
        ? "Use company detail only when the team needs broader account context after the review, not as the customer success proxy."
        : "只有当团队需要更宽的账户上下文时才回到公司详情面，而不是继续把它当作客户成功代理。",
      handoffBoundary: protocol.pageBoundarySummary[0],
      handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
      handoffDependency: protocol.pageBoundarySummary[2] ?? null,
      handoffRisk: english
        ? "Company detail must stay account context. If it takes over the success judgement again, the real handoff owner becomes implicit."
        : "公司详情必须继续只是账户上下文。如果它再次接管客户成功判断，真正的交接负责人就会重新变成隐式。",
      handoffDecisionRequest:
        protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open company detail."
        : "打开公司详情面。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: "internal-only",
      handoffHref: task.actionItem.opportunity.company
        ? `/companies/${task.actionItem.opportunity.company.id}`
        : `/packages/${task.actionItem.opportunity.id}`,
    });

    handoffs.push({
      handoffSource: "review-request-detail" as const,
      handoffTarget: "proposal" as const,
      handoffReason: english
        ? "Return to proposal when review exposes unresolved scope, terms or next-phase framing."
        : "如果复核暴露出未解决的范围、条款或下一阶段措辞，就回到提案。",
      handoffBoundary: protocol.pageBoundarySummary[0],
      handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
      handoffDependency: protocol.pageBoundarySummary[2] ?? null,
      handoffRisk: english
        ? "If proposal gaps are answered as if approved, the chain can drift into false certainty."
        : "如果提案缺口被当成“已经批准”去回答，这条链就会滑向虚假的确定性。",
      handoffDecisionRequest:
        protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open proposal detail."
        : "打开提案详情。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: "internal-only",
      handoffHref: `/proposals/${task.actionItem.opportunity.id}`,
    });

    handoffs.push({
      handoffSource: "review-request-detail" as const,
      handoffTarget: "external-narrative" as const,
      handoffReason: english
        ? "Route into external narrative only after review pressure is explicit and the next outward layer still needs reusable wording."
        : "只有在复核压力已经说清楚，且下一层对外措辞仍需要复用时，才切到对外叙事。",
      handoffBoundary: protocol.pageBoundarySummary[0],
      handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
      handoffDependency: protocol.pageBoundarySummary[2] ?? null,
      handoffRisk: english
        ? "Narrative can still be overstated if the review request is mistaken for approval-complete status."
        : "如果把复核请求误当成“审批已完成”，叙事仍可能被说过头。",
      handoffDecisionRequest:
        protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open external narrative detail."
        : "打开对外叙事详情面。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: "review-before-send",
      handoffHref: `/external-narratives/${task.actionItem.opportunity.id}`,
    });
  } else {
    handoffs.push({
      handoffSource: "review-request-detail" as const,
      handoffTarget: "conversation" as const,
      handoffReason: english
        ? "Without an attached opportunity, the request should step back into shared conversation prep first."
        : "在没有关联机会的情况下，这条请求应该先退回共享沟通准备。",
      handoffBoundary: protocol.pageBoundarySummary[0],
      handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
      handoffDependency: protocol.pageBoundarySummary[2] ?? null,
      handoffRisk: english
        ? "The missing opportunity frame keeps this request internal-only for now."
        : "由于缺少机会框架，这条请求当前仍然只能内部处理。",
      handoffDecisionRequest: protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Return to approvals list."
        : "回到复核与边界。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: "internal-only",
      handoffHref: `/approvals?approvalId=${task.id}`,
    });
  }

  return handoffs;
}

function buildEvidenceGroups({
  english,
  replayItems,
  auditItems,
  memoryItems,
  workerItems,
  boundaryItems,
  sendabilityItems,
  handoffItems,
  historyItems,
}: {
  english: boolean;
  replayItems: string[];
  auditItems: string[];
  memoryItems: string[];
  workerItems: string[];
  boundaryItems: string[];
  sendabilityItems: string[];
  handoffItems: string[];
  historyItems: string[];
}): InboxFollowupReviewRequestEvidenceGroup[] {
  return [
    {
      groupId: "replay",
      label: english ? "Replay" : "回放",
      items: replayItems,
    },
    {
      groupId: "audit",
      label: english ? "Audit" : "审计",
      items: auditItems,
    },
    {
      groupId: "memory",
      label: english ? "Memory" : "经营记忆",
      items: memoryItems,
    },
    {
      groupId: "worker_output",
      label: english ? "Worker output" : "执行输出",
      items: workerItems,
    },
    {
      groupId: "boundary_trace",
      label: english ? "Boundary trace" : "边界轨迹",
      items: boundaryItems.length
        ? boundaryItems
        : [
            english
              ? "No extra boundary trace."
              : "当前没有额外边界轨迹。",
          ],
    },
    {
      groupId: "sendability_trace",
      label: english ? "Sendability trace" : "发送评估轨迹",
      items: sendabilityItems,
    },
    {
      groupId: "handoff_trace",
      label: english ? "Handoff trace" : "交接轨迹",
      items: handoffItems,
    },
    {
      groupId: "historical_changes",
      label: english ? "Historical changes" : "历史变化",
      items: historyItems,
    },
  ];
}

function mapRiskSignal(
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  extraPressure: boolean,
): InboxFollowupReviewRequestRiskSignal {
  if (riskLevel === "CRITICAL" || riskLevel === "HIGH" || extraPressure) {
    return "high";
  }
  if (riskLevel === "MEDIUM") return "caution";
  return "watch";
}

function priorityForRisk(riskSignal: InboxFollowupReviewRequestRiskSignal) {
  if (riskSignal === "high") return "urgent" as const;
  if (riskSignal === "caution") return "important" as const;
  return "watch" as const;
}

function toneForSendability(
  mode:
    | InboxDetailReportingContract["inboxDetailSendabilityMode"]
    | FollowupDetailReportingContract["followupDetailSendabilityMode"]
    | ReviewRequestDetailReportingContract["reviewRequestDetailSendabilityMode"],
) {
  if (mode === "customer-visible") return "emerald" as const;
  if (mode === "safe-with-boundary") return "sky" as const;
  if (mode === "review-before-send") return "amber" as const;
  return "violet" as const;
}

function formatThreadScene(
  scene: InboxDetailReportingContract["inboxDetailScene"],
  english: boolean,
) {
  if (scene === "inbox-customer-thread") {
    return english ? "Customer thread" : "客户线程";
  }
  return english ? "Internal thread" : "内部线程";
}

function formatFollowupScene(
  scene: FollowupDetailReportingContract["followupDetailScene"],
  english: boolean,
) {
  switch (scene) {
    case "followup-draft":
      return english ? "Draft" : "草稿态";
    case "followup-ready-to-review":
      return english ? "Ready to review" : "待复核";
    case "followup-review-before-send":
      return english ? "Review before send" : "发送前复核";
    default:
      return english ? "Internal prep only" : "仅内部准备";
  }
}

function formatReviewScene(
  scene: ReviewRequestDetailReportingContract["reviewRequestDetailScene"],
  english: boolean,
) {
  switch (scene) {
    case "review-request-pending":
      return english ? "Pending review" : "待审批";
    case "review-request-escalated":
      return english ? "Escalated review" : "升级审批";
    case "review-request-blocked":
      return english ? "Blocked review" : "受阻审批";
    default:
      return english ? "Internal prep only" : "仅内部准备";
  }
}

function formatAudienceMode(
  mode:
    | InboxDetailReportingContract["inboxDetailAudienceMode"]
    | FollowupDetailReportingContract["followupDetailAudienceMode"]
    | ReviewRequestDetailReportingContract["reviewRequestDetailAudienceMode"],
  english: boolean,
) {
  switch (mode) {
    case "customer-visible":
      return english ? "Customer visible" : "面向客户";
    case "shared-review":
      return english ? "Shared review" : "共享复核";
    case "account-owner":
      return english ? "Account owner" : "账户负责人";
    default:
      return english ? "Internal only" : "仅内部";
  }
}

function formatSendabilityMode(
  mode:
    | InboxDetailReportingContract["inboxDetailSendabilityMode"]
    | FollowupDetailReportingContract["followupDetailSendabilityMode"]
    | ReviewRequestDetailReportingContract["reviewRequestDetailSendabilityMode"],
  english: boolean,
) {
  switch (mode) {
    case "customer-visible":
      return english ? "Customer visible" : "可直接对外";
    case "safe-with-boundary":
      return english ? "Safe with boundary" : "带边界可说";
    case "review-before-send":
      return english ? "Review before send" : "发送前复核";
    case "discussion-only":
      return english ? "Discussion only" : "仅供讨论";
    case "boundary-only":
      return english ? "Boundary only" : "仅边界说明";
    default:
      return english ? "Internal only" : "仅内部";
  }
}

function formatRiskSignal(
  signal: InboxFollowupReviewRequestRiskSignal,
  english: boolean,
) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Caution" : "谨慎";
  return english ? "Watch" : "观察";
}

function formatThreadStage(thread: InboxThreadDetail, english: boolean) {
  const statusLabel =
    thread.status === "WAITING_US"
      ? english
        ? "Waiting on us"
        : "待我方动作"
      : thread.status === "WAITING_THEM"
        ? english
          ? "Waiting on them"
          : "待对方动作"
        : thread.status === "OPEN"
          ? english
            ? "Open"
            : "打开"
          : english
            ? "Closed"
            : "已关闭";

  return thread.opportunity
    ? `${statusLabel} · ${thread.opportunity.stage}`
    : statusLabel;
}

function formatReviewStage(task: ReviewRequestDetail, english: boolean) {
  const statusLabel =
    task.status === "PENDING"
      ? english
        ? "Pending"
        : "待审批"
      : task.status === "EXECUTED"
        ? english
          ? "Executed"
          : "已执行"
        : task.status === "REJECTED"
          ? english
            ? "Rejected"
            : "已拒绝"
          : english
            ? "Withdrawn"
            : "已撤回";
  return `${statusLabel} · ${task.actionItem.riskLevel}`;
}
