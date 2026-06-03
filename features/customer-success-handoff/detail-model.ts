import type { PageReportingProtocol } from "@/lib/presentation/reporting-protocol";
import type {
  AgentPolicyCue,
  AgentTag,
} from "@/lib/presentation/agent-primitives";
import {
  formatAgentAttentionState,
  formatAgentAuthorityState,
  toneForAgentAttentionState,
  toneForAgentAuthorityState,
} from "@/lib/presentation/agent-primitives";
import {
  createCustomerSuccessDetailReportingContract,
  createCustomerSuccessHandoffSurfaceContract,
  toCustomerSuccessDetailPageReportingProtocol,
  type CustomerSuccessAudienceMode,
  type CustomerSuccessDetailReportingContract,
  type CustomerSuccessEvidenceGroup,
  type CustomerSuccessFallbackMode,
  type CustomerSuccessHandoffStage,
  type CustomerSuccessOwnershipMode,
  type CustomerSuccessRiskSignal,
  type CustomerSuccessSendabilityMode,
} from "@/lib/presentation/customer-success-handoff-surface-contract";
import {
  createUnifiedDetailNavigationModel,
  type CrossDetailHandoff,
  type CrossDetailHandoffVisibilityMode,
  type UnifiedDetailNavigationModel,
  type UnifiedDetailNodePriority,
} from "@/lib/presentation/unified-detail-navigation";
import { formatDateLabel, trimText } from "@/lib/utils";
import {
  buildCustomerSuccessInternalActionSpecs,
  parseCustomerSuccessInternalActionMetadata,
  type CustomerSuccessAttentionState,
  type CustomerSuccessAuthorityState,
  type CustomerSuccessInternalActionKey,
  type CustomerSuccessInternalActionMetadata,
  type CustomerSuccessInternalActionState,
} from "@/features/customer-success-handoff/internal-actions";

export type {
  CustomerSuccessAttentionState,
  CustomerSuccessAuthorityState,
  CustomerSuccessInternalActionState,
} from "@/features/customer-success-handoff/internal-actions";

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

type PageKind = "customer-success" | "success-check" | "expansion-review";

type WatchState = {
  lastReviewedAt: Date | null;
  lastReviewedSummary: string | null;
  lastBackedAt: Date | null;
  lastBackedSummary: string | null;
  lastSeenAt: Date | null;
  lastSeenSummary: string;
};

export type CustomerSuccessInternalActionViewModel = {
  key: CustomerSuccessInternalActionKey;
  title: string;
  summary: string;
  state: CustomerSuccessInternalActionState;
  stateLabel: string;
  stateTone: Chip["tone"];
  actionTypeLabel: string;
  internalOnlyLabel: string;
  approvalSummary: string | null;
  executionSummary: string | null;
  resultSummary: string | null;
  actionItemId: string | null;
  canApprove: boolean;
  canExecute: boolean;
  policyLabels: CustomerSuccessPolicyTag[];
};

export type CustomerSuccessPolicyTag = AgentTag;

export type CustomerSuccessProcessAdvisoryCategory =
  | "missing-decision"
  | "blocked-by-dependency"
  | "boundary-limited"
  | "repeated-review-before-send"
  | "widened-ownership-pressure"
  | "expansion-readiness-distorted";

// Thin derived process advisory only. advisory categories are not stages,
// not workflow states, do not change route ownership, and do not imply approval or commitment.
// Playbook recommendations are suggestions, not automatic actions.
export type CustomerSuccessProcessAdvisoryModel = {
  category: CustomerSuccessProcessAdvisoryCategory;
  categoryLabel: string;
  patternLabel: string;
  whyNow: string;
  playbookRecommendation: string;
  unresolved: string;
  overstateRisk: string;
};

export type CustomerSuccessPolicyCue = AgentPolicyCue;

// policy cues are governance markers, not stages or workflow states.
// they do not mutate route ownership or approval chains.
// they keep external send and commitment disabled on this surface.
export type CustomerSuccessPolicySurfaceModel = {
  activeCues: CustomerSuccessPolicyCue[];
  primaryLabel: string;
  primaryTone: Chip["tone"];
  whatHelmCanDoNow: string;
  approvalRequirement: string;
  internalOnlyBoundary: string;
  whatRemainsBlocked: string;
  overstateRisk: string;
  queueSummary: string;
  queueBlockedSummary: string;
  approvalRequiredLabel: string | null;
  internalOnlyLabel: string;
  externalSendDisabledLabel: string;
  commitmentDisabledLabel: string;
};

export type CustomerSuccessExternalDraftCue =
  | "draft-only"
  | "review-before-send"
  | "not-sendable-yet"
  | "boundary-limited"
  | "non-commitment-required"
  | "human-review-required";

export type CustomerSuccessExternalDraftKind =
  | "holding-reply"
  | "boundary-aware-check-in"
  | "decision-dependency-clarification-request"
  | "review-before-send-follow-up"
  | "non-commitment-status-update";

export type CustomerSuccessDraftReviewOutcomeCue =
  | "review-pending"
  | "reviewed-by-human"
  | "revision-requested"
  | "handoff-to-human-sender"
  | "manual-send-recorded";

// review / handoff cues are draft-level provenance markers, not stages or workflow states.
// handoff-to-human-sender does not give Helm send authority.
// manual send can only be recorded after the fact.
export type CustomerSuccessDraftReviewOutcomeModel = {
  activeCues: CustomerSuccessDraftReviewOutcomeCue[];
  cueLabels: CustomerSuccessPolicyTag[];
  reviewPosture: string;
  reviewerIdentity: string | null;
  revisionRequest: string | null;
  sendHandoff: string | null;
  manualSendRecorded: string | null;
  helmBoundaryReminder: string;
  queueStatusLabel: string;
  queueStatusTone: Chip["tone"];
  queueSummary: string;
  queueHandoffSummary: string | null;
  reviewedAt: Date | null;
  sendHandoffAt: Date | null;
  manualSendRecordedAt: Date | null;
};

export type CustomerSuccessPostSendOutcomeCue =
  | "awaiting-external-outcome"
  | "external-reply-received"
  | "outcome-requested-clarification"
  | "outcome-tightened-boundary"
  | "outcome-unblocked"
  | "outcome-shifted-next-action"
  | "outcome-maintains-review-posture";

// post-send outcome cues are derived outcome markers, not stages or workflow states.
// they keep send authority outside Helm and only assimilate visible external results back into the working surface.
export type CustomerSuccessPostSendOutcomeModel = {
  referenceAt: Date;
  meaningfulOutcomeAt: Date | null;
  activeCues: CustomerSuccessPostSendOutcomeCue[];
  cueLabels: CustomerSuccessPolicyTag[];
  currentPosture: string;
  firstOutcomeSummary: string | null;
  whatChanged: string;
  unresolved: string;
  overstateRisk: string;
  queueStatusLabel: string;
  queueStatusTone: Chip["tone"];
  queueSummary: string;
  queueBlockedSummary: string;
  deltaSummary: string;
  resurfaceReason: string;
  progressSummary: string;
};

// draft cues are not stages.
// draft cues are not workflow states.
// they do not enable send.
// they do not imply commitment.
export type CustomerSuccessExternalDraftViewModel = {
  kind: CustomerSuccessExternalDraftKind;
  kindLabel: string;
  title: string;
  summary: string;
  intent: string;
  whyNow: string;
  reviewStateLabel: string;
  unresolved: string;
  overstateRisk: string;
  policyCues: CustomerSuccessExternalDraftCue[];
  policyCueLabels: CustomerSuccessPolicyTag[];
  queueStatusLabel: string;
  queueStatusTone: Chip["tone"];
  queueSummary: string;
  queueBlockedSummary: string;
  reviewOutcome: CustomerSuccessDraftReviewOutcomeModel;
  postSendOutcome: CustomerSuccessPostSendOutcomeModel | null;
};

export type CustomerSuccessHandoffPageModel = {
  rootDataAttributes: Record<string, string>;
  opportunityId: string;
  eyebrow: string;
  title: string;
  description: string;
  stageKey: CustomerSuccessHandoffStage;
  authorityState: CustomerSuccessAuthorityState;
  attentionState: CustomerSuccessAttentionState;
  ownershipMode: CustomerSuccessOwnershipMode;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  riskSignal: CustomerSuccessRiskSignal;
  reviewRequestId: string | null;
  recentThreadId: string | null;
  actions: HeaderLink[];
  briefingLabel: string;
  navigation: UnifiedDetailNavigationModel;
  protocol: PageReportingProtocol;
  chips: Chip[];
  secondarySummaryItems: SecondarySummaryItem[];
  recentChangesLabel: string;
  recentChangesItems: string[];
  resurfaceReasonLabel: string;
  resurfaceReasonItems: string[];
  processAdvisoryLabel: string;
  processAdvisoryItems: string[];
  processAdvisory: CustomerSuccessProcessAdvisoryModel;
  policyLabel: string;
  policyItems: string[];
  policySurface: CustomerSuccessPolicySurfaceModel;
  externalDraftsLabel: string;
  externalDrafts: CustomerSuccessExternalDraftViewModel[];
  actionSummaryLabel: string;
  decisionRequestLabel: string;
  decisionLabel: string;
  decisionItems: string[];
  boundaryLabel: string;
  evidenceSummaryLabel: string;
  actionLabel: string;
  internalActionsLabel: string;
  internalActions: CustomerSuccessInternalActionViewModel[];
  progressTraceLabel: string;
  progressTraceItems: string[];
  evidenceLabel: string;
  evidenceCountLabel: string;
  evidenceGroups: EvidenceGroup[];
  stageBadge: string;
};

type OpportunityCommercialDetailForCustomerSuccess = {
  id: string;
  title: string;
  stage: string;
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
    aiReason: string | null;
    draftContent: string | null;
    metadata: string | null;
    status: string;
    executionStatus: string;
    statusReason: string | null;
    suggestedAt: Date;
    executedAt: Date | null;
    updatedAt: Date;
    dueDate: Date | null;
    owner: { id: string; name: string } | null;
    contact: { id: string; name: string } | null;
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
  memoryEntries: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: Date;
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

type CompanyContextForCustomerSuccess = {
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

type ReviewRequestForCustomerSuccess = {
  id: string;
  status: "PENDING" | "EXECUTED" | "REJECTED" | "WITHDRAWN";
  channel: string | null;
  isHighRisk: boolean;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  approver: { name: string } | null;
  reviewedBy: { id: string; name: string } | null;
  actionItem: {
    id: string;
    title: string;
    actionType: string;
    description: string | null;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    opportunity: {
      id: string;
      title: string;
      company: { id: string; name: string } | null;
    } | null;
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

export function buildCustomerSuccessHandoffPageModel({
  detail,
  company,
  reviewTasks,
  stageLabel,
  currentUserId,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  company: CompanyContextForCustomerSuccess;
  reviewTasks: ReviewRequestForCustomerSuccess[];
  stageLabel: string;
  currentUserId?: string;
  english: boolean;
}): CustomerSuccessHandoffPageModel {
  return buildPageModel({
    kind: "customer-success",
    detail,
    company,
    reviewTasks,
    stageLabel,
    currentUserId,
    english,
  });
}

export function buildSuccessCheckPageModel({
  detail,
  company,
  reviewTasks,
  stageLabel,
  currentUserId,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  company: CompanyContextForCustomerSuccess;
  reviewTasks: ReviewRequestForCustomerSuccess[];
  stageLabel: string;
  currentUserId?: string;
  english: boolean;
}): CustomerSuccessHandoffPageModel {
  return buildPageModel({
    kind: "success-check",
    detail,
    company,
    reviewTasks,
    stageLabel,
    currentUserId,
    english,
  });
}

export function buildExpansionReviewPageModel({
  detail,
  company,
  reviewTasks,
  stageLabel,
  currentUserId,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  company: CompanyContextForCustomerSuccess;
  reviewTasks: ReviewRequestForCustomerSuccess[];
  stageLabel: string;
  currentUserId?: string;
  english: boolean;
}): CustomerSuccessHandoffPageModel {
  return buildPageModel({
    kind: "expansion-review",
    detail,
    company,
    reviewTasks,
    stageLabel,
    currentUserId,
    english,
  });
}

function buildPageModel({
  kind,
  detail,
  company,
  reviewTasks,
  stageLabel,
  currentUserId,
  english,
}: {
  kind: PageKind;
  detail: OpportunityCommercialDetailForCustomerSuccess;
  company: CompanyContextForCustomerSuccess;
  reviewTasks: ReviewRequestForCustomerSuccess[];
  stageLabel: string;
  currentUserId?: string;
  english: boolean;
}): CustomerSuccessHandoffPageModel {
  const signals = summarizeSignals(detail, reviewTasks);
  const customerSuccessHandoffStage = getStage(kind, detail, signals);
  const customerSuccessHandoffAudienceMode = getAudienceMode(
    kind,
    customerSuccessHandoffStage,
  );
  const customerSuccessHandoffOwnership = getOwnershipMode(
    kind,
    customerSuccessHandoffStage,
    signals,
  );
  const customerSuccessDetailSendabilityMode = getSendabilityMode(
    kind,
    customerSuccessHandoffStage,
    signals,
  );
  const customerSuccessDetailFallbackMode = getFallbackMode(
    customerSuccessHandoffStage,
    signals,
  );
  const riskSignal = mapRiskSignal(detail.riskLevel, signals);
  const authorityState = getAuthorityState(detail, signals);
  const attentionState = getAttentionState({
    stage: customerSuccessHandoffStage,
    sendabilityMode: customerSuccessDetailSendabilityMode,
    fallbackMode: customerSuccessDetailFallbackMode,
    authorityState,
    signals,
  });
  const stageText = formatStage(customerSuccessHandoffStage, english);
  const variantText = formatVariantMode(customerSuccessHandoffStage, english);
  const authorityText = formatAuthorityState(authorityState, english);
  const attentionText = formatAttentionState(attentionState, english);
  const ownershipPressureText = formatOwnershipPressure(
    customerSuccessHandoffStage,
    customerSuccessHandoffOwnership,
    english,
  );
  const routeCueText = formatRouteCue(
    customerSuccessHandoffStage,
    customerSuccessDetailSendabilityMode,
    customerSuccessDetailFallbackMode,
    english,
  );
  const sendabilityText = formatSendabilityMode(
    customerSuccessDetailSendabilityMode,
    english,
  );
  const audienceText = formatAudienceMode(
    customerSuccessHandoffAudienceMode,
    english,
  );
  const ownershipText = formatOwnershipMode(
    customerSuccessHandoffOwnership,
    english,
  );
  const fallbackText = formatFallbackMode(
    customerSuccessDetailFallbackMode,
    english,
  );
  const decisionItems = buildDecisionSummary({
    kind,
    stage: customerSuccessHandoffStage,
    ownershipMode: customerSuccessHandoffOwnership,
    sendabilityMode: customerSuccessDetailSendabilityMode,
    fallbackMode: customerSuccessDetailFallbackMode,
    english,
  });
  const currentReason =
    detail.briefingSnapshot?.payload.summary ??
    buildReason(kind, detail, signals, english);
  const watchState = buildWatchState({
    detail,
    signals,
    stage: customerSuccessHandoffStage,
    attentionState,
    currentUserId,
    english,
  });
  const evidenceGroups = buildEvidenceGroups({
    detail,
    company,
    signals,
    kind,
    customerSuccessHandoffStage,
    customerSuccessDetailSendabilityMode,
    english,
  });

  const surfaceContract = createCustomerSuccessHandoffSurfaceContract({
    customerSuccessHandoffJudgement: buildJudgement({
      kind,
      stage: customerSuccessHandoffStage,
      english,
    }),
    customerSuccessHandoffReason: currentReason,
    customerSuccessHandoffSummary: [
      english
        ? "Review pressure, current blockers, open commitments and the account route are already pulled onto one dedicated customer success handoff surface."
        : "复核压力、当前卡点、开放承诺和账户路由已经收在同一张客户成功接手页面上。",
      signals.pendingReview
        ? english
          ? "Pending review no longer has to hide behind company detail. Customer success can now inherit the account follow-through directly."
          : "待复核已经不需要再躲在公司详情面 后面，客户成功现在可以直接继承账户跟进闭环。"
        : english
          ? "Even without a pending review, this page keeps success follow-through, expansion pressure and the next accountable owner in one place."
          : "即使当前没有待复核条目，这页也会继续把客户成功跟进闭环、拓展压力和下一位负责人收在同一处。",
      kind === "expansion-review"
        ? english
          ? "Expansion review now sits on the same chain as package, proposal, offer and reinforcement instead of drifting into account notes."
          : "拓展复核现在已经挂在与方案包、提案、客户报价和加固同一条链上，而不是漂回账户备注。"
        : english
          ? "Coordination handoff, boundary note and evidence stay visible before anyone treats success follow-through as external certainty."
          : "在任何人把客户成功跟进闭环说成对外确定性之前，协作分工、边界备注和证据都会继续留在前台。",
      customerSuccessHandoffStage === "issue-follow-through"
        ? english
          ? "A contained issue can move back toward success check once the repair path is explicit, but it should only widen into expansion review when commercial readiness stays clean."
          : "只有当修复路径已经说清时，已收口问题才应回到客户成功验收；也只有在商业就绪度没有被扭曲时，它才适合继续进入拓展复核。"
        : customerSuccessHandoffStage === "escalation-follow-through"
          ? english
            ? "Escalation can widen ownership pressure, but if external wording would overstate certainty it must still downgrade into review-before-send or blocked-by-boundary first."
            : "升级可以扩大负责人压力，但只要外部表达会夸大确定性，它就仍必须先降回发送前复核或受阻于边界。"
          : null,
    ].filter((item): item is string => Boolean(item)),
    customerSuccessHandoffBoundary: buildBoundarySummary({
      kind,
      fallbackMode: customerSuccessDetailFallbackMode,
      signals,
      english,
    }),
    customerSuccessHandoffWorkerSummary: [
      english
        ? "Customer success worker keeps review follow-through, success check and expansion routing aligned to one judgement-first handoff surface."
        : "客户成功执行会持续把复核跟进闭环、客户成功验收 和拓展路由对齐到同一张判断优先交接面上。",
      english
        ? "Sales / delivery / founder cues remain attached here so the next owner can inherit the chain without restating the whole account."
        : "销售 / 交付 / 创始人线索会继续挂在这里，保证下一位负责人能在不重讲整条账户上下文的前提下接手。",
    ],
    customerSuccessHandoffEvidenceSummary: [
      english
        ? `${detail.memoryFacts.length} memory facts, ${detail.commitments.length} commitments, ${detail.blockers.length} blockers and ${reviewTasks.length} review traces are grouped below without interrupting the main narrative.`
        : `当前 ${detail.memoryFacts.length} 条经营记忆事实、${detail.commitments.length} 条承诺、${detail.blockers.length} 个阻塞和 ${reviewTasks.length} 条复核轨迹都已经分组收在下方，不会打断主叙事。`,
      english
        ? "Replay, audit, worker output, boundary trace, sendability trace and handoff evidence remain available on demand."
        : "回放、审计、执行输出、边界轨迹、发送评估轨迹和交接证据会继续保留在附注层按需可看。",
    ],
    customerSuccessHandoffDecisionRequest: buildDecisionRequests({
      kind,
      stage: customerSuccessHandoffStage,
      ownershipMode: customerSuccessHandoffOwnership,
      english,
    }),
    customerSuccessHandoffNextAction: buildActions({
      kind,
      detail,
      signals,
      english,
    }),
    customerSuccessHandoffRiskSignal: riskSignal,
    customerSuccessHandoffAudienceMode,
    customerSuccessHandoffOwnership,
    customerSuccessHandoffStage,
    customerSuccessHandoffEvidenceGroups: evidenceGroups,
    pageWhyItMatters: buildWhyItMatters({
      kind,
      signals,
      stageLabel,
      english,
    }),
    pageEvidenceLinks: buildEvidenceLinks({
      detail,
      signals,
      english,
    }),
    pageEscalationHint: buildEscalationHint({
      kind,
      stage: customerSuccessHandoffStage,
      english,
    }),
  });

  const detailContract = createCustomerSuccessDetailReportingContract({
    customerSuccessDetailJudgement:
      surfaceContract.customerSuccessHandoffJudgement,
    customerSuccessDetailReason: surfaceContract.customerSuccessHandoffReason,
    customerSuccessDetailActionSummary:
      surfaceContract.customerSuccessHandoffSummary,
    customerSuccessDetailDecision: decisionItems,
    customerSuccessDetailDecisionRequest:
      surfaceContract.customerSuccessHandoffDecisionRequest,
    customerSuccessDetailBoundarySummary:
      surfaceContract.customerSuccessHandoffBoundary,
    customerSuccessDetailEvidenceSummary:
      surfaceContract.customerSuccessHandoffEvidenceSummary,
    customerSuccessDetailWorkerSummary:
      surfaceContract.customerSuccessHandoffWorkerSummary,
    customerSuccessDetailNextAction:
      surfaceContract.customerSuccessHandoffNextAction,
    customerSuccessDetailRiskSignal: riskSignal,
    customerSuccessDetailAudienceMode: customerSuccessHandoffAudienceMode,
    customerSuccessDetailStage: customerSuccessHandoffStage,
    customerSuccessDetailSendabilityMode: customerSuccessDetailSendabilityMode,
    customerSuccessDetailFallbackMode: customerSuccessDetailFallbackMode,
    customerSuccessDetailEvidenceGroups:
      surfaceContract.customerSuccessHandoffEvidenceGroups,
    pageWhyItMatters: surfaceContract.pageWhyItMatters,
    pageEvidenceLinks: surfaceContract.pageEvidenceLinks,
    pageEscalationHint: surfaceContract.pageEscalationHint,
  });

  const protocol = toCustomerSuccessDetailPageReportingProtocol(detailContract);
  const internalActions = buildCustomerSuccessInternalActions({
    detail,
    stage: customerSuccessHandoffStage,
    authorityState,
    attentionState,
    sendabilityMode: customerSuccessDetailSendabilityMode,
    fallbackMode: customerSuccessDetailFallbackMode,
    judgement: protocol.pageJudgement,
    reason: protocol.pageJudgementReason,
    decisionRequest: protocol.pageDecisionRequest[0] ?? protocol.pageJudgement,
    nextAction:
      protocol.pageNextAction[0]?.label ?? protocol.pageJudgementReason,
    boundarySummary:
      protocol.pageBoundarySummary[0] ?? protocol.pageJudgementReason,
    english,
  });
  const processAdvisory = buildProcessAdvisory({
    kind,
    signals,
    stage: customerSuccessHandoffStage,
    attentionState,
    ownershipMode: customerSuccessHandoffOwnership,
    sendabilityMode: customerSuccessDetailSendabilityMode,
    fallbackMode: customerSuccessDetailFallbackMode,
    decisionItems,
    decisionRequest: protocol.pageDecisionRequest[0] ?? protocol.pageJudgement,
    boundarySummary:
      protocol.pageBoundarySummary[0] ?? protocol.pageJudgementReason,
    internalActions,
    english,
  });
  const processAdvisoryItems = buildProcessAdvisoryItems({
    processAdvisory,
    english,
  });
  const policySurface = buildPolicySurface({
    attentionState,
    sendabilityMode: customerSuccessDetailSendabilityMode,
    fallbackMode: customerSuccessDetailFallbackMode,
    internalActions,
    processAdvisory,
    english,
  });
  const policyItems = buildPolicyItems({
    policySurface,
    english,
  });
  const externalDrafts = buildExternalDrafts({
    detail,
    reviewTasks,
    signals,
    stage: customerSuccessHandoffStage,
    attentionState,
    authorityState,
    sendabilityMode: customerSuccessDetailSendabilityMode,
    fallbackMode: customerSuccessDetailFallbackMode,
    processAdvisory,
    judgement: protocol.pageJudgement,
    reason: protocol.pageJudgementReason,
    decisionRequest: protocol.pageDecisionRequest[0] ?? protocol.pageJudgement,
    boundarySummary:
      protocol.pageBoundarySummary[0] ?? protocol.pageJudgementReason,
    nextActionLabel:
      protocol.pageNextAction[0]?.label ?? protocol.pageJudgementReason,
    english,
  });
  const primaryPostSendOutcome =
    externalDrafts.find((draft) => draft.postSendOutcome != null)
      ?.postSendOutcome ?? null;
  const recentChangesItems = buildRecentChanges({
    detail,
    signals,
    stage: customerSuccessHandoffStage,
    authorityState,
    watchState,
    postSendOutcome: primaryPostSendOutcome,
    english,
  });
  const resurfaceReasonItems = buildResurfaceReasons({
    signals,
    stage: customerSuccessHandoffStage,
    sendabilityMode: customerSuccessDetailSendabilityMode,
    watchState,
    postSendOutcome: primaryPostSendOutcome,
    english,
  });
  const progressTraceItems = buildProgressTrace({
    signals,
    authorityState,
    attentionState,
    stage: customerSuccessHandoffStage,
    watchState,
    internalActions,
    postSendOutcome: primaryPostSendOutcome,
    english,
  });
  const navigation = buildNavigation({
    kind,
    detail,
    company,
    signals,
    protocol,
    stage: customerSuccessHandoffStage,
    audienceText,
    sendabilityText,
    fallbackText,
    english,
  });

  const titlePrefix =
    kind === "customer-success"
      ? english
        ? "Customer success handoff"
        : "客户成功接手面"
      : kind === "success-check"
        ? english
          ? "Success check"
          : "客户成功验收"
        : english
          ? "Expansion review"
          : "拓展复核";

  return {
    rootDataAttributes: {
      "data-customer-success-handoff-page": "true",
      "data-customer-success-handoff-kind": kind,
      "data-customer-success-visible-agent": "true",
      "data-customer-success-shared-attention": "true",
      "data-customer-success-limited-internal-execution": "true",
      "data-customer-success-process-advisory": "true",
      "data-customer-success-policy-surface": "true",
      "data-customer-success-external-draft-surface": "true",
      "data-customer-success-draft-review-handoff": "true",
      "data-customer-success-post-send-outcome": "true",
    },
    opportunityId: detail.id,
    eyebrow: english
      ? `Customer success chain / ${titlePrefix}`
      : `客户成功链 / ${titlePrefix}`,
    title: `${detail.title} · ${titlePrefix}`,
    description: english
      ? `${detail.company?.name ?? "No company"} · ${stageLabel} · ${stageText}`
      : `${detail.company?.name ?? "暂无公司"} · ${stageLabel} · ${stageText}`,
    stageKey: customerSuccessHandoffStage,
    authorityState,
    attentionState,
    ownershipMode: customerSuccessHandoffOwnership,
    sendabilityMode: customerSuccessDetailSendabilityMode,
    fallbackMode: customerSuccessDetailFallbackMode,
    riskSignal,
    reviewRequestId: signals.pendingReview?.id ?? null,
    recentThreadId: signals.recentThread?.id ?? null,
    actions: buildHeaderLinks({
      kind,
      detail,
      signals,
      english,
    }),
    briefingLabel: english
      ? "Current customer success judgement"
      : "当前客户成功判断",
    navigation,
    protocol,
    chips: [
      {
        label: english ? "Prepared review surface" : "待复核结果面",
        tone: "sky",
      },
      {
        label: authorityText,
        tone: toneForAgentAuthorityState(authorityState),
      },
      {
        label: attentionText,
        tone: toneForAgentAttentionState(attentionState),
      },
      {
        label: variantText,
        tone:
          customerSuccessHandoffStage === "escalation-follow-through"
            ? "amber"
            : customerSuccessHandoffStage === "issue-follow-through"
              ? "violet"
              : "emerald",
      },
      {
        label: sendabilityText,
        tone:
          customerSuccessDetailSendabilityMode === "review-before-send"
            ? "amber"
            : customerSuccessDetailSendabilityMode === "internal-only"
              ? "violet"
              : "emerald",
      },
      {
        label: stageText,
        tone: "violet",
      },
    ],
    secondarySummaryItems: [
      {
        label: english ? "Current stage" : "当前阶段",
        value: stageText,
      },
      {
        label: english ? "Ownership" : "接手负责人",
        value: ownershipText,
      },
      {
        label: english ? "Ownership pressure" : "负责人压力",
        value: ownershipPressureText,
      },
      {
        label: english ? "Authority" : "执行权限",
        value: buildAuthoritySummary(authorityState, english),
      },
      {
        label: english ? "Attention" : "关注状态",
        value: buildAttentionSummary(attentionState, english),
      },
      {
        label: english ? "Last explicit user touch" : "最近一次显式用户触点",
        value: watchState.lastSeenSummary,
      },
      {
        label: english ? "Current route" : "当前路由",
        value: routeCueText,
      },
      {
        label: english ? "Audience mode" : "受众模式",
        value: audienceText,
      },
      {
        label: english ? "Sendability" : "发送边界",
        value: sendabilityText,
      },
      {
        label: english ? "Fallback" : "降级方式",
        value: fallbackText,
      },
      {
        label: english ? "Review pressure" : "复核压力",
        value: signals.pendingReview
          ? english
            ? "Pending review still open"
            : "仍有待复核条目"
          : english
            ? "No pending review"
            : "当前无待复核条目",
      },
      ...buildDeeperVariantSummaryItems({
        kind,
        detail,
        signals,
        stage: customerSuccessHandoffStage,
        ownershipMode: customerSuccessHandoffOwnership,
        sendabilityMode: customerSuccessDetailSendabilityMode,
        fallbackMode: customerSuccessDetailFallbackMode,
        english,
      }),
    ],
    recentChangesLabel: english ? "Since last seen" : "自上次查看以来",
    recentChangesItems,
    resurfaceReasonLabel: english
      ? "Why this is back now"
      : "为什么这条线又回到这里",
    resurfaceReasonItems,
    processAdvisoryLabel: english ? "Advisory cue" : "建议提示",
    processAdvisoryItems,
    processAdvisory,
    policyLabel: english
      ? "What stays available now / what remains blocked"
      : "当前仍可做什么 / 当前还被什么卡住",
    policyItems,
    policySurface,
    externalDraftsLabel: english
      ? "Prepared external drafts"
      : "已准备外部草稿",
    externalDrafts,
    actionSummaryLabel: english ? "Prepared actions" : "已准备动作",
    decisionRequestLabel: english ? "Your decisions now" : "你现在要拍板的事",
    decisionLabel: english
      ? "Current decision framing"
      : "当前判断措辞",
    decisionItems,
    boundaryLabel: english
      ? "Boundary, sendability and non-commitment"
      : "边界、发送性与非承诺",
    evidenceSummaryLabel: english ? "Evidence summary" : "证据摘要",
    actionLabel: english ? "Available next actions" : "可直接执行的动作",
    internalActionsLabel: english
      ? "Internal actions available on this surface"
      : "这张面上当前可做的内部动作",
    internalActions,
    progressTraceLabel: english ? "Progress trace" : "进度轨迹",
    progressTraceItems,
    evidenceLabel: english ? "Evidence drawer" : "证据抽屉",
    evidenceCountLabel: english
      ? `${evidenceGroups.length} grouped tracks`
      : `${evidenceGroups.length} 组依据`,
    evidenceGroups,
    stageBadge: `${stageText} · ${detail.riskLevel}`,
  };
}

function summarizeSignals(
  detail: OpportunityCommercialDetailForCustomerSuccess,
  reviewTasks: ReviewRequestForCustomerSuccess[],
) {
  const latestReviewTask =
    reviewTasks.find((task) => task.status === "PENDING") ??
    reviewTasks[0] ??
    null;
  const topBlocker = detail.blockers[0] ?? null;
  const blockerNeedsEscalation =
    topBlocker != null &&
    (topBlocker.severity >= 7 ||
      detail.riskLevel === "HIGH" ||
      detail.riskLevel === "CRITICAL");
  const overdueCommitment =
    detail.commitments.find((item) => item.overdueFlag) ?? null;
  const openCommitmentCount = detail.commitments.filter(
    (item) => item.status !== "FULFILLED",
  ).length;
  const recentMeeting = detail.meetings[0] ?? null;
  const recentThread = detail.emailThreads[0] ?? null;
  const workerPreparedCount =
    detail.actionItems.length +
    (detail.briefingSnapshot?.payload.recommendedNextSteps?.length ?? 0) +
    (recentMeeting ? 1 : 0) +
    (recentThread ? 1 : 0);
  const reviewedTask =
    reviewTasks.find((task) => task.reviewedBy != null) ?? null;
  const executedTask =
    reviewTasks.find((task) => task.status === "EXECUTED") ?? null;
  const executedApproval =
    detail.actionItems.find(
      (item) => item.approvalTask?.status === "EXECUTED",
    ) ?? null;
  const reviewedApproval =
    detail.actionItems.find(
      (item) =>
        item.approvalTask != null && item.approvalTask.status !== "PENDING",
    ) ?? null;
  const latestAudit = detail.auditLogs[0] ?? null;

  return {
    pendingReview:
      latestReviewTask != null && "channel" in latestReviewTask
        ? latestReviewTask
        : (reviewTasks.find((task) => task.status === "PENDING") ?? null),
    latestReviewTask,
    topBlocker,
    blockerNeedsEscalation,
    overdueCommitment,
    openCommitmentCount,
    recentMeeting,
    recentThread,
    workerPreparedCount,
    reviewedTask,
    executedTask,
    reviewedApproval,
    executedApproval,
    latestAudit,
  };
}

function getAuthorityState(
  detail: OpportunityCommercialDetailForCustomerSuccess,
  signals: ReturnType<typeof summarizeSignals>,
): CustomerSuccessAuthorityState {
  if (signals.executedTask || signals.executedApproval) {
    return "user-backed";
  }

  if (signals.reviewedTask || signals.reviewedApproval) {
    return "user-reviewed";
  }

  if (
    detail.auditLogs.some((log) =>
      /reviewed|approved|confirmed|backed/i.test(log.summary),
    )
  ) {
    return "user-reviewed";
  }

  return "helm-prepared";
}

function getAttentionState({
  stage,
  sendabilityMode,
  fallbackMode,
  authorityState,
  signals,
}: {
  stage: CustomerSuccessHandoffStage;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  authorityState: CustomerSuccessAuthorityState;
  signals: ReturnType<typeof summarizeSignals>;
}): CustomerSuccessAttentionState {
  if (
    stage === "review-before-send" ||
    stage === "review-follow-through" ||
    sendabilityMode === "review-before-send"
  ) {
    return "review-before-send";
  }

  if (
    stage === "blocked-by-boundary" ||
    stage === "escalation-follow-through" ||
    fallbackMode === "blocked-by-boundary" ||
    signals.blockerNeedsEscalation
  ) {
    return "blocked";
  }

  if (authorityState === "user-backed") {
    return "pushing";
  }

  if (
    signals.pendingReview ||
    signals.recentThread?.status === "WAITING_THEM"
  ) {
    return "waiting";
  }

  return "watching";
}

function getStage(
  kind: PageKind,
  detail: OpportunityCommercialDetailForCustomerSuccess,
  signals: ReturnType<typeof summarizeSignals>,
): CustomerSuccessHandoffStage {
  if (kind === "expansion-review") {
    if (signals.pendingReview || signals.topBlocker) {
      return "expansion-ready-but-blocked";
    }
    return "expansion-review";
  }

  if (kind === "success-check") {
    if (signals.pendingReview) return "review-before-send";
    if (signals.topBlocker || signals.overdueCommitment) {
      return "blocked-by-boundary";
    }
    if (detail.stage === "INTERNAL_SYNC") return "activation-follow-through";
    return "success-follow-through";
  }

  if (signals.pendingReview) return "review-follow-through";
  if (signals.blockerNeedsEscalation) return "escalation-follow-through";
  if (signals.overdueCommitment) return "issue-follow-through";
  if (detail.stage === "INTERNAL_SYNC" || signals.recentMeeting) {
    return "activation-follow-through";
  }
  return "success-follow-through";
}

function getAudienceMode(
  kind: PageKind,
  stage: CustomerSuccessHandoffStage,
): CustomerSuccessAudienceMode {
  if (stage === "review-before-send" || stage === "review-follow-through") {
    return "shared-review";
  }
  if (stage === "blocked-by-boundary" || stage === "internal-prep-only") {
    return "internal-only";
  }
  if (kind === "expansion-review") return "expansion-owner";
  if (kind === "success-check") return "success-owner";
  return "customer-success";
}

function getOwnershipMode(
  kind: PageKind,
  stage: CustomerSuccessHandoffStage,
  signals: ReturnType<typeof summarizeSignals>,
): CustomerSuccessOwnershipMode {
  if (kind === "expansion-review") return "shared-with-sales";
  if (
    stage === "activation-follow-through" ||
    (signals.recentMeeting && !signals.pendingReview)
  ) {
    return "shared-with-delivery";
  }
  if (stage === "escalation-follow-through") return "shared-with-founder";
  return "customer-success";
}

function getSendabilityMode(
  kind: PageKind,
  stage: CustomerSuccessHandoffStage,
  signals: ReturnType<typeof summarizeSignals>,
): CustomerSuccessSendabilityMode {
  if (stage === "review-before-send" || stage === "review-follow-through") {
    return "review-before-send";
  }
  if (
    stage === "blocked-by-boundary" ||
    stage === "expansion-ready-but-blocked" ||
    signals.blockerNeedsEscalation
  ) {
    return "boundary-only";
  }
  if (kind === "expansion-review" || kind === "success-check") {
    return "customer-visible-with-boundary";
  }
  return "internal-only";
}

function getFallbackMode(
  stage: CustomerSuccessHandoffStage,
  signals: ReturnType<typeof summarizeSignals>,
): CustomerSuccessFallbackMode {
  if (stage === "review-before-send" || stage === "review-follow-through") {
    return "review-hold";
  }
  if (
    stage === "blocked-by-boundary" ||
    stage === "expansion-ready-but-blocked"
  ) {
    return "blocked-by-boundary";
  }
  if (signals.overdueCommitment) return "non-commitment-fallback";
  return "no-fallback";
}

function mapRiskSignal(
  riskLevel: OpportunityCommercialDetailForCustomerSuccess["riskLevel"],
  signals: ReturnType<typeof summarizeSignals>,
): CustomerSuccessRiskSignal {
  if (
    riskLevel === "CRITICAL" ||
    riskLevel === "HIGH" ||
    signals.pendingReview != null ||
    signals.blockerNeedsEscalation
  ) {
    return "high";
  }
  if (riskLevel === "MEDIUM" || signals.overdueCommitment) {
    return "caution";
  }
  return "watch";
}

function buildJudgement({
  kind,
  stage,
  english,
}: {
  kind: PageKind;
  stage: CustomerSuccessHandoffStage;
  english: boolean;
}) {
  const stageLabel = formatStage(stage, english);

  if (kind === "expansion-review") {
    return english
      ? `Use expansion review as the current customer success decision layer, keep the work at ${stageLabel}, and do not let the account drift back into generic company follow-through.`
      : `当前应把拓展复核当作客户成功的判断层，先停在「${stageLabel}」，不要让这条链重新退回泛化的公司跟进闭环。`;
  }

  if (kind === "success-check") {
    return english
      ? `Use success check as the current customer success verification layer, keep the work at ${stageLabel}, and only widen the story after the boundary is explicit.`
      : `当前应把客户成功验收当作客户成功的校验层，先停在「${stageLabel}」，只有在边界说清后才继续扩大叙事。`;
  }

  if (stage === "escalation-follow-through") {
    return english
      ? `Use customer success handoff as the current escalation layer, keep the work at ${stageLabel}, and widen ownership before anyone speaks more firmly than the evidence allows.`
      : `当前应把客户成功交接当作升级接手层，先停在「${stageLabel}」，并在任何人说得比现有证据更实之前先扩大负责人归属。`;
  }

  if (stage === "issue-follow-through") {
    return english
      ? `Use customer success handoff as the current issue layer, keep the work at ${stageLabel}, and repair follow-through before the chain widens into stronger external wording.`
      : `当前应把客户成功交接当作问题接手层，先停在「${stageLabel}」，并在这条链扩大成更强的外部表达前先把跟进闭环修复好。`;
  }

  return english
    ? `Use customer success handoff as the current follow-through layer, keep the work at ${stageLabel}, and make the next owner, boundary and review line explicit before anyone speaks more firmly.`
    : `当前应把客户成功交接当作跟进闭环判断层，先停在「${stageLabel}」，并在任何人说得更实之前，把下一位负责人、边界和复核话术说清楚。`;
}

function buildReason(
  kind: PageKind,
  detail: OpportunityCommercialDetailForCustomerSuccess,
  signals: ReturnType<typeof summarizeSignals>,
  english: boolean,
) {
  const companyName =
    detail.company?.name ?? (english ? "this account" : "这个账户");

  if (kind === "expansion-review") {
    return english
      ? `${companyName} already has enough commercial context to justify an expansion read, but the page still needs to tell the team whether this is ready to widen or still blocked by review and boundary pressure.`
      : `${companyName} 当前已经积累出足够的商业上下文，值得进入拓展研判，但这页仍要先告诉团队：这次扩展是可以推进，还是仍被复核和边界压力卡住。`;
  }

  if (kind === "success-check") {
    return english
      ? `${companyName} now needs an honest success check that keeps adoption, blocker and review pressure on one page before the next promise-like move appears.`
      : `${companyName} 当前需要一张诚实的客户成功验收页面，把采用情况、阻塞和复核压力收到同一页，再决定下一步会不会滑向承诺式动作。`;
  }

  if (signals.blockerNeedsEscalation) {
    return english
      ? `${companyName} has already crossed the normal follow-through threshold, so customer success now needs to widen ownership and carry the blocker explicitly as escalation instead of hiding it in generic account progress.`
      : `${companyName} 当前已经越过普通跟进闭环阈值，所以客户成功现在需要显式扩大负责人归属，把阻塞作为升级接住，而不是继续把它藏在泛化账户进度里。`;
  }

  if (signals.overdueCommitment) {
    return english
      ? `${companyName} now needs explicit issue follow-through because an open commitment or missed follow-through is already shaping what customer success can honestly say next.`
      : `${companyName} 当前已经需要显式问题跟进闭环，因为开放承诺或漏掉的跟进闭环已经在直接影响客户成功下一步能诚实说到哪里。`;
  }

  return signals.pendingReview
    ? english
      ? `${companyName} already has a pending review path, so customer success should inherit the follow-through directly instead of waiting behind company detail proxy routing.`
      : `${companyName} 当前已经存在待复核路径，所以客户成功应直接继承后续跟进，而不是继续躲在公司详情面的代理路由后面。`
    : english
      ? `${companyName} now needs a dedicated success handoff because the next motion is no longer generic account context; it is ownership, follow-through and expansion judgement.`
      : `${companyName} 当前已经需要专属客户成功交接，因为接下来的动作不再只是泛化账户上下文，而是负责人归属、跟进闭环和拓展判断。`;
}

function buildWhyItMatters({
  kind,
  signals,
  stageLabel,
  english,
}: {
  kind: PageKind;
  signals: ReturnType<typeof summarizeSignals>;
  stageLabel: string;
  english: boolean;
}) {
  return [
    english
      ? `The opportunity is already at ${stageLabel}, so the next customer success move now shapes whether the chain continues as follow-through, expansion or explicit boundary management.`
      : `当前机会已经进入「${stageLabel}」窗口，所以下一步客户成功动作会直接改变这条链是继续做跟进闭环、进入拓展，还是退回显式边界管理。`,
    signals.pendingReview
      ? english
        ? "There is still review pressure on the chain, so customer success must inherit the request honestly instead of speaking as if the review is already closed."
        : "当前链路上仍有复核压力，所以客户成功必须诚实继承这条请求，而不是按“复核已经结束”去说。"
      : english
        ? "Even without pending review, open blockers and commitments still decide whether follow-through can sound confident or must stay reversible."
        : "即使当前没有待复核条目，开放阻塞和承诺也仍在决定跟进闭环是可以更有信心，还是必须继续保持可回退。",
    kind === "expansion-review"
      ? english
        ? "Package, proposal and reinforcement context are already prepared here, so the remaining value is choosing the right expansion owner and boundary."
        : "方案包、提案和加固上下文已经准备好，所以这里剩下真正的价值是选对拓展负责人和边界。"
      : english
        ? "Account evidence, worker notes and the handoff route are already grouped here, so the remaining work is deciding who takes over and how firmly the chain can move."
        : "账户依据、执行备注和交接 路由 已经收在这里，所以剩下真正的工作是决定由谁接手，以及这条链能说到多实。",
  ];
}

function buildDecisionRequests({
  kind,
  stage,
  ownershipMode,
  english,
}: {
  kind: PageKind;
  stage: CustomerSuccessHandoffStage;
  ownershipMode: CustomerSuccessOwnershipMode;
  english: boolean;
}) {
  const ownerLabel = formatOwnershipMode(ownershipMode, english);
  const stageLabel = formatStage(stage, english);

  if (kind === "expansion-review") {
    return [
      english
        ? `Confirm whether expansion review should stay at ${stageLabel}, or whether the chain can safely move back into package / proposal shaping.`
        : `确认拓展复核当前是否继续停在「${stageLabel}」，还是这条链已经可以安全地回到方案包 / 提案构形。`,
      english
        ? `Confirm whether ${ownerLabel} should carry the next expansion move, or whether founder / sales review must step in first.`
        : `确认下一步拓展是否应由「${ownerLabel}」接手，还是需要创始人 / 销售复核先介入。`,
    ];
  }

  if (stage === "escalation-follow-through") {
    return [
      english
        ? "Confirm whether this account should keep moving as escalation follow-through, or whether the pressure has already narrowed enough to downgrade into issue handling."
        : "确认这条账户当前是否继续按升级跟进闭环推进，还是压力已经足够收窄，可以降回问题处理。",
      english
        ? `Confirm whether ${ownerLabel} is the correct widened owner, or whether founder / sales / delivery review still needs to shift before the next outward move.`
        : `确认当前是否真的应由「${ownerLabel}」承担扩大后的负责人角色，还是在下一次对外动作前仍需要创始人 / 销售 / 交付重新调整。`,
    ];
  }

  if (stage === "issue-follow-through") {
    return [
      english
        ? "Confirm whether this account should remain in issue follow-through, or whether it can safely move back into ordinary success verification first."
        : "确认这条账户当前是否继续停在问题跟进闭环，还是已经可以先安全退回普通客户成功验收。",
      english
        ? `Confirm whether ${ownerLabel} should carry the repair move now, or whether review / delivery / sales clarification still has to happen first.`
        : `确认当前是否真的应由「${ownerLabel}」先承担修复动作，还是仍要先补复核 / 交付 / 销售澄清。`,
    ];
  }

  return [
    english
      ? `Confirm whether customer success should keep this work at ${stageLabel}, or whether it should step back into review, proposal or explicit boundary handling first.`
      : `确认客户成功当前是否继续停在「${stageLabel}」，还是需要退回复核、方案或显式边界处理。`,
    english
      ? `Confirm whether ${ownerLabel} is the right next owner, or whether founder / sales / delivery should take the next motion instead.`
      : `确认下一步是否真的该由「${ownerLabel}」接手，还是应改由创始人 / 销售 / 交付继续推进。`,
  ];
}

function buildDecisionSummary({
  kind,
  stage,
  ownershipMode,
  sendabilityMode,
  fallbackMode,
  english,
}: {
  kind: PageKind;
  stage: CustomerSuccessHandoffStage;
  ownershipMode: CustomerSuccessOwnershipMode;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  english: boolean;
}) {
  const stageLabel = formatStage(stage, english);
  const ownershipLabel = formatOwnershipMode(ownershipMode, english);
  const sendabilityLabel = formatSendabilityMode(sendabilityMode, english);
  const fallbackLabel = formatFallbackMode(fallbackMode, english);

  const postureLine =
    kind === "expansion-review"
      ? english
        ? `Current decision posture: keep the chain at ${stageLabel} and let ${ownershipLabel} carry the next expansion read before any stronger commercial wording appears.`
        : `当前判断姿态：先把这条链停在「${stageLabel}」，并由「${ownershipLabel}」承接下一次拓展研判，再决定是否能进入更强的商业表达。`
      : stage === "escalation-follow-through"
        ? english
          ? `Current decision posture: keep the chain at ${stageLabel} because progress is materially blocked by dependency, boundary, missing decision, widened ownership pressure, or elevated execution risk.`
          : `当前判断姿态：先把这条链停在「${stageLabel}」，因为进展已经被依赖、边界、缺失判断、扩大后的 负责人压力或更高 执行风险实质性阻塞。`
        : stage === "issue-follow-through"
          ? english
            ? `Current decision posture: keep the chain at ${stageLabel} because the account has a real follow-through problem, but the repair path still remains within normal current-round coordination.`
            : `当前判断姿态：先把这条链停在「${stageLabel}」，因为账户已经出现真实跟进闭环问题，但修复路径仍落在正常这一轮协调范围内。`
          : english
            ? `Current decision posture: keep the chain at ${stageLabel} and let ${ownershipLabel} carry the next follow-through move instead of treating the account as generally resolved.`
            : `当前判断姿态：先把这条链停在「${stageLabel}」，并由「${ownershipLabel}」承接下一次跟进闭环动作，而不是把账户按“已整体解决”来处理。`;

  const safetyLine =
    fallbackMode === "no-fallback"
      ? english
        ? `Current outward posture stays at ${sendabilityLabel}; anything firmer still needs explicit review, boundary and evidence before it can sound customer-safe.`
        : `当前对外姿态停在「${sendabilityLabel}」，任何更实的表达仍然需要先补齐复核、边界和证据，才能接近客户安全。`
      : english
        ? `Current outward posture stays at ${sendabilityLabel} with ${fallbackLabel}, so the next move must not imply certainty that the current boundary does not support.`
        : `当前对外姿态停在「${sendabilityLabel}」，并继续保留「${fallbackLabel}」，所以下一步不能暗示任何超出当前边界支持范围的确定性。`;

  return [postureLine, safetyLine];
}

function buildWatchState({
  detail,
  signals,
  stage,
  attentionState,
  currentUserId,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  signals: ReturnType<typeof summarizeSignals>;
  stage: CustomerSuccessHandoffStage;
  attentionState: CustomerSuccessAttentionState;
  currentUserId?: string;
  english: boolean;
}): WatchState {
  const reviewTasks = dedupeReviewTasks(
    [
      signals.pendingReview,
      signals.latestReviewTask,
      signals.reviewedTask,
      signals.executedTask,
    ].filter(
      (task): task is ReviewRequestForCustomerSuccess =>
        task != null && "reviewedAt" in task,
    ),
  );
  const reviewTouches = compactWatchTouches([
    ...detail.actionItems.flatMap((item) =>
      item.approvalTask?.reviewedAt
        ? [
            {
              at: item.approvalTask.reviewedAt,
              kind:
                item.approvalTask.status === "EXECUTED"
                  ? ("backed" as const)
                  : ("reviewed" as const),
              isCurrentUser:
                currentUserId != null &&
                item.approvalTask.reviewedById === currentUserId,
              actorLabel:
                currentUserId != null &&
                item.approvalTask.reviewedById === currentUserId
                  ? english
                    ? "you"
                    : "你"
                  : null,
            },
          ]
        : [],
    ),
    ...reviewTouchesFromReviewTasks({
      reviewTasks,
      currentUserId,
      english,
    }),
    ...detail.auditLogs
      .filter((log) => /reviewed|approved|confirmed|backed/i.test(log.summary))
      .map((log) => ({
        at: log.createdAt,
        kind: /approved|backed/i.test(log.summary)
          ? ("backed" as const)
          : ("reviewed" as const),
        isCurrentUser: false,
        actorLabel: log.actor,
      })),
  ]);
  const currentUserTouches = reviewTouches.filter(
    (touch) => touch.isCurrentUser,
  );

  const lastReviewedTouch = newestWatchTouch(
    (currentUserTouches.length > 0 ? currentUserTouches : reviewTouches).filter(
      (touch) => touch.kind === "reviewed",
    ),
  );
  const lastBackedTouch = newestWatchTouch(
    (currentUserTouches.length > 0 ? currentUserTouches : reviewTouches).filter(
      (touch) => touch.kind === "backed",
    ),
  );
  const lastSeenTouch = newestWatchTouch(
    currentUserTouches.length > 0 ? currentUserTouches : reviewTouches,
  );

  return {
    lastReviewedAt: lastReviewedTouch?.at ?? null,
    lastReviewedSummary:
      lastReviewedTouch != null
        ? formatWatchTouchSummary(lastReviewedTouch, english)
        : null,
    lastBackedAt: lastBackedTouch?.at ?? null,
    lastBackedSummary:
      lastBackedTouch != null
        ? formatWatchTouchSummary(lastBackedTouch, english)
        : null,
    lastSeenAt: lastSeenTouch?.at ?? null,
    lastSeenSummary:
      lastSeenTouch != null
        ? formatWatchTouchSummary(lastSeenTouch, english)
        : attentionState === "blocked"
          ? english
            ? `No explicit user review yet. Helm is still watching the ${formatStage(stage, true)} line because the work remains materially blocked.`
            : `当前还没有显式用户复核。Helm 仍在继续盯住「${formatStage(stage, false)}」这条线，因为工作仍处于实质阻塞。`
          : english
            ? "No explicit user review or backing yet. Helm is still carrying the current watch line."
            : "当前还没有显式用户复核或支持。Helm 仍在继续承担当前观察线。",
  };
}

function buildRecentChanges({
  detail,
  signals,
  stage,
  authorityState,
  watchState,
  postSendOutcome,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  signals: ReturnType<typeof summarizeSignals>;
  stage: CustomerSuccessHandoffStage;
  authorityState: CustomerSuccessAuthorityState;
  watchState: WatchState;
  postSendOutcome: CustomerSuccessPostSendOutcomeModel | null;
  english: boolean;
}) {
  const lastSeenAt = watchState.lastSeenAt;
  const deltaItems =
    lastSeenAt != null
      ? compactStrings([
          postSendOutcome &&
          (postSendOutcome.meaningfulOutcomeAt == null
            ? postSendOutcome.referenceAt > lastSeenAt
            : postSendOutcome.meaningfulOutcomeAt > lastSeenAt)
            ? postSendOutcome.deltaSummary
            : null,
          detail.updatedAt > lastSeenAt
            ? english
              ? `The working line was refreshed after ${formatDateLabel(lastSeenAt)} and now reads as ${formatStage(stage, true)}.`
              : `这条工作线在 ${formatDateLabel(lastSeenAt)} 之后被刷新，当前已经转到「${formatStage(stage, false)}」。`
            : null,
          signals.pendingReview && signals.pendingReview.updatedAt > lastSeenAt
            ? english
              ? `Review pressure tightened on ${formatDateLabel(signals.pendingReview.updatedAt)}.`
              : `复核压力在 ${formatDateLabel(signals.pendingReview.updatedAt)} 进一步收紧。`
            : null,
          signals.topBlocker && signals.topBlocker.updatedAt > lastSeenAt
            ? english
              ? `Boundary pressure changed: ${trimText(signals.topBlocker.blockerText, 92)}`
              : `边界压力发生变化：${trimText(signals.topBlocker.blockerText, 92)}`
            : null,
          signals.latestAudit && signals.latestAudit.createdAt > lastSeenAt
            ? english
              ? `New evidence refreshed the judgement: ${signals.latestAudit.actor} · ${trimText(signals.latestAudit.summary, 92)}`
              : `新依据刷新了判断：${signals.latestAudit.actor} · ${trimText(signals.latestAudit.summary, 92)}`
            : null,
          signals.recentThread && signals.recentThread.updatedAt > lastSeenAt
            ? english
              ? `The linked success inbox thread changed on ${formatDateLabel(signals.recentThread.updatedAt)}.`
              : `关联客户成功收件箱线程在 ${formatDateLabel(signals.recentThread.updatedAt)} 后出现变化。`
            : null,
          detail.briefingSnapshot?.generatedAt &&
          detail.briefingSnapshot.generatedAt > lastSeenAt
            ? english
              ? `Helm refreshed the prepared framing on ${formatDateLabel(detail.briefingSnapshot.generatedAt)}.`
              : `Helm 在 ${formatDateLabel(detail.briefingSnapshot.generatedAt)} 重新整理了已准备措辞。`
            : null,
        ])
      : [];

  if (deltaItems.length > 0) {
    return deltaItems.slice(0, 3);
  }

  return compactStrings([
    lastSeenAt
      ? english
        ? `No material customer success delta has been surfaced since ${formatDateLabel(lastSeenAt)}.`
        : `自 ${formatDateLabel(lastSeenAt)} 以来，当前还没有出现新的客户成功关键变化。`
      : postSendOutcome
        ? postSendOutcome.deltaSummary
        : signals.latestAudit
          ? `${signals.latestAudit.actor} · ${trimText(signals.latestAudit.summary, 100)}`
          : english
            ? "Helm refreshed the current customer success framing from the latest account context."
            : "当前已经根据最新账户上下文刷新了客户成功措辞。",
    authorityState === "helm-prepared"
      ? english
        ? "This item is still Helm-prepared; the user has not yet explicitly reviewed or backed the current framing."
        : "当前仍停在 Helm 准备状态，用户还没有明确复核或支持这条措辞。"
      : null,
    signals.pendingReview
      ? english
        ? `Review pressure is still open after ${formatDateLabel(signals.pendingReview.updatedAt)}.`
        : `当前复核压力仍然开放，最近更新于 ${formatDateLabel(signals.pendingReview.updatedAt)}。`
      : signals.topBlocker
        ? english
          ? `Blocker pressure remains visible: ${trimText(signals.topBlocker.blockerText, 96)}`
          : `当前卡点压力仍然可见：${trimText(signals.topBlocker.blockerText, 96)}`
        : null,
  ]).slice(0, 3);
}

function buildResurfaceReasons({
  signals,
  stage,
  sendabilityMode,
  watchState,
  postSendOutcome,
  english,
}: {
  signals: ReturnType<typeof summarizeSignals>;
  stage: CustomerSuccessHandoffStage;
  sendabilityMode: CustomerSuccessSendabilityMode;
  watchState: WatchState;
  postSendOutcome: CustomerSuccessPostSendOutcomeModel | null;
  english: boolean;
}) {
  const lastSeenAt = watchState.lastSeenAt;
  const stageLabel = formatStage(stage, english);

  return compactStrings([
    postSendOutcome &&
    (lastSeenAt == null ||
      (postSendOutcome.meaningfulOutcomeAt == null
        ? postSendOutcome.referenceAt > lastSeenAt
        : postSendOutcome.meaningfulOutcomeAt > lastSeenAt))
      ? postSendOutcome.resurfaceReason
      : null,
    stage === "escalation-follow-through"
      ? english
        ? `This is back because the work now needs ${stageLabel}: progress is materially blocked by dependency, boundary, missing decision, widened ownership pressure, or elevated risk.`
        : `Helm 重新抬出这条线，是因为工作已经需要「${stageLabel}」：当前进展已被依赖、边界、缺失判断、扩大后的负责人压力或更高风险实质阻塞。`
      : stage === "issue-follow-through"
        ? english
          ? `This is back because a real follow-through issue is now shaping what customer success can honestly say next.`
          : `Helm 重新抬出这条线，是因为真实的跟进闭环问题已经开始直接影响客户成功下一步能诚实说到哪里。`
        : stage === "review-before-send" || stage === "review-follow-through"
          ? english
            ? `This is back because review-before-send posture now needs an explicit user decision before any outward wording.`
            : `Helm 重新抬出这条线，是因为当前已经进入发送前复核姿态，在任何对外措辞之前都需要显式用户决策。`
          : null,
    signals.topBlocker
      ? english
        ? `This remains blocked by: ${trimText(signals.topBlocker.blockerText, 96)}`
        : `当前仍被以下事项卡住：${trimText(signals.topBlocker.blockerText, 96)}`
      : signals.pendingReview
        ? english
          ? `This remains waiting on the open review path last updated ${formatDateLabel(signals.pendingReview.updatedAt)}.`
          : `当前仍在等待开放中的复核路径，最近更新于 ${formatDateLabel(signals.pendingReview.updatedAt)}。`
        : null,
    lastSeenAt != null &&
    signals.latestAudit &&
    signals.latestAudit.createdAt > lastSeenAt
      ? english
        ? "New evidence refreshed the current judgement after your last explicit touch."
        : "新的依据在你上次显式触达之后刷新了当前判断。"
      : null,
    lastSeenAt != null &&
    (sendabilityMode === "review-before-send" ||
      sendabilityMode === "boundary-only") &&
    (signals.pendingReview != null ||
      signals.topBlocker != null ||
      (signals.latestAudit?.createdAt ?? new Date(0)) > lastSeenAt)
      ? english
        ? `The current outward posture tightened to ${formatSendabilityMode(sendabilityMode, true)}.`
        : `当前对外姿态已收紧到「${formatSendabilityMode(sendabilityMode, false)}」。`
      : null,
    lastSeenAt != null &&
    !signals.topBlocker &&
    !signals.pendingReview &&
    watchState.lastBackedAt != null &&
    watchState.lastBackedAt <= lastSeenAt
      ? english
        ? "A previously blocked line now looks unblocked enough to review again, but it still remains non-commitment-first."
        : "一条此前受阻的线路现在已经足够解除阻塞，值得重新复核，但它仍然保持非承诺优先。"
      : null,
    english
      ? "This is back to keep the current boundary, decision posture and next accountable move explicit."
      : "Helm 重新抬出这条线，是为了继续把当前边界、判断姿态和下一条负责动作说清楚。",
  ]).slice(0, 3);
}

function buildProcessAdvisory({
  kind,
  signals,
  stage,
  attentionState,
  ownershipMode,
  sendabilityMode,
  fallbackMode,
  decisionItems,
  decisionRequest,
  boundarySummary,
  internalActions,
  english,
}: {
  kind: PageKind;
  signals: ReturnType<typeof summarizeSignals>;
  stage: CustomerSuccessHandoffStage;
  attentionState: CustomerSuccessAttentionState;
  ownershipMode: CustomerSuccessOwnershipMode;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  decisionItems: string[];
  decisionRequest: string;
  boundarySummary: string;
  internalActions: CustomerSuccessInternalActionViewModel[];
  english: boolean;
}): CustomerSuccessProcessAdvisoryModel {
  const escalationAction = internalActions.find((item) =>
    /escalation/i.test(item.title),
  );
  const internalActionCue =
    escalationAction ??
    internalActions.find((item) => item.state !== "executed-internally") ??
    internalActions[0] ??
    null;
  const blockerText = signals.topBlocker
    ? trimText(signals.topBlocker.blockerText, 96)
    : trimText(boundarySummary, 96);
  const decisionPosture = trimText(decisionItems[0] ?? decisionRequest, 110);

  if (
    kind === "expansion-review" &&
    (stage === "expansion-ready-but-blocked" ||
      signals.pendingReview != null ||
      signals.topBlocker != null)
  ) {
    return {
      category: "expansion-readiness-distorted",
      categoryLabel: english
        ? "Expansion readiness distorted"
        : "拓展就绪度被扭曲",
      patternLabel: english
        ? "Commercial readiness is visible, but current blocker or review pressure still distorts what can honestly be framed as expansion-ready."
        : "商业准备度已经可见，但当前卡点或复核压力仍在扭曲这条线到底能否诚实地被说成可扩展。",
      whyNow: signals.pendingReview
        ? english
          ? "Review pressure is still open, so the account cannot yet be framed as clean expansion momentum."
          : "当前复核压力仍未关闭，所以这条账户线还不能被说成干净的拓展动能。"
        : english
          ? `Current blocker pressure still distorts readiness: ${blockerText}`
          : `当前卡点压力仍在扭曲准备度：${blockerText}`,
      playbookRecommendation: internalActionCue
        ? english
          ? `Keep blocked-by-boundary visible, request the missing decision first, and use "${internalActionCue.title}" only as internal preparation.`
          : `继续把受阻于边界留在前台，先请求缺失判断，并把「${internalActionCue.title}」只作为内部准备动作。`
        : english
          ? "Keep blocked-by-boundary visible, request the missing decision first, and do not frame this as expansion-ready yet."
          : "继续把受阻于边界留在前台，先请求缺失判断，不要急着把这条线说成可拓展。",
      unresolved: english
        ? `Unresolved readiness distortion: ${blockerText}`
        : `当前尚未解决的就绪度扭曲：${blockerText}`,
      overstateRisk: english
        ? "Do not overstate this as expansion-ready, commercial-safe or ready for stronger outward certainty."
        : "不要把这条线说成已经可拓展、商业安全，或已经适合更强的对外确定性表达。",
    };
  }

  if (
    stage === "escalation-follow-through" ||
    ownershipMode === "shared-with-founder"
  ) {
    return {
      category: "widened-ownership-pressure",
      categoryLabel: english
        ? "Widened ownership pressure"
        : "负责人压力已扩大",
      patternLabel: english
        ? "This item no longer fits normal customer success handling; it needs widened ownership pressure to keep the route honest."
        : "这条条目已经不再适合普通客户成功处理，需要扩大负责人压力才能把路线说诚实。",
      whyNow: english
        ? `Escalation follow-through is active because current pressure would be understated without widened ownership.`
        : `当前已经进入升级跟进闭环；如果不扩大负责人归属，现有压力就会被说轻。`,
      playbookRecommendation: escalationAction
        ? english
          ? `Widen internal visibility, request the missing decision before external progression, and use "${escalationAction.title}" as the bounded internal playbook.`
          : `扩大内部可见度，在外部推进前先请求缺失判断，并把「${escalationAction.title}」作为有边界的内部 playbook。`
        : english
          ? "Widen internal visibility, request the missing decision before external progression, and keep the escalation note internal-only."
          : "扩大内部可见度，在外部推进前先请求缺失判断，并把升级备注保持为仅内部。",
      unresolved: english
        ? `Current widened pressure remains unresolved: ${blockerText}`
        : `当前扩大后的压力仍未解决：${blockerText}`,
      overstateRisk: english
        ? "Do not overstate widened internal pressure as external certainty, approval or commitment."
        : "不要把扩大后的内部压力误写成外部确定性、审批或承诺。",
    };
  }

  if (
    stage === "blocked-by-boundary" ||
    fallbackMode === "blocked-by-boundary" ||
    sendabilityMode === "boundary-only"
  ) {
    return {
      category: "boundary-limited",
      categoryLabel: english ? "Boundary limited" : "受边界限制",
      patternLabel: english
        ? "The main limiter is now boundary posture rather than execution energy; the chain needs honest containment, not stronger outward wording."
        : "当前主限制项已经是边界姿态，而不是执行意愿；这条链需要诚实收口，而不是更强的对外措辞。",
      whyNow: english
        ? `The current outward posture is ${formatSendabilityMode(sendabilityMode, true)}, so boundary is now the operative constraint.`
        : `当前对外姿态已停在「${formatSendabilityMode(sendabilityMode, false)}」，所以边界已经成为主要约束。`,
      playbookRecommendation: english
        ? "Keep blocked-by-boundary visible, make prerequisite and dependency notes explicit, and keep any next move inside internal or review-held wording."
        : "继续把受阻于边界留在前台，把前置和依赖备注说清，并让下一步停在仅内部或复核挂起措辞里。",
      unresolved: english
        ? `Unresolved boundary line: ${blockerText}`
        : `当前未解开的边界线：${blockerText}`,
      overstateRisk: english
        ? "Do not overstate boundary-limited work as customer-visible certainty, sendability or readiness."
        : "不要把受边界限制的工作说成客户可见确定性、发送评估或就绪度。",
    };
  }

  if (
    stage === "review-before-send" ||
    stage === "review-follow-through" ||
    sendabilityMode === "review-before-send" ||
    signals.pendingReview != null
  ) {
    return {
      category: "repeated-review-before-send",
      categoryLabel: english
        ? "Repeated review-before-send"
        : "反复回到发送前复核",
      patternLabel: english
        ? "The chain keeps returning to review-before-send because the current line is still not ready to sound firmer without explicit review."
        : "这条链反复回到发送前复核，是因为当前表述还没有准备好在没有显式复核的前提下说得更实。",
      whyNow: signals.pendingReview
        ? english
          ? `Open review pressure is still active from ${formatDateLabel(signals.pendingReview.updatedAt)}.`
          : `开放中的复核压力仍在生效，最近更新于 ${formatDateLabel(signals.pendingReview.updatedAt)}。`
        : english
          ? "The sendability posture is still review-before-send, so the next move must stay review-held."
          : "当前发送评估姿态 仍是发送前复核，所以下一步必须继续停在复核挂起。",
      playbookRecommendation: english
        ? "Keep review-before-send explicit, tighten the current decision ask, and only widen visibility internally until the review line closes."
        : "继续把发送前复核留在前台，收紧当前判断请求，并在复核话术 关闭前只扩大内部可见度。",
      unresolved: english
        ? `Unresolved review pressure: ${trimText(decisionRequest, 108)}`
        : `当前未解开的复核压力：${trimText(decisionRequest, 108)}`,
      overstateRisk: english
        ? "Do not overstate review-held wording as ready-to-send, customer-safe or already approved."
        : "不要把停在复核线上的表述说成可发送、客户安全或已经获批。",
    };
  }

  if (signals.topBlocker != null || attentionState === "blocked") {
    return {
      category: "blocked-by-dependency",
      categoryLabel: english ? "Blocked by dependency" : "被依赖卡住",
      patternLabel: english
        ? "The work is stalling because a dependency remains unresolved; more activity without resolution will mostly create noise."
        : "当前停滞的主因是依赖尚未解决；如果不先解依赖，继续加动作大多只会增加噪音。",
      whyNow: english
        ? `Current dependency pressure remains visible: ${blockerText}`
        : `当前依赖压力仍然可见：${blockerText}`,
      playbookRecommendation: internalActionCue
        ? english
          ? `Keep the dependency visible, request the missing decision or unblocker, and use "${internalActionCue.title}" only to coordinate internally.`
          : `继续把依赖留在前台，先请求缺失判断或解除阻塞事项，并把「${internalActionCue.title}」只用于内部协同。`
        : english
          ? "Keep the dependency visible, request the missing decision or unblocker, and avoid widening certainty until the dependency clears."
          : "继续把依赖留在前台，先请求缺失判断或解除阻塞事项，并在依赖清除前避免扩大确定性表达。",
      unresolved: english
        ? `Unresolved dependency: ${blockerText}`
        : `当前未解开的依赖：${blockerText}`,
      overstateRisk: english
        ? "Do not overstate a blocked dependency path as a clean next-step line or implied commitment."
        : "不要把仍被依赖卡住的路径说成干净的下一步话术，或暗示成 隐含承诺。",
    };
  }

  return {
    category: "missing-decision",
    categoryLabel: english ? "Missing decision" : "缺少判断",
    patternLabel: english
      ? "The main reason this line stalls is that the next bounded decision has not yet been made explicit."
      : "这条线之所以会拖住，主因是下一条有边界的判断还没有被显式说清。",
    whyNow: english
      ? `Current decision posture still needs confirmation: ${decisionPosture}`
      : `当前仍需确认的判断姿态：${decisionPosture}`,
    playbookRecommendation: internalActionCue
      ? english
        ? `Request the decision before widening the route, and use "${internalActionCue.title}" only as bounded internal preparation.`
        : `先请求这条判断，再决定是否扩大路线，并把「${internalActionCue.title}」只作为有边界的内部准备。`
      : english
        ? "Request the bounded decision before widening the route, and keep the current line non-commitment-first."
        : "先请求这条有边界的判断，再决定是否扩大路线，并继续保持非承诺优先。",
    unresolved: english
      ? `Still unresolved: ${trimText(decisionRequest, 110)}`
      : `当前仍未解开的事项：${trimText(decisionRequest, 110)}`,
    overstateRisk: english
      ? "Do not overstate a missing-decision line as already agreed, externally safe or ready for stronger certainty."
      : "不要把一条缺少判断的线路说成已经 agreed、可安全对外或已经准备好更强确定性表达。",
  };
}

function buildProcessAdvisoryItems({
  processAdvisory,
  english,
}: {
  processAdvisory: CustomerSuccessProcessAdvisoryModel;
  english: boolean;
}) {
  return [
    `${english ? "Detected pattern" : "当前模式"}: ${processAdvisory.categoryLabel}`,
    `${english ? "Why Helm thinks this applies now" : "Helm 为什么判断它现在适用"}: ${processAdvisory.whyNow}`,
    `${english ? "Safe playbook" : "安全处理建议"}: ${processAdvisory.playbookRecommendation}`,
    `${english ? "What remains unresolved" : "当前仍未解决"}: ${processAdvisory.unresolved}`,
    `${english ? "What would overstate certainty" : "什么会夸大确定性"}: ${processAdvisory.overstateRisk}`,
  ];
}

function buildPolicySurface({
  attentionState,
  sendabilityMode,
  fallbackMode,
  internalActions,
  processAdvisory,
  english,
}: {
  attentionState: CustomerSuccessAttentionState;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  internalActions: CustomerSuccessInternalActionViewModel[];
  processAdvisory: CustomerSuccessProcessAdvisoryModel;
  english: boolean;
}): CustomerSuccessPolicySurfaceModel {
  const hasExecutionAllowed = internalActions.some((item) => item.canExecute);
  const hasApprovalRequired = internalActions.some((item) => item.canApprove);

  const activeCues: CustomerSuccessPolicyCue[] = [
    hasExecutionAllowed
      ? "internal-execution-allowed"
      : hasApprovalRequired
        ? "approval-required"
        : "advisory-only",
    "internal-only",
    "external-send-disabled",
    "commitment-disabled",
  ];

  const blockedBy =
    attentionState === "review-before-send" ||
    sendabilityMode === "review-before-send"
      ? english
        ? "Current review-before-send posture still blocks any outward move from sounding customer-safe."
        : "当前发送前复核姿态 仍会阻止任何对外动作被说成客户安全。"
      : sendabilityMode === "boundary-only" ||
          fallbackMode === "blocked-by-boundary"
        ? english
          ? "Current boundary posture still blocks outward certainty from widening beyond the evidence."
          : "当前边界姿态 仍在阻止对外确定性超出证据支持范围。"
        : attentionState === "blocked"
          ? english
            ? "Current blocker, dependency or missing decision still keeps the next move bounded."
            : "当前卡点、依赖或缺失判断仍在把下一步限制在有边界的范围里。"
          : english
            ? "Current customer success line still stays bounded by non-commitment-first governance."
            : "当前客户成功线路仍受非承诺优先 治理约束。";

  return {
    activeCues,
    primaryLabel: hasExecutionAllowed
      ? english
        ? "Internal execution allowed"
        : "允许内部执行"
      : hasApprovalRequired
        ? english
          ? "Approval required"
          : "需要批准"
        : english
          ? "Advisory only"
          : "仅建议",
    primaryTone: hasExecutionAllowed
      ? "emerald"
      : hasApprovalRequired
        ? "amber"
        : "sky",
    whatHelmCanDoNow: hasExecutionAllowed
      ? english
        ? "Already-approved low-risk internal actions can be prepared, recommended, and executed on this customer success line."
        : "这条客户成功线当前可以准备、建议，并执行已经获批的低风险内部动作。"
      : hasApprovalRequired
        ? english
          ? "The current bounded move can be prepared and recommended here, and low-risk internal actions can execute only after your explicit approval."
          : "这里可以先准备并建议这条有边界的下一动作；只有在你显式批准后，低风险内部动作才可执行。"
        : english
          ? "The current line can stay prepared, recommended and visible here, but it remains advisory-only until a user approval path becomes explicit."
          : "这条线当前可以继续保持已准备、可建议且可见，但在用户批准路径明确前，它仍保持仅建议。",
    approvalRequirement: hasExecutionAllowed
      ? english
        ? "Any additional internal action beyond the approved set still needs explicit per-action approval."
        : "除了当前已批准的动作外，任何新增内部动作仍然需要逐条显式批准。"
      : hasApprovalRequired
        ? english
          ? "Prepared internal actions still require your explicit per-action approval before execution can happen."
          : "当前已准备的内部动作仍需要你逐条显式批准，之后才可执行。"
        : english
          ? "No internal action is currently executable without first re-entering an explicit approval line."
          : "当前没有任何内部动作可以绕过显式批准直接执行。",
    internalOnlyBoundary: english
      ? "Any prepared or executed action here remains internal-only, not customer-sendable, and non-commitment by default."
      : "这里任何已准备或已执行的动作都仍然是仅内部、不可对外发送，并默认保持非承诺。",
    whatRemainsBlocked: blockedBy,
    overstateRisk: english
      ? `Do not overstate this surface as customer-sendable, commitment-capable, or safe for stronger certainty while the current policy line remains ${processAdvisory.categoryLabel.toLowerCase()}.`
      : `在当前治理线仍停在「${processAdvisory.categoryLabel}」期间，不要把这一面说成可对外发送、可形成承诺，或适合更强确定性表达。`,
    queueSummary: hasExecutionAllowed
      ? english
        ? "An approved low-risk internal step is available, but external send remains disabled."
        : "当前有一条已批准的低风险内部步骤可执行，但外发仍然禁用。"
      : hasApprovalRequired
        ? english
          ? "Low-risk internal actions can be prepared here, but execution still requires user approval."
          : "这里可以先准备低风险内部动作，但执行仍需要用户批准。"
        : english
          ? "This line is still advisory-only; it can prepare and recommend, not execute."
          : "当前这条线仍是仅建议；这里只能准备和建议，不能直接执行。",
    queueBlockedSummary: english
      ? `${blockedBy} External send stays disabled and commitment stays disabled on this surface.`
      : `${blockedBy} 这一面仍然禁用对外发送，并继续禁用承诺。`,
    approvalRequiredLabel: hasApprovalRequired
      ? english
        ? "Requires your approval"
        : "需要你批准"
      : null,
    internalOnlyLabel: english ? "Internal only" : "仅内部可见",
    externalSendDisabledLabel: english
      ? "External send disabled"
      : "外发已禁用",
    commitmentDisabledLabel: english ? "Commitment disabled" : "承诺已禁用",
  };
}

function buildPolicyItems({
  policySurface,
  english,
}: {
  policySurface: CustomerSuccessPolicySurfaceModel;
  english: boolean;
}) {
  return [
    `${english ? "What stays available now" : "当前仍可做什么"}: ${policySurface.whatHelmCanDoNow}`,
    `${english ? "What needs explicit approval" : "什么需要显式批准"}: ${policySurface.approvalRequirement}`,
    `${english ? "What remains internal-only" : "什么仍然只限内部"}: ${policySurface.internalOnlyBoundary}`,
    `${english ? "What remains blocked" : "当前还被什么卡住"}: ${policySurface.whatRemainsBlocked}`,
    `${english ? "What would overstate certainty or commitment" : "什么会夸大确定性或承诺"}: ${policySurface.overstateRisk}`,
  ];
}

function buildExternalDrafts({
  detail,
  reviewTasks,
  signals,
  stage,
  attentionState,
  authorityState,
  sendabilityMode,
  fallbackMode,
  processAdvisory,
  judgement,
  reason,
  decisionRequest,
  boundarySummary,
  nextActionLabel,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  reviewTasks: ReviewRequestForCustomerSuccess[];
  signals: ReturnType<typeof summarizeSignals>;
  stage: CustomerSuccessHandoffStage;
  attentionState: CustomerSuccessAttentionState;
  authorityState: CustomerSuccessAuthorityState;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  processAdvisory: CustomerSuccessProcessAdvisoryModel;
  judgement: string;
  reason: string;
  decisionRequest: string;
  boundarySummary: string;
  nextActionLabel: string;
  english: boolean;
}): CustomerSuccessExternalDraftViewModel[] {
  const kind = deriveExternalDraftKind({
    stage,
    attentionState,
    sendabilityMode,
    fallbackMode,
    advisoryCategory: processAdvisory.category,
  });
  const policyCues = buildExternalDraftPolicyCues({
    kind,
    attentionState,
    sendabilityMode,
    fallbackMode,
  });
  const policyCueLabels = buildExternalDraftPolicyCueLabels({
    cues: policyCues,
    english,
  });
  const reviewOutcome = buildExternalDraftReviewOutcome({
    detail,
    reviewTasks,
    authorityState,
    sendabilityMode,
    boundarySummary,
    draftPreparedAt: detail.briefingSnapshot?.generatedAt ?? detail.updatedAt,
    english,
  });
  const postSendOutcome = buildExternalDraftPostSendOutcome({
    detail,
    signals,
    reviewOutcome,
    sendabilityMode,
    judgement,
    reason,
    decisionRequest,
    boundarySummary,
    nextActionLabel,
    english,
  });
  const kindLabel = formatExternalDraftKind(kind, english);

  const summary =
    kind === "review-before-send-follow-up"
      ? english
        ? "A review-before-send follow-up draft is already prepared, and the next outward wording stays held for human review."
        : "当前已准备一条发送前复核跟进草稿，下一条对外措辞会继续停在人工复核线。"
      : kind === "boundary-aware-check-in"
        ? english
          ? "A boundary-aware check-in draft is already prepared, so the customer can stay informed without widening certainty."
          : "当前已准备一条边界感知确认草稿，可以继续向客户同步，但不会扩大确定性。"
        : kind === "decision-dependency-clarification-request"
          ? english
            ? "A clarification draft is already prepared and asks only for the missing decision or dependency needed to move honestly."
            : "当前已准备一条澄清草稿，只询问诚实推进所必需的缺失判断或依赖。"
          : kind === "non-commitment-status-update"
            ? english
              ? "A non-commitment status update is already prepared and keeps follow-through visible without sounding like a promise."
              : "当前已准备一条非承诺状态更新，可以继续保持跟进闭环可见，但不会说得像承诺。"
        : english
          ? "A holding reply draft is already prepared so the customer line can move without sounding firmer than the evidence."
          : "当前已准备一条持守中回应草稿，让客户线继续推进，但不会说得比现有证据更实。";

  const intent =
    kind === "review-before-send-follow-up"
      ? english
        ? "Hold the line at review-before-send until a human checks the exact outward wording."
        : "在人工检查具体对外措辞前，继续把这条线停在发送前复核。"
      : kind === "boundary-aware-check-in"
        ? english
          ? "Keep boundary, prerequisite and dependency visible without implying the route is already clear."
          : "继续把边界、前置和依赖留在前台，不暗示这条路线已经被清空。"
        : kind === "decision-dependency-clarification-request"
          ? english
            ? "Ask only for the missing decision or dependency instead of sounding as if the path is already settled."
            : "只请求缺失的判断或依赖，而不是把这条路径说得像已经落定。"
          : kind === "non-commitment-status-update"
            ? english
              ? "Show motion on the work while keeping the next ask, current risk and non-commitment posture explicit."
              : "继续展示这条工作的推进，同时把下一条请求、当前风险和非承诺姿态说清楚。"
            : english
              ? "Acknowledge the current state, keep the next move warm, and avoid over-speaking beyond the current evidence."
              : "确认当前状态、保持下一步预热，但避免说到超出当前证据的范围。";

  const whyNow =
    kind === "review-before-send-follow-up"
      ? english
        ? "The current sendability line still stays at review-before-send, so the safest customer-facing wording must remain draft-only."
        : "当前发送评估仍停在发送前复核，所以最安全的客户可见措辞也必须继续停在草稿状态。"
      : kind === "boundary-aware-check-in"
        ? english
          ? `Boundary posture is still active: ${trimText(boundarySummary, 120)}`
          : `当前边界姿态 仍在前台：${trimText(boundarySummary, 120)}`
        : kind === "decision-dependency-clarification-request"
          ? english
            ? `The missing ask is still explicit: ${trimText(decisionRequest, 120)}`
            : `当前缺失的 请求 仍然明确存在：${trimText(decisionRequest, 120)}`
          : kind === "non-commitment-status-update"
            ? english
              ? `The current issue line still needs bounded visibility before the next move: ${trimText(reason, 120)}`
              : `当前问题话术在下一步前仍需要有边界的可见度：${trimText(reason, 120)}`
            : english
              ? `The customer line can stay alive, but only with bounded wording: ${trimText(judgement, 120)}`
              : `客户线可以继续维持，但只能使用有边界的措辞：${trimText(judgement, 120)}`;

  const reviewStateLabel =
    authorityState === "user-backed"
      ? english
        ? "Prepared draft · user-backed framing · still requires human review"
        : "已准备草稿 · 当前措辞已获用户支持 · 但仍需要人工复核"
      : authorityState === "user-reviewed"
        ? english
          ? "Prepared draft · user-reviewed framing · still requires human review"
          : "已准备草稿 · 当前措辞已经用户复核 · 但仍需要人工复核"
        : english
          ? "Prepared draft · requires human review"
          : "已准备草稿 · 需要人工复核";

  const unresolved =
    kind === "decision-dependency-clarification-request"
      ? english
        ? `Still unresolved before any send could even be reviewed: ${trimText(decisionRequest, 120)}`
        : `在任何发送进入复核之前，当前仍未解决：${trimText(decisionRequest, 120)}`
      : attentionState === "review-before-send" ||
          sendabilityMode === "review-before-send"
        ? english
          ? "Human review still needs to confirm the exact outward wording, boundary line and decision posture."
          : "当前仍需要人工确认具体对外措辞、边界话术 和判断姿态。"
        : fallbackMode === "blocked-by-boundary"
          ? english
            ? `Current boundary still limits any outward wording: ${trimText(boundarySummary, 120)}`
            : `当前边界仍在限制任何对外措辞：${trimText(boundarySummary, 120)}`
          : english
            ? `The next bounded move still needs review: ${trimText(nextActionLabel, 120)}`
            : `当前下一条有边界的动作仍需要复核：${trimText(nextActionLabel, 120)}`;

  const overstateRisk =
    kind === "decision-dependency-clarification-request"
      ? english
        ? "Sending this as if the route were already settled would overstate certainty while the missing decision or dependency stays open."
        : "如果把这条草稿按“路线已落定”去发送，就会在缺失判断或依赖仍未解决时夸大确定性。"
      : kind === "boundary-aware-check-in"
        ? english
          ? "Any wording that sounds as if the boundary is cleared, sendability is open, or the account is already expansion-ready would overstate reality."
          : "任何把这条线说成边界已清、发送评估已开放或账户已经可拓展 的措辞，都会夸大现实状态。"
        : kind === "review-before-send-follow-up"
          ? english
            ? "Treating this draft as customer-sendable now would overstate the current review line and safe outward posture."
            : "如果把这条草稿现在当成可直接对外发送，就会夸大当前的复核话术 和 安全对外姿态。"
          : kind === "non-commitment-status-update"
            ? english
              ? "Wording this draft like a promise, delivery commitment, or cleared outcome would overstate the current line."
              : "如果把这条草稿写得像承诺、交付承诺或已清晰结果，就会夸大当前线路。"
            : english
              ? "Any reply that sounds firmer than the current boundary, decision posture or evidence would overstate certainty."
              : "任何说得比当前边界、判断姿态或证据更实的回复，都会夸大确定性。";

  return [
    {
      kind,
      kindLabel,
      title: english ? `${kindLabel} draft` : `${kindLabel}草稿`,
      summary,
      intent,
      whyNow,
      reviewStateLabel,
      unresolved,
      overstateRisk,
      policyCues,
      policyCueLabels,
      queueStatusLabel: english ? "External draft prepared" : "已准备外部草稿",
      queueStatusTone:
        attentionState === "review-before-send" ||
        sendabilityMode === "review-before-send"
          ? "amber"
          : fallbackMode === "blocked-by-boundary"
            ? "violet"
            : "sky",
      queueSummary: `${kindLabel}${english ? ": " : "："}${trimText(summary, 116)}`,
      queueBlockedSummary:
        kind === "review-before-send-follow-up"
          ? english
            ? "Draft remains review-before-send and not customer-sendable until human review closes the line."
            : "当前草稿仍停在发送前复核，在人工复核收口前不可对外发送。"
          : kind === "boundary-aware-check-in"
            ? english
              ? `Draft remains boundary-limited: ${trimText(boundarySummary, 112)}`
              : `当前草稿仍受边界限制：${trimText(boundarySummary, 112)}`
            : english
              ? trimText(unresolved, 118)
              : trimText(unresolved, 118),
      reviewOutcome,
      postSendOutcome,
    },
  ];
}

function deriveExternalDraftKind({
  stage,
  attentionState,
  sendabilityMode,
  fallbackMode,
  advisoryCategory,
}: {
  stage: CustomerSuccessHandoffStage;
  attentionState: CustomerSuccessAttentionState;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  advisoryCategory: CustomerSuccessProcessAdvisoryCategory;
}): CustomerSuccessExternalDraftKind {
  if (
    attentionState === "review-before-send" ||
    stage === "review-before-send" ||
    sendabilityMode === "review-before-send"
  ) {
    return "review-before-send-follow-up";
  }

  if (
    stage === "blocked-by-boundary" ||
    fallbackMode === "blocked-by-boundary" ||
    sendabilityMode === "boundary-only" ||
    advisoryCategory === "boundary-limited"
  ) {
    return "boundary-aware-check-in";
  }

  if (
    advisoryCategory === "missing-decision" ||
    advisoryCategory === "blocked-by-dependency"
  ) {
    return "decision-dependency-clarification-request";
  }

  if (stage === "issue-follow-through") {
    return "non-commitment-status-update";
  }

  return "holding-reply";
}

function buildExternalDraftPolicyCues({
  kind,
  attentionState,
  sendabilityMode,
  fallbackMode,
}: {
  kind: CustomerSuccessExternalDraftKind;
  attentionState: CustomerSuccessAttentionState;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
}): CustomerSuccessExternalDraftCue[] {
  return compactActions<CustomerSuccessExternalDraftCue>([
    "draft-only",
    "review-before-send",
    "not-sendable-yet",
    "non-commitment-required",
    "human-review-required",
    kind === "boundary-aware-check-in" ||
    fallbackMode === "blocked-by-boundary" ||
    sendabilityMode === "boundary-only" ||
    attentionState === "blocked"
      ? "boundary-limited"
      : null,
  ]);
}

function buildExternalDraftPolicyCueLabels({
  cues,
  english,
}: {
  cues: CustomerSuccessExternalDraftCue[];
  english: boolean;
}): CustomerSuccessPolicyTag[] {
  return cues.map((cue) => ({
    label: formatExternalDraftCue(cue, english),
    tone:
      cue === "draft-only"
        ? "sky"
        : cue === "boundary-limited" || cue === "non-commitment-required"
          ? "violet"
          : "amber",
  }));
}

function buildExternalDraftReviewOutcome({
  detail,
  reviewTasks,
  authorityState,
  sendabilityMode,
  boundarySummary,
  draftPreparedAt,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  reviewTasks: ReviewRequestForCustomerSuccess[];
  authorityState: CustomerSuccessAuthorityState;
  sendabilityMode: CustomerSuccessSendabilityMode;
  boundarySummary: string;
  draftPreparedAt: Date;
  english: boolean;
}): CustomerSuccessDraftReviewOutcomeModel {
  const revisionTask =
    reviewTasks.find(
      (task) => task.status === "REJECTED" && task.reviewedBy != null,
    ) ?? null;
  const handoffTask =
    reviewTasks.find(
      (task) => task.status === "EXECUTED" && task.reviewedBy != null,
    ) ?? null;
  const reviewedTask =
    reviewTasks.find(
      (task) =>
        task.reviewedBy != null &&
        task.reviewedAt != null &&
        task.status !== "REJECTED" &&
        task.status !== "EXECUTED",
    ) ?? null;
  const pendingTask =
    reviewTasks.find((task) => task.status === "PENDING") ?? null;
  const manualSendRecord = findManualSendRecord({
    detail,
    after:
      handoffTask?.reviewedAt ?? reviewedTask?.reviewedAt ?? draftPreparedAt,
    english,
  });

  const activeCues = compactActions<CustomerSuccessDraftReviewOutcomeCue>([
    pendingTask ? "review-pending" : null,
    reviewedTask ? "reviewed-by-human" : null,
    revisionTask ? "revision-requested" : null,
    handoffTask ? "handoff-to-human-sender" : null,
    manualSendRecord ? "manual-send-recorded" : null,
  ]);

  const cueLabels = compactPolicyTags(
    activeCues.map((cue) => ({
      label: formatDraftReviewOutcomeCue(cue, english),
      tone:
        cue === "manual-send-recorded"
          ? "emerald"
          : cue === "handoff-to-human-sender" || cue === "reviewed-by-human"
            ? "violet"
            : "amber",
    })),
  );

  const reviewerName =
    revisionTask?.reviewedBy?.name ??
    handoffTask?.reviewedBy?.name ??
    reviewedTask?.reviewedBy?.name ??
    null;
  const reviewerIdentity = reviewerName
    ? english
      ? `Reviewed by ${reviewerName}`
      : `由 ${reviewerName} 复核`
    : authorityState === "helm-prepared"
      ? english
        ? "No human review has been recorded yet."
        : "当前还没有记录到人工复核。"
      : null;

  const revisionRequest = revisionTask?.reviewedBy?.name
    ? english
      ? `${revisionTask.reviewedBy.name} requested revision on ${formatDateLabel(revisionTask.reviewedAt ?? revisionTask.updatedAt)}.`
      : `${revisionTask.reviewedBy.name} 在 ${formatDateLabel(revisionTask.reviewedAt ?? revisionTask.updatedAt)} 要求修改当前草稿。`
    : null;

  const sendHandoff = handoffTask?.reviewedBy?.name
    ? english
      ? `Handoff to human sender: ${handoffTask.reviewedBy.name} now owns any manual send decision outside Helm.`
      : `已交接给人工发送者：${handoffTask.reviewedBy.name} 现在承接 Helm 之外的任何手动发送决策。`
    : null;

  const manualSendRecorded = manualSendRecord
    ? english
      ? `Manual send recorded by ${manualSendRecord.actor} on ${formatDateLabel(manualSendRecord.at)}.`
      : `${manualSendRecord.actor} 已在 ${formatDateLabel(manualSendRecord.at)} 记录手动发送。`
    : null;

  const reviewPosture = revisionRequest
    ? english
      ? "Revision requested: the draft stays review-before-send and must be revised before any future handoff is reconsidered."
      : "当前已被要求修改：草稿仍停在发送前复核，在重新考虑后续交接前必须先改写。"
    : manualSendRecorded
      ? english
        ? "Manual send recorded: the external move happened outside this surface, and only the attributable review / handoff trace stays here."
        : "当前已记录人工发送：外部动作发生在这张面之外，这里只保留可追溯的复核 / 交接轨迹。"
      : sendHandoff
        ? english
          ? "Reviewed and handed off: a named human now owns any send decision outside Helm."
          : "当前已完成复核并交接：具体发送决策现在由具名人工在 Helm 之外承接。"
        : reviewedTask?.reviewedBy?.name
          ? english
            ? `${reviewedTask.reviewedBy.name} reviewed the draft, but it still remains review-before-send and unsendable inside Helm.`
            : `${reviewedTask.reviewedBy.name} 已复核当前草稿，但它在 Helm 内仍保持发送前复核且不可发送。`
          : pendingTask
            ? english
              ? "Human review is still pending, so the draft remains held for review and still does not send."
              : "当前人工复核仍在等待中，所以草稿继续停在复核线，也不会发送。"
            : english
              ? "The draft is still awaiting explicit human review before any send could even be considered."
              : "在任何发送被考虑之前，这条草稿仍在等待显式人工复核。";

  const helmBoundaryReminder = english
    ? `External send still stays disabled here. Current posture remains ${formatSendabilityMode(sendabilityMode, true)} with ${trimText(boundarySummary, 110)}`
    : `这里仍然禁止外部发送。当前姿态 仍停在「${formatSendabilityMode(sendabilityMode, false)}」，并继续保留：${trimText(boundarySummary, 110)}`;

  return {
    activeCues,
    cueLabels,
    reviewPosture,
    reviewerIdentity,
    revisionRequest,
    sendHandoff,
    manualSendRecorded,
    helmBoundaryReminder,
    queueStatusLabel: revisionRequest
      ? english
        ? "Revision requested"
        : "已要求修改"
      : manualSendRecorded
        ? english
          ? "Manual send recorded"
          : "已记录手动发送"
        : sendHandoff
          ? english
            ? "Handed off to human sender"
            : "已交接给人工发送者"
          : reviewedTask?.reviewedBy?.name
            ? english
              ? "Reviewed by human"
              : "已完成人工复核"
            : english
              ? "Review pending"
              : "等待复核",
    queueStatusTone: revisionRequest
      ? "amber"
      : manualSendRecorded
        ? "emerald"
        : sendHandoff || reviewedTask?.reviewedBy?.name
          ? "violet"
          : "amber",
    queueSummary: revisionRequest
      ? english
        ? "The draft was returned for revision and remains review-before-send inside Helm."
        : "当前草稿已被退回修改，在 Helm 内仍保持发送前复核。"
      : manualSendRecorded
        ? english
          ? "A human later recorded that the external message was sent manually outside this surface."
          : "当前已由人工记录外部消息在这张面之外被手动发送。"
        : sendHandoff
          ? english
            ? "The draft was reviewed and handed off to a named human sender; this surface still did not send it."
            : "当前草稿已完成复核并交接给具名人工发送者；这张面仍未发送它。"
          : reviewedTask?.reviewedBy?.name
            ? english
              ? "The draft has human review, but still remains review-before-send and not customer-sendable inside Helm."
              : "当前草稿已经有人类复核，但在 Helm 内仍保持发送前复核，且不可对外发送。"
            : english
              ? "The draft is prepared and still waiting for explicit human review."
              : "当前草稿已准备好，但仍在等待显式人工复核。",
    queueHandoffSummary: manualSendRecorded
      ? english
        ? `${manualSendRecorded} This surface still did not send the message.`
        : `${manualSendRecorded} 这张面仍没有发送这条消息。`
      : sendHandoff
        ? english
          ? `${sendHandoff} Send authority still stays disabled here.`
          : `${sendHandoff} 这里仍继续禁用发送权限。`
        : revisionRequest
          ? english
            ? `${revisionRequest} The draft stays internal and review-held until it is rewritten.`
            : `${revisionRequest} 在改写完成前，这条草稿仍只限内部并继续停在复核线上。`
          : english
            ? "The draft still stays internal, non-commitment, and review-before-send."
            : "这条草稿仍保持为 internal、非承诺和发送前复核。",
    reviewedAt: reviewedTask?.reviewedAt ?? null,
    sendHandoffAt: handoffTask?.reviewedAt ?? null,
    manualSendRecordedAt: manualSendRecord?.at ?? null,
  };
}

type PostSendOutcomeEvent = {
  at: Date;
  kind: "external-reply" | "account-trace";
  summary: string;
  text: string;
};

function buildExternalDraftPostSendOutcome({
  detail,
  signals,
  reviewOutcome,
  sendabilityMode,
  judgement,
  reason,
  decisionRequest,
  boundarySummary,
  nextActionLabel,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  signals: ReturnType<typeof summarizeSignals>;
  reviewOutcome: CustomerSuccessDraftReviewOutcomeModel;
  sendabilityMode: CustomerSuccessSendabilityMode;
  judgement: string;
  reason: string;
  decisionRequest: string;
  boundarySummary: string;
  nextActionLabel: string;
  english: boolean;
}): CustomerSuccessPostSendOutcomeModel | null {
  const referenceAt =
    reviewOutcome.manualSendRecordedAt ?? reviewOutcome.sendHandoffAt ?? null;
  if (!referenceAt) {
    return null;
  }

  const firstOutcome = findFirstMeaningfulExternalOutcome({
    detail,
    after: referenceAt,
    english,
  });
  const boundarySignal = buildBoundarySignalAfterPostSend({
    signals,
    after: referenceAt,
    english,
  });
  const clarificationRequested =
    /clarif|question|unclear|confirm|which|what|when|how|need more|dependency/i.test(
      `${firstOutcome?.text ?? ""} ${boundarySignal?.text ?? ""}`,
    );
  const boundaryTightened =
    boundarySignal != null ||
    /blocked|cannot|can't|not yet|approval|security|legal|budget|boundary|risk/i.test(
      `${firstOutcome?.text ?? ""}`,
    );
  const unblocked =
    firstOutcome != null &&
    !clarificationRequested &&
    !boundaryTightened &&
    !signals.topBlocker &&
    !signals.pendingReview &&
    /thanks|thank you|sounds good|works|okay|ok\b|confirmed|proceed|move forward|unblocked|resolved|good to go/i.test(
      firstOutcome.text,
    );
  const reviewMaintainsPosture =
    sendabilityMode === "review-before-send" ||
    sendabilityMode === "boundary-only" ||
    reviewOutcome.activeCues.includes("revision-requested");
  const shiftedNextAction =
    firstOutcome != null || clarificationRequested || boundaryTightened;
  const awaitingExternalOutcome =
    firstOutcome == null && boundarySignal == null && !unblocked;
  const meaningfulOutcomeAt = firstOutcome?.at ?? boundarySignal?.at ?? null;

  const firstOutcomeSummary =
    firstOutcome?.summary ?? boundarySignal?.summary ?? null;
  const whatChanged = clarificationRequested
    ? english
      ? `Judgement now shifts into clarification-first follow-through. Decision posture tightens around ${trimText(decisionRequest, 120)}, and the next action now centers on ${trimText(nextActionLabel, 120)}.`
      : `当前判断已转到澄清优先跟进闭环。判断姿态会继续收紧在「${trimText(decisionRequest, 120)}」上，下一步也转成「${trimText(nextActionLabel, 120)}」。`
    : boundaryTightened
      ? english
        ? `Judgement and boundary posture both tighten after the post-send signal: ${trimText(boundarySummary, 120)} The next action stays ${trimText(nextActionLabel, 120)}.`
        : `当前发送后信号让判断和边界姿态同时收紧：${trimText(boundarySummary, 120)} 下一步仍停在「${trimText(nextActionLabel, 120)}」。`
      : unblocked
        ? english
          ? `The line looks more unblocked now, so the current next move can refresh to ${trimText(nextActionLabel, 120)} without turning into commitment.`
          : `当前线路看起来更接近解除阻塞，因此下一步可以刷新到「${trimText(nextActionLabel, 120)}」，但这仍不意味着承诺。`
        : firstOutcomeSummary
          ? english
            ? `A meaningful post-send outcome refreshed the working line: ${trimText(reason, 120)} Next action now stays anchored to ${trimText(nextActionLabel, 120)}.`
            : `当前有一条有意义的发送后结果刷新了工作线：${trimText(reason, 120)} 下一步会继续锚定在「${trimText(nextActionLabel, 120)}」。`
          : english
            ? `No meaningful external outcome is visible yet, so judgement stays anchored to the current line: ${trimText(judgement, 120)}`
            : `当前还没有可见的外部结果，所以判断仍锚定在这条线上：${trimText(judgement, 120)}`;
  const unresolved = awaitingExternalOutcome
    ? english
      ? "Still unresolved: no meaningful external outcome is visible yet after the human handoff / manual send record."
      : "当前仍未解决：在人工交接 / 手动发送记录之后，还没有看到可见的外部结果。"
    : clarificationRequested
      ? english
        ? `Still unresolved: ${trimText(decisionRequest, 120)}`
        : `当前仍未解决：${trimText(decisionRequest, 120)}`
      : boundaryTightened
        ? english
          ? `Still unresolved: ${trimText(boundarySummary, 120)}`
          : `当前仍未解决：${trimText(boundarySummary, 120)}`
        : reviewMaintainsPosture
          ? english
            ? `Still unresolved: the line remains ${formatSendabilityMode(sendabilityMode, true)} and non-commitment-first.`
            : `当前仍未解决：这条线仍保持「${formatSendabilityMode(sendabilityMode, false)}」并继续以非承诺优先 为主。`
          : english
            ? `Still unresolved: ${trimText(nextActionLabel, 120)}`
            : `当前仍未解决：${trimText(nextActionLabel, 120)}`;
  const overstateRisk = awaitingExternalOutcome
    ? english
      ? "Treating silence or a human handoff as confirmation would overstate certainty."
      : "把沉默或人工交接直接当成确认，会夸大当前确定性。"
    : clarificationRequested
      ? english
        ? "Replying as if the missing clarification were already closed would overstate certainty."
        : "如果把缺失澄清当成已经关闭再往下推进，就会夸大当前确定性。"
      : boundaryTightened
        ? english
          ? "Treating this as if boundary were cleared, sendability were open, or expansion were already ready would overstate reality."
          : "如果把这条线说成边界已清、发送评估已开放，或者拓展已经就绪，就会夸大现实状态。"
        : unblocked
          ? english
            ? "Treating this as commitment, cleared certainty or automatically safe external motion would still overstate the line."
            : "如果把这条线说成承诺、已清晰确定性，或自动进入安全外发，仍会夸大当前状态。"
          : reviewMaintainsPosture
          ? english
            ? "Even with a visible outcome, the line still remains review-limited and non-commitment."
            : "即使已经看到结果，这条线仍受复核限制，并保持非承诺。"
          : english
            ? "Any wording that sounds firmer than the current evidence, boundary or decision posture would overstate certainty."
            : "任何说得比当前证据、边界或判断姿态更实的措辞，都会夸大确定性。";
  const deltaSummary = awaitingExternalOutcome
    ? english
      ? "A human send handoff / manual send record is now visible, but Helm is still awaiting the first meaningful external outcome."
      : "当前已经出现人工发送交接 / 手动发送记录，但 Helm 仍在等待第一条可见的外部结果。"
    : clarificationRequested
      ? english
        ? "A meaningful external outcome asked for clarification and tightened the next decision line."
        : "当前有一条可见的外部结果明确要求澄清，并收紧了下一条判断话术。"
      : boundaryTightened
        ? english
          ? "A post-send outcome tightened the current boundary posture and kept the route constrained."
          : "当前有一条发送后结果收紧了边界姿态，并继续把这条路线限制在有边界的状态里。"
        : unblocked
          ? english
            ? "A post-send outcome appears to unblock progress and refresh the next bounded move."
            : "当前有一条发送后结果似乎已经重新打开进展，并刷新了下一条有边界的动作。"
          : english
            ? "A meaningful external outcome refreshed the current customer success line."
            : "当前有一条可见的外部结果刷新了这条客户成功线路。";
  const resurfaceReason = awaitingExternalOutcome
    ? english
      ? "This is back because a human send handoff / manual send record is now visible and the first meaningful external outcome is still missing."
      : "Helm 重新抬出这条线，是因为当前已经出现人工发送交接 / 手动发送记录，但第一条可见的外部结果仍未出现。"
    : clarificationRequested
      ? english
        ? "This is back because the first meaningful external outcome asked for clarification and changed the next decision line."
        : "Helm 重新抬出这条线，是因为第一条可见的外部结果要求澄清，并改变了下一条判断话术。"
      : boundaryTightened
        ? english
          ? "This is back because the first post-send outcome tightened the current boundary posture."
          : "Helm 重新抬出这条线，是因为第一条发送后结果收紧了当前边界姿态。"
        : unblocked
          ? english
            ? "This is back because the first post-send outcome appears to unblock progress enough to refresh the next move."
            : "Helm 重新抬出这条线，是因为第一条发送后结果已经足够解除阻塞，值得刷新下一步。"
          : english
            ? "This is back because a meaningful post-send outcome changed the current customer success line."
            : "Helm 重新抬出这条线，是因为有一条有意义的发送后结果改变了当前客户成功线。";
  const progressSummary = awaitingExternalOutcome
    ? english
      ? "Waiting for the first meaningful external outcome after the human send handoff / manual send record."
      : "当前正在等待人工发送交接 / 手动发送记录之后的第一条可见的外部结果。"
    : clarificationRequested
      ? english
        ? "External outcome requested clarification and tightened the next action."
        : "当前对外结果要求澄清，并收紧了下一步。"
      : boundaryTightened
        ? english
          ? "Post-send outcome tightened the boundary and kept the line non-commitment-first."
          : "当前发送后结果收紧了边界，并继续把这条线留在非承诺优先。"
        : unblocked
          ? english
            ? "Post-send outcome unblocked progress enough to refresh the next bounded move."
            : "当前发送后结果已足够解除阻塞，可以刷新下一条有边界的动作。"
          : english
            ? "Meaningful post-send outcome assimilated back into the current customer success line."
            : "当前已把有意义的发送后结果重新吸收到客户成功线里。";

  const activeCues = compactActions<CustomerSuccessPostSendOutcomeCue>([
    awaitingExternalOutcome ? "awaiting-external-outcome" : null,
    firstOutcome?.kind === "external-reply" ? "external-reply-received" : null,
    clarificationRequested ? "outcome-requested-clarification" : null,
    boundaryTightened ? "outcome-tightened-boundary" : null,
    unblocked ? "outcome-unblocked" : null,
    shiftedNextAction ? "outcome-shifted-next-action" : null,
    reviewMaintainsPosture ? "outcome-maintains-review-posture" : null,
  ]);

  const cueLabels = compactPolicyTags(
    activeCues.map((cue) => ({
      label: formatPostSendOutcomeCue(cue, english),
      tone:
        cue === "outcome-unblocked"
          ? "emerald"
          : cue === "external-reply-received" ||
              cue === "outcome-shifted-next-action"
            ? "violet"
            : cue === "awaiting-external-outcome"
              ? "sky"
              : "amber",
    })),
  );

  return {
    referenceAt,
    meaningfulOutcomeAt,
    activeCues,
    cueLabels,
    currentPosture: awaitingExternalOutcome
      ? english
        ? "A human send handoff / manual send is on record, but no meaningful external outcome is visible yet."
        : "当前已经出现人工发送交接 / 手动发送记录，但还没有看到可见的外部结果。"
      : clarificationRequested
        ? english
          ? "The first meaningful post-send outcome asked for clarification, so the line shifts back to decision and dependency clarity."
          : "当前第一条有意义的发送后结果已要求澄清，所以这条线会回到判断与依赖清晰度。"
        : boundaryTightened
          ? english
            ? "The first meaningful post-send signal tightened the current boundary line, so the route remains constrained."
            : "当前第一条有意义的发送后信号已收紧边界线，所以这条路线继续保持受限。"
          : unblocked
            ? english
              ? "The first meaningful post-send outcome appears to unblock the line enough to refresh the next move, without turning it into commitment."
              : "当前第一条有意义的发送后结果看起来已经足够解除阻塞，可以刷新下一步，但这仍不意味着承诺。"
            : english
              ? "A meaningful post-send outcome arrived and refreshed the current customer success framing."
              : "当前已有一条有意义的发送后结果到来，并刷新了客户成功措辞。",
    firstOutcomeSummary,
    whatChanged,
    unresolved,
    overstateRisk,
    queueStatusLabel: clarificationRequested
      ? english
        ? "Clarification requested"
        : "已要求澄清"
      : boundaryTightened
        ? english
          ? "Outcome tightened boundary"
          : "结果收紧了边界"
        : unblocked
          ? english
            ? "Outcome unblocked progress"
            : "结果已解除阻塞"
          : firstOutcome?.kind === "external-reply"
            ? english
              ? "External reply received"
              : "已收到外部回复"
            : firstOutcomeSummary
              ? english
                ? "Next action shifted"
                : "下一步已变化"
              : english
                ? "Awaiting external outcome"
                : "等待外部结果",
    queueStatusTone: clarificationRequested
      ? "amber"
      : boundaryTightened
        ? "amber"
        : unblocked
          ? "emerald"
          : firstOutcome?.kind === "external-reply"
            ? "violet"
            : firstOutcomeSummary
              ? "violet"
              : "sky",
    queueSummary: firstOutcomeSummary ?? deltaSummary,
    queueBlockedSummary: `${unresolved} ${overstateRisk}`,
    deltaSummary,
    resurfaceReason,
    progressSummary,
  };
}

function buildBoundarySignalAfterPostSend({
  signals,
  after,
  english,
}: {
  signals: ReturnType<typeof summarizeSignals>;
  after: Date;
  english: boolean;
}) {
  if (signals.topBlocker && signals.topBlocker.updatedAt >= after) {
    return {
      at: signals.topBlocker.updatedAt,
      summary: english
        ? `A post-send blocker signal tightened the boundary on ${formatDateLabel(signals.topBlocker.updatedAt)}: ${trimText(signals.topBlocker.blockerText, 120)}`
        : `当前在 ${formatDateLabel(signals.topBlocker.updatedAt)} 出现了 post-send 阻塞信号，并收紧了边界：${trimText(signals.topBlocker.blockerText, 120)}`,
      text: signals.topBlocker.blockerText,
    };
  }

  if (signals.pendingReview && signals.pendingReview.updatedAt >= after) {
    return {
      at: signals.pendingReview.updatedAt,
      summary: english
        ? `Review pressure stayed active after the human handoff on ${formatDateLabel(signals.pendingReview.updatedAt)}.`
        : `当前复核压力在 ${formatDateLabel(signals.pendingReview.updatedAt)} 之后仍保持活跃。`,
      text:
        signals.pendingReview.actionItem.description ??
        signals.pendingReview.actionItem.title,
    };
  }

  return null;
}

function findFirstMeaningfulExternalOutcome({
  detail,
  after,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  after: Date;
  english: boolean;
}): PostSendOutcomeEvent | null {
  const outcomeEvents: PostSendOutcomeEvent[] = [
    ...detail.emailThreads.flatMap((thread) =>
      thread.messages
        .filter((message) => message.isInbound && message.sentAt >= after)
        .map((message) => ({
          at: message.sentAt,
          kind: "external-reply" as const,
          summary: english
            ? `First meaningful external reply arrived on ${formatDateLabel(message.sentAt)}: ${trimText(message.body, 120)}`
            : `当前第一条 meaningful external 回应在 ${formatDateLabel(message.sentAt)} 到达：${trimText(message.body, 120)}`,
          text: message.body,
        })),
    ),
    ...detail.auditLogs
      .filter(
        (log) =>
          log.createdAt >= after &&
          !/manual send|sent manually|emailed|replied to customer|sent reply/i.test(
            log.summary,
          ),
      )
      .map((log) => ({
        at: log.createdAt,
        kind: "account-trace" as const,
        summary: english
          ? `First meaningful post-send outcome appeared in the account trace on ${formatDateLabel(log.createdAt)}: ${log.actor} · ${trimText(log.summary, 120)}`
          : `当前第一条有意义的发送后结果在 ${formatDateLabel(log.createdAt)} 出现在账户轨迹中：${log.actor} · ${trimText(log.summary, 120)}`,
        text: log.summary,
      })),
  ]
    .filter((event) => event.text.trim().length > 0)
    .sort((left, right) => left.at.getTime() - right.at.getTime());

  return outcomeEvents[0] ?? null;
}

function formatPostSendOutcomeCue(
  cue: CustomerSuccessPostSendOutcomeCue,
  english: boolean,
) {
  switch (cue) {
    case "awaiting-external-outcome":
      return english ? "Awaiting external outcome" : "等待外部结果";
    case "external-reply-received":
      return english ? "External reply received" : "已收到外部回复";
    case "outcome-requested-clarification":
      return english ? "Clarification requested" : "已要求澄清";
    case "outcome-tightened-boundary":
      return english ? "Outcome tightened boundary" : "结果收紧了边界";
    case "outcome-unblocked":
      return english ? "Outcome unblocked progress" : "结果已解除阻塞";
    case "outcome-shifted-next-action":
      return english ? "Next action shifted" : "下一步已变化";
    case "outcome-maintains-review-posture":
      return english ? "Still review-limited" : "仍受复核限制";
    default:
      return cue;
  }
}

function findManualSendRecord({
  detail,
  after,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  after: Date;
  english: boolean;
}) {
  const auditMatch =
    detail.auditLogs.find(
      (log) =>
        log.createdAt >= after &&
        /manual send|sent manually|emailed|replied to customer|sent reply/i.test(
          log.summary,
        ),
    ) ?? null;
  if (auditMatch) {
    return {
      actor: auditMatch.actor,
      at: auditMatch.createdAt,
      summary: english
        ? `${auditMatch.actor} recorded the manual send in the account trace.`
        : `${auditMatch.actor} 已在账户轨迹中记录手动发送。`,
    };
  }

  const outboundMessage =
    detail.emailThreads
      .flatMap((thread) => thread.messages)
      .filter((message) => !message.isInbound && message.sentAt >= after)
      .sort(
        (left, right) => right.sentAt.getTime() - left.sentAt.getTime(),
      )[0] ?? null;

  if (!outboundMessage) {
    return null;
  }

  return {
    actor: outboundMessage.sender,
    at: outboundMessage.sentAt,
    summary: english
      ? `${outboundMessage.sender} later sent the message manually outside Helm.`
      : `${outboundMessage.sender} 之后在 Helm 之外手动发出了这条消息。`,
  };
}

function buildBoundarySummary({
  kind,
  fallbackMode,
  signals,
  english,
}: {
  kind: PageKind;
  fallbackMode: CustomerSuccessFallbackMode;
  signals: ReturnType<typeof summarizeSignals>;
  english: boolean;
}) {
  const boundaryLine =
    kind === "expansion-review"
      ? english
        ? "Expansion review can sharpen next-phase framing, but it still does not equal package approval, pricing approval or external commitment."
        : "拓展复核可以提高下一阶段措辞清晰度，但它仍然不等于方案包审批、定价审批或 对外承诺。"
      : english
        ? "Customer success handoff can clarify ownership, follow-through and the next review window, but it still does not equal commitment or automatic customer-safe sendability."
        : "客户成功交接可以澄清负责人归属、跟进闭环和下一次复核窗口，但它仍然不等于承诺，也不等于自动客户安全 发送评估。";

  const pressureLine = signals.pendingReview
    ? english
      ? "Pending review must stay visible before anyone speaks outward as if the chain is already approved."
      : "在任何人按“链路已获批准”去对外说之前，待复核条目都必须继续显式可见。"
    : signals.topBlocker
      ? english
        ? `Current blocker: ${trimText(signals.topBlocker.blockerText, 92)}`
        : `当前卡点：${trimText(signals.topBlocker.blockerText, 92)}`
      : english
        ? "Prerequisite, dependency, risk and non-commitment still need to stay visible whenever the next step widens beyond internal coordination."
        : "只要下一步要从内部协调扩大出去，前置、依赖、风险和非承诺就仍然必须留在前台。";

  const issueLine = signals.blockerNeedsEscalation
    ? english
      ? "Escalation follow-through widens ownership pressure because the path is materially blocked, but it still cannot widen customer-visible certainty ahead of blocker evidence."
      : "升级跟进闭环会因为路径已被实质性阻塞而扩大负责人压力，但它仍不能在阻塞证据之前扩大客户可见确定性。"
    : signals.overdueCommitment
      ? english
        ? "Issue follow-through keeps the repair path inside normal current-round coordination, but it still cannot turn repair wording into commitment wording."
        : "问题跟进闭环会把修复路径继续留在正常这一轮协调里，但它仍不能把修复性表述写成承诺表述。"
      : null;

  const fallbackLine =
    fallbackMode === "no-fallback"
      ? english
        ? "Internal-only notes, review-only cues and boundary-only caveats must never leak into customer-facing wording."
        : "仅内部备注、仅复核 线索和仅边界注脚，不能直接漏进客户可见措辞。"
      : english
        ? `Current fallback stays at ${formatFallbackMode(fallbackMode, true)}, so the next owner must not speak as if the stronger path is already available.`
        : `当前兜底停在「${formatFallbackMode(fallbackMode, false)}」，所以下一位负责人不能按“更强路径已经可用”去说。`;

  return compactStrings([
    boundaryLine,
    pressureLine,
    issueLine,
    fallbackLine,
  ]).slice(0, 3);
}

function buildActions({
  kind,
  detail,
  signals,
  english,
}: {
  kind: PageKind;
  detail: OpportunityCommercialDetailForCustomerSuccess;
  signals: ReturnType<typeof summarizeSignals>;
  english: boolean;
}): CustomerSuccessDetailReportingContract["customerSuccessDetailNextAction"] {
  if (kind === "expansion-review") {
    return compactPageActions([
      {
        label: english ? "Open package detail" : "打开方案包详情面",
        href: `/packages/${detail.id}`,
      },
      {
        label: english ? "Open proposal detail" : "打开提案详情",
        href: `/proposals/${detail.id}`,
        variant: "secondary" as const,
      },
      {
        label: english
          ? "Open reinforcement detail"
          : "打开加固详情面",
        href: `/reinforcements/${detail.id}`,
        variant: "ghost" as const,
      },
    ]);
  }

  if (kind === "success-check") {
    return compactPageActions([
      {
        label: english ? "Open expansion review" : "打开拓展复核",
        href: `/expansion-reviews/${detail.id}`,
      },
      signals.pendingReview
        ? {
            label: english ? "Open review request" : "打开复核请求",
            href: `/review-requests/${signals.pendingReview.id}`,
            variant: "secondary" as const,
          }
        : {
            label: english
              ? "Open customer success handoff"
              : "打开客户成功交接",
            href: `/customer-success/${detail.id}`,
            variant: "secondary" as const,
          },
      {
        label: english ? "Open company detail" : "打开公司详情面",
        href: detail.company
          ? `/companies/${detail.company.id}`
          : `/packages/${detail.id}`,
        variant: "ghost" as const,
      },
    ]);
  }

  return compactPageActions([
    {
      label: english ? "Open success check" : "打开客户成功验收",
      href: `/success-checks/${detail.id}`,
    },
    signals.recentThread
      ? {
          label: english ? "Open success inbox" : "打开客户成功收件箱",
          href: `/inbox/${signals.recentThread.id}`,
          variant: "secondary" as const,
        }
      : {
          label: english ? "Open success queue" : "打开客户成功队列",
          href: `/customer-success`,
          variant: "secondary" as const,
        },
    {
      label: english ? "Open expansion review" : "打开拓展复核",
      href: `/expansion-reviews/${detail.id}`,
      variant: "ghost" as const,
    },
    signals.pendingReview
      ? {
          label: english ? "Open review request" : "打开复核请求",
          href: `/review-requests/${signals.pendingReview.id}`,
          variant: "ghost" as const,
        }
      : {
          label: english ? "Open company detail" : "打开公司详情面",
          href: detail.company
            ? `/companies/${detail.company.id}`
            : `/packages/${detail.id}`,
          variant: "ghost" as const,
        },
  ]);
}

function buildCustomerSuccessInternalActions({
  detail,
  stage,
  authorityState,
  attentionState,
  sendabilityMode,
  fallbackMode,
  judgement,
  reason,
  decisionRequest,
  nextAction,
  boundarySummary,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  stage: CustomerSuccessHandoffStage;
  authorityState: CustomerSuccessAuthorityState;
  attentionState: CustomerSuccessAttentionState;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  judgement: string;
  reason: string;
  decisionRequest: string;
  nextAction: string;
  boundarySummary: string;
  english: boolean;
}): CustomerSuccessInternalActionViewModel[] {
  const specs = buildCustomerSuccessInternalActionSpecs({
    title: detail.title,
    stageKey: stage,
    authorityState,
    attentionState,
    sendabilityMode,
    fallbackMode,
    riskLevel: detail.riskLevel,
    judgement,
    reason,
    decisionRequest,
    nextAction,
    boundarySummary,
    english,
  });

  const existingActionsByKey = new Map<
    CustomerSuccessInternalActionKey,
    OpportunityCommercialDetailForCustomerSuccess["actionItems"][number]
  >();

  for (const actionItem of detail.actionItems) {
    const metadata = parseCustomerSuccessInternalActionMetadata(
      actionItem.metadata,
    );
    if (!metadata) continue;
    const existing = existingActionsByKey.get(
      metadata.customerSuccessInternalActionKey,
    );
    if (!existing || existing.updatedAt < actionItem.updatedAt) {
      existingActionsByKey.set(
        metadata.customerSuccessInternalActionKey,
        actionItem,
      );
    }
  }

  return specs.map((spec) => {
    const persistedAction = existingActionsByKey.get(spec.key) ?? null;
    const metadata = persistedAction
      ? parseCustomerSuccessInternalActionMetadata(persistedAction.metadata)
      : null;
    const state = getCustomerSuccessInternalActionState({
      actionItem: persistedAction,
      authorityState,
    });

    return {
      key: spec.key,
      title: spec.title,
      summary: spec.summary,
      state,
      stateLabel: formatInternalActionState(state, english),
      stateTone: toneForInternalActionState(state),
      actionTypeLabel: formatInternalActionType(spec.actionType, english),
      internalOnlyLabel: english ? "Internal only" : "仅内部可见",
      approvalSummary: buildInternalActionApprovalSummary({
        actionItem: persistedAction,
        metadata,
        english,
      }),
      executionSummary: buildInternalActionExecutionSummary({
        actionItem: persistedAction,
        metadata,
        english,
      }),
      resultSummary:
        metadata?.resultSummary ??
        (persistedAction?.status === "EXECUTED"
          ? (persistedAction.statusReason ?? spec.resultSummary)
          : null),
      actionItemId: persistedAction?.id ?? null,
      canApprove:
        state === "helm-prepared" ||
        state === "user-reviewed" ||
        state === "user-backed",
      canExecute: state === "user-approved-to-execute",
      policyLabels: buildInternalActionPolicyLabels({
        state,
        english,
      }),
    };
  });
}

function buildProgressTrace({
  signals,
  authorityState,
  attentionState,
  stage,
  watchState,
  internalActions,
  postSendOutcome,
  english,
}: {
  signals: ReturnType<typeof summarizeSignals>;
  authorityState: CustomerSuccessAuthorityState;
  attentionState: CustomerSuccessAttentionState;
  stage: CustomerSuccessHandoffStage;
  watchState: WatchState;
  internalActions: CustomerSuccessInternalActionViewModel[];
  postSendOutcome: CustomerSuccessPostSendOutcomeModel | null;
  english: boolean;
}) {
  const approvedAction = internalActions.find(
    (item) => item.state === "user-approved-to-execute",
  );
  const executedAction = internalActions.find(
    (item) => item.state === "executed-internally",
  );

  return compactStrings([
    english
      ? "A bounded handoff surface is already prepared."
      : "当前已经准备好一张有边界的交接 面。",
    watchState.lastBackedSummary
      ? watchState.lastBackedSummary
      : watchState.lastReviewedSummary,
    postSendOutcome?.progressSummary,
    authorityState === "user-reviewed"
      ? english
        ? "Reviewed by user before the next outward move."
        : "用户已经复核过当前措辞，再决定下一次对外动作。"
      : authorityState === "user-backed"
        ? english
          ? "Backed by user as the current bounded next-step line."
          : "用户已经显式支持当前这条有边界的下一步路线。"
        : null,
    attentionState === "blocked"
      ? english
        ? "Blocked by dependency, boundary, missing decision, or widened ownership pressure."
        : "当前被依赖、边界、缺失判断或扩大后的负责人压力阻塞。"
      : attentionState === "review-before-send"
        ? english
          ? "Moved into review-before-send before any outward wording."
          : "当前已进入发送前复核，在任何对外措辞之前先停在复核线。"
        : attentionState === "waiting"
          ? english
            ? "Waiting on review, reply, or a dependency that still sits outside the next move."
            : "当前正在等待复核、回复或仍停在下一步之外的依赖。"
          : attentionState === "pushing"
            ? english
              ? "Pushing the current follow-through with explicit user backing."
              : "当前在用户明确支持下持续推动这条跟进闭环。"
            : english
              ? "Watching the current line while the next bounded move stays prepared."
              : "当前保持 watching，同时下一条有边界的下一动作会继续保持已准备。",
    stage === "escalation-follow-through"
      ? english
        ? "Escalated because ordinary follow-through wording would understate current pressure."
        : "当前已升级，因为普通跟进闭环措辞会低估当前压力。"
      : stage === "issue-follow-through"
        ? english
          ? "Issue remains contained enough to stay inside normal current-round coordination."
          : "当前问题仍足够可控，仍留在正常这一轮协调内处理。"
        : null,
    !signals.topBlocker &&
    !signals.pendingReview &&
    authorityState === "user-backed"
      ? english
        ? "Resolved / unblocked enough to keep the next move visible without implying commitment."
        : "当前已经足够已解决 / 已解除阻塞，可以把下一步保持可见，但仍不意味着承诺。"
      : null,
    approvedAction
      ? (approvedAction.approvalSummary ??
        (english
          ? `${approvedAction.title} is approved and ready for internal execution.`
          : `${approvedAction.title} 已批准，随时可做内部执行。`))
      : null,
    executedAction
      ? (executedAction.executionSummary ??
        (english
          ? `${executedAction.title} already executed internally.`
          : `${executedAction.title} 已经完成内部执行。`))
      : null,
  ]).slice(0, 5);
}

function getCustomerSuccessInternalActionState({
  actionItem,
  authorityState,
}: {
  actionItem:
    | OpportunityCommercialDetailForCustomerSuccess["actionItems"][number]
    | null;
  authorityState: CustomerSuccessAuthorityState;
}): CustomerSuccessInternalActionState {
  if (
    actionItem?.status === "EXECUTED" ||
    actionItem?.executionStatus === "executed"
  ) {
    return "executed-internally";
  }

  if (
    actionItem?.status === "APPROVED" ||
    actionItem?.executionStatus === "approved_to_execute"
  ) {
    return "user-approved-to-execute";
  }

  if (authorityState === "user-backed") {
    return "user-backed";
  }

  if (authorityState === "user-reviewed") {
    return "user-reviewed";
  }

  return "helm-prepared";
}

function formatInternalActionState(
  state: CustomerSuccessInternalActionState,
  english: boolean,
) {
  switch (state) {
    case "user-reviewed":
      return english ? "Ready for your approval" : "等待你批准";
    case "user-backed":
      return english ? "Backed and ready for approval" : "已获得支持，等待批准";
    case "user-approved-to-execute":
      return english ? "Approved to execute" : "已批准执行";
    case "executed-internally":
      return english ? "Executed internally" : "已完成内部执行";
    default:
      return english ? "Prepared draft" : "已准备草稿";
  }
}

function toneForInternalActionState(
  state: CustomerSuccessInternalActionState,
): Chip["tone"] {
  switch (state) {
    case "user-backed":
    case "executed-internally":
      return "emerald";
    case "user-approved-to-execute":
      return "violet";
    case "user-reviewed":
      return "amber";
    default:
      return "sky";
  }
}

function buildInternalActionPolicyLabels({
  state,
  english,
}: {
  state: CustomerSuccessInternalActionState;
  english: boolean;
}): CustomerSuccessPolicyTag[] {
  return compactPolicyTags([
    state === "user-approved-to-execute"
      ? {
          label: english ? "Internal execution allowed" : "允许内部执行",
          tone: "emerald" as const,
        }
      : state === "executed-internally"
        ? {
            label: english ? "Advisory only" : "仅建议",
            tone: "sky" as const,
          }
        : {
            label: english ? "Requires your approval" : "需要你批准",
            tone: "amber" as const,
          },
    {
      label: english ? "Not customer-sendable" : "不可对外发送",
      tone: "violet" as const,
    },
    {
      label: english ? "Non-commitment" : "非承诺",
      tone: "sky" as const,
    },
  ]);
}

function formatInternalActionType(actionType: string, english: boolean) {
  if (actionType === "CREATE_TASK") {
    return english ? "Internal reminder artifact" : "内部提醒 制品";
  }
  return english ? "Internal note" : "内部备注";
}

function buildInternalActionApprovalSummary({
  actionItem,
  metadata,
  english,
}: {
  actionItem:
    | OpportunityCommercialDetailForCustomerSuccess["actionItems"][number]
    | null;
  metadata: CustomerSuccessInternalActionMetadata | null;
  english: boolean;
}) {
  const approvedAt = metadata?.approvedAt
    ? new Date(metadata.approvedAt)
    : null;
  if (approvedAt && metadata?.approvedByName) {
    return english
      ? `${metadata.approvedByName} approved internal execution on ${formatDateLabel(approvedAt)}.`
      : `${metadata.approvedByName} 在 ${formatDateLabel(approvedAt)} 批准了内部执行。`;
  }

  if (actionItem?.status === "APPROVED") {
    return english
      ? "Internal execution was explicitly approved on the current customer success line."
      : "当前客户成功线路已经明确批准了内部执行。";
  }

  return null;
}

function buildInternalActionExecutionSummary({
  actionItem,
  metadata,
  english,
}: {
  actionItem:
    | OpportunityCommercialDetailForCustomerSuccess["actionItems"][number]
    | null;
  metadata: CustomerSuccessInternalActionMetadata | null;
  english: boolean;
}) {
  const executedAt = metadata?.executedAt
    ? new Date(metadata.executedAt)
    : (actionItem?.executedAt ?? null);
  if (!executedAt) return null;

  const actorLabel = metadata?.executedByName ?? "Helm AI";
  return english
    ? `${actorLabel} executed this internally on ${formatDateLabel(executedAt)}.`
    : `${actorLabel} 在 ${formatDateLabel(executedAt)} 完成了内部执行。`;
}

type WatchTouch = {
  at: Date;
  kind: "reviewed" | "backed";
  isCurrentUser: boolean;
  actorLabel: string | null;
};

function dedupeReviewTasks(reviewTasks: ReviewRequestForCustomerSuccess[]) {
  return Array.from(
    new Map(reviewTasks.map((task) => [task.id, task])).values(),
  );
}

function reviewTouchesFromReviewTasks({
  reviewTasks,
  currentUserId,
  english,
}: {
  reviewTasks: ReviewRequestForCustomerSuccess[];
  currentUserId?: string;
  english: boolean;
}): WatchTouch[] {
  return reviewTasks.flatMap((task) =>
    task.reviewedAt
      ? [
          {
            at: task.reviewedAt,
            kind:
              task.status === "EXECUTED"
                ? ("backed" as const)
                : ("reviewed" as const),
            isCurrentUser:
              currentUserId != null && task.reviewedBy?.id === currentUserId,
            actorLabel:
              currentUserId != null && task.reviewedBy?.id === currentUserId
                ? english
                  ? "you"
                  : "你"
                : (task.reviewedBy?.name ?? null),
          },
        ]
      : [],
  );
}

function compactWatchTouches(touches: WatchTouch[]) {
  return touches
    .filter(
      (touch) => touch.at instanceof Date && !Number.isNaN(touch.at.getTime()),
    )
    .sort((left, right) => right.at.getTime() - left.at.getTime());
}

function compactPolicyTags(tags: Array<CustomerSuccessPolicyTag | null>) {
  return tags.filter((tag): tag is CustomerSuccessPolicyTag => tag != null);
}

function newestWatchTouch(touches: WatchTouch[]) {
  return touches[0] ?? null;
}

function formatWatchTouchSummary(touch: WatchTouch, english: boolean) {
  if (touch.kind === "backed") {
    if (touch.isCurrentUser) {
      return english
        ? `You backed this on ${formatDateLabel(touch.at)}.`
        : `你在 ${formatDateLabel(touch.at)} 支持过这条线。`;
    }
    return english
      ? `${touch.actorLabel ?? "A user"} backed this on ${formatDateLabel(touch.at)}.`
      : `${touch.actorLabel ?? "有用户"}在 ${formatDateLabel(touch.at)} 支持过这条线。`;
  }

  if (touch.isCurrentUser) {
    return english
      ? `You reviewed this on ${formatDateLabel(touch.at)}.`
      : `你在 ${formatDateLabel(touch.at)} 复核过这条线。`;
  }

  return english
    ? `${touch.actorLabel ?? "A user"} reviewed this on ${formatDateLabel(touch.at)}.`
    : `${touch.actorLabel ?? "有用户"}在 ${formatDateLabel(touch.at)} 复核过这条线。`;
}

function buildHeaderLinks({
  kind,
  detail,
  signals,
  english,
}: {
  kind: PageKind;
  detail: OpportunityCommercialDetailForCustomerSuccess;
  signals: ReturnType<typeof summarizeSignals>;
  english: boolean;
}) {
  if (kind === "customer-success") {
    return compactLinks([
      {
        label: english ? "Open success queue" : "打开客户成功队列",
        href: `/customer-success`,
      },
      {
        label: english ? "Open success check" : "打开客户成功验收",
        href: `/success-checks/${detail.id}`,
        variant: "secondary" as const,
      },
      signals.recentThread
        ? {
            label: english ? "Open success inbox" : "打开客户成功收件箱",
            href: `/inbox/${signals.recentThread.id}`,
            variant: "ghost" as const,
          }
        : null,
      {
        label: english ? "Open expansion review" : "打开拓展复核",
        href: `/expansion-reviews/${detail.id}`,
        variant: "ghost" as const,
      },
      signals.pendingReview
        ? {
            label: english ? "Review request" : "复核请求",
            href: `/review-requests/${signals.pendingReview.id}`,
            variant: "ghost" as const,
          }
        : null,
    ]);
  }

  if (kind === "success-check") {
    return compactLinks([
      {
        label: english
          ? "Open customer success handoff"
          : "打开客户成功交接",
        href: `/customer-success/${detail.id}`,
      },
      {
        label: english ? "Open expansion review" : "打开拓展复核",
        href: `/expansion-reviews/${detail.id}`,
        variant: "secondary" as const,
      },
      {
        label: english ? "Open company detail" : "打开公司详情面",
        href: detail.company
          ? `/companies/${detail.company.id}`
          : `/packages/${detail.id}`,
        variant: "ghost" as const,
      },
    ]);
  }

  return compactLinks([
    {
      label: english ? "Open package detail" : "打开方案包详情面",
      href: `/packages/${detail.id}`,
    },
    {
      label: english ? "Open proposal detail" : "打开提案详情",
      href: `/proposals/${detail.id}`,
      variant: "secondary" as const,
    },
    {
      label: english ? "Open external proposal" : "打开外部提案",
      href: `/external-proposals/${detail.id}`,
      variant: "ghost" as const,
    },
  ]);
}

function buildEvidenceLinks({
  detail,
  signals,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  signals: ReturnType<typeof summarizeSignals>;
  english: boolean;
}) {
  return compactEvidenceLinks([
    {
      label: english ? "Open success queue" : "打开客户成功队列",
      href: `/customer-success`,
    },
    {
      label: english ? "Open company detail" : "打开公司详情面",
      href: detail.company
        ? `/companies/${detail.company.id}`
        : `/packages/${detail.id}`,
    },
    signals.recentThread
      ? {
          label: english
            ? "Open success inbox thread"
            : "打开客户成功收件箱线程",
          href: `/inbox/${signals.recentThread.id}`,
        }
      : null,
    signals.pendingReview
      ? {
          label: english
            ? "Open review request detail"
            : "打开复核请求详情面",
          href: `/review-requests/${signals.pendingReview.id}`,
        }
      : null,
    {
      label: english ? "Open proposal detail" : "打开提案详情",
      href: `/proposals/${detail.id}`,
    },
  ]);
}

function buildEscalationHint({
  kind,
  stage,
  english,
}: {
  kind: PageKind;
  stage: CustomerSuccessHandoffStage;
  english: boolean;
}) {
  if (stage === "review-before-send" || stage === "review-follow-through") {
    return english
      ? "If anyone wants customer success to speak as if the review is already complete, escalate back into review and founder / sales alignment first."
      : "如果任何人想让客户成功按“复核已经完成”去说，就先升级回复核，并重新做创始人 / 销售对齐。";
  }

  if (kind === "expansion-review") {
    return english
      ? "If expansion language starts outrunning package, offer or reinforcement evidence, step back from expansion review and return to the narrower commercial detail."
      : "如果拓展语言开始跑在方案包、客户报价或加固依据前面，就先从拓展复核退回，回到更窄的商业详情面。";
  }

  return english
    ? "If success follow-through starts sounding firmer than the current blocker, dependency or commitment picture supports, step back into boundary-first handling immediately."
    : "如果客户成功推进开始比当前卡点、依赖或承诺画面说得更实，就立刻退回边界优先处理。";
}

function buildNavigation({
  kind,
  detail,
  company,
  signals,
  protocol,
  stage,
  audienceText,
  sendabilityText,
  fallbackText,
  english,
}: {
  kind: PageKind;
  detail: OpportunityCommercialDetailForCustomerSuccess;
  company: CompanyContextForCustomerSuccess;
  signals: ReturnType<typeof summarizeSignals>;
  protocol: PageReportingProtocol;
  stage: CustomerSuccessHandoffStage;
  audienceText: string;
  sendabilityText: string;
  fallbackText: string;
  english: boolean;
}): UnifiedDetailNavigationModel {
  const priority = priorityForRisk(mapRiskSignal(detail.riskLevel, signals));
  const reviewHref = signals.pendingReview
    ? `/review-requests/${signals.pendingReview.id}`
    : company
      ? `/companies/${company.id}`
      : `/packages/${detail.id}`;
  const reviewSummary = signals.pendingReview
    ? english
      ? "Return here when review-sensitive follow-through still needs the current approval context."
      : "如果复核-敏感跟进闭环仍需要当前审批上下文，就回到这里。"
    : english
      ? "Return to company detail when the account context matters more than the success surface."
      : "如果账户上下文比 客户成功面 更重要，就回到公司详情面。";
  const nextLink =
    kind === "customer-success"
      ? {
          type: "success-check" as const,
          href: `/success-checks/${detail.id}`,
          label: english ? "Success check" : "客户成功验收",
          summary: english
            ? "Move here once the handoff is explicit and the next question becomes whether the account is genuinely ready to continue."
            : "当接手已经说清楚，而下一步问题变成账户是否真的能继续推进时，就切到这里。",
        }
      : kind === "success-check"
        ? {
            type: "expansion-review" as const,
            href: `/expansion-reviews/${detail.id}`,
            label: english ? "Expansion review" : "拓展复核",
            summary: english
              ? "Move here when the chain needs to judge whether the next story should widen into expansion."
              : "当这条链需要判断下一步是否应扩大成拓展叙事时，就切到这里。",
          }
        : {
            type: "package" as const,
            href: `/packages/${detail.id}`,
            label: english ? "Package detail" : "方案包详情",
            summary: english
              ? "Move here once expansion review needs to turn back into the narrower commercial package line."
              : "当拓展复核需要重新落回更窄的商业方案包线时，就切到这里。",
          };
  const currentNode =
    kind === "customer-success"
      ? {
          detailNodeType: "customer-success" as const,
          detailNodeSummary: protocol.pageJudgement,
          detailNodeStage: formatStage(stage, english),
          detailNodeBoundary: protocol.pageBoundarySummary[0],
          detailNodeAudienceMode: audienceText,
          detailNodeSendabilityMode: sendabilityText,
          detailNodeStrengthMode: fallbackText,
          detailNodePrev: {
            type: signals.pendingReview
              ? ("review-request-detail" as const)
              : ("company-detail" as const),
            href: reviewHref,
            label: signals.pendingReview
              ? english
                ? "Review request detail"
                : "复核请求详情"
              : english
                ? "Company detail"
                : "公司详情",
            summary: reviewSummary,
          },
          detailNodeNext: nextLink,
          detailNodeCurrentReason: protocol.pageJudgementReason,
          detailNodePriority: priority,
          detailNodeNavigationHint: english
            ? "Use this surface when the team must explain why customer success owns the next move, what boundary still applies, and which chain should inherit the follow-through."
            : "当团队需要说明为什么现在由客户成功接手、当前边界还在什么位置，以及下一段跟进闭环应交给哪条链时，停在这里。",
        }
      : kind === "success-check"
        ? {
            detailNodeType: "success-check" as const,
            detailNodeSummary: protocol.pageJudgement,
            detailNodeStage: formatStage(stage, english),
            detailNodeBoundary: protocol.pageBoundarySummary[0],
            detailNodeAudienceMode: audienceText,
            detailNodeSendabilityMode: sendabilityText,
            detailNodeStrengthMode: fallbackText,
            detailNodePrev: {
              type: signals.pendingReview
                ? ("review-request-detail" as const)
                : ("company-detail" as const),
              href: reviewHref,
              label: signals.pendingReview
                ? english
                  ? "Review request detail"
                  : "复核请求详情"
                : english
                  ? "Company detail"
                  : "公司详情",
              summary: reviewSummary,
            },
            detailNodeNext: nextLink,
            detailNodeCurrentReason: protocol.pageJudgementReason,
            detailNodePriority: priority,
            detailNodeNavigationHint: english
              ? "Use success check when the team has already agreed customer success owns follow-through and now needs to judge readiness honestly."
              : "当团队已经确认由客户成功接手，而下一步需要诚实判断就绪度时，停在客户成功验收。",
          }
        : {
            detailNodeType: "expansion-review" as const,
            detailNodeSummary: protocol.pageJudgement,
            detailNodeStage: formatStage(stage, english),
            detailNodeBoundary: protocol.pageBoundarySummary[0],
            detailNodeAudienceMode: audienceText,
            detailNodeSendabilityMode: sendabilityText,
            detailNodeStrengthMode: fallbackText,
            detailNodePrev: {
              type: signals.pendingReview
                ? ("review-request-detail" as const)
                : ("company-detail" as const),
              href: reviewHref,
              label: signals.pendingReview
                ? english
                  ? "Review request detail"
                  : "复核请求详情"
                : english
                  ? "Company detail"
                  : "公司详情",
              summary: reviewSummary,
            },
            detailNodeNext: nextLink,
            detailNodeCurrentReason: protocol.pageJudgementReason,
            detailNodePriority: priority,
            detailNodeNavigationHint: english
              ? "Use expansion review when the chain needs to widen from success follow-through into the next commercial motion without losing the current boundary."
              : "当这条链需要在不丢失当前边界的前提下，从客户成功跟进闭环扩大成下一条商业推进线时，停在拓展复核。",
          };

  return createUnifiedDetailNavigationModel({
    currentNode,
    handoffs: buildHandoffs({
      kind,
      detail,
      company,
      signals,
      protocol,
      english,
    }),
  });
}

function buildHandoffs({
  kind,
  detail,
  company,
  signals,
  protocol,
  english,
}: {
  kind: PageKind;
  detail: OpportunityCommercialDetailForCustomerSuccess;
  company: CompanyContextForCustomerSuccess;
  signals: ReturnType<typeof summarizeSignals>;
  protocol: PageReportingProtocol;
  english: boolean;
}): CrossDetailHandoff[] {
  const boundary = protocol.pageBoundarySummary[0];
  const prerequisite = protocol.pageBoundarySummary[1] ?? null;
  const dependency = protocol.pageBoundarySummary[2] ?? null;
  const visibilityMode = toVisibilityMode(
    getSendabilityMode(kind, getStage(kind, detail, signals), signals),
  );
  const handoffs: Array<CrossDetailHandoff | null> = [];

  if (kind === "customer-success") {
    if (signals.pendingReview) {
      handoffs.push({
        handoffSource: "company-detail",
        handoffTarget: "review-request-detail",
        handoffReason: english
          ? "Use company detail only when the team needs broader account context, then reopen the pending review before customer success inherits the follow-through."
          : "只有当团队需要更宽的账户上下文时才回到公司详情面；随后应先重新打开等待中的复核，再由客户成功继承跟进闭环。",
        handoffBoundary: boundary,
        handoffPrerequisite: prerequisite,
        handoffDependency: dependency,
        handoffRisk: english
          ? "Skipping the explicit review leg can make customer success inherit approval pressure as if it were already resolved."
          : "如果跳过明确的复核这一跳，客户成功就可能把审批压力当成“已经解决”来继承。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open review request detail."
          : "打开复核请求详情面。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: "review-before-send",
        handoffHref: `/review-requests/${signals.pendingReview.id}`,
      });

      handoffs.push({
        handoffSource: "review-request-detail",
        handoffTarget: "customer-success",
        handoffReason: english
          ? "The review request → customer success handoff now needs dedicated issue / escalation / renewal-risk follow-through instead of hiding inside company routing."
          : "这条复核请求 → 客户成功交接现在需要 专门的问题 / 升级 / 续约风险跟进闭环，而不是继续躲在公司页面 里。",
        handoffBoundary: boundary,
        handoffPrerequisite: prerequisite,
        handoffDependency: dependency,
        handoffRisk: english
          ? "If customer success inherits this review as if it were already closed, issue repair, escalation or renewal-risk language can drift into accidental promise wording."
          : "如果客户成功把这条复核当成“已经结束”去继承，问题修复、升级或续约风险的表达就可能滑向意外承诺措辞。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open customer success handoff."
          : "打开客户成功交接。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: "review-before-send",
        handoffHref: `/customer-success/${detail.id}`,
      });
    }

    handoffs.push({
      handoffSource: "company-detail",
      handoffTarget: "customer-success",
      handoffReason: english
        ? "Account context is no longer enough on its own; the next motion is customer success ownership and follow-through."
        : "仅有账户上下文 已经不够，下一步真正需要的是客户成功 负责人归属与跟进闭环。",
      handoffBoundary: boundary,
      handoffPrerequisite: prerequisite,
      handoffDependency: detail.nextAction,
      handoffRisk: english
        ? "If the team stays on company detail too long, customer success work becomes implicit and easier to drop."
        : "如果团队在公司详情面停留太久，客户成功工作就会继续变成隐式任务，更容易丢失。",
      handoffDecisionRequest: protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open customer success handoff."
        : "打开客户成功交接。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: "internal-only",
      handoffHref: `/customer-success/${detail.id}`,
    });

    handoffs.push({
      handoffSource: "customer-success",
      handoffTarget: "success-check",
      handoffReason: english
        ? "The next question is no longer just who owns the follow-through, but whether success issue repair is actually clean enough to keep moving."
        : "下一步的问题已经不再只是由谁接手，而是客户成功问题修复是否已经足够干净，真的可以继续推进。",
      handoffBoundary: boundary,
      handoffPrerequisite: prerequisite,
      handoffDependency: dependency,
      handoffRisk: english
        ? "Skipping success check can make the chain sound healthier than the real blocker and review picture."
        : "如果跳过 客户成功验收，这条链就可能被说得比真实阻塞和复核画面更健康。",
      handoffDecisionRequest: protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open success check."
        : "打开客户成功验收。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: visibilityMode,
      handoffHref: `/success-checks/${detail.id}`,
    });

    if (signals.recentThread) {
      handoffs.push({
        handoffSource: "customer-success",
        handoffTarget: "inbox-detail",
        handoffReason: english
          ? "Route into success inbox only when the next move needs the live thread context, not just the handoff summary."
          : "只有当下一步真正需要实时线程上下文，而不只是交接摘要时，才切进客户成功收件箱。",
        handoffBoundary: boundary,
        handoffPrerequisite: prerequisite,
        handoffDependency: dependency,
        handoffRisk: english
          ? "If the team answers from raw thread pressure without carrying the current success boundary, issue or escalation can be mistaken for commitment."
          : "如果团队从原始线程压力直接作答，却没带着当前客户成功边界，就可能把问题或升级误讲成承诺。",
        handoffDecisionRequest:
          protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open success inbox thread."
          : "打开客户成功收件箱线程。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          visibilityMode === "customer-facing-with-boundary"
            ? "review-before-send"
            : visibilityMode,
        handoffHref: `/inbox/${signals.recentThread.id}`,
      });
    }

    handoffs.push({
      handoffSource: "customer-success",
      handoffTarget: "expansion-review",
      handoffReason: english
        ? "Move into expansion review once customer success has made the current follow-through, issue / escalation pressure, renewal risk and next-step ownership explicit."
        : "当客户成功已经把当前跟进闭环、问题 / 升级压力、续约风险和下一步负责人归属 说清后，就可以切进拓展复核。",
      handoffBoundary: boundary,
      handoffPrerequisite: prerequisite,
      handoffDependency: dependency,
      handoffRisk: english
        ? "Expansion cannot outrun the current non-commitment and blocker picture."
        : "拓展不能跑在当前非承诺和阻塞画面前面。",
      handoffDecisionRequest:
        protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open expansion review."
        : "打开拓展复核。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: visibilityMode,
      handoffHref: `/expansion-reviews/${detail.id}`,
    });

    for (const target of [
      { handoffTarget: "package" as const, href: `/packages/${detail.id}` },
      { handoffTarget: "proposal" as const, href: `/proposals/${detail.id}` },
      {
        handoffTarget: "customer-facing-offer" as const,
        href: `/offers/${detail.id}`,
      },
      {
        handoffTarget: "external-proposal" as const,
        href: `/external-proposals/${detail.id}`,
      },
      {
        handoffTarget: "reinforcement" as const,
        href: `/reinforcements/${detail.id}`,
      },
      {
        handoffTarget: "founder-conversation" as const,
        href: `/founder-conversations/${detail.id}`,
      },
      {
        handoffTarget: "sales-conversation" as const,
        href: `/sales-conversations/${detail.id}`,
      },
      {
        handoffTarget: "delivery-conversation" as const,
        href: `/delivery-conversations/${detail.id}`,
      },
    ] as const) {
      const roleSpecificReason =
        target.handoffTarget === "founder-conversation"
          ? english
            ? "Use customer success → founder handoff when the line has become a founder-escalated issue, a strategic boundary call, or a blockage review that customer success should not absorb alone."
            : "当这条线已经变成升级到创始人的问题、战略边界判断或客户成功不应独自吸收的阻塞复核时，使用客户成功 → 创始人交接。"
          : target.handoffTarget === "sales-conversation"
            ? english
              ? "Use customer success → sales handoff when renewal risk, blocked expansion, or customer-visible clarification now needs sales-owned commercial follow-through."
              : "当续约风险、拓展受阻或客户可见澄清已经需要销售负责的商业跟进闭环时，使用客户成功 → 销售交接。"
            : target.handoffTarget === "delivery-conversation"
              ? english
                ? "Use customer success → delivery handoff when the next move is delivery-escalated issue repair, walkthrough clarification, or dependency cleanup rather than more success wording."
                : "当下一步已经变成升级到交付的问题修复、走查澄清或依赖清理，而不是继续补客户成功措辞时，使用客户成功 → 交付交接。"
              : english
                ? `Open ${target.handoffTarget} only after customer success has made the current follow-through and boundary picture explicit.`
                : `只有在客户成功已经把当前跟进闭环与边界画面说清后，才切到 ${target.handoffTarget}。`;
      const roleSpecificRisk =
        target.handoffTarget === "founder-conversation"
          ? english
            ? "If founder inherits the chain without the current boundary, escalation can be mistaken for a cleared strategic commitment."
            : "如果创始人接手时漏掉当前边界，升级就可能被误讲成已经清掉的战略承诺。"
          : target.handoffTarget === "sales-conversation"
            ? english
              ? "If sales inherits this without the current success boundary, renewal or expansion pressure can overstate certainty."
              : "如果销售接手时漏掉当前客户成功边界，续约或拓展压力就可能把确定性说过头。"
            : target.handoffTarget === "delivery-conversation"
              ? english
                ? "If delivery inherits this without the current issue / escalation boundary, repair work can be mistaken for delivery commitment."
                : "如果交付接手时漏掉当前问题 / 升级边界，修复动作就可能被误讲成交付承诺。"
              : english
                ? "If the next detail inherits customer success context without the current boundary, the chain can overstate certainty."
                : "如果下一页继承了客户成功上下文 却漏掉当前边界，这条链就可能把确定性说过头。";
      const roleSpecificNextAction =
        target.handoffTarget === "founder-conversation"
          ? english
            ? "Open founder escalation handoff."
            : "打开创始人升级交接。"
          : target.handoffTarget === "sales-conversation"
            ? english
              ? "Open sales renewal / expansion handoff."
              : "打开销售续约 / 拓展交接。"
            : target.handoffTarget === "delivery-conversation"
              ? english
                ? "Open delivery issue / dependency handoff."
                : "打开交付问题 / 依赖交接。"
              : english
                ? "Open next detail."
                : "打开下一页 detail。";
      handoffs.push({
        handoffSource: "customer-success",
        handoffTarget: target.handoffTarget,
        handoffReason: roleSpecificReason,
        handoffBoundary: boundary,
        handoffPrerequisite: prerequisite,
        handoffDependency: dependency,
        handoffRisk: roleSpecificRisk,
        handoffDecisionRequest:
          protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
        handoffNextAction: roleSpecificNextAction,
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: visibilityMode,
        handoffHref: target.href,
      });
    }
  } else if (kind === "success-check") {
    handoffs.push({
      handoffSource: "customer-success",
      handoffTarget: "success-check",
      handoffReason: english
        ? "Once ownership is clear, the next question becomes whether the account is actually ready for the next move."
        : "当负责人归属 已经清楚后，下一步的问题就会变成这个账户是否真的准备好进入下一层动作。",
      handoffBoundary: boundary,
      handoffPrerequisite: prerequisite,
      handoffDependency: dependency,
      handoffRisk: english
        ? "Skipping success check can hide the current blocker, dependency or open commitment pressure."
        : "如果跳过成功检查，就可能把当前卡点、依赖或开放承诺压力藏起来。",
      handoffDecisionRequest: protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open success check."
        : "打开客户成功验收。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: visibilityMode,
      handoffHref: `/success-checks/${detail.id}`,
    });
    handoffs.push({
      handoffSource: "success-check",
      handoffTarget: "expansion-review",
      handoffReason: english
        ? "Move into expansion review only after the success check says the current account motion is honest enough to widen."
        : "只有当 客户成功验收 先确认当前账户推进已经足够诚实时，才切进拓展复核。",
      handoffBoundary: boundary,
      handoffPrerequisite: prerequisite,
      handoffDependency: dependency,
      handoffRisk: english
        ? "Expansion pressure should not erase the current success boundary."
        : "拓展压力不应抹掉当前客户成功边界。",
      handoffDecisionRequest:
        protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open expansion review."
        : "打开拓展复核。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: visibilityMode,
      handoffHref: `/expansion-reviews/${detail.id}`,
    });
  } else {
    handoffs.push({
      handoffSource: "success-check",
      handoffTarget: "expansion-review",
      handoffReason: english
        ? "Expansion review should inherit the account only after success check has made the current follow-through honest."
        : "只有在客户成功验收已经把当前跟进闭环说诚实后，拓展复核才应该接手这个账户。",
      handoffBoundary: boundary,
      handoffPrerequisite: prerequisite,
      handoffDependency: dependency,
      handoffRisk: english
        ? "Expansion review that skips the success picture can overstate readiness."
        : "如果拓展复核跳过客户成功画面，就容易把就绪度说过头。",
      handoffDecisionRequest: protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open expansion review."
        : "打开拓展复核。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: visibilityMode,
      handoffHref: `/expansion-reviews/${detail.id}`,
    });

    for (const target of [
      { handoffTarget: "package" as const, href: `/packages/${detail.id}` },
      { handoffTarget: "proposal" as const, href: `/proposals/${detail.id}` },
      {
        handoffTarget: "customer-facing-offer" as const,
        href: `/offers/${detail.id}`,
      },
      {
        handoffTarget: "reinforcement" as const,
        href: `/reinforcements/${detail.id}`,
      },
    ] as const) {
      handoffs.push({
        handoffSource: "expansion-review",
        handoffTarget: target.handoffTarget,
        handoffReason: english
          ? `Once expansion review is explicit, the next commercial layer can reopen on ${target.handoffTarget} without losing the current follow-through context.`
          : `当拓展复核已经说清后，下一条商业层就可以在 ${target.handoffTarget} 上重开，而不会丢掉当前跟进闭环上下文。`,
        handoffBoundary: boundary,
        handoffPrerequisite: prerequisite,
        handoffDependency: dependency,
        handoffRisk: english
          ? "Commercial detail still cannot inherit expansion optimism as if it were already approved."
          : "商业详情面仍然不能把拓展乐观估计直接继承成“已批准的确定性”。",
        handoffDecisionRequest:
          protocol.pageDecisionRequest[1] ?? protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open commercial detail."
          : "打开商业详情面。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: visibilityMode,
        handoffHref: target.href,
      });
    }
  }

  if (company) {
    handoffs.push({
      handoffSource: kind,
      handoffTarget: "company-detail",
      handoffReason: english
        ? "Return to company detail only when the team needs the broader account context, not when it needs the customer success decision itself."
        : "只有在团队需要更宽的账户上下文时才回到公司详情面，而不是把它继续当作客户成功决策本身。",
      handoffBoundary: boundary,
      handoffPrerequisite: prerequisite,
      handoffDependency: dependency,
      handoffRisk: english
        ? "Company detail should remain context, not become a weak alias for customer success handoff."
        : "公司详情面应继续是上下文页，而不是客户成功交接的弱别名。",
      handoffDecisionRequest: protocol.pageDecisionRequest[0],
      handoffNextAction: english
        ? "Open company detail."
        : "打开公司详情面。",
      handoffWorkerSummary: protocol.pageWorkerSummary,
      handoffEvidenceSummary: protocol.pageEvidenceSummary,
      handoffVisibilityMode: "internal-only",
      handoffHref: `/companies/${company.id}`,
    });
  }

  return compactHandoffs(handoffs);
}

function buildEvidenceGroups({
  detail,
  company,
  signals,
  kind,
  customerSuccessHandoffStage,
  customerSuccessDetailSendabilityMode,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  company: CompanyContextForCustomerSuccess;
  signals: ReturnType<typeof summarizeSignals>;
  kind: PageKind;
  customerSuccessHandoffStage: CustomerSuccessHandoffStage;
  customerSuccessDetailSendabilityMode: CustomerSuccessSendabilityMode;
  english: boolean;
}): CustomerSuccessEvidenceGroup[] {
  return [
    {
      groupId: "replay",
      label: english ? "Replay" : "回放",
      items: compactStrings([
        detail.meetings[0]?.note?.summary
          ? trimText(detail.meetings[0].note?.summary ?? "", 120)
          : null,
        detail.emailThreads[0]?.messages.at(-1)?.body
          ? trimText(detail.emailThreads[0].messages.at(-1)?.body ?? "", 120)
          : english
            ? "No latest thread replay."
            : "当前没有最新线程回放。",
      ]),
    },
    {
      groupId: "audit",
      label: english ? "Audit" : "审计",
      items: compactStrings([
        detail.auditLogs[0]
          ? `${detail.auditLogs[0].actor} · ${trimText(detail.auditLogs[0].summary, 100)}`
          : english
            ? "No audit trace yet."
            : "当前还没有审计轨迹。",
        signals.pendingReview
          ? english
            ? `Review updated ${formatDateLabel(signals.pendingReview.updatedAt)}`
            : `复核更新于 ${formatDateLabel(signals.pendingReview.updatedAt)}`
          : null,
      ]),
    },
    {
      groupId: "memory",
      label: english ? "Memory" : "记忆",
      items: compactStrings([
        detail.memoryFacts[0]
          ? `${detail.memoryFacts[0].title} · ${trimText(detail.memoryFacts[0].content, 100)}`
          : english
            ? "No memory fact captured yet."
            : "当前还没有记忆事实。",
        company?.briefingSnapshot?.payload.summary
          ? trimText(company.briefingSnapshot.payload.summary, 120)
          : null,
      ]),
    },
    {
      groupId: "worker_output",
      label: english ? "Worker output" : "执行输出",
      items: compactStrings([
        detail.briefingSnapshot?.payload.recommendedNextSteps?.[0] ??
          (english
            ? "Coordination handoff keeps follow-through, review and expansion cues aligned."
            : "协作分工会持续把跟进闭环、复核和拓展线索对齐。"),
        signals.pendingReview?.actionItem.description
          ? trimText(signals.pendingReview.actionItem.description, 120)
          : null,
      ]),
    },
    {
      groupId: "boundary_trace",
      label: english ? "Boundary trace" : "边界痕迹",
      items: compactStrings([
        signals.topBlocker
          ? trimText(signals.topBlocker.blockerText, 120)
          : english
            ? "No dominant blocker trace."
            : "当前没有主导阻塞轨迹。",
        english
          ? `${formatStage(customerSuccessHandoffStage, true)} still keeps boundary, prerequisite and non-commitment visible.`
          : `当前「${formatStage(customerSuccessHandoffStage, false)}」仍会继续把边界、前置和非承诺挂在前台。`,
      ]),
    },
    {
      groupId: "sendability_trace",
      label: english ? "Sendability trace" : "发送评估痕迹",
      items: [
        english
          ? `Current customer success sendability stays at ${formatSendabilityMode(customerSuccessDetailSendabilityMode, true)}.`
          : `当前客户成功发送评估停在「${formatSendabilityMode(customerSuccessDetailSendabilityMode, false)}」。`,
      ],
    },
    {
      groupId: "handoff_trace",
      label: english ? "Handoff trace" : "交接痕迹",
      items: compactStrings([
        signals.pendingReview
          ? english
            ? "Review request now passes into customer success instead of stopping at company proxy routing."
            : "复核请求现在会继续交给客户成功，而不再停在公司代理路由。"
          : english
            ? "Customer success now sits as a dedicated chain node between review, success check and expansion review."
            : "客户成功现在已经是复核、客户成功验收 和拓展复核之间的 专属链路节点。",
        kind === "expansion-review"
          ? english
            ? "Expansion review can now reopen package, proposal, offer and reinforcement with the current account context intact."
            : "拓展复核现在可以在保留当前账户上下文的前提下，重新打开方案包、提案、客户报价和加固。"
          : null,
      ]),
    },
    {
      groupId: "success_trace",
      label: english ? "Success trace" : "成功轨迹",
      items: compactStrings([
        detail.commitments[0]
          ? `${detail.commitments[0].title} · ${detail.commitments[0].status}`
          : english
            ? "No dominant commitment trace."
            : "当前没有主导承诺轨迹。",
        detail.meetings[0]
          ? `${detail.meetings[0].title} · ${formatDateLabel(detail.meetings[0].startsAt)}`
          : english
            ? "No latest success meeting."
            : "当前没有最近 success meeting。",
      ]),
    },
    {
      groupId: "historical_changes",
      label: english ? "Historical changes" : "历史变化",
      items: compactStrings([
        english
          ? `Opportunity updated ${formatDateLabel(detail.updatedAt)}`
          : `机会更新于 ${formatDateLabel(detail.updatedAt)}`,
        company?.memoryEntries[0]
          ? `${company.memoryEntries[0].title} · ${formatDateLabel(company.memoryEntries[0].createdAt)}`
          : null,
      ]),
    },
  ];
}

function formatStage(stage: CustomerSuccessHandoffStage, english: boolean) {
  switch (stage) {
    case "success-follow-through":
      return english ? "Success follow-through" : "客户成功跟进";
    case "activation-follow-through":
      return english ? "Activation follow-through" : "激活跟进";
    case "review-follow-through":
      return english ? "Review follow-through" : "复核跟进";
    case "expansion-review":
      return english ? "Expansion review" : "拓展复核";
    case "expansion-ready-but-blocked":
      return english ? "Expansion ready but blocked" : "拓展就绪但被阻塞";
    case "issue-follow-through":
      return english ? "Issue follow-through" : "问题跟进";
    case "escalation-follow-through":
      return english ? "Escalation follow-through" : "升级跟进";
    case "internal-prep-only":
      return english ? "Internal prep only" : "仅内部准备";
    case "review-before-send":
      return english ? "Review before send" : "发送前复核";
    default:
      return english ? "Blocked by boundary" : "被边界阻塞";
  }
}

function formatVariantMode(
  stage: CustomerSuccessHandoffStage,
  english: boolean,
) {
  if (stage === "escalation-follow-through") {
    return english ? "Escalation variant" : "升级变体";
  }

  if (stage === "issue-follow-through") {
    return english ? "Issue variant" : "问题变体";
  }

  return english ? "Follow-through variant" : "跟进变体";
}

function buildDeeperVariantSummaryItems({
  kind,
  detail,
  signals,
  stage,
  ownershipMode,
  sendabilityMode,
  fallbackMode,
  english,
}: {
  kind: PageKind;
  detail: OpportunityCommercialDetailForCustomerSuccess;
  signals: ReturnType<typeof summarizeSignals>;
  stage: CustomerSuccessHandoffStage;
  ownershipMode: CustomerSuccessOwnershipMode;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  english: boolean;
}): SecondarySummaryItem[] {
  return [
    {
      label: english ? "Issue sub-variant" : "Issue 子变体",
      value: formatIssueSubVariant({
        signals,
        sendabilityMode,
        fallbackMode,
        english,
      }),
    },
    {
      label: english ? "Escalation sub-variant" : "升级子变体",
      value: formatEscalationSubVariant({
        detail,
        signals,
        ownershipMode,
        sendabilityMode,
        fallbackMode,
        english,
      }),
    },
    {
      label: english
        ? "Renewal / expansion risk sub-variant"
        : "续费 / 扩展风险子变体",
      value: formatRenewalExpansionRiskSubVariant({
        kind,
        signals,
        stage,
        sendabilityMode,
        fallbackMode,
        english,
      }),
    },
  ];
}

function formatIssueSubVariant({
  signals,
  sendabilityMode,
  fallbackMode,
  english,
}: {
  signals: ReturnType<typeof summarizeSignals>;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  english: boolean;
}) {
  if (sendabilityMode === "review-before-send" || signals.pendingReview) {
    return english
      ? "review-before-send issue response"
      : "发送前复核的问题回复";
  }

  if (
    sendabilityMode === "boundary-only" ||
    fallbackMode === "blocked-by-boundary" ||
    blockerSuggestsBoundary(signals.topBlocker?.blockerText ?? null)
  ) {
    return english
      ? "boundary-only issue response"
      : "仅边界的问题回复";
  }

  if (
    sendabilityMode === "internal-only" ||
    sendabilityMode === "discussion-only"
  ) {
    return english ? "internal-only issue prep" : "仅内部的问题准备";
  }

  if (signals.topBlocker) {
    return english ? "blocked issue resolution" : "受阻问题处理";
  }

  if (sendabilityMode === "customer-visible-with-boundary") {
    return english
      ? "customer-visible issue clarification"
      : "客户可见的问题澄清";
  }

  return english
    ? "success issue follow-through"
    : "成功问题跟进";
}

function formatEscalationSubVariant({
  detail,
  signals,
  ownershipMode,
  sendabilityMode,
  fallbackMode,
  english,
}: {
  detail: OpportunityCommercialDetailForCustomerSuccess;
  signals: ReturnType<typeof summarizeSignals>;
  ownershipMode: CustomerSuccessOwnershipMode;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  english: boolean;
}) {
  if (ownershipMode === "shared-with-founder") {
    return english ? "founder-escalated issue" : "创始人升级问题";
  }

  if (ownershipMode === "shared-with-delivery") {
    return english ? "delivery-escalated issue" : "交付升级问题";
  }

  if (ownershipMode === "shared-with-sales") {
    return english ? "sales-escalated issue" : "销售升级问题";
  }

  if (
    signals.blockerNeedsEscalation &&
    blockerSuggestsDependency(signals.topBlocker?.blockerText ?? null)
  ) {
    return english
      ? "blocked-by-dependency escalation"
      : "依赖阻塞升级";
  }

  if (
    sendabilityMode === "boundary-only" ||
    fallbackMode === "blocked-by-boundary" ||
    blockerSuggestsBoundary(signals.topBlocker?.blockerText ?? null) ||
    blockerSuggestsBoundary(detail.nextAction)
  ) {
    return english
      ? "blocked-by-boundary escalation"
      : "边界阻塞升级";
  }

  if (
    sendabilityMode === "internal-only" ||
    sendabilityMode === "discussion-only"
  ) {
    return english
      ? "internal-only escalation prep"
      : "仅内部的升级准备";
  }

  return english
    ? "escalation-triggered follow-through"
    : "升级触发跟进";
}

function formatRenewalExpansionRiskSubVariant({
  kind,
  signals,
  stage,
  sendabilityMode,
  fallbackMode,
  english,
}: {
  kind: PageKind;
  signals: ReturnType<typeof summarizeSignals>;
  stage: CustomerSuccessHandoffStage;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  english: boolean;
}) {
  if (
    (kind === "expansion-review" || stage === "expansion-ready-but-blocked") &&
    (sendabilityMode === "review-before-send" || signals.pendingReview)
  ) {
    return english
      ? "review-before-send expansion clarification"
      : "发送前复核的拓展澄清";
  }

  if (
    kind === "expansion-review" &&
    (stage === "expansion-ready-but-blocked" ||
      fallbackMode === "blocked-by-boundary" ||
      signals.topBlocker != null)
  ) {
    return english
      ? "expansion blocked clarification"
      : "拓展阻塞澄清";
  }

  if (signals.overdueCommitment) {
    return english
      ? "success follow-through before expansion"
      : "先完成成功跟进再拓展";
  }

  if (fallbackMode === "non-commitment-fallback") {
    return english
      ? "non-commitment fallback for success / expansion"
      : "成功 / 拓展的非承诺降级";
  }

  return english ? "renewal risk clarification" : "续费风险澄清";
}

function blockerSuggestsDependency(text: string | null) {
  if (!text) return false;
  return /dependency|waiting on|blocked by|procurement|legal|security|integration|vendor|calendar|schedule|依赖|等待|采购|法务|安全|集成|排期|第三方/i.test(
    text,
  );
}

function blockerSuggestsBoundary(text: string | null) {
  if (!text) return false;
  return /boundary|outside scope|scope|cannot|can't|not supported|policy|approval gate|commitment|send authority|边界|超出范围|范围外|不支持|不能|不可|政策|治理|承诺|外发/i.test(
    text,
  );
}

function formatAuthorityState(
  state: CustomerSuccessAuthorityState,
  english: boolean,
) {
  return formatAgentAuthorityState(state, english);
}

function buildAuthoritySummary(
  state: CustomerSuccessAuthorityState,
  english: boolean,
) {
  switch (state) {
    case "user-reviewed":
      return english
        ? "The user has reviewed the current framing, but the next move still stays bounded and non-commitment-first."
        : "用户已经复核过当前措辞，但下一步仍保持在有边界、非承诺优先 的范围内。";
    case "user-backed":
      return english
        ? "The user is explicitly backing the current next-step line, and bounded follow-through stays prepared without implying commitment."
        : "用户已经明确支持当前下一步线路，同时有边界的跟进闭环会继续保持已准备，但不会暗示承诺。";
    default:
      return english
        ? "The current framing and next-step options are prepared; user review or backing has not yet been made explicit."
        : "当前措辞和下一步选项已经准备好，用户是否复核或支持仍未被显式抬出来。";
  }
}

function formatAttentionState(
  state: CustomerSuccessAttentionState,
  english: boolean,
) {
  return formatAgentAttentionState(state, english);
}

function buildAttentionSummary(
  state: CustomerSuccessAttentionState,
  english: boolean,
) {
  switch (state) {
    case "pushing":
      return english
        ? "The relevant user is actively pushing the current bounded next step."
        : "当前相关用户正在主动推动这条有边界的下一步。";
    case "waiting":
      return english
        ? "The work is waiting on review, reply, or another dependency before it can move honestly."
        : "当前工作正在等待复核、回复或其他依赖，之后才能诚实推进。";
    case "blocked":
      return english
        ? "The work is materially blocked and must not be narrated as ordinary follow-through."
        : "当前工作已被实质性阻塞，不能再按普通跟进闭环去讲。";
    case "review-before-send":
      return english
        ? "The work remains under review-before-send; outward wording must stay held back."
        : "当前工作仍停在发送前复核，外部措辞必须继续收住。";
    default:
      return english
        ? "The relevant user is watching the current line while the bounded next move stays visible."
        : "当前相关用户正在看住这条线，同时有边界的下一步会继续挂在前台。";
  }
}

function formatAudienceMode(
  mode: CustomerSuccessAudienceMode,
  english: boolean,
) {
  switch (mode) {
    case "customer-success":
      return english ? "Customer success" : "客户成功";
    case "success-owner":
      return english ? "Success owner" : "成功负责人";
    case "expansion-owner":
      return english ? "Expansion owner" : "拓展负责人";
    case "shared-review":
      return english ? "Shared review" : "共享复核";
    case "customer-visible":
      return english ? "Customer visible" : "面向客户";
    default:
      return english ? "Internal only" : "仅内部";
  }
}

function formatOwnershipPressure(
  stage: CustomerSuccessHandoffStage,
  ownershipMode: CustomerSuccessOwnershipMode,
  english: boolean,
) {
  if (stage === "escalation-follow-through") {
    return english
      ? `Widened beyond the normal customer success path; ${formatOwnershipMode(ownershipMode, true)} now carries explicit intervention pressure.`
      : `当前已经超出普通客户成功路径；「${formatOwnershipMode(ownershipMode, false)}」现在要承接显式介入压力。`;
  }

  if (stage === "issue-follow-through") {
    return english
      ? "Still within normal current-round coordination; widened ownership pressure is not yet required."
      : "当前仍在正常这一轮协调范围内，还不需要扩大负责人压力。";
  }

  if (stage === "review-follow-through" || stage === "review-before-send") {
    return english
      ? "Shared review pressure stays visible before any stronger external wording appears."
      : "在任何更强的外部表达出现前，共享复核压力仍需继续显式可见。";
  }

  return english
    ? `Normal current-round handling remains active under ${formatOwnershipMode(ownershipMode, true)}.`
    : `当前仍由「${formatOwnershipMode(ownershipMode, false)}」承接正常这一轮处理。`;
}

function formatRouteCue(
  stage: CustomerSuccessHandoffStage,
  sendabilityMode: CustomerSuccessSendabilityMode,
  fallbackMode: CustomerSuccessFallbackMode,
  english: boolean,
) {
  if (stage === "escalation-follow-through") {
    return english
      ? "Blocked until widened decision or downgrade path is explicit."
      : "在扩大判断或降级路径说清前，当前先按受阻处理。";
  }

  if (stage === "issue-follow-through") {
    return english
      ? "Contained if repair closes; only widen once readiness stays clean."
      : "只有修复收口后才算已收口；也只有在就绪度仍然干净时才继续扩大。";
  }

  if (
    stage === "review-follow-through" ||
    sendabilityMode === "review-before-send"
  ) {
    return english
      ? "Held at the review line before any outward certainty."
      : "在任何对外确定性之前，当前先停在复核话术。";
  }

  if (
    fallbackMode === "blocked-by-boundary" ||
    stage === "blocked-by-boundary"
  ) {
    return english ? "Blocked by boundary." : "当前被边界阻塞。";
  }

  if (stage === "activation-follow-through") {
    return english
      ? "Ready for activation follow-through."
      : "当前适合激活跟进闭环。";
  }

  if (stage === "expansion-review") {
    return english
      ? "Ready for expansion review."
      : "当前适合拓展复核。";
  }

  return english
    ? "Ready for ordinary follow-through."
    : "当前适合普通跟进闭环。";
}

function formatOwnershipMode(
  mode: CustomerSuccessOwnershipMode,
  english: boolean,
) {
  switch (mode) {
    case "shared-with-sales":
      return english ? "Shared with sales" : "与销售共享";
    case "shared-with-delivery":
      return english ? "Shared with delivery" : "与交付共享";
    case "shared-with-founder":
      return english ? "Shared with founder" : "与创始人共享";
    default:
      return english
        ? "Customer success owns next move"
        : "由客户成功接手";
  }
}

function formatSendabilityMode(
  mode: CustomerSuccessSendabilityMode,
  english: boolean,
) {
  switch (mode) {
    case "customer-visible-with-boundary":
      return english ? "Customer visible with boundary" : "带边界可对外";
    case "review-before-send":
      return english ? "Review before send" : "发送前复核";
    case "boundary-only":
      return english ? "Boundary only" : "仅边界";
    case "discussion-only":
      return english ? "Discussion only" : "仅供讨论";
    default:
      return english ? "Internal only" : "仅内部";
  }
}

function formatExternalDraftKind(
  kind: CustomerSuccessExternalDraftKind,
  english: boolean,
) {
  switch (kind) {
    case "holding-reply":
      return english ? "Holding reply" : "暂缓回复";
    case "boundary-aware-check-in":
      return english ? "Boundary-aware check-in" : "带边界确认";
    case "decision-dependency-clarification-request":
      return english
        ? "Decision / dependency clarification request"
        : "判断 / 依赖澄清请求";
    case "review-before-send-follow-up":
      return english
        ? "Review-before-send follow-up"
        : "发送前复核跟进";
    default:
      return english
        ? "Non-commitment status update"
        : "非承诺状态更新";
  }
}

function formatExternalDraftCue(
  cue: CustomerSuccessExternalDraftCue,
  english: boolean,
) {
  switch (cue) {
    case "draft-only":
      return english ? "Draft only" : "仅草稿";
    case "review-before-send":
      return english ? "Review before send" : "发送前复核";
    case "not-sendable-yet":
      return english ? "Not customer-sendable yet" : "暂不可对外发送";
    case "boundary-limited":
      return english ? "Boundary limited" : "受边界限制";
    case "non-commitment-required":
      return english ? "Non-commitment required" : "必须保持非承诺";
    default:
      return english ? "Human review required" : "需要人工复核";
  }
}

function formatDraftReviewOutcomeCue(
  cue: CustomerSuccessDraftReviewOutcomeCue,
  english: boolean,
) {
  switch (cue) {
    case "review-pending":
      return english ? "Review pending" : "等待复核";
    case "reviewed-by-human":
      return english ? "Reviewed by human" : "已完成人工复核";
    case "revision-requested":
      return english ? "Revision requested" : "已要求修改";
    case "handoff-to-human-sender":
      return english ? "Handoff to human sender" : "已交接给人工发送者";
    default:
      return english ? "Manual send recorded" : "已记录手动发送";
  }
}

function formatFallbackMode(
  mode: CustomerSuccessFallbackMode,
  english: boolean,
) {
  switch (mode) {
    case "non-commitment-fallback":
      return english ? "Non-commitment fallback" : "非承诺降级";
    case "internal-only":
      return english ? "Internal only" : "仅内部";
    case "blocked-by-boundary":
      return english ? "Blocked by boundary" : "被边界阻塞";
    case "review-hold":
      return english ? "Review hold" : "复核暂停";
    default:
      return english ? "No fallback" : "无额外降级";
  }
}

function priorityForRisk(
  signal: CustomerSuccessRiskSignal,
): UnifiedDetailNodePriority {
  if (signal === "high") return "urgent";
  if (signal === "caution") return "important";
  return "watch";
}

function toVisibilityMode(
  mode: CustomerSuccessSendabilityMode,
): CrossDetailHandoffVisibilityMode {
  switch (mode) {
    case "customer-visible-with-boundary":
      return "customer-facing-with-boundary";
    case "review-before-send":
      return "review-before-send";
    case "boundary-only":
      return "boundary-only";
    default:
      return "internal-only";
  }
}

function compactLinks<T>(items: Array<T | null>): T[] {
  return items.filter((item): item is T => item != null);
}

function compactHandoffs(
  items: Array<CrossDetailHandoff | null>,
): CrossDetailHandoff[] {
  return items.filter((item): item is CrossDetailHandoff => item != null);
}

function compactStrings(items: Array<string | null | undefined>) {
  return items.filter((item): item is string => Boolean(item && item.trim()));
}

function compactActions<T>(items: Array<T | null>): T[] {
  return items.filter((item): item is T => item != null);
}

function compactPageActions<T extends HeaderLink>(items: Array<T | null>): T[] {
  const filtered = items.filter((item): item is T => item != null);
  const primaryActions: T[] = [];
  const secondaryActions: T[] = [];

  for (const action of filtered) {
    if (action.variant === undefined || action.variant === "default") {
      if (primaryActions.length === 0) {
        primaryActions.push(action);
      }
      continue;
    }

    if (secondaryActions.length < 2) {
      secondaryActions.push(action);
    }
  }

  return [...primaryActions, ...secondaryActions];
}

function compactEvidenceLinks<T>(items: Array<T | null>): T[] {
  return items.filter((item): item is T => item != null);
}
