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

type SuccessCheckOpportunityDetail = {
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

type SuccessCheckCompanyContext = {
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

type SuccessCheckReviewTask = {
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

type SuccessCheckSignals = {
  pendingReview: SuccessCheckReviewTask | null;
  reviewedTask: SuccessCheckReviewTask | null;
  executedTask: SuccessCheckReviewTask | null;
  reviewedApproval: SuccessCheckOpportunityDetail["actionItems"][number] | null;
  executedApproval: SuccessCheckOpportunityDetail["actionItems"][number] | null;
  topBlocker: SuccessCheckOpportunityDetail["blockers"][number] | null;
  overdueCommitment:
    | SuccessCheckOpportunityDetail["commitments"][number]
    | null;
  recentThread: SuccessCheckOpportunityDetail["emailThreads"][number] | null;
  recentMeeting: SuccessCheckOpportunityDetail["meetings"][number] | null;
  latestAudit: SuccessCheckOpportunityDetail["auditLogs"][number] | null;
};

type SuccessCheckWatchState = {
  lastTouchAt: Date | null;
  lastTouchSummary: string;
};

type SuccessCheckAgentSurfaceModel = AgentSurfaceSections & {
  authorityState: AgentAuthorityState;
  attentionState: AgentAttentionState;
  policyCues: AgentPolicyCue[];
};

export type SuccessCheckPageModel = AgentSurfaceSections & {
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

export function buildSuccessCheckDetailPageModel({
  detail,
  company,
  reviewTasks,
  stageLabel,
  currentUserId,
  english,
}: {
  detail: SuccessCheckOpportunityDetail;
  company: SuccessCheckCompanyContext;
  reviewTasks: SuccessCheckReviewTask[];
  stageLabel: string;
  currentUserId?: string;
  english: boolean;
}): SuccessCheckPageModel {
  const signals = summarizeSignals(detail, reviewTasks);
  const authorityState = deriveAuthorityState(signals);
  const attentionState = deriveAttentionState(detail, signals);
  const watchState = buildWatchState({
    detail,
    reviewTasks,
    currentUserId,
    english,
  });
  const agentSurface = buildSuccessCheckAgentSurface({
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

  const reviewPosture = describeReviewPosture(signals, attentionState, english);
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
      "data-success-check-agent-surface": "true",
      "data-shared-agent-surface": "success-check-detail",
    },
    eyebrow: english
      ? "Success check / Review surface"
      : "成功检查 / 复核面",
    title: english
      ? `${detail.title} · Success check`
      : `${detail.title} · 成功检查`,
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
      ? "Current success check judgement"
      : "当前成功检查判断",
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
        label: english ? "Review posture" : "当前复核状态",
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
      ? "Boundary, review posture and non-commitment"
      : "边界、复核状态与非承诺",
    actionLabel: english ? "Available next actions" : "可直接执行的动作",
    progressTraceLabel: agentSurface.progressTraceLabel,
    progressTraceItems: agentSurface.progressTraceItems,
    evidenceLabel: english ? "Evidence drawer" : "证据抽屉",
    evidenceCountLabel: english
      ? `${evidenceGroups.length} grouped tracks`
      : `${evidenceGroups.length} 组依据`,
    evidenceGroups,
    stageBadge: english
      ? `Success check · ${formatRisk(detail.riskLevel, true)}`
      : `成功检查 · ${formatRisk(detail.riskLevel, false)}`,
  };
}

function summarizeSignals(
  detail: SuccessCheckOpportunityDetail,
  reviewTasks: SuccessCheckReviewTask[],
): SuccessCheckSignals {
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
  signals: SuccessCheckSignals,
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
  detail: SuccessCheckOpportunityDetail,
  signals: SuccessCheckSignals,
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
  detail: SuccessCheckOpportunityDetail;
  reviewTasks: SuccessCheckReviewTask[];
  currentUserId?: string;
  english: boolean;
}): SuccessCheckWatchState {
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
    return {
      lastTouchAt: reviewCandidate,
      lastTouchSummary: english
        ? `${explicitReview?.reviewedBy?.name ?? "A reviewer"} reviewed this on ${formatDateLabel(reviewCandidate)}`
        : `${explicitReview?.reviewedBy?.name ?? "有复核人"} 在 ${formatDateLabel(reviewCandidate)} 复核了这条成功检查`,
    };
  }

  if (approvalCandidate) {
    return {
      lastTouchAt: approvalCandidate,
      lastTouchSummary: english
        ? `A human reviewed the linked approval on ${formatDateLabel(approvalCandidate)}`
        : `在 ${formatDateLabel(approvalCandidate)} 有人复核了相关审批`,
    };
  }

  return {
    lastTouchAt: null,
    lastTouchSummary: english
      ? `No explicit user touch yet. The current readiness read was prepared on ${formatDateLabel(detail.updatedAt)}.`
      : `当前还没有显式用户触点。这条准备度判断准备于 ${formatDateLabel(detail.updatedAt)}。`,
  };
}

function buildSuccessCheckAgentSurface({
  detail,
  stageLabel,
  signals,
  authorityState,
  attentionState,
  watchState,
  english,
}: {
  detail: SuccessCheckOpportunityDetail;
  stageLabel: string;
  signals: SuccessCheckSignals;
  authorityState: AgentAuthorityState;
  attentionState: AgentAttentionState;
  watchState: SuccessCheckWatchState;
  english: boolean;
}): SuccessCheckAgentSurfaceModel {
  const policyCues = uniquePolicyCues([
    "advisory-only",
    "internal-only",
    signals.pendingReview ? "approval-required" : null,
    "external-send-disabled",
    "commitment-disabled",
  ]);

  const recentChangesItems = compactItems([
    watchState.lastTouchAt != null && detail.updatedAt > watchState.lastTouchAt
      ? signals.pendingReview
        ? english
          ? `Since ${formatDateLabel(watchState.lastTouchAt)}, explicit review pressure is still open and keeps this at a readiness check.`
          : `自 ${formatDateLabel(watchState.lastTouchAt)} 以来，显式复核压力仍未关闭，所以这条线还停在准备度检查。`
        : signals.topBlocker
          ? english
            ? `Since ${formatDateLabel(watchState.lastTouchAt)}, blocker "${signals.topBlocker.title}" still keeps the account from widening honestly.`
            : `自 ${formatDateLabel(watchState.lastTouchAt)} 以来，阻塞点「${signals.topBlocker.title}」仍然让这条账户线不能诚实地继续扩大。`
          : signals.recentThread &&
              signals.recentThread.updatedAt > watchState.lastTouchAt
            ? english
              ? `Since ${formatDateLabel(watchState.lastTouchAt)}, the latest external thread changed and the next action now needs a fresh readiness read.`
              : `自 ${formatDateLabel(watchState.lastTouchAt)} 以来，最近一条外部线程已经变化，下一步现在需要重新做一次准备度判断。`
            : english
              ? `Since ${formatDateLabel(watchState.lastTouchAt)}, this success check has stayed aligned to ${stageLabel} without widening the story prematurely.`
              : `自 ${formatDateLabel(watchState.lastTouchAt)} 以来，这条成功检查一直对齐在「${stageLabel}」，没有提前把叙事抬大。`
      : watchState.lastTouchAt == null
        ? english
          ? "This success check is already prepared from the current blocker, commitment and thread signals, so the team can judge readiness without reopening raw context."
          : "当前这条成功检查已经基于阻塞点、承诺压力和线程信号准备好，团队不必回翻原始上下文就能判断准备度。"
        : english
          ? "The last explicit user touch still anchors the current success check posture."
          : "最近一次显式用户触点仍在锚定当前成功检查状态。",
  ]);

  const resurfaceReasonItems = compactItems([
    signals.pendingReview
      ? english
        ? "This is back because the account still needs human review before anyone widens the external story."
        : "这条线回到这里，是因为当前账户在任何人扩大外部叙事前，仍然需要先经过人工复核。"
      : signals.topBlocker
        ? english
          ? `This is back because blocker "${signals.topBlocker.title}" still distorts the honest readiness picture.`
          : `这条线回到这里，是因为阻塞点「${signals.topBlocker.title}」仍在扭曲当前真实的准备度画面。`
        : signals.overdueCommitment
          ? english
            ? `This is back because overdue commitment pressure still needs an honest check before any expansion-like move.`
            : `这条线回到这里，是因为逾期承诺压力仍需先过一遍诚实的检查，之后才谈得上扩大推进。`
          : signals.recentThread
            ? english
              ? "This is back because the latest external thread can shift the next action even though this surface still remains non-commitment."
              : "这条线回到这里，是因为最近一条外部线程可能改写下一步，但这张面仍然保持非承诺。"
            : english
              ? "This is back to keep readiness honest before the chain widens into expansion review."
              : "这条线回到这里，是为了在链路继续扩到扩展审查前，先把准备度说诚实。",
  ]);

  const policyItems = compactItems([
    english
      ? "This success check can stay prepared, summarized and visible, but it still does not send externally or turn readiness into commitment."
      : "这张成功检查当前可以继续保持已准备、已汇总且可见，但它仍然不会对外发送，也不会把准备度写成承诺。",
    signals.pendingReview
      ? english
        ? "Human review is still required before any outward wording is even reconsidered."
        : "在重新考虑任何对外措辞前，当前仍然必须先经过人工复核。"
      : signals.topBlocker || signals.overdueCommitment
        ? english
          ? "This remains a boundary-limited readiness read until the blocker or open commitment pressure is honestly reduced."
          : "在阻塞点或开放承诺压力被诚实降低前，这条线仍然只是一条有边界的准备度判断。"
        : english
          ? "This surface can guide the next move, but the widening decision still belongs to a human."
          : "这张面可以帮助判断下一步，但是否扩大推进仍然属于人的决定。",
    english
      ? "External send stays disabled here, and review-before-send does not become safe-to-send by default."
      : "这页仍然禁止外部发送，而且发送前复核也不会默认变成可安全外发。",
  ]);

  const progressTraceItems = compactItems([
    english
      ? "A thin success-check readiness surface is already prepared."
      : "当前已经准备好一张薄层成功检查准备度页面。",
    authorityState === "user-backed"
      ? english
        ? "A human already backed a related approval or review line, so the check can focus on the next bounded move instead of re-proving ownership."
        : "当前已经有人工支持过相关审批或复核线，所以这条检查可以把重心放在下一步有边界的动作，而不是重新证明归属。"
      : authorityState === "user-reviewed"
        ? english
          ? "A human already reviewed the surrounding line, but the readiness read still stays separate from any promise-like wording."
          : "当前已经有人复核过周边链路，但准备度判断仍会和类似承诺的措辞分开。"
        : english
          ? "No explicit human touch yet; the current readiness read stays visible until the next owner responds."
          : "当前还没有显式人工触点；在下一位负责人响应前，这条准备度判断会继续保持可见。",
    attentionState === "review-before-send"
      ? english
        ? "Still waiting on explicit review before this can move beyond a bounded check."
        : "当前仍在等待显式复核，之后这条线才可能离开有边界的检查状态。"
      : attentionState === "blocked"
        ? english
          ? "Current blocker or overdue commitment keeps the check boundary-limited."
          : "当前卡点或逾期承诺仍在把这条检查卡在有边界的状态。"
        : attentionState === "waiting"
          ? english
            ? "The latest external thread is still in a waiting posture, so this stays an honest watch layer."
            : "最近一条外部线程仍处于等待态，所以这里会继续保持为一层诚实的观察面。"
          : english
            ? "The next bounded action is visible, but the page still stays advisory-first."
            : "当前下一条有边界的动作已经可见，但这页仍保持先建议、后行动。",
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
  detail: SuccessCheckOpportunityDetail;
  company: SuccessCheckCompanyContext;
  reviewTasks: SuccessCheckReviewTask[];
  signals: SuccessCheckSignals;
  watchState: SuccessCheckWatchState;
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
            label: english
              ? "Open customer success handoff"
              : "打开客户成功交接",
            href: `/customer-success/${detail.id}`,
          }
        : {
            label: english ? "Open expansion review" : "打开扩展审查",
            href: `/expansion-reviews/${detail.id}`,
          };

  return createPageReportingProtocol({
    pageJudgement: english
      ? "Use success check as the current readiness judgement layer before anyone widens the account story again."
      : "当前应先把成功检查当作准备度判断层，再决定是否继续扩大这条账户叙事。",
    pageJudgementReason:
      detail.briefingSnapshot?.payload.summary ??
      (signals.pendingReview
        ? english
          ? `${companyName} still carries open review pressure, so readiness has to stay explicit before anyone talks with more certainty.`
          : `${companyName} 当前仍带着开放的复核压力，所以在任何人说得更确定前，准备度必须先被显式说清。`
        : signals.topBlocker
          ? english
            ? `${companyName} still has a visible blocker, so the team needs an honest success check before widening into expansion-like language.`
            : `${companyName} 当前仍有可见阻塞点，所以团队需要先做一轮诚实的成功检查，再决定是否扩大叙事。`
          : english
            ? `${companyName} now needs a thinner success check that keeps readiness, next action and boundary pressure on one page.`
            : `${companyName} 当前需要一张更薄的成功检查页，把准备度、下一步动作和边界压力收在同一页。`),
    pageWhyItMatters: compactItems([
      english
        ? "Success check keeps readiness judgement separate from promise-like customer language."
        : "成功检查会把准备度判断和类似承诺的客户表达继续分开。",
      signals.pendingReview
        ? english
          ? "Pending review still distorts how honestly the team can describe current momentum."
          : "当前待复核仍在影响团队能否诚实描述这条推进线。"
        : signals.topBlocker || signals.overdueCommitment
          ? english
            ? "The current blocker / commitment picture can still overstate health unless the boundary stays visible."
            : "如果边界不继续显式保留，当前卡点 / 承诺压力画面仍可能把健康度说高。"
          : english
            ? "The next owner can inherit a cleaner judgement without reopening raw thread, memory and approval context."
            : "下一位负责人不必回翻原始线程、记忆和审批上下文，也能继承一版更干净的判断。",
      signals.recentThread
        ? english
          ? "Latest external context is visible here, but it still does not silently become commitment."
          : "最近一层外部上下文会继续显示在这里，但它不会被悄悄抬成承诺。"
        : english
          ? "Current next action stays visible here so the chain can move without hiding uncertainty."
          : "当前下一步动作会继续留在这里，让链路可以推进但不会把不确定性藏起来。",
    ]),
    pageActionSummary: compactItems([
      english
        ? "The current success-check surface already groups blocker, commitment, review and recent thread pressure on one thinner page."
        : "当前这张更薄的成功检查页面已经把阻塞点、承诺压力、复核和最近线程压力收在一起。",
      signals.pendingReview
        ? english
          ? "Human review pressure remains visible without forcing this page into a workflow controller."
          : "当前人工复核压力会继续显式可见，但这页不会因此变成流程控制器。"
        : signals.topBlocker
          ? english
            ? "The current blocker is already translated into a readiness read instead of hiding in raw notes."
            : "当前卡点已经被翻译成一条准备度判断，而不是继续藏在原始备注里。"
          : english
            ? "The next bounded move stays explicit before anyone widens into expansion review."
            : "在任何人把链路扩大到扩展审查前，下一条有边界的动作会先继续挂清楚。",
      watchState.lastTouchAt
        ? english
          ? "Last explicit human touch remains visible so the team can tell whether this is still prepared-only or already human-reviewed."
          : "最近一次显式人工触点会继续留在前台，团队可以看清这条线究竟仍是仅已准备，还是已经有人复核过。"
        : null,
    ]),
    pageDecisionRequest: compactItems([
      signals.pendingReview
        ? english
          ? "Confirm whether this should remain review-limited until the current human review line closes."
          : "确认这条线是否必须继续停在复核受限状态，直到当前人工复核线关闭。"
        : signals.topBlocker || signals.overdueCommitment
          ? english
            ? "Confirm whether the current blocker means this should step back into broader customer success follow-through instead of widening."
            : "确认当前卡点是否意味着这条线应先退回更广的客户成功跟进，而不是继续扩大。"
          : english
            ? "Confirm whether readiness is now honest enough to widen into expansion review."
            : "确认当前准备度是否已经足够诚实，可以继续扩大到扩展审查。",
      english
        ? "Confirm what should stay explicit as boundary, dependency or non-commitment if anyone references this outward."
        : "确认如果有人需要对外提到这条线，哪些内容仍必须继续显式保留为边界、依赖或非承诺。",
    ]),
    pageNextAction: compactActions([
      nextPrimaryAction,
      {
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
    ]),
    pageBoundarySummary: compactItems([
      english
        ? "Success check can make readiness clearer, but it still does not equal customer confirmation, safe send or commitment."
        : "成功检查可以把准备度说得更清楚，但它仍然不等于客户确认，也不等于可安全外发或承诺。",
      signals.pendingReview
        ? english
          ? "Current review pressure still keeps this in review-before-send / human-review-required posture."
          : "当前复核压力仍在把这条线停在发送前复核 / 需要人工复核状态。"
        : signals.topBlocker || signals.overdueCommitment
          ? english
            ? "Current blocker and open commitment pressure must stay visible before anyone widens the account story."
            : "在任何人扩大这条账户叙事前，当前卡点和开放承诺压力都必须继续保持可见。"
          : english
            ? "Even when readiness looks healthier, the next widening step still belongs to a human decision."
            : "即使当前准备度看起来更健康，下一步是否扩大推进仍然属于人的决定。",
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
        ? "This thinner success-check surface keeps readiness, blocker pressure and the next bounded move aligned."
        : "这张更薄的成功检查页会持续把准备度、阻塞压力和下一条有边界的动作对齐起来。",
      english
        ? "The broader customer success chain remains available, but this page does not quietly turn into customer success detail, queue or send control."
        : "更广的客户成功链会继续可达，但这页不会悄悄滑成客户成功详情、队列或发送控制。",
    ]),
    pagePrioritySignal:
      signals.pendingReview || signals.topBlocker || signals.overdueCommitment
        ? english
          ? "Boundary still active"
          : "当前边界仍然活跃"
        : english
          ? "Readiness watch"
          : "当前属于准备度观察",
    pageEscalationHint:
      signals.pendingReview || signals.topBlocker || signals.overdueCommitment
        ? english
          ? "Do not overstate certainty until the blocker / review line is honestly reduced."
          : "在阻塞点 / 复核线被诚实降低前，不要把确定性说高。"
        : undefined,
    pageEvidenceLinks: compactLinks([
      company?.id
        ? {
            label: english ? "Open company detail" : "打开公司详情",
            href: `/companies/${company.id}`,
          }
        : null,
      {
        label: english ? "Open memory context" : "打开记忆上下文",
        href: `/memory?objectType=OPPORTUNITY&objectId=${detail.id}`,
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
  detail: SuccessCheckOpportunityDetail;
  company: SuccessCheckCompanyContext;
  signals: SuccessCheckSignals;
  english: boolean;
}): EvidenceGroup[] {
  return [
    {
      groupId: "readiness-pressure",
      label: english ? "Readiness pressure" : "准备度压力",
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
            ? `Overdue commitment cue: ${signals.overdueCommitment.title}`
            : `逾期承诺提醒：${signals.overdueCommitment.title}`
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
      label: english ? "Memory and audit context" : "经营记忆与审计上下文",
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
            : `公司简报：${trimText(company.briefingSnapshot.payload.summary, 120)}`
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
  detail: SuccessCheckOpportunityDetail;
  signals: SuccessCheckSignals;
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
      detailNodeType: "success-check",
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: english ? "Success check" : "成功检查",
      detailNodeBoundary: boundary,
      detailNodeAudienceMode: english ? "Internal readiness" : "内部准备度",
      detailNodeSendabilityMode: english
        ? "External send disabled"
        : "禁止外部发送",
      detailNodeStrengthMode: english ? "Readiness judgement" : "准备度判断",
      detailNodePrev: {
        type: "customer-success",
        href: `/customer-success/${detail.id}`,
        label: english ? "Customer success handoff" : "客户成功交接",
        summary: english
          ? "Return to the broader follow-through surface."
          : "回到更广的跟进页面。",
      },
      detailNodeNext: {
        type: "expansion-review",
        href: `/expansion-reviews/${detail.id}`,
        label: english ? "Expansion review" : "扩展审查",
        summary: english
          ? "Only widen after this readiness read stays honest."
          : "只有当这条准备度判断保持诚实时，才继续扩大到扩展审查。",
      },
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority:
        signals.pendingReview || signals.topBlocker || signals.overdueCommitment
          ? "urgent"
          : signals.recentThread
            ? "important"
            : "watch",
      detailNodeNavigationHint: english
        ? "Use success check to keep the current readiness story honest before the chain widens again."
        : "先用成功检查把当前准备度叙事说诚实，再决定链路是否继续扩大。",
    },
    handoffs: compactHandoffs([
      {
        handoffSource: "success-check",
        handoffTarget: "customer-success",
        handoffReason: english
          ? "Step back into the broader customer success layer when the current blocker or review line still dominates the account story."
          : "如果当前卡点或复核线仍在主导整条账户叙事，就退回更广的客户成功层。",
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
              ? "Human review still has to close honestly."
              : "人工复核仍需要先诚实关闭。"
            : null,
        handoffRisk: protocol.pagePrioritySignal ?? boundary,
        handoffDecisionRequest:
          protocol.pageDecisionRequest[0] ?? protocol.pageJudgement,
        handoffNextAction: english
          ? "Open customer success handoff."
          : "打开客户成功交接。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          signals.pendingReview != null
            ? "review-before-send"
            : "internal-only",
        handoffHref: `/customer-success/${detail.id}`,
      },
      signals.pendingReview != null
        ? {
            handoffSource: "success-check" as const,
            handoffTarget: "review-request-detail" as const,
            handoffReason: english
              ? "Use review request detail when explicit human review is still the current blocker."
              : "如果显式人工复核仍是当前卡点，就回到复核请求详情。",
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
        handoffSource: "success-check",
        handoffTarget: "expansion-review",
        handoffReason: english
          ? "Move into expansion review only after this success check says the readiness story is still honest."
          : "只有当这条成功检查先确认准备度叙事仍然诚实时，才切进扩展审查。",
        handoffBoundary: boundary,
        handoffPrerequisite:
          signals.pendingReview ||
          signals.topBlocker ||
          signals.overdueCommitment
            ? english
              ? "Do not widen until the current blocker / review line is honestly reduced."
              : "在当前卡点 / 复核线被诚实降低前，不要继续扩大。"
            : null,
        handoffDependency: null,
        handoffRisk: protocol.pagePrioritySignal ?? boundary,
        handoffDecisionRequest:
          protocol.pageDecisionRequest[0] ?? protocol.pageJudgement,
        handoffNextAction: english
          ? "Open expansion review."
          : "打开扩展审查。",
        handoffWorkerSummary: compactItems([
          workerSummary,
          english
            ? "Expansion review should stay thinner than the broader customer success story."
            : "扩展审查应继续保持比更广的客户成功叙事更薄。",
        ]),
        handoffEvidenceSummary: compactItems([
          evidenceSummary,
          english
            ? "Readiness evidence remains grouped here before the chain widens."
            : "在链路扩大前，准备度依据会继续先在这里分组可见。",
        ]),
        handoffVisibilityMode:
          signals.pendingReview ||
          signals.topBlocker ||
          signals.overdueCommitment
            ? "boundary-only"
            : "customer-facing-with-boundary",
        handoffHref: `/expansion-reviews/${detail.id}`,
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
  detail: SuccessCheckOpportunityDetail;
  signals: SuccessCheckSignals;
  company: SuccessCheckCompanyContext;
  english: boolean;
}): HeaderLink[] {
  return compactActions([
    {
      label: english ? "Open customer success handoff" : "打开客户成功交接",
      href: `/customer-success/${detail.id}`,
    },
    signals.pendingReview
      ? {
          label: english ? "Open review request" : "打开复核请求",
          href: `/review-requests/${signals.pendingReview.id}`,
          variant: "secondary",
        }
      : {
          label: english ? "Open expansion review" : "打开扩展审查",
          href: `/expansion-reviews/${detail.id}`,
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

function describeReviewPosture(
  signals: SuccessCheckSignals,
  attentionState: AgentAttentionState,
  english: boolean,
) {
  if (attentionState === "review-before-send") {
    return english ? "Review-limited" : "受复核限制";
  }

  if (attentionState === "blocked") {
    return english ? "Boundary-limited" : "受边界限制";
  }

  if (signals.recentThread?.status.includes("WAITING")) {
    return english ? "Waiting for reply" : "等待回复";
  }

  return english ? "Readiness watch" : "准备度观察";
}

function formatRisk(
  riskLevel: SuccessCheckOpportunityDetail["riskLevel"],
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
    handoffSource: "success-check";
    handoffTarget:
      | "customer-success"
      | "review-request-detail"
      | "expansion-review";
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
      | "boundary-only"
      | "customer-facing-with-boundary";
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
