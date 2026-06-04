import type {
  AgentAttentionState,
  AgentAuthorityState,
  AgentPolicyCue,
  AgentSurfaceSections,
} from "@/lib/presentation/agent-primitives";
import {
  buildAgentPolicyTag,
  formatAgentAttentionState,
  formatAgentAuthorityState,
  formatAgentPolicyCue,
  toneForAgentAttentionState,
  toneForAgentAuthorityState,
} from "@/lib/presentation/agent-primitives";
import {
  createPageReportingProtocol,
  type PageReportingProtocol,
} from "@/lib/presentation/reporting-protocol";
import {
  createUnifiedDetailNavigationModel,
  type UnifiedDetailNavigationModel,
} from "@/lib/presentation/unified-detail-navigation";
import { formatExpansionReviewDateLabel } from "@/features/expansion-review/expansion-review-date-labels";
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

type ExpansionReviewOpportunityDetail = {
  id: string;
  title: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  nextAction: string | null;
  dueDate: Date | null;
  updatedAt: Date;
  company: { id: string; name: string } | null;
  contacts: Array<{ id: string; name: string }>;
  owner: { id: string; name: string } | null;
  actionItems: Array<{
    id: string;
    title: string;
    actionType: string;
    description: string | null;
    status: string;
    executionStatus: string;
    suggestedAt: Date;
    executedAt: Date | null;
    updatedAt: Date;
    dueDate: Date | null;
    approvalTask: {
      id: string;
      status: "PENDING" | "EXECUTED" | "REJECTED" | "WITHDRAWN";
      reviewedAt: Date | null;
      reviewedById: string | null;
    } | null;
  }>;
  meetings: Array<{
    id: string;
    title: string;
    startsAt: Date;
    note: { summary: string | null } | null;
  }>;
  emailThreads: Array<{
    id: string;
    subject: string;
    status: string;
    updatedAt: Date;
    messages: Array<{
      id: string;
      sender: string;
      body: string;
      sentAt: Date;
      isInbound: boolean;
    }>;
  }>;
  memoryFacts: Array<{
    id: string;
    title: string;
    content: string;
    updatedAt: Date;
  }>;
  commitments: Array<{
    id: string;
    title: string;
    status: string;
    overdueFlag: boolean;
    dueDate: Date | null;
    commitmentText: string;
    updatedAt: Date;
  }>;
  blockers: Array<{
    id: string;
    title: string;
    blockerText: string;
    severity: number;
    status: string;
    updatedAt: Date;
  }>;
  briefingSnapshot: {
    generatedAt: Date;
    payload: {
      summary?: string;
      recommendedNextSteps?: string[];
    };
  } | null;
  auditLogs: Array<{
    id: string;
    actor: string;
    summary: string;
    createdAt: Date;
  }>;
};

type ExpansionReviewCompanyContext = {
  id: string;
  name: string;
  industry: string | null;
  contacts: Array<{ id: string; name: string }>;
  meetings: Array<{ id: string; title: string; startsAt: Date }>;
  opportunities: Array<{ id: string; title: string; stage: string }>;
  memoryEntries: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: Date;
  }>;
  briefingSnapshot: {
    payload: {
      summary?: string;
      recommendedNextSteps?: string[];
    };
  } | null;
} | null;

type ExpansionReviewTask = {
  id: string;
  status: "PENDING" | "EXECUTED" | "REJECTED" | "WITHDRAWN";
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: { id: string; name: string } | null;
  approver: { name: string } | null;
  actionItem: {
    id: string;
    title: string;
    actionType: string;
    description: string | null;
  };
};

type ExpansionReviewSignals = {
  pendingReview: ExpansionReviewTask | null;
  reviewedTask: ExpansionReviewTask | null;
  executedTask: ExpansionReviewTask | null;
  reviewedApproval:
    | ExpansionReviewOpportunityDetail["actionItems"][number]
    | null;
  executedApproval:
    | ExpansionReviewOpportunityDetail["actionItems"][number]
    | null;
  topBlocker: ExpansionReviewOpportunityDetail["blockers"][number] | null;
  overdueCommitment:
    | ExpansionReviewOpportunityDetail["commitments"][number]
    | null;
  recentThread: ExpansionReviewOpportunityDetail["emailThreads"][number] | null;
  recentMeeting: ExpansionReviewOpportunityDetail["meetings"][number] | null;
  latestAudit: ExpansionReviewOpportunityDetail["auditLogs"][number] | null;
};

type ExpansionReviewWatchState = {
  lastTouchAt: Date | null;
  lastTouchSummary: string;
};

type ExpansionReviewAgentSurfaceModel = AgentSurfaceSections & {
  authorityState: AgentAuthorityState;
  attentionState: AgentAttentionState;
  policyCues: AgentPolicyCue[];
};

export type ExpansionReviewPageModel = AgentSurfaceSections & {
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
  authorityState: AgentAuthorityState;
  attentionState: AgentAttentionState;
  policyLabel: string;
  policyItems: string[];
};

export function buildExpansionReviewDetailPageModel({
  detail,
  company,
  reviewTasks,
  stageLabel,
  currentUserId,
  english,
}: {
  detail: ExpansionReviewOpportunityDetail;
  company: ExpansionReviewCompanyContext;
  reviewTasks: ExpansionReviewTask[];
  stageLabel: string;
  currentUserId?: string;
  english: boolean;
}): ExpansionReviewPageModel {
  const signals = summarizeSignals(detail, reviewTasks);
  const authorityState = deriveAuthorityState(signals);
  const attentionState = deriveAttentionState(detail, signals);
  const watchState = buildWatchState({
    detail,
    reviewTasks,
    currentUserId,
    english,
  });
  const agentSurface = buildExpansionReviewAgentSurface({
    detail,
    stageLabel,
    signals,
    authorityState,
    attentionState,
    watchState,
    english,
  });
  const policyTags = agentSurface.policyCues.map((cue) =>
    buildAgentPolicyTag(cue, english),
  );
  const protocol = buildProtocol({
    detail,
    company,
    reviewTasks,
    signals,
    watchState,
    english,
  });
  const evidenceGroups = buildEvidenceGroups({
    detail,
    company,
    signals,
    english,
  });
  const navigation = buildNavigation({
    detail,
    signals,
    protocol,
    english,
  });
  const reviewPosture = describeCommercialReviewPosture(
    signals,
    attentionState,
    english,
  );
  const primaryPolicyTag =
    policyTags.find(
      (tag) => tag.label === formatAgentPolicyCue("approval-required", english),
    ) ??
    policyTags.find(
      (tag) =>
        tag.label === formatAgentPolicyCue("external-send-disabled", english),
    ) ??
    policyTags[0] ??
    null;

  return {
    rootDataAttributes: {
      "data-expansion-review-agent-surface": "true",
      "data-shared-agent-surface": "expansion-review-detail",
    },
    eyebrow: english
      ? "Expansion review / Review surface"
      : "拓展复核 / 复核面",
    title: english
      ? `${detail.title} · Expansion review`
      : `${detail.title} · Expansion review`,
    description: english
      ? `${detail.company?.name ?? "No company"} · ${stageLabel} · ${reviewPosture}`
      : `${detail.company?.name ?? "暂无公司"} · ${stageLabel} · ${reviewPosture}`,
    actions: buildHeaderActions({
      detail,
      signals,
      company,
      english,
    }),
    briefingLabel: english
      ? "Current expansion review judgement"
      : "当前扩展审查判断",
    navigation,
    protocol,
    chips: compactChips([
      {
        label: english ? "Prepared review surface" : "待复核结果面",
        tone: "sky",
      },
      {
        label: formatAgentAuthorityState(authorityState, english),
        tone: toneForAgentAuthorityState(authorityState),
      },
      {
        label: formatAgentAttentionState(attentionState, english),
        tone: toneForAgentAttentionState(attentionState),
      },
      primaryPolicyTag,
      {
        label: formatRisk(detail.riskLevel, english),
        tone:
          detail.riskLevel === "HIGH" || detail.riskLevel === "CRITICAL"
            ? "amber"
            : "violet",
      },
    ]),
    secondarySummaryItems: [
      {
        label: english ? "Commercial stage" : "商业阶段",
        value: stageLabel,
      },
      {
        label: english ? "Authority" : "权限依据",
        value: formatAgentAuthorityState(authorityState, english),
      },
      {
        label: english ? "Attention" : "注意事项",
        value: formatAgentAttentionState(attentionState, english),
      },
      {
        label: english ? "Commercial review posture" : "当前商业复核状态",
        value: reviewPosture,
      },
      {
        label: english ? "Current owner" : "当前负责人",
        value: detail.owner?.name ?? (english ? "Unassigned" : "未分配"),
      },
      {
        label: english ? "Last explicit user touch" : "最近一次显式用户触点",
        value: watchState.lastTouchSummary,
      },
    ],
    authorityState,
    attentionState,
    recentChangesLabel: agentSurface.recentChangesLabel,
    recentChangesItems: agentSurface.recentChangesItems,
    resurfaceReasonLabel: agentSurface.resurfaceReasonLabel,
    resurfaceReasonItems: agentSurface.resurfaceReasonItems,
    policyLabel:
      agentSurface.policyLabel ??
      (english
        ? "What stays available now / what remains blocked"
        : "当前仍可做什么 / 当前还被什么卡住"),
    policyItems: agentSurface.policyItems ?? [],
    boundaryLabel: english
      ? "Commercial boundary, review posture and non-commitment"
      : "商业边界、复核状态与非承诺",
    actionLabel: english ? "Available next actions" : "可直接执行的动作",
    progressTraceLabel: agentSurface.progressTraceLabel,
    progressTraceItems: agentSurface.progressTraceItems,
    evidenceLabel: english ? "Evidence drawer" : "证据抽屉",
    evidenceCountLabel: english
      ? `${evidenceGroups.length} grouped tracks`
      : `${evidenceGroups.length} 组依据`,
    evidenceGroups,
    stageBadge: english
      ? `Expansion review · ${formatRisk(detail.riskLevel, true)}`
      : `Expansion review · ${formatRisk(detail.riskLevel, false)}`,
  };
}

function summarizeSignals(
  detail: ExpansionReviewOpportunityDetail,
  reviewTasks: ExpansionReviewTask[],
): ExpansionReviewSignals {
  return {
    pendingReview:
      reviewTasks.find((task) => task.status === "PENDING") ?? null,
    reviewedTask: reviewTasks.find((task) => task.reviewedBy != null) ?? null,
    executedTask:
      reviewTasks.find((task) => task.status === "EXECUTED") ?? null,
    reviewedApproval:
      detail.actionItems.find(
        (item) => item.approvalTask?.reviewedAt != null,
      ) ?? null,
    executedApproval:
      detail.actionItems.find(
        (item) => item.approvalTask?.status === "EXECUTED",
      ) ?? null,
    topBlocker: detail.blockers[0] ?? null,
    overdueCommitment:
      detail.commitments.find((item) => item.overdueFlag) ?? null,
    recentThread: detail.emailThreads[0] ?? null,
    recentMeeting: detail.meetings[0] ?? null,
    latestAudit: detail.auditLogs[0] ?? null,
  };
}

function deriveAuthorityState(
  signals: ExpansionReviewSignals,
): AgentAuthorityState {
  if (signals.executedTask || signals.executedApproval) {
    return "user-backed";
  }

  if (signals.reviewedTask || signals.reviewedApproval) {
    return "user-reviewed";
  }

  return "helm-prepared";
}

function deriveAttentionState(
  detail: ExpansionReviewOpportunityDetail,
  signals: ExpansionReviewSignals,
): AgentAttentionState {
  if (signals.pendingReview) {
    return "review-before-send";
  }

  if (signals.topBlocker || signals.overdueCommitment) {
    return "blocked";
  }

  if (signals.recentThread?.status.includes("WAITING")) {
    return "waiting";
  }

  if (detail.nextAction || signals.executedTask || signals.executedApproval) {
    return "pushing";
  }

  return "watching";
}

function buildWatchState({
  detail,
  reviewTasks,
  currentUserId,
  english,
}: {
  detail: ExpansionReviewOpportunityDetail;
  reviewTasks: ExpansionReviewTask[];
  currentUserId?: string;
  english: boolean;
}): ExpansionReviewWatchState {
  const explicitReview =
    (currentUserId
      ? reviewTasks.find((task) => task.reviewedBy?.id === currentUserId)
      : null) ??
    reviewTasks.find((task) => task.reviewedBy != null) ??
    null;
  const explicitApproval =
    (currentUserId
      ? detail.actionItems.find(
          (item) => item.approvalTask?.reviewedById === currentUserId,
        )
      : null) ??
    detail.actionItems.find((item) => item.approvalTask?.reviewedAt != null) ??
    null;

  const reviewCandidate =
    explicitReview?.reviewedAt ?? explicitReview?.updatedAt ?? null;
  const approvalCandidate = explicitApproval?.approvalTask?.reviewedAt ?? null;

  if (
    reviewCandidate &&
    (!approvalCandidate || reviewCandidate >= approvalCandidate)
  ) {
    const reviewDateLabel = expansionReviewDateLabel(reviewCandidate, english);

    return {
      lastTouchAt: reviewCandidate,
      lastTouchSummary: english
        ? `${explicitReview?.reviewedBy?.name ?? "A reviewer"} reviewed this on ${reviewDateLabel}`
        : `${explicitReview?.reviewedBy?.name ?? "有复核人"} 在 ${formatDateLabel(reviewCandidate)} 复核了这条扩展审查`,
    };
  }

  if (approvalCandidate) {
    const approvalDateLabel = expansionReviewDateLabel(
      approvalCandidate,
      english,
    );

    return {
      lastTouchAt: approvalCandidate,
      lastTouchSummary: english
        ? `A human reviewed the linked approval on ${approvalDateLabel}`
        : `在 ${formatDateLabel(approvalCandidate)} 有人复核了相关审批`,
    };
  }

  const preparedDateLabel = expansionReviewDateLabel(detail.updatedAt, english);

  return {
    lastTouchAt: null,
    lastTouchSummary: english
      ? `No explicit user touch yet. The current commercial review read was prepared on ${preparedDateLabel}.`
      : `当前还没有显式用户触点。这条 commercial 复核判断准备于 ${formatDateLabel(detail.updatedAt)}。`,
  };
}

function buildExpansionReviewAgentSurface({
  detail,
  stageLabel,
  signals,
  authorityState,
  attentionState,
  watchState,
  english,
}: {
  detail: ExpansionReviewOpportunityDetail;
  stageLabel: string;
  signals: ExpansionReviewSignals;
  authorityState: AgentAuthorityState;
  attentionState: AgentAttentionState;
  watchState: ExpansionReviewWatchState;
  english: boolean;
}): ExpansionReviewAgentSurfaceModel {
  const policyCues = uniquePolicyCues([
    "advisory-only",
    "internal-only",
    signals.pendingReview ? "approval-required" : null,
    "external-send-disabled",
    "commitment-disabled",
  ]);
  const lastTouchDateLabel = watchState.lastTouchAt
    ? expansionReviewDateLabel(watchState.lastTouchAt, english)
    : null;

  const recentChangesItems = compactItems([
    watchState.lastTouchAt != null && detail.updatedAt > watchState.lastTouchAt
      ? signals.pendingReview
        ? english
          ? `Since ${lastTouchDateLabel}, explicit human commercial review is still open and keeps this line bounded.`
          : `自 ${formatDateLabel(watchState.lastTouchAt)} 以来，显式人工 commercial 复核仍未关闭，所以这条线仍保持有边界。`
        : signals.topBlocker
          ? english
            ? `Since ${lastTouchDateLabel}, blocker "${signals.topBlocker.title}" still keeps the commercial story from widening honestly.`
            : `自 ${formatDateLabel(watchState.lastTouchAt)} 以来，阻塞点「${signals.topBlocker.title}」仍然让这条商业叙事不能诚实地继续扩大。`
          : signals.recentThread &&
              signals.recentThread.updatedAt > watchState.lastTouchAt
            ? english
              ? `Since ${lastTouchDateLabel}, the latest external thread changed and the commercial posture now needs a fresh expansion review.`
              : `自 ${formatDateLabel(watchState.lastTouchAt)} 以来，最近一条外部线程已经变化，当前商业状态需要重新做一次扩展审查。`
            : english
              ? `Since ${lastTouchDateLabel}, this expansion review has stayed aligned to ${stageLabel} without widening the story prematurely.`
              : `自 ${formatDateLabel(watchState.lastTouchAt)} 以来，这条扩展审查一直对齐在「${stageLabel}」，没有提前把叙事抬大。`
      : watchState.lastTouchAt == null
        ? english
          ? "This expansion review is already prepared from the current blocker, commitment and thread signals, so the team can judge commercial posture without reopening raw context."
          : "当前这条扩展审查已经基于阻塞点、承诺压力和线程信号准备好，团队不必回翻原始上下文就能判断商业状态。"
        : english
          ? "The last explicit user touch still anchors the current expansion review posture."
          : "最近一次显式用户触点仍在锚定当前扩展审查状态。",
  ]);

  const resurfaceReasonItems = compactItems([
    signals.pendingReview
      ? english
        ? "This is back because stronger commercial wording still needs explicit human review before anyone widens the story."
        : "这条线回到这里，是因为更强的商业表达仍然需要显式人工复核，之后才谈得上扩大叙事。"
      : signals.topBlocker
        ? english
          ? `This is back because blocker "${signals.topBlocker.title}" still distorts the honest expansion picture.`
          : `这条线回到这里，是因为阻塞点「${signals.topBlocker.title}」仍在扭曲当前真实的扩展画面。`
        : signals.overdueCommitment
          ? english
            ? "This is back because open commitment pressure still needs an honest commercial review before any stronger framing."
            : "这条线回到这里，是因为开放承诺压力仍需先过一遍诚实的商业审查，之后才谈得上更强的表述。"
          : signals.recentThread
            ? english
              ? "This is back because the latest external thread can shift the next commercial move even though this surface remains non-commitment."
              : "这条线回到这里，是因为最近一条外部线程可能改写下一条商业动作，但这张面仍然保持非承诺。"
            : english
              ? "This is back to keep commercial review honest before the chain tries to widen again."
              : "这条线回到这里，是为了在链路再次扩大前，先把商业审查说诚实。",
  ]);

  const policyItems = compactItems([
    english
      ? "This expansion review can stay prepared, summarized and visible, but it still does not send externally or turn commercial framing into commitment."
      : "这张扩展审查当前可以继续保持已准备、已汇总且可见，但它仍然不会对外发送，也不会把商业表述写成承诺。",
    signals.pendingReview
      ? english
        ? "Human commercial review is still required before any stronger package / proposal-like wording is even reconsidered."
        : "在重新考虑任何更强的方案包或类似提案措辞前，当前仍然必须先经过人工商业复核。"
      : signals.topBlocker || signals.overdueCommitment
        ? english
          ? "This remains a boundary-limited commercial review until the blocker or open commitment pressure is honestly reduced."
          : "在阻塞点或开放承诺压力被诚实降低前，这条线仍然只是一条有边界的商业审查。"
        : english
          ? "This surface can sharpen the next commercial move, but the widening decision still belongs to a human."
          : "这张面可以帮助收紧下一条商业动作，但是否扩大推进仍然属于人的决定。",
    english
      ? "External send stays disabled here, and review-before-send does not become safe-to-send by default."
      : "这页仍然禁止外部发送，而且发送前复核也不会默认变成可安全外发。",
  ]);

  const progressTraceItems = compactItems([
    english
      ? "A bounded expansion-review commercial surface is already prepared."
      : "当前已经准备好一张有边界的扩展商业审查面。",
    authorityState === "user-backed"
      ? english
        ? "A human already backed a related approval or review line, so this page can focus on the next bounded commercial move."
        : "当前已经有人工支持过相关审批或复核线，所以这页可以把重心放在下一条有边界的商业动作上。"
      : authorityState === "user-reviewed"
        ? english
          ? "A human already reviewed the surrounding line, but commercial review still stays separate from package/proposal authority."
          : "当前已经有人复核过周边链路，但商业复核仍会和方案包 / 提案权限分开。"
        : english
          ? "No explicit human touch yet; the current commercial review stays visible until the next owner responds."
          : "当前还没有显式人工触点；在下一位负责人响应前，这条商业审查会继续保持可见。",
    attentionState === "review-before-send"
      ? english
        ? "Still waiting on explicit human review before this can widen beyond bounded commercial review."
        : "当前仍在等待显式人工复核，之后这条线才可能离开有边界的商业审查状态。"
      : attentionState === "blocked"
        ? english
          ? "Current blocker or overdue commitment keeps this expansion review boundary-limited."
          : "当前卡点或逾期承诺仍在把这条扩展审查卡在有边界的状态。"
        : attentionState === "waiting"
          ? english
            ? "The latest external thread is still in a waiting posture, so this stays an honest commercial watch layer."
            : "最近一条外部线程仍处于等待态，所以这里会继续保持为一层诚实的商业观察面。"
          : english
            ? "The next bounded commercial move is visible, but the page still stays advisory-first."
            : "当前下一条有边界的商业动作已经可见，但这页仍保持先建议、后行动。",
  ]);

  return {
    authorityState,
    attentionState,
    policyCues,
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

function buildProtocol({
  detail,
  company,
  reviewTasks,
  signals,
  watchState,
  english,
}: {
  detail: ExpansionReviewOpportunityDetail;
  company: ExpansionReviewCompanyContext;
  reviewTasks: ExpansionReviewTask[];
  signals: ExpansionReviewSignals;
  watchState: ExpansionReviewWatchState;
  english: boolean;
}) {
  const companyName =
    detail.company?.name ??
    company?.name ??
    (english ? "the account" : "当前账户");
  const nextPrimaryAction =
    signals.pendingReview != null
      ? {
          label: english ? "Open review request" : "打开复核请求",
          href: `/review-requests/${signals.pendingReview.id}`,
        }
      : signals.topBlocker || signals.overdueCommitment
        ? {
            label: english ? "Open success check" : "打开成功检查",
            href: `/success-checks/${detail.id}`,
          }
        : {
            label: english
              ? "Open customer success handoff"
              : "打开客户成功交接",
            href: `/customer-success/${detail.id}`,
          };

  return createPageReportingProtocol({
    pageJudgement: english
      ? "Use expansion review as the current commercial review judgement layer before anyone widens package, proposal or offer language."
      : "当前应先把扩展审查当作商业审查判断层，再决定是否继续扩大到方案包、提案或报价语言。",
    pageJudgementReason:
      detail.briefingSnapshot?.payload.summary ??
      (signals.pendingReview
        ? english
          ? `${companyName} still carries open human review pressure, so stronger commercial framing has to stay explicit before anyone talks with more certainty.`
          : `${companyName} 当前仍带着开放的人工复核压力，所以在任何人说得更确定前，更强的商业表述必须先被显式说清。`
        : signals.topBlocker
          ? english
            ? `${companyName} still has a visible blocker, so the team needs an honest expansion review before widening into stronger commercial language.`
            : `${companyName} 当前仍有可见阻塞点，所以团队需要先做一轮诚实的扩展审查，再决定是否扩大到更强的商业叙事。`
          : signals.overdueCommitment
            ? english
              ? `${companyName} still carries open commitment pressure, so commercial posture must stay bounded before anyone implies readiness.`
              : `${companyName} 当前仍带着开放承诺压力，所以在任何人暗示准备就绪前，商业状态必须继续保持有边界。`
            : english
              ? `${companyName} now needs a thinner expansion review that keeps commercial posture, unresolved boundary and next move on one page.`
              : `${companyName} 当前需要一张更薄的扩展审查页，把商业状态、未解决边界和下一步动作收在同一页。`),
    pageWhyItMatters: compactItems([
      english
        ? "Expansion review keeps commercial judgement separate from package / proposal / offer authority."
        : "扩展审查会把商业判断和方案包 / 提案 / 报价权限继续分开。",
      signals.pendingReview
        ? english
          ? "Pending human review still distorts how honestly the team can describe current commercial momentum."
          : "当前待人工复核仍在影响团队能否诚实描述这条商业推进线。"
        : signals.topBlocker || signals.overdueCommitment
          ? english
            ? "The current blocker / commitment picture can still overstate readiness unless the boundary stays visible."
            : "如果边界不继续显式保留，当前卡点 / 承诺压力画面仍可能把准备度说高。"
          : english
            ? "The next owner can inherit a cleaner commercial judgement without reopening raw thread, memory and approval context."
            : "下一位负责人不必回翻原始线程、记忆和审批上下文，也能继承一版更干净的商业判断。",
      signals.recentThread
        ? english
          ? "Latest external context is visible here, but it still does not silently become sendable or commitment-safe."
          : "最近一层外部上下文会继续显示在这里，但它不会被悄悄抬成可发送或可承诺。"
        : english
          ? "Current next move stays visible here so the chain can progress without hiding uncertainty."
          : "当前下一条动作会继续留在这里，让链路可以推进但不会把不确定性藏起来。",
    ]),
    pageActionSummary: compactItems([
      english
        ? "The current expansion-review surface already groups commercial pressure, blocker, review and recent thread signals on one thinner page."
        : "当前这张更薄的扩展审查页面已经把商业压力、阻塞点、复核和最近线程信号收在一起。",
      signals.pendingReview
        ? english
          ? "Human commercial review remains visible without forcing this page into a workflow controller."
          : "当前人工商业复核压力会继续显式可见，但这页不会因此变成流程控制器。"
        : signals.topBlocker
          ? english
            ? "The current blocker is already translated into a commercial review read instead of hiding in raw notes."
            : "当前卡点已经被翻译成一条商业审查判断，而不是继续藏在原始备注里。"
          : english
            ? "The next bounded commercial move stays explicit before anyone widens package / proposal-like language."
            : "在任何人把链路扩大到方案包或类似提案语言前，下一条有边界的商业动作会先继续挂清楚。",
      watchState.lastTouchAt
        ? english
          ? "Last explicit human touch remains visible so the team can tell whether this is still prepared-only or already human-reviewed."
          : "最近一次显式人工触点会继续留在前台，团队可以看清这条线究竟仍是仅已准备，还是已经有人复核过。"
        : null,
    ]),
    pageDecisionRequest: compactItems([
      signals.pendingReview
        ? english
          ? "Confirm whether this should remain human-review-limited until the current commercial review line closes."
          : "确认这条线是否必须继续停在人工复核受限状态，直到当前商业复核线关闭。"
        : signals.topBlocker || signals.overdueCommitment
          ? english
            ? "Confirm whether the current blocker means this should step back into success check instead of widening commercial framing."
            : "确认当前卡点是否意味着这条线应先退回成功检查，而不是继续扩大商业表述。"
          : english
            ? "Confirm whether commercial posture is now honest enough to support stronger package / proposal shaping without overstating certainty."
            : "确认当前商业状态是否已经足够诚实，可以支持更强的方案包 / 提案塑形，同时不夸大确定性。",
      english
        ? "Confirm what must stay explicit as boundary, dependency or non-commitment if anyone references this outward."
        : "确认如果有人需要对外提到这条线，哪些内容仍必须继续显式保留为边界、依赖或非承诺。",
    ]),
    pageNextAction: compactActions([
      nextPrimaryAction,
      {
        label: english ? "Open success check" : "打开成功检查",
        href: `/success-checks/${detail.id}`,
        variant: "secondary",
      },
      company?.id
        ? {
            label: english ? "Open company detail" : "打开公司详情",
            href: `/companies/${company.id}`,
            variant: "ghost",
          }
        : null,
    ]),
    pageBoundarySummary: compactItems([
      english
        ? "Expansion review can sharpen commercial posture, but it still does not equal package approval, proposal readiness, safe send or commitment."
        : "扩展审查可以把商业状态说得更清楚，但它仍然不等于方案包批准、提案已就绪、可安全外发或承诺。",
      signals.pendingReview
        ? english
          ? "Current human review pressure still keeps this in review-before-send / human-review-required posture."
          : "当前人工复核压力仍在把这条线停在发送前复核 / 需要人工复核状态。"
        : signals.topBlocker || signals.overdueCommitment
          ? english
            ? "Current blocker and open commitment pressure must stay visible before anyone widens the commercial story."
            : "在任何人扩大这条商业叙事前，当前卡点和开放承诺压力都必须继续保持可见。"
          : english
            ? "Even when commercial posture looks healthier, the widening decision still belongs to a human."
            : "即使当前商业状态看起来更健康，下一步是否扩大推进仍然属于人的决定。",
      english
        ? "External send remains disabled on this page, and review-before-send does not become safe-to-send by default."
        : "这页仍然禁止外部发送，而且发送前复核不会默认变成可安全外发。",
    ]),
    pageEvidenceSummary: compactItems([
      english
        ? `${detail.blockers.length} blockers, ${detail.commitments.length} commitments and ${reviewTasks.length} review traces remain grouped below without interrupting the main judgement.`
        : `当前 ${detail.blockers.length} 个阻塞点、${detail.commitments.length} 条承诺和 ${reviewTasks.length} 条复核痕迹都已经分组收在下方，不会打断主判断。`,
      english
        ? "Recent thread, meeting, memory and audit context remain available on demand."
        : "最近的线程、会议、记忆和审计上下文都保留在附注层按需可看。",
    ]),
    pageWorkerSummary: compactItems([
      english
        ? "This thinner expansion-review surface keeps commercial posture, blocker pressure and the next bounded move aligned."
        : "这张更薄的扩展审查页会持续把商业状态、阻塞压力和下一条有边界的动作对齐起来。",
      english
        ? "The broader customer success chain remains available, but this page does not quietly turn into package / proposal / offer authority."
        : "更广的客户成功链会继续可达，但这页不会悄悄滑成方案包 / 提案 / 报价权限。",
    ]),
    pagePrioritySignal:
      signals.pendingReview || signals.topBlocker || signals.overdueCommitment
        ? english
          ? "Commercial boundary active"
          : "当前商业边界仍然活跃"
        : english
          ? "Commercial review watch"
          : "当前属于商业复核观察",
    pageEscalationHint:
      signals.pendingReview || signals.topBlocker || signals.overdueCommitment
        ? english
          ? "Do not widen package / proposal-like language until the blocker / review line is honestly reduced."
          : "在阻塞点 / 复核线被诚实降低前，不要把方案包或类似提案语言继续扩大。"
        : undefined,
    pageEvidenceLinks: compactLinks([
      company?.id
        ? {
            label: english ? "Open company detail" : "打开公司详情",
            href: `/companies/${company.id}`,
          }
        : null,
      {
        label: english ? "Open customer success handoff" : "打开客户成功交接",
        href: `/customer-success/${detail.id}`,
      },
    ]),
  });
}

function buildEvidenceGroups({
  detail,
  company,
  signals,
  english,
}: {
  detail: ExpansionReviewOpportunityDetail;
  company: ExpansionReviewCompanyContext;
  signals: ExpansionReviewSignals;
  english: boolean;
}): EvidenceGroup[] {
  return [
    {
      groupId: "commercial-pressure",
      label: english ? "Commercial pressure" : "商业压力",
      items: compactItems([
        ...detail.blockers
          .slice(0, 3)
          .map((item) =>
            english
              ? `${item.title}: ${trimText(item.blockerText, 120)}`
              : `${item.title}：${trimText(item.blockerText, 120)}`,
          ),
        ...detail.commitments
          .filter((item) => item.status !== "FULFILLED")
          .slice(0, 3)
          .map((item) =>
            english
              ? `${item.title}: ${trimText(item.commitmentText, 120)}`
              : `${item.title}：${trimText(item.commitmentText, 120)}`,
          ),
        signals.overdueCommitment
          ? english
            ? `Open commitment cue: ${signals.overdueCommitment.title}`
            : `开放承诺提醒：${signals.overdueCommitment.title}`
          : null,
      ]),
    },
    {
      groupId: "review-and-thread",
      label: english ? "Review and thread context" : "复核与线程上下文",
      items: compactItems([
        ...detail.actionItems
          .filter((item) => item.approvalTask != null)
          .slice(0, 3)
          .map((item) =>
            english
              ? `${item.title}: approval ${item.approvalTask?.status.toLowerCase()}`
              : `${item.title}：审批 ${item.approvalTask?.status.toLowerCase()}`,
          ),
        signals.recentThread
          ? english
            ? `${signals.recentThread.subject}: ${trimText(signals.recentThread.messages[0]?.body ?? "", 120)}`
            : `${signals.recentThread.subject}：${trimText(signals.recentThread.messages[0]?.body ?? "", 120)}`
          : null,
        signals.recentMeeting?.note?.summary
          ? english
            ? `${signals.recentMeeting.title}: ${trimText(signals.recentMeeting.note.summary, 120)}`
            : `${signals.recentMeeting.title}：${trimText(signals.recentMeeting.note.summary, 120)}`
          : null,
      ]),
    },
    {
      groupId: "memory-and-audit",
      label: english ? "Memory and audit context" : "记忆与审计上下文",
      items: compactItems([
        ...detail.memoryFacts
          .slice(0, 3)
          .map((item) =>
            english
              ? `${item.title}: ${trimText(item.content, 120)}`
              : `${item.title}：${trimText(item.content, 120)}`,
          ),
        company?.briefingSnapshot?.payload.summary
          ? english
            ? `Company briefing: ${trimText(company.briefingSnapshot.payload.summary, 120)}`
            : `Company briefing：${trimText(company.briefingSnapshot.payload.summary, 120)}`
          : null,
        signals.latestAudit
          ? english
            ? `Latest audit: ${trimText(signals.latestAudit.summary, 120)}`
            : `最近一条审计：${trimText(signals.latestAudit.summary, 120)}`
          : null,
      ]),
    },
  ].filter((group) => group.items.length > 0);
}

function buildNavigation({
  detail,
  signals,
  protocol,
  english,
}: {
  detail: ExpansionReviewOpportunityDetail;
  signals: ExpansionReviewSignals;
  protocol: PageReportingProtocol;
  english: boolean;
}): UnifiedDetailNavigationModel {
  const boundary =
    protocol.pageBoundarySummary[0] ?? protocol.pageJudgementReason;
  const evidenceSummary =
    protocol.pageEvidenceSummary[0] ?? protocol.pageJudgementReason;
  const workerSummary =
    protocol.pageWorkerSummary[0] ?? protocol.pageJudgementReason;

  return createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType: "expansion-review",
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: english ? "Expansion review" : "扩展审查",
      detailNodeBoundary: boundary,
      detailNodeAudienceMode: english
        ? "Internal commercial review"
        : "内部商业审查",
      detailNodeSendabilityMode: english
        ? "External send disabled"
        : "禁止外部发送",
      detailNodeStrengthMode: english ? "Commercial review" : "商业审查",
      detailNodePrev: {
        type: "success-check",
        href: `/success-checks/${detail.id}`,
        label: english ? "Success check" : "成功检查",
        summary: english
          ? "Return to the thinner readiness layer when the current commercial posture still needs a cleaner read."
          : "如果当前商业状态仍需要更干净的判断，就回到更薄的成功检查层。",
      },
      detailNodeNext: null,
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority:
        signals.pendingReview || signals.topBlocker || signals.overdueCommitment
          ? "urgent"
          : signals.recentThread
            ? "important"
            : "watch",
      detailNodeNavigationHint: english
        ? "Use expansion review to keep the current commercial story honest before anyone tries to widen the chain again."
        : "先用扩展审查把当前商业叙事说诚实，再决定链路是否继续扩大。",
    },
    handoffs: compactHandoffs([
      {
        handoffSource: "expansion-review",
        handoffTarget: "success-check",
        handoffReason: english
          ? "Step back into success check when the current blocker or review line still dominates the honest commercial read."
          : "如果当前卡点或复核线仍在主导这条商业判断，就退回成功检查。",
        handoffBoundary: boundary,
        handoffPrerequisite:
          signals.pendingReview ||
          signals.topBlocker ||
          signals.overdueCommitment
            ? english
              ? "Keep the current blocker / review line explicit."
              : "保持当前卡点 / 复核线显式可见。"
            : null,
        handoffDependency:
          signals.pendingReview != null
            ? english
              ? "A human reviewer still needs to respond."
              : "仍需要一位人工复核人明确响应。"
            : null,
        handoffRisk: protocol.pagePrioritySignal ?? boundary,
        handoffDecisionRequest:
          protocol.pageDecisionRequest[0] ?? protocol.pageJudgement,
        handoffNextAction: english ? "Open success check." : "打开成功检查。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          signals.pendingReview != null
            ? "review-before-send"
            : "boundary-only",
        handoffHref: `/success-checks/${detail.id}`,
      },
      signals.pendingReview != null
        ? {
            handoffSource: "expansion-review" as const,
            handoffTarget: "review-request-detail" as const,
            handoffReason: english
              ? "Use review request detail when explicit human commercial review is still the current blocker."
              : "如果显式人工商业复核仍是当前卡点，就回到复核请求详情。",
            handoffBoundary: boundary,
            handoffPrerequisite: english
              ? "Keep review-before-send and non-commitment explicit."
              : "保持发送前复核和非承诺显式可见。",
            handoffDependency: english
              ? "A human reviewer still needs to respond."
              : "仍需要一位人工复核人明确响应。",
            handoffRisk: protocol.pagePrioritySignal ?? boundary,
            handoffDecisionRequest:
              protocol.pageDecisionRequest[0] ?? protocol.pageJudgement,
            handoffNextAction: english
              ? "Open review request detail."
              : "打开复核请求详情。",
            handoffWorkerSummary: protocol.pageWorkerSummary,
            handoffEvidenceSummary: protocol.pageEvidenceSummary,
            handoffVisibilityMode: "review-before-send" as const,
            handoffHref: `/review-requests/${signals.pendingReview.id}`,
          }
        : null,
      {
        handoffSource: "expansion-review",
        handoffTarget: "customer-success",
        handoffReason: english
          ? "Move back to customer success handoff when the commercial review still needs broader follow-through context rather than stronger framing."
          : "如果当前商业审查仍需要更广的跟进上下文，而不是更强的表述，就回到客户成功交接。",
        handoffBoundary: boundary,
        handoffPrerequisite:
          signals.topBlocker || signals.overdueCommitment
            ? english
              ? "Do not widen until the blocker / commitment line is honestly reduced."
              : "在阻塞点 / 承诺线被诚实降低前，不要继续扩大。"
            : null,
        handoffDependency: null,
        handoffRisk: protocol.pagePrioritySignal ?? boundary,
        handoffDecisionRequest:
          protocol.pageDecisionRequest[0] ?? protocol.pageJudgement,
        handoffNextAction: english
          ? "Open customer success handoff."
          : "打开客户成功交接。",
        handoffWorkerSummary: compactItems([
          workerSummary,
          english
            ? "Customer success keeps the broader follow-through line visible while expansion review stays thin and conservative."
            : "客户成功会继续保持更广的跟进线可见，而扩展审查会继续保持薄层和保守。",
        ]),
        handoffEvidenceSummary: compactItems([
          evidenceSummary,
          english
            ? "Commercial review evidence remains grouped here before the line widens again."
            : "在链路再次扩大前，商业复核依据会继续先在这里分组可见。",
        ]),
        handoffVisibilityMode:
          signals.pendingReview ||
          signals.topBlocker ||
          signals.overdueCommitment
            ? "boundary-only"
            : "internal-only",
        handoffHref: `/customer-success/${detail.id}`,
      },
    ]),
  });
}

function buildHeaderActions({
  detail,
  signals,
  company,
  english,
}: {
  detail: ExpansionReviewOpportunityDetail;
  signals: ExpansionReviewSignals;
  company: ExpansionReviewCompanyContext;
  english: boolean;
}): HeaderLink[] {
  return compactActions([
    {
      label: english ? "Open success check" : "打开成功检查",
      href: `/success-checks/${detail.id}`,
    },
    signals.pendingReview
      ? {
          label: english ? "Open review request" : "打开复核请求",
          href: `/review-requests/${signals.pendingReview.id}`,
          variant: "secondary",
        }
      : {
          label: english ? "Open customer success handoff" : "打开客户成功交接",
          href: `/customer-success/${detail.id}`,
          variant: "secondary",
        },
    company?.id
      ? {
          label: english ? "Open company detail" : "打开公司详情",
          href: `/companies/${company.id}`,
          variant: "ghost",
        }
      : null,
  ]);
}

function describeCommercialReviewPosture(
  signals: ExpansionReviewSignals,
  attentionState: AgentAttentionState,
  english: boolean,
) {
  if (attentionState === "review-before-send") {
    return english ? "Human commercial review required" : "需要人工商业复核";
  }

  if (attentionState === "blocked") {
    return english ? "Boundary-limited commercial review" : "有边界的商业审查";
  }

  if (signals.recentThread?.status.includes("WAITING")) {
    return english ? "Watching external response" : "观察外部回复";
  }

  return english ? "Commercial review watch" : "商业审查观察中";
}

function formatRisk(
  riskLevel: ExpansionReviewOpportunityDetail["riskLevel"],
  english: boolean,
) {
  switch (riskLevel) {
    case "CRITICAL":
      return english ? "Critical risk" : "高危风险";
    case "HIGH":
      return english ? "High risk" : "高风险";
    case "LOW":
      return english ? "Low risk" : "低风险";
    default:
      return english ? "Medium risk" : "中风险";
  }
}

function compactItems(items: Array<string | null>) {
  return items.filter((item): item is string => item != null);
}

function expansionReviewDateLabel(
  value: Date | string | null | undefined,
  english: boolean,
) {
  return formatExpansionReviewDateLabel(value, english, formatDateLabel);
}

function compactLinks(items: Array<{ label: string; href: string } | null>) {
  return items.filter(
    (item): item is { label: string; href: string } => item != null,
  );
}

function compactActions(items: Array<HeaderLink | null>) {
  return items.filter((item): item is HeaderLink => item != null);
}

function compactChips(items: Array<Chip | null>) {
  return items.filter((item): item is Chip => item != null);
}

function compactHandoffs<
  T extends {
    handoffSource: "expansion-review";
    handoffTarget:
      | "success-check"
      | "review-request-detail"
      | "customer-success";
    handoffReason: string;
    handoffBoundary: string;
    handoffPrerequisite: string | null;
    handoffDependency: string | null;
    handoffRisk: string;
    handoffDecisionRequest: string;
    handoffNextAction: string;
    handoffWorkerSummary: string[];
    handoffEvidenceSummary: string[];
    handoffVisibilityMode:
      | "review-before-send"
      | "internal-only"
      | "boundary-only";
    handoffHref: string;
  },
>(items: Array<T | null>) {
  return items.filter((item): item is T => item != null);
}

function uniquePolicyCues(items: Array<AgentPolicyCue | null>) {
  return Array.from(
    new Set(items.filter((item): item is AgentPolicyCue => item != null)),
  );
}
