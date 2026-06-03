import type { PageReportingProtocol } from "@/lib/presentation/reporting-protocol";
import {
  formatAgentAttentionState,
  formatAgentAuthorityState,
} from "@/lib/presentation/agent-primitives";
import { createPageReportingProtocol } from "@/lib/presentation/reporting-protocol";
import { buildCustomerSuccessHandoffPageModel } from "@/features/customer-success-handoff/detail-model";
import {
  buildHighFrequencyActionTemplateHint,
  getHighFrequencyActionTemplate,
  type HighFrequencyActionTemplateKey,
} from "@/lib/operating-system/action-templates";
import type {
  CustomerSuccessAttentionState,
  CustomerSuccessAuthorityState,
} from "@/features/customer-success-handoff/detail-model";
import { formatDateLabel, trimText } from "@/lib/utils";

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

type FastPathItem = {
  label: string;
  hint: string;
  href: string;
};

type QueueDetailInput = {
  detail: Parameters<typeof buildCustomerSuccessHandoffPageModel>[0]["detail"];
  company: Parameters<typeof buildCustomerSuccessHandoffPageModel>[0]["company"];
  reviewTasks: Parameters<typeof buildCustomerSuccessHandoffPageModel>[0]["reviewTasks"];
  stageLabel: string;
};

type SuccessInboxThreadInput = {
  id: string;
  subject: string;
  counterpart: string;
  status: "OPEN" | "WAITING_US" | "WAITING_THEM" | "CLOSED";
  shouldReply: boolean;
  updatedAt: Date;
  company: { id: string; name: string } | null;
  opportunity: {
    id: string;
    title: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    stage: string;
    nextAction: string | null;
  };
  latestMessage: {
    body: string;
    isInbound: boolean;
    sentAt: Date;
  } | null;
  messageCount: number;
};

function buildFastPathTemplateItems(english: boolean) {
  const keys: HighFrequencyActionTemplateKey[] = [
    "follow-up",
    "review-request",
    "escalation",
  ];

  return keys
    .map((key) => getHighFrequencyActionTemplate(key, english))
    .filter((template): template is NonNullable<typeof template> => Boolean(template))
    .map((template) => ({
      label: template.title,
      hint: buildHighFrequencyActionTemplateHint(template, english),
      href: template.href,
    }));
}

export type CustomerSuccessQueueSurfaceItem = {
  id: string;
  title: string;
  companyLabel: string;
  variant: "issue" | "escalation" | "follow-through";
  authorityState: CustomerSuccessAuthorityState;
  authorityLabel: string;
  attentionState: CustomerSuccessAttentionState;
  attentionLabel: string;
  judgementLabel: string;
  variantSummary: string;
  subvariantSummary: string | null;
  advisoryCategoryLabel: string;
  advisoryPatternLabel: string;
  advisoryPlaybookLabel: string;
  policyModeLabel: string;
  policyModeTone: Chip["tone"];
  approvalRequiredLabel: string | null;
  internalOnlyLabel: string;
  externalSendDisabledLabel: string;
  commitmentDisabledLabel: string;
  policySummaryLabel: string;
  policyBlockedLabel: string;
  sinceLastSeenLabel: string;
  resurfacedBecauseLabel: string;
  stillWaitingLabel: string | null;
  stillBlockedLabel: string | null;
  stageLabel: string;
  ownerLabel: string;
  ownershipPressureLabel: string;
  decisionPostureLabel: string;
  progressLabel: string;
  internalActionStatusLabel: string | null;
  internalActionStatusTone: Chip["tone"] | null;
  internalActionResultLabel: string | null;
  externalDraftStatusLabel: string | null;
  externalDraftStatusTone: Chip["tone"] | null;
  externalDraftPolicyLabel: string | null;
  externalDraftSummaryLabel: string | null;
  externalDraftBlockedLabel: string | null;
  draftReviewStatusLabel: string | null;
  draftReviewStatusTone: Chip["tone"] | null;
  draftReviewSummaryLabel: string | null;
  draftSendHandoffLabel: string | null;
  postSendOutcomeStatusLabel: string | null;
  postSendOutcomeStatusTone: Chip["tone"] | null;
  postSendOutcomeSummaryLabel: string | null;
  postSendOutcomeBlockedLabel: string | null;
  readinessLabel: string;
  readinessTone: Chip["tone"];
  nextActionLabel: string;
  decisionLabel: string;
  boundaryLabel: string;
  evidenceLabel: string;
  riskLabel: string;
  href: string;
  successCheckHref: string;
  expansionReviewHref: string;
  inboxHref: string | null;
};

export type CustomerSuccessInboxSurfaceItem = {
  id: string;
  subject: string;
  counterpart: string;
  companyLabel: string;
  variant: "issue" | "escalation" | "follow-through";
  authorityState: CustomerSuccessAuthorityState;
  authorityLabel: string;
  attentionState: CustomerSuccessAttentionState;
  attentionLabel: string;
  judgementLabel: string;
  variantSummary: string;
  subvariantSummary: string | null;
  advisoryCategoryLabel: string;
  advisoryPatternLabel: string;
  advisoryPlaybookLabel: string;
  policyModeLabel: string;
  policyModeTone: Chip["tone"];
  approvalRequiredLabel: string | null;
  internalOnlyLabel: string;
  externalSendDisabledLabel: string;
  commitmentDisabledLabel: string;
  policySummaryLabel: string;
  policyBlockedLabel: string;
  sinceLastSeenLabel: string;
  resurfacedBecauseLabel: string;
  stillWaitingLabel: string | null;
  stillBlockedLabel: string | null;
  stageLabel: string;
  ownerLabel: string;
  ownershipPressureLabel: string;
  decisionPostureLabel: string;
  progressLabel: string;
  internalActionStatusLabel: string | null;
  internalActionStatusTone: Chip["tone"] | null;
  internalActionResultLabel: string | null;
  externalDraftStatusLabel: string | null;
  externalDraftStatusTone: Chip["tone"] | null;
  externalDraftPolicyLabel: string | null;
  externalDraftSummaryLabel: string | null;
  externalDraftBlockedLabel: string | null;
  draftReviewStatusLabel: string | null;
  draftReviewStatusTone: Chip["tone"] | null;
  draftReviewSummaryLabel: string | null;
  draftSendHandoffLabel: string | null;
  postSendOutcomeStatusLabel: string | null;
  postSendOutcomeStatusTone: Chip["tone"] | null;
  postSendOutcomeSummaryLabel: string | null;
  postSendOutcomeBlockedLabel: string | null;
  readinessLabel: string;
  readinessTone: Chip["tone"];
  nextActionLabel: string;
  decisionLabel: string;
  boundaryLabel: string;
  evidenceLabel: string;
  riskLabel: string;
  href: string;
  customerSuccessHref: string;
};

export type CustomerSuccessQueueSurfaceModel = {
  rootDataAttributes: Record<string, string>;
  eyebrow: string;
  title: string;
  description: string;
  briefingLabel: string;
  protocol: PageReportingProtocol;
  chips: Chip[];
  secondarySummaryItems: SecondarySummaryItem[];
  boundaryLabel: string;
  actionLabel: string;
  evidenceLabel: string;
  evidenceCountLabel: string;
  immediateActions: FastPathItem[];
  decisionsWaiting: FastPathItem[];
  blockersToClear: FastPathItem[];
  actionTemplates: FastPathItem[];
  retroFeedback: FastPathItem[];
  evidenceGroups: EvidenceGroup[];
  queueItems: CustomerSuccessQueueSurfaceItem[];
  inboxItems: CustomerSuccessInboxSurfaceItem[];
};

export function buildCustomerSuccessQueueSurfaceModel({
  queueDetails,
  successInboxThreads,
  currentUserId,
  english,
}: {
  queueDetails: QueueDetailInput[];
  successInboxThreads: SuccessInboxThreadInput[];
  currentUserId?: string;
  english: boolean;
}): CustomerSuccessQueueSurfaceModel {
  const queueModels = queueDetails.map((entry) =>
    buildCustomerSuccessHandoffPageModel({
      detail: entry.detail,
      company: entry.company,
      reviewTasks: entry.reviewTasks,
      stageLabel: entry.stageLabel,
      currentUserId,
      english,
    }),
  );

  const visibleInboxThreadIds = new Set(
    successInboxThreads.map((thread) => thread.id),
  );

  const queueItems = queueModels.map((model, index) => {
    const source = queueDetails[index];
    const stageLabel = readSummaryValue(
      model.secondarySummaryItems,
      english ? "Current stage" : "当前阶段",
    );
    const ownerLabel = readSummaryValue(
      model.secondarySummaryItems,
      english ? "Ownership" : "接手负责人",
    );
    const variant =
      model.stageKey === "escalation-follow-through"
        ? ("escalation" as const)
        : model.stageKey === "issue-follow-through"
          ? ("issue" as const)
          : ("follow-through" as const);
    const readinessCue = buildQueueReadinessCue(
      model.stageKey,
      model.sendabilityMode,
      model.fallbackMode,
      english,
    );
    const issueSubvariant = readSummaryValue(
      model.secondarySummaryItems,
      english ? "Issue sub-variant" : "Issue 子变体",
    );
    const escalationSubvariant = readSummaryValue(
      model.secondarySummaryItems,
      english ? "Escalation sub-variant" : "升级子变体",
    );
    const renewalSubvariant = readSummaryValue(
      model.secondarySummaryItems,
      english
        ? "Renewal / expansion risk sub-variant"
        : "续费 / 扩展风险子变体",
    );
    const internalActionCue = buildInternalActionQueueCue(
      model.internalActions,
      english,
    );
    const externalDraftCue = buildExternalDraftQueueCue(
      model.externalDrafts,
      english,
    );
    const draftReviewCue = buildExternalDraftReviewQueueCue(
      model.externalDrafts,
      english,
    );
    const postSendCue = buildExternalDraftPostSendQueueCue(
      model.externalDrafts,
      english,
    );

    return {
      id: source.detail.id,
      title: source.detail.title,
      companyLabel: source.detail.company?.name ?? (english ? "No company" : "暂无公司"),
      variant,
      authorityState: model.authorityState,
      authorityLabel: formatAuthorityLabel(model.authorityState, english),
      attentionState: model.attentionState,
      attentionLabel: formatAttentionLabel(model.attentionState, english),
      judgementLabel: model.protocol.pageJudgement,
      variantSummary: buildQueueVariantSummary(model.stageKey, english),
      subvariantSummary: buildQueueSubvariantSummary({
        stageKey: model.stageKey,
        issueSubvariant,
        escalationSubvariant,
        renewalSubvariant,
      }),
      advisoryCategoryLabel: model.processAdvisory.categoryLabel,
      advisoryPatternLabel: model.processAdvisory.patternLabel,
      advisoryPlaybookLabel: model.processAdvisory.playbookRecommendation,
      policyModeLabel: model.policySurface.primaryLabel,
      policyModeTone: model.policySurface.primaryTone,
      approvalRequiredLabel: model.policySurface.approvalRequiredLabel,
      internalOnlyLabel: model.policySurface.internalOnlyLabel,
      externalSendDisabledLabel: model.policySurface.externalSendDisabledLabel,
      commitmentDisabledLabel: model.policySurface.commitmentDisabledLabel,
      policySummaryLabel: model.policySurface.queueSummary,
      policyBlockedLabel: model.policySurface.queueBlockedSummary,
      sinceLastSeenLabel:
        model.recentChangesItems[0] ??
        (english
          ? "No material customer success delta has surfaced since the last explicit touch."
          : "自上次显式触达以来，当前没有新的客户成功关键变化。"),
      resurfacedBecauseLabel:
        model.resurfaceReasonItems[0] ??
        (english
          ? "This is back to keep the current boundary, risk and next accountable move explicit."
          : "这条线重新回到这里，是为了继续把当前边界、风险和下一条 accountable 动作说清楚。"),
      stillWaitingLabel: buildStillWaitingLabel({
        attentionState: model.attentionState,
        stageKey: model.stageKey,
        decisionRequest: model.protocol.pageDecisionRequest[0],
        english,
      }),
      stillBlockedLabel: buildStillBlockedLabel({
        attentionState: model.attentionState,
        stageKey: model.stageKey,
        boundarySummary:
          model.protocol.pageBoundarySummary[1] ??
          model.protocol.pageBoundarySummary[0],
        english,
      }),
      stageLabel,
      ownerLabel,
      ownershipPressureLabel: buildOwnershipPressureLabel(
        model.stageKey,
        model.ownershipMode,
        english,
      ),
      decisionPostureLabel:
        model.decisionItems[0] ?? model.protocol.pageJudgementReason,
      progressLabel:
        model.progressTraceItems[0] ??
        (english
          ? "A bounded handoff surface is already prepared."
          : "当前已经准备好一张有边界的交接 面。"),
      internalActionStatusLabel: internalActionCue.statusLabel,
      internalActionStatusTone: internalActionCue.statusTone,
      internalActionResultLabel: internalActionCue.resultLabel,
      externalDraftStatusLabel: externalDraftCue.statusLabel,
      externalDraftStatusTone: externalDraftCue.statusTone,
      externalDraftPolicyLabel: externalDraftCue.policyLabel,
      externalDraftSummaryLabel: externalDraftCue.summaryLabel,
      externalDraftBlockedLabel: externalDraftCue.blockedLabel,
      draftReviewStatusLabel: draftReviewCue.statusLabel,
      draftReviewStatusTone: draftReviewCue.statusTone,
      draftReviewSummaryLabel: draftReviewCue.summaryLabel,
      draftSendHandoffLabel: draftReviewCue.handoffLabel,
      postSendOutcomeStatusLabel: postSendCue.statusLabel,
      postSendOutcomeStatusTone: postSendCue.statusTone,
      postSendOutcomeSummaryLabel: postSendCue.summaryLabel,
      postSendOutcomeBlockedLabel: postSendCue.blockedLabel,
      readinessLabel: readinessCue.label,
      readinessTone: readinessCue.tone,
      nextActionLabel: model.protocol.pageNextAction[0]?.label ?? model.protocol.pageJudgement,
      decisionLabel: model.protocol.pageDecisionRequest[0],
      boundaryLabel: model.protocol.pageBoundarySummary[0],
      evidenceLabel: model.protocol.pageEvidenceSummary[0],
      riskLabel: model.protocol.pagePrioritySignal ?? (english ? "Watch" : "继续观察"),
      href: `/customer-success/${source.detail.id}`,
      successCheckHref: `/success-checks/${source.detail.id}`,
      expansionReviewHref: `/expansion-reviews/${source.detail.id}`,
      inboxHref:
        model.recentThreadId && visibleInboxThreadIds.has(model.recentThreadId)
          ? `/inbox/${model.recentThreadId}`
          : null,
    };
  });

  const queueByOpportunityId = new Map(queueItems.map((item) => [item.id, item]));
  const inboxItems = successInboxThreads.map((thread) => {
    const queueItem = queueByOpportunityId.get(thread.opportunity.id);
    const variant = queueItem?.variant ?? ("follow-through" as const);
    const authorityState =
      queueItem?.authorityState ??
      (thread.shouldReply ? "user-reviewed" : "helm-prepared");
    const attentionState =
      queueItem?.attentionState ??
      deriveInboxAttentionState(thread.status, thread.shouldReply);
    const inboxAdvisoryFallback = buildInboxAdvisoryFallback({
      status: thread.status,
      shouldReply: thread.shouldReply,
      english,
    });
    const inboxPolicyFallback = buildInboxPolicyFallback({
      status: thread.status,
      shouldReply: thread.shouldReply,
      english,
    });
    const inboxDraftFallback = buildInboxDraftFallback({
      status: thread.status,
      shouldReply: thread.shouldReply,
      attentionState,
      english,
    });
    const inboxDraftReviewFallback = buildInboxDraftReviewFallback({
      status: thread.status,
      shouldReply: thread.shouldReply,
      english,
    });
    const inboxPostSendOutcomeFallback = buildInboxPostSendOutcomeFallback({
      status: thread.status,
      shouldReply: thread.shouldReply,
      latestMessage: thread.latestMessage,
      english,
    });

    return {
      id: thread.id,
      subject: thread.subject,
      counterpart: thread.counterpart,
      companyLabel: thread.company?.name ?? (english ? "No company" : "暂无公司"),
      variant,
      authorityState,
      authorityLabel:
        queueItem?.authorityLabel ??
        formatAuthorityLabel(authorityState, english),
      attentionState,
      attentionLabel:
        queueItem?.attentionLabel ??
        formatAttentionLabel(attentionState, english),
      judgementLabel:
        queueItem?.judgementLabel ??
        (english
          ? "Use this thread as a thin customer success routing cue until the next handoff surface is explicit."
          : "当前先把这条线程当作很薄的客户成功 路由 线索，直到下一张交接面 说清为止。"),
      variantSummary:
        queueItem?.variantSummary ??
        (english
          ? "Current thread pressure is visible, but it still sits inside ordinary customer success triage until issue or escalation is explicit."
          : "当前线程压力已经可见，但在问题或升级被明确抬出来之前，它仍停在普通的客户成功 triage 里。"),
      subvariantSummary: queueItem?.subvariantSummary ?? null,
      advisoryCategoryLabel:
        queueItem?.advisoryCategoryLabel ?? inboxAdvisoryFallback.categoryLabel,
      advisoryPatternLabel:
        queueItem?.advisoryPatternLabel ?? inboxAdvisoryFallback.patternLabel,
      advisoryPlaybookLabel:
        queueItem?.advisoryPlaybookLabel ?? inboxAdvisoryFallback.playbookLabel,
      policyModeLabel:
        queueItem?.policyModeLabel ?? inboxPolicyFallback.primaryLabel,
      policyModeTone:
        queueItem?.policyModeTone ?? inboxPolicyFallback.primaryTone,
      approvalRequiredLabel:
        queueItem?.approvalRequiredLabel ?? inboxPolicyFallback.approvalRequiredLabel,
      internalOnlyLabel:
        queueItem?.internalOnlyLabel ?? inboxPolicyFallback.internalOnlyLabel,
      externalSendDisabledLabel:
        queueItem?.externalSendDisabledLabel ??
        inboxPolicyFallback.externalSendDisabledLabel,
      commitmentDisabledLabel:
        queueItem?.commitmentDisabledLabel ??
        inboxPolicyFallback.commitmentDisabledLabel,
      policySummaryLabel:
        queueItem?.policySummaryLabel ?? inboxPolicyFallback.queueSummary,
      policyBlockedLabel:
        queueItem?.policyBlockedLabel ?? inboxPolicyFallback.queueBlockedSummary,
      sinceLastSeenLabel:
        queueItem?.sinceLastSeenLabel ??
        (english
          ? `The linked thread changed on ${formatThreadDateLabel(thread.updatedAt)}.`
          : `关联线程在 ${formatThreadDateLabel(thread.updatedAt)} 后出现了变化。`),
      resurfacedBecauseLabel:
        queueItem?.resurfacedBecauseLabel ??
        (thread.shouldReply
          ? english
            ? "This is back because the thread now needs an explicit next response path."
            : "这条线重新回到这里，是因为当前线程已经需要显式下一条回复路径。"
          : english
            ? "This is back because the linked thread still affects the current customer success route."
            : "这条线重新回到这里，是因为关联线程仍在影响当前客户成功路线。"),
      stillWaitingLabel:
        queueItem?.stillWaitingLabel ??
        (thread.status === "WAITING_THEM"
          ? english
            ? "Still waiting on the next external reply before the route can honestly move."
            : "当前仍在等待下一次外部回复，之后这条路线才能诚实推进。"
          : thread.status === "WAITING_US" || thread.shouldReply
            ? english
              ? "Still waiting on explicit review of the next reply."
              : "当前仍在等待对下一条回复的显式复核。"
            : null),
      stillBlockedLabel:
        queueItem?.stillBlockedLabel ??
        (thread.status === "WAITING_US" && !thread.shouldReply
          ? english
            ? "Still blocked until the next routing decision becomes explicit."
            : "在下一条 路由 判断被说清楚之前，当前仍保持阻塞。"
          : null),
      stageLabel:
        queueItem?.stageLabel ?? fallbackCustomerSuccessStageLabel(english),
      ownerLabel:
        queueItem?.ownerLabel ??
        (english ? "Customer success owns next move" : "由客户成功接手"),
      ownershipPressureLabel:
        queueItem?.ownershipPressureLabel ??
        (english
          ? "Normal customer success handling remains active until widened pressure is explicit."
          : "在 widened 压力被显式抬出来之前，当前仍按普通客户成功处理处理。"),
      decisionPostureLabel:
        queueItem?.decisionPostureLabel ??
        (english
          ? "Current decision posture: keep the thread inside thin inbox triage until the next customer success route is explicit."
          : "当前判断姿态：先把这条线程留在很薄的收件箱 triage 里，直到下一条客户成功 路由 被明确说出来。"),
      progressLabel:
        queueItem?.progressLabel ??
        (attentionState === "blocked"
          ? english
            ? "Blocked by dependency, boundary, or missing decision until the next customer success route is explicit."
            : "当前被依赖、边界或缺失判断阻塞，直到下一条客户成功 路由 被明确说出来。"
          : attentionState === "review-before-send"
            ? english
              ? "Moved into review-before-send before anyone answers from the raw thread."
              : "当前已进入发送前复核，在任何人直接从原始线程作答前先停在复核线。"
            : attentionState === "waiting"
              ? english
                ? "Waiting on the next reply or dependency while the routing cue stays prepared."
                : "当前正在等待下一次回复或依赖，这条 路由 线索会继续保持可用。"
              : english
                ? "A thin inbox routing cue is already prepared."
                : "当前已经准备好一条很薄的收件箱 路由 线索。"),
      internalActionStatusLabel: queueItem?.internalActionStatusLabel ?? null,
      internalActionStatusTone: queueItem?.internalActionStatusTone ?? null,
      internalActionResultLabel: queueItem?.internalActionResultLabel ?? null,
      externalDraftStatusLabel:
        queueItem?.externalDraftStatusLabel ?? inboxDraftFallback.statusLabel,
      externalDraftStatusTone:
        queueItem?.externalDraftStatusTone ?? inboxDraftFallback.statusTone,
      externalDraftPolicyLabel:
        queueItem?.externalDraftPolicyLabel ?? inboxDraftFallback.policyLabel,
      externalDraftSummaryLabel:
        queueItem?.externalDraftSummaryLabel ?? inboxDraftFallback.summaryLabel,
      externalDraftBlockedLabel:
        queueItem?.externalDraftBlockedLabel ?? inboxDraftFallback.blockedLabel,
      draftReviewStatusLabel:
        queueItem?.draftReviewStatusLabel ?? inboxDraftReviewFallback.statusLabel,
      draftReviewStatusTone:
        queueItem?.draftReviewStatusTone ?? inboxDraftReviewFallback.statusTone,
      draftReviewSummaryLabel:
        queueItem?.draftReviewSummaryLabel ?? inboxDraftReviewFallback.summaryLabel,
      draftSendHandoffLabel:
        queueItem?.draftSendHandoffLabel ?? inboxDraftReviewFallback.handoffLabel,
      postSendOutcomeStatusLabel:
        queueItem?.postSendOutcomeStatusLabel ??
        inboxPostSendOutcomeFallback.statusLabel,
      postSendOutcomeStatusTone:
        queueItem?.postSendOutcomeStatusTone ??
        inboxPostSendOutcomeFallback.statusTone,
      postSendOutcomeSummaryLabel:
        queueItem?.postSendOutcomeSummaryLabel ??
        inboxPostSendOutcomeFallback.summaryLabel,
      postSendOutcomeBlockedLabel:
        queueItem?.postSendOutcomeBlockedLabel ??
        inboxPostSendOutcomeFallback.blockedLabel,
      readinessLabel:
        queueItem?.readinessLabel ??
        (english ? "Needs routing cue" : "需要 路由 线索"),
      readinessTone: queueItem?.readinessTone ?? ("sky" as const),
      nextActionLabel:
        queueItem?.nextActionLabel ??
        (thread.opportunity.nextAction ??
          (english ? "Open thread and decide the next route" : "打开线程后判断下一条路线")),
      decisionLabel:
        queueItem?.decisionLabel ??
        (english
          ? "Confirm whether the thread stays review-before-send or can safely pass back into follow-through."
          : "确认这条线程是继续停在发送前复核，还是已经可以安全回到跟进闭环。"),
      boundaryLabel:
        queueItem?.boundaryLabel ??
        (english
          ? "Success inbox is still a derived surface. Thread pressure cannot silently become commitment."
          : "success 收件箱仍是派生面。线程压力不能悄悄变成承诺。"),
      evidenceLabel: thread.latestMessage
        ? trimText(thread.latestMessage.body, 120)
        : english
          ? `${thread.messageCount} messages remain attached to the current success context.`
          : `当前 ${thread.messageCount} 条消息仍挂在现有客户成功上下文上。`,
      riskLabel: queueItem?.riskLabel ?? (english ? "Watch" : "继续观察"),
      href: `/inbox/${thread.id}`,
      customerSuccessHref: `/customer-success/${thread.opportunity.id}`,
    };
  });

  const issueCount = queueItems.filter((item) => item.variant === "issue").length;
  const escalationCount = queueItems.filter(
    (item) => item.variant === "escalation",
  ).length;
  const reviewHoldCount = queueModels.filter(
    (item) => item.sendabilityMode === "review-before-send",
  ).length;
  const topQueueItem = queueItems[0] ?? null;

  const protocol = createPageReportingProtocol({
    pageJudgement: english
      ? "Use customer success queue as a derived operational surface: start with escalation, then issue follow-through, then the rest of the active success chain."
      : "当前应把客户成功队列当作派生运营面：先看升级，再看问题跟进闭环，最后处理其余进行中的客户成功链路。",
    pageJudgementReason: english
      ? `The frozen handoff baseline is already stable, so v1.1 now only adds a thin operational layer: ${queueItems.length} queue items and ${inboxItems.length} success inbox threads derived from existing opportunity, review and thread context.`
      : `当前已冻结的交接基线已经稳定，所以 v1.1 只补一层很薄的运营面：从既有机会、复核和线程上下文派生出 ${queueItems.length} 条队列条目和 ${inboxItems.length} 条客户成功收件箱线程。`,
    pageWhyItMatters: [
      english
        ? "Customer success should no longer inherit work only by opening company detail, review request or generic inbox in the right order."
        : "客户成功不应再靠手动打开公司详情面、复核请求 或泛化收件箱来拼出接手顺序。",
      english
        ? "Issue and escalation need to be explicit enough that repair pressure and widened intervention do not blur together."
        : "问题与升级必须足够显式，保证修复压力和扩大介入不会重新混成一团。",
      english
        ? "Queue and inbox stay derived and thin, so operational clarity can improve without turning this into a workflow or CS ops platform."
        : "队列与收件箱会继续保持派生且很薄，保证这里只提高运营清晰度，而不会滑成工作流 或 客户成功运营平台。",
    ],
    pageActionSummary: [
      english
        ? "Live customer success items are ranked, linked inbox threads are grouped, and each remains tied to the existing handoff detail pages."
        : "当前已经排好实时客户成功条目、分好关联收件箱线程，并继续把它们挂回现有交接详情页。",
      english
        ? "Issue and escalation remain derived from the frozen customer success stage model instead of becoming new canonical objects."
        : "问题与升级会继续从已冻结的客户成功阶段模型 派生，而不是变成新的 权威对象。",
      english
        ? "Contained issues can move back toward success check, while escalations may need to downgrade into review-before-send or blocked-by-boundary before any outward wording appears."
        : "已收口问题可以回到 客户成功验收，而升级只要对外表达会夸大确定性，就必须先降回发送前复核或受阻于边界。",
      english
        ? "The queue does not replace review request, success check, expansion review or inbox detail; it only exposes the next honest operating entry point."
        : "这张队列不会替代复核请求、客户成功验收、拓展复核或收件箱详情面；它只负责把下一条诚实的 经营入口 抬到前台。",
    ],
    pageDecisionRequest: [
      english
        ? "Confirm which item should be taken first by customer success, and which one must stay shared with founder, sales or delivery."
        : "确认哪一条条目现在该由客户成功先接，哪一条必须继续与创始人、销售或交付共享。",
      english
        ? "Confirm which thread or queue item must stay review-before-send or boundary-only before any outward wording appears."
        : "确认哪一条线程或队列条目必须继续停在发送前复核或仅边界，再决定是否产生对外措辞。",
    ],
    pageNextAction: topQueueItem
      ? [
          {
            label: english ? "Open top customer success handoff" : "打开首条客户成功交接",
            href: topQueueItem.href,
          },
          {
            label: english ? "Open top success check" : "打开首条客户成功验收",
            href: topQueueItem.successCheckHref,
            variant: "secondary",
          },
          ...(topQueueItem.inboxHref
            ? [
                {
                  label: english ? "Open top success inbox thread" : "打开首条客户成功收件箱线程",
                  href: topQueueItem.inboxHref,
                  variant: "ghost" as const,
                },
              ]
            : []),
        ]
      : [
          {
            label: english ? "Open reports" : "打开报告",
            href: "/reports",
          },
        ],
    pageBoundarySummary: [
      english
        ? "Customer success queue and success inbox are derived operational surfaces, not canonical systems of record."
        : "客户成功队列和客户成功收件箱都是派生运营面，不是权威记录系统。",
      english
        ? "Issue and escalation can sharpen routing and ownership, but they still cannot convert review, boundary or non-commitment states into commitment."
        : "问题与升级可以提高路由和 负责人清晰度，但它们仍不能把复核、边界或非承诺状态改写成承诺。",
      english
        ? "Any customer-visible wording that risks sounding firmer than the current evidence must stay inside boundary, prerequisite, dependency or review-before-send framing."
        : "任何可能比当前证据 说得更实的客户可见措辞，都必须继续降级到边界、前置、依赖或发送前复核结构里。",
    ],
    pageEvidenceSummary: [
      english
        ? `${queueItems.length} queue items and ${inboxItems.length} linked threads are grouped below as a thin operational appendix.`
        : `当前 ${queueItems.length} 条队列条目和 ${inboxItems.length} 条关联线程都已在下方收成一层很薄的运营附录。`,
      english
        ? "Review traces, handoff reasons, thread replay and risk pressure remain available without replacing the first-screen judgement."
        : "复核轨迹、交接 reason、线程回放和风险压力都保留可看，但不会替代首屏判断。",
    ],
    pageWorkerSummary: [
      english
        ? "Customer success worker keeps review, success check, expansion review and inbox cues aligned to the same frozen handoff baseline."
        : "客户成功执行会持续把复核、客户成功验收、拓展复核和收件箱线索对齐到同一套已冻结的交接基线上。",
      english
        ? "The queue only lifts the next operating entry point. It does not invent a new customer success object or a new review system."
        : "这张队列只负责抬高下一条 经营入口，不会发明新的客户成功对象，也不会发明新的复核系统。",
    ],
    pagePrioritySignal:
      escalationCount > 0
        ? english
          ? "Escalation present"
          : "当前有升级"
        : issueCount > 0
          ? english
            ? "Issue follow-through present"
            : "当前有问题跟进闭环"
          : english
            ? "Follow-through stable"
            : "跟进闭环稳定",
  });

  const evidenceGroups: EvidenceGroup[] = [
    {
      groupId: "queue_trace",
      label: english ? "Queue trace" : "Queue trace",
      items: queueItems.length
        ? queueItems.map(
            (item) =>
              `${item.title} · ${item.stageLabel} · ${item.riskLabel} · ${item.nextActionLabel}`,
          )
        : [
            english
              ? "No active customer success queue items yet."
              : "当前还没有进行中的客户成功队列条目。",
          ],
    },
    {
      groupId: "inbox_trace",
      label: english ? "Success inbox trace" : "Success inbox trace",
      items: inboxItems.length
        ? inboxItems.map(
            (item) =>
              `${item.subject} · ${item.counterpart} · ${item.stageLabel} · ${item.riskLabel}`,
          )
        : [
            english
              ? "No linked success inbox threads yet."
              : "当前还没有关联的客户成功收件箱线程。",
          ],
    },
    {
      groupId: "handoff_trace",
      label: english ? "Handoff trace" : "Handoff trace",
      items: [
        english
          ? "review request → customer success → success check → expansion review remains the mainline."
          : "复核请求 → 客户成功 → 客户成功验收 → 拓展复核仍是主线。",
        english
          ? "Queue and inbox only expose the next derived operating layer around that mainline."
          : "队列与收件箱只是在这条主线周围补一层派生运营层。",
      ],
    },
  ];

  const immediateActions: FastPathItem[] = queueItems.slice(0, 3).map((item) => ({
    label: item.nextActionLabel,
    hint: english
      ? `${item.ownerLabel} should pick up ${item.title} now because ${item.judgementLabel}`
      : `${item.ownerLabel} 现在就该接住 ${item.title}，因为 ${item.judgementLabel}`,
    href: item.href,
  }));

  const decisionsWaiting: FastPathItem[] = queueItems.slice(0, 3).map((item) => ({
    label: item.decisionLabel,
    hint: english
      ? `${item.title} still needs an explicit decision owner before the next customer success move can stay honest.`
      : `${item.title} 仍需要显式判断负责人，这样下一步客户成功动作才能继续保持诚实。`,
    href: item.successCheckHref,
  }));

  const blockersToClear: FastPathItem[] = queueItems
    .filter((item) => item.stillBlockedLabel || item.policyBlockedLabel)
    .slice(0, 3)
    .map((item) => ({
      label: item.title,
      hint:
        item.stillBlockedLabel ??
        item.policyBlockedLabel ??
        item.boundaryLabel,
      href: item.href,
    }));

  const actionTemplates = buildFastPathTemplateItems(english);

  const retroFeedback: FastPathItem[] = queueItems.slice(0, 3).map((item) => ({
    label: english
      ? `${item.title} → success memory / campaign`
      : `${item.title} → success memory / campaign`,
    hint: english
      ? `Write the newest issue, escalation or follow-through result back so ${item.title} stops re-entering the queue as the same unresolved story.`
      : `把最新的问题、升级或跟进闭环结果回挂进去，避免 ${item.title} 继续以同一个未解故事反复回到队列。`,
    href: item.successCheckHref,
  }));

  return {
    rootDataAttributes: {
      "data-customer-success-queue-surface": "true",
      "data-success-inbox-surface": "true",
      "data-customer-success-process-advisory": "true",
      "data-customer-success-policy-surface": "true",
      "data-customer-success-external-draft-surface": "true",
      "data-customer-success-draft-review-handoff": "true",
      "data-customer-success-post-send-outcome": "true",
    },
    eyebrow: english
      ? "Customer success chain / Queue and inbox"
      : "客户成功链路 / 队列与收件箱",
    title: english
      ? "Customer Success Queue / Inbox v1.1"
      : "Customer Success Queue / Inbox v1.1",
    description: english
      ? `${queueItems.length} queue items · ${issueCount} issues · ${escalationCount} escalations · ${inboxItems.length} inbox threads`
      : `${queueItems.length} 条队列条目 · ${issueCount} 条问题 · ${escalationCount} 条升级 · ${inboxItems.length} 条收件箱线程`,
    briefingLabel: english
      ? "Current customer success operating judgement"
      : "当前客户成功运营判断",
    protocol,
    chips: [
      {
        label: english ? "Prepared review surface" : "待复核结果面",
        tone: "sky",
      },
      {
        label: english ? "Derived success queue" : "派生 success 队列",
        tone: "sky",
      },
      {
        label: english ? "Derived success inbox" : "派生 success 收件箱",
        tone: "violet",
      },
      {
        label:
          escalationCount > 0
            ? english
              ? `${escalationCount} escalations`
              : `${escalationCount} 条升级`
            : reviewHoldCount > 0
              ? english
                ? `${reviewHoldCount} review holds`
                : `${reviewHoldCount} 条复核 持守`
              : english
                ? "No active escalation"
                : "当前无 active 升级",
        tone: escalationCount > 0 ? "amber" : "emerald",
      },
    ],
    secondarySummaryItems: [
      {
        label: english ? "Queue items" : "Queue 项",
        value: `${queueItems.length}`,
      },
      {
        label: english ? "Issue follow-through" : "Issue 跟进",
        value: `${issueCount}`,
      },
      {
        label: english ? "Escalation follow-through" : "升级跟进",
        value: `${escalationCount}`,
      },
      {
        label: english ? "Review holds" : "Review hold",
        value: `${reviewHoldCount}`,
      },
      {
        label: english ? "Success inbox threads" : "Success 收件箱线程",
        value: `${inboxItems.length}`,
      },
    ],
    boundaryLabel: english
      ? "Boundary, sendability and non-commitment"
      : "边界、发送性与非承诺",
    actionLabel: english ? "Available next actions" : "可直接执行的动作",
    evidenceLabel: english ? "Evidence drawer" : "证据抽屉",
    evidenceCountLabel: english
      ? `${evidenceGroups.length} grouped tracks`
      : `${evidenceGroups.length} 组依据`,
    immediateActions,
    decisionsWaiting,
    blockersToClear,
    actionTemplates,
    retroFeedback,
    evidenceGroups,
    queueItems,
    inboxItems,
  };
}

function readSummaryValue(
  items: SecondarySummaryItem[],
  label: string,
) {
  return items.find((item) => item.label === label)?.value ?? "-";
}

function fallbackCustomerSuccessStageLabel(english: boolean) {
  return english ? "Success follow-through" : "Success 跟进";
}

function formatThreadDateLabel(date: Date) {
  return formatDateLabel(date);
}

function formatAuthorityLabel(
  authorityState: CustomerSuccessAuthorityState,
  english: boolean,
) {
  return formatAgentAuthorityState(authorityState, english);
}

function formatAttentionLabel(
  attentionState: CustomerSuccessAttentionState,
  english: boolean,
) {
  return formatAgentAttentionState(attentionState, english);
}

function deriveInboxAttentionState(
  status: SuccessInboxThreadInput["status"],
  shouldReply: boolean,
): CustomerSuccessAttentionState {
  if (status === "WAITING_US" && shouldReply) {
    return "review-before-send";
  }

  if (status === "WAITING_THEM") {
    return "waiting";
  }

  if (status === "OPEN" && shouldReply) {
    return "pushing";
  }

  if (status === "CLOSED") {
    return "watching";
  }

  return "watching";
}

function buildInboxAdvisoryFallback({
  status,
  shouldReply,
  english,
}: {
  status: SuccessInboxThreadInput["status"];
  shouldReply: boolean;
  english: boolean;
}) {
  if (status === "WAITING_US" && shouldReply) {
    return {
      categoryLabel: english
        ? "Repeated review-before-send"
        : "反复回到发送前复核",
      patternLabel: english
        ? "The thread still needs explicit review before any customer-success reply should sound firmer."
        : "当前线程在任何客户成功回复说得更实之前，仍然需要显式复核。",
      playbookLabel: english
        ? "Keep review-before-send explicit, tighten the reply ask, and widen only internal visibility for now."
        : "继续把发送前复核留在前台，收紧回复 请求，当前只扩大内部可见度。",
    };
  }

  if (status === "WAITING_THEM") {
    return {
      categoryLabel: english ? "Blocked by dependency" : "被依赖卡住",
      patternLabel: english
        ? "The thread is still waiting on an external dependency, so more internal certainty would mostly overstate progress."
        : "当前线程仍在等待外部依赖，如果内部说得更实，大多只会夸大进展。",
      playbookLabel: english
        ? "Keep the dependency visible, watch for a meaningful reply, and avoid speaking as if the route is already resolved."
        : "继续把依赖留在前台，等待有意义的回复，并避免把这条路线说成已经解决。",
    };
  }

  return {
    categoryLabel: english ? "Missing decision" : "缺少判断",
    patternLabel: english
      ? "The next bounded routing decision is still the main limiter on honest thread handling."
      : "当前最主要的限制项仍是下一条有边界的 路由 判断还没有说清。",
    playbookLabel: english
      ? "Request the bounded routing decision first and keep the thread inside thin customer success triage until it is explicit."
      : "先请求这条有边界的 路由 判断，并在它被明确前让线程继续停在很薄的客户成功 triage 里。",
  };
}

function buildInboxPolicyFallback({
  status,
  shouldReply,
  english,
}: {
  status: SuccessInboxThreadInput["status"];
  shouldReply: boolean;
  english: boolean;
}) {
  const approvalRequired = status === "WAITING_US" || shouldReply;

  return {
    primaryLabel: approvalRequired
      ? english
        ? "Approval required"
        : "需要批准"
      : english
        ? "Advisory only"
        : "仅 advisory",
    primaryTone: approvalRequired ? ("amber" as const) : ("sky" as const),
    approvalRequiredLabel: approvalRequired
      ? english
        ? "Requires your approval"
        : "需要你批准"
      : null,
    internalOnlyLabel: english ? "Internal only" : "仅内部可见",
    externalSendDisabledLabel: english
      ? "External send disabled"
      : "外发已禁用",
    commitmentDisabledLabel: english
      ? "Commitment disabled"
      : "承诺已禁用",
    queueSummary: approvalRequired
      ? english
        ? "The next reply path can be prepared here, but any internal execution still needs your explicit approval."
        : "这里可以先准备下一条回复路径，但任何内部执行仍需要你显式批准。"
      : english
        ? "This thread remains a thin advisory routing cue; it can prepare and recommend, not send."
        : "当前线程仍是很薄的 advisory 路由 线索；这里只能准备和建议，不能发送。",
    queueBlockedSummary:
      status === "WAITING_THEM"
        ? english
          ? "The thread is still waiting on an external dependency, while external send and commitment remain disabled on this surface."
          : "当前线程仍在等待外部依赖，这一面 仍继续禁用 对外发送 和承诺。"
        : english
          ? "This thread remains internal-only on this surface, with external send and commitment still disabled."
          : "这条线程在当前面 仍只允许仅内部动作，对外发送 和承诺继续禁用。",
  };
}

function buildInternalActionQueueCue(
  internalActions: ReturnType<typeof buildCustomerSuccessHandoffPageModel>["internalActions"],
  english: boolean,
) {
  const approvedAction = internalActions.find(
    (item) => item.state === "user-approved-to-execute",
  );
  if (approvedAction) {
    return {
      statusLabel: english
        ? `Internal action ready: ${approvedAction.title}`
        : `内部动作已就绪：${approvedAction.title}`,
      statusTone: "violet" as const,
      resultLabel: null,
    };
  }

  const awaitingApprovalAction = internalActions.find(
    (item) =>
      item.state === "helm-prepared" ||
      item.state === "user-reviewed" ||
      item.state === "user-backed",
  );
  if (awaitingApprovalAction) {
    return {
      statusLabel: english
        ? `Awaiting user approval: ${awaitingApprovalAction.title}`
        : `等待用户批准：${awaitingApprovalAction.title}`,
      statusTone: "amber" as const,
      resultLabel: null,
    };
  }

  const executedAction = internalActions.find(
    (item) => item.state === "executed-internally",
  );
  if (executedAction) {
    return {
      statusLabel: english
        ? `Internal step executed: ${executedAction.title}`
        : `内部步骤已执行：${executedAction.title}`,
      statusTone: "emerald" as const,
      resultLabel:
        executedAction.resultSummary ??
        (english
          ? "A low-risk internal customer success step has already been executed."
          : "一条低风险的客户成功内部动作已经执行。"),
    };
  }

  return {
    statusLabel: null,
    statusTone: null,
    resultLabel: null,
  };
}

function buildExternalDraftQueueCue(
  externalDrafts: ReturnType<typeof buildCustomerSuccessHandoffPageModel>["externalDrafts"],
  english: boolean,
) {
  const draft = externalDrafts[0] ?? null;
  if (!draft) {
    return {
      statusLabel: null,
      statusTone: null,
      policyLabel: null,
      summaryLabel: null,
      blockedLabel: null,
    };
  }

  return {
    statusLabel: draft.queueStatusLabel,
    statusTone: draft.queueStatusTone,
    policyLabel:
      draft.policyCueLabels
        .slice(0, 3)
        .map((item) => item.label)
        .join(" · ") ||
      (english
        ? "Draft only · review before send"
        : "仅草稿 · 发送前复核"),
    summaryLabel: draft.queueSummary,
    blockedLabel: draft.queueBlockedSummary,
  };
}

function buildExternalDraftReviewQueueCue(
  externalDrafts: ReturnType<typeof buildCustomerSuccessHandoffPageModel>["externalDrafts"],
  english: boolean,
) {
  const draft = externalDrafts[0] ?? null;
  if (!draft) {
    return {
      statusLabel: null,
      statusTone: null,
      summaryLabel: null,
      handoffLabel: null,
    };
  }

  return {
    statusLabel: draft.reviewOutcome.queueStatusLabel,
    statusTone: draft.reviewOutcome.queueStatusTone,
    summaryLabel: draft.reviewOutcome.queueSummary,
    handoffLabel:
      draft.reviewOutcome.queueHandoffSummary ??
      (english
        ? "External send still stays disabled on this surface."
        : "这一面 仍然禁用对外发送。"),
  };
}

function buildExternalDraftPostSendQueueCue(
  externalDrafts: ReturnType<typeof buildCustomerSuccessHandoffPageModel>["externalDrafts"],
  english: boolean,
) {
  const draft = externalDrafts[0] ?? null;
  if (!draft?.postSendOutcome) {
    return {
      statusLabel: null,
      statusTone: null,
      summaryLabel: null,
      blockedLabel: null,
    };
  }

  return {
    statusLabel: draft.postSendOutcome.queueStatusLabel,
    statusTone: draft.postSendOutcome.queueStatusTone,
    summaryLabel: draft.postSendOutcome.queueSummary,
    blockedLabel:
      draft.postSendOutcome.queueBlockedSummary ??
      (english
        ? "Send authority stays disabled, and the outcome still counts only as derived working context."
        : "发送权限仍然禁用，而且当前结果仍只被当作派生工作上下文处理。"),
  };
}

function buildInboxDraftFallback({
  status,
  shouldReply,
  attentionState,
  english,
}: {
  status: SuccessInboxThreadInput["status"];
  shouldReply: boolean;
  attentionState: CustomerSuccessAttentionState;
  english: boolean;
}) {
  if (status === "CLOSED" && !shouldReply) {
    return {
      statusLabel: null,
      statusTone: null,
      policyLabel: null,
      summaryLabel: null,
      blockedLabel: null,
    };
  }

  const reviewHeavy =
    attentionState === "review-before-send" ||
    status === "WAITING_US" ||
    shouldReply;
  const boundaryLimited =
    attentionState === "blocked" || status === "WAITING_THEM";

  return {
    statusLabel: english ? "External draft prepared" : "已准备外部草稿",
    statusTone: reviewHeavy ? ("amber" as const) : ("violet" as const),
    policyLabel: boundaryLimited
      ? english
        ? "Draft only · review before send · boundary limited"
        : "仅草稿 · 发送前复核 · 受边界限制"
      : english
        ? "Draft only · review before send · not customer-sendable yet"
        : "仅草稿 · 发送前复核 · 暂不可对外发送",
    summaryLabel: reviewHeavy
      ? english
        ? "A review-held external draft is already prepared so the next customer-facing line can be checked before anyone replies."
        : "当前已经准备好一条停在复核线上的外部草稿，让下一条客户可见表达在任何人回复前先被检查。"
      : english
        ? "A bounded holding draft is already prepared so the thread can progress without sounding firmer than the current evidence."
        : "当前已经准备好一条有边界的 持守中 草稿，让线程继续推进，但不会说得比当前证据 更实。",
    blockedLabel: boundaryLimited
      ? english
        ? "Draft remains blocked by dependency, boundary, or the next missing decision."
        : "当前草稿仍被依赖、边界或下一条缺失判断卡住。"
      : reviewHeavy
        ? english
          ? "Draft remains review-before-send and cannot be treated as customer-sendable yet."
          : "当前草稿仍停在发送前复核，暂时不能被当作可对外发送。"
        : english
          ? "Draft still requires human review before any send could even be considered."
          : "在任何发送被考虑之前，这条草稿仍需要人工复核。",
  };
}

function buildInboxDraftReviewFallback({
  status,
  shouldReply,
  english,
}: {
  status: SuccessInboxThreadInput["status"];
  shouldReply: boolean;
  english: boolean;
}) {
  if (status === "CLOSED" && !shouldReply) {
    return {
      statusLabel: null,
      statusTone: null,
      summaryLabel: null,
      handoffLabel: null,
    };
  }

  return {
    statusLabel: english ? "Review pending" : "等待复核",
    statusTone: "amber" as const,
    summaryLabel: english
      ? "The draft still needs explicit human review before any manual handoff could even be considered."
      : "在任何手动交接被考虑之前，这条草稿仍需要显式人工复核。",
    handoffLabel: english
      ? "No human send handoff is recorded yet, and external send still stays disabled on this surface."
      : "当前还没有记录到人工发送交接，而且这一面 仍然禁用对外发送。",
  };
}

function buildInboxPostSendOutcomeFallback({
  status,
  shouldReply,
  latestMessage,
  english,
}: {
  status: SuccessInboxThreadInput["status"];
  shouldReply: boolean;
  latestMessage: SuccessInboxThreadInput["latestMessage"];
  english: boolean;
}) {
  if (status === "CLOSED" && !shouldReply) {
    return {
      statusLabel: null,
      statusTone: null,
      summaryLabel: null,
      blockedLabel: null,
    };
  }

  if (latestMessage?.isInbound) {
    const clarificationRequested = /clarif|question|unclear|confirm|which|what|when|how|need more|dependency/i.test(
      latestMessage.body,
    );
    return {
      statusLabel: clarificationRequested
        ? english
          ? "Clarification requested"
          : "已要求澄清"
        : english
          ? "External reply received"
          : "已收到外部回复",
      statusTone: clarificationRequested ? ("amber" as const) : ("violet" as const),
      summaryLabel: clarificationRequested
        ? english
          ? `The latest inbound reply asks for clarification: ${trimText(latestMessage.body, 118)}`
          : `最新 inbound 回应正在要求澄清：${trimText(latestMessage.body, 118)}`
        : english
          ? `A new inbound reply surfaced after the last outward move: ${trimText(latestMessage.body, 118)}`
          : `在最近一次对外动作之后，当前出现了新的 inbound 回应：${trimText(latestMessage.body, 118)}`,
      blockedLabel: clarificationRequested
        ? english
          ? "The line still needs a bounded clarification response and remains non-commitment."
          : "当前仍需要一条有边界的澄清回复，并继续保持非承诺。"
        : english
          ? "The reply still counts as derived outcome context, not as send authority or cleared certainty."
          : "这条回复仍只算派生结果上下文，而不是发送权限或已清晰确定性。",
    };
  }

  if (status === "WAITING_THEM") {
    return {
      statusLabel: english ? "Awaiting external outcome" : "等待外部结果",
      statusTone: "sky" as const,
      summaryLabel: english
        ? "The thread is still waiting for the first meaningful external outcome after the latest outward move."
        : "当前线程仍在等待最近一次对外动作之后的第一条可见的外部结果。",
      blockedLabel: english
        ? "Silence still does not count as confirmation, sendability, or commitment."
        : "当前沉默仍然不等于确认、可发送或承诺。",
    };
  }

  return {
    statusLabel: null,
    statusTone: null,
    summaryLabel: null,
    blockedLabel: null,
  };
}

function buildStillWaitingLabel({
  attentionState,
  stageKey,
  decisionRequest,
  english,
}: {
  attentionState: CustomerSuccessAttentionState;
  stageKey: ReturnType<typeof buildCustomerSuccessHandoffPageModel>["stageKey"];
  decisionRequest: string;
  english: boolean;
}) {
  if (attentionState === "review-before-send") {
    return english
      ? "Still waiting on explicit review before any outward wording appears."
      : "当前仍在等待显式复核，在任何对外措辞出现前不能继续往外说。";
  }

  if (attentionState !== "waiting") {
    return null;
  }

  if (stageKey === "review-follow-through") {
    return english
      ? "Still waiting on the open review path before the follow-through line can move."
      : "当前仍在等待开放中的复核路径，之后这条跟进闭环才能继续推进。";
  }

  return english
    ? `Still waiting on: ${trimText(decisionRequest, 110)}`
    : `当前仍在等待：${trimText(decisionRequest, 110)}`;
}

function buildStillBlockedLabel({
  attentionState,
  stageKey,
  boundarySummary,
  english,
}: {
  attentionState: CustomerSuccessAttentionState;
  stageKey: ReturnType<typeof buildCustomerSuccessHandoffPageModel>["stageKey"];
  boundarySummary: string;
  english: boolean;
}) {
  if (
    attentionState !== "blocked" &&
    stageKey !== "blocked-by-boundary" &&
    stageKey !== "escalation-follow-through"
  ) {
    return null;
  }

  return english
    ? `Still blocked by: ${trimText(boundarySummary, 120)}`
    : `当前仍被以下事项卡住：${trimText(boundarySummary, 120)}`;
}

function buildQueueVariantSummary(
  variantStage: Parameters<typeof buildQueueReadinessCue>[0],
  english: boolean,
) {
  if (variantStage === "escalation-follow-through") {
    return english
      ? "Escalation follow-through: progress is materially blocked by dependency, boundary, missing decision, widened ownership pressure, or elevated execution risk."
      : "升级跟进闭环：当前进展已经被依赖、边界、缺失判断、扩大后的 负责人压力或更高 执行风险实质性阻塞。";
  }

  if (variantStage === "issue-follow-through") {
    return english
      ? "Issue follow-through: a real follow-through problem is visible, but the repair path still remains inside normal current-round coordination."
      : "问题跟进闭环：当前已经出现真实跟进闭环问题，但修复路径仍停在正常这一轮协调范围内。";
  }

  return english
    ? "Follow-through remains inside the normal customer success path until issue or escalation pressure needs to be made explicit."
    : "在问题或升级压力需要被显式抬出来之前，当前仍停在普通客户成功路径上。";
}

function buildQueueSubvariantSummary({
  stageKey,
  issueSubvariant,
  escalationSubvariant,
  renewalSubvariant,
}: {
  stageKey: ReturnType<typeof buildCustomerSuccessHandoffPageModel>["stageKey"];
  issueSubvariant: string;
  escalationSubvariant: string;
  renewalSubvariant: string;
}) {
  if (stageKey === "escalation-follow-through") {
    return [escalationSubvariant, renewalSubvariant]
      .filter((item) => item && item !== "-")
      .join(" · ");
  }

  if (stageKey === "issue-follow-through") {
    return [issueSubvariant, renewalSubvariant]
      .filter((item) => item && item !== "-")
      .join(" · ");
  }

  return [renewalSubvariant, issueSubvariant]
    .filter((item) => item && item !== "-")
    .join(" · ");
}

function buildOwnershipPressureLabel(
  stage: Parameters<typeof buildQueueReadinessCue>[0],
  ownerLabel: string,
  english: boolean,
) {
  if (stage === "escalation-follow-through") {
    return english
      ? `${ownerLabel} now carries widened ownership pressure.`
      : `当前由「${ownerLabel}」承接扩大后的接手压力。`;
  }

  if (stage === "issue-follow-through") {
    return english
      ? `${ownerLabel} still handles this inside the normal customer success path.`
      : `当前仍由「${ownerLabel}」在客户成功常规路径内处理。`;
  }

  return english
    ? `${ownerLabel} keeps the current-round follow-through line visible.`
    : `当前由「${ownerLabel}」继续把这一轮后续推进挂在前台。`;
}

function buildQueueReadinessCue(
  stage: QueueDetailInput["detail"] extends never ? never : ReturnType<
    typeof buildCustomerSuccessHandoffPageModel
  >["stageKey"],
  sendabilityMode: ReturnType<typeof buildCustomerSuccessHandoffPageModel>["sendabilityMode"],
  fallbackMode: ReturnType<typeof buildCustomerSuccessHandoffPageModel>["fallbackMode"],
  english: boolean,
) {
  if (stage === "escalation-follow-through") {
    return {
      label: english
        ? "Blocked until widened decision"
        : "在 widened 判断前保持阻塞",
      tone: "amber" as const,
    };
  }

  if (stage === "issue-follow-through") {
    return {
      label: english ? "Contained if repair closes" : "修复收口后可转回",
      tone: "violet" as const,
    };
  }

  if (stage === "review-follow-through" || sendabilityMode === "review-before-send") {
    return {
      label: english ? "Held at review line" : "当前停在复核话术",
      tone: "amber" as const,
    };
  }

  if (stage === "blocked-by-boundary" || fallbackMode === "blocked-by-boundary") {
    return {
      label: english ? "Blocked by boundary" : "当前被边界阻塞",
      tone: "amber" as const,
    };
  }

  if (stage === "activation-follow-through") {
    return {
      label: english ? "Ready for activation" : "适合激活跟进",
      tone: "emerald" as const,
    };
  }

  if (stage === "expansion-review") {
    return {
      label: english ? "Ready for expansion review" : "适合拓展复核",
      tone: "emerald" as const,
    };
  }

  return {
    label: english ? "Ready for follow-through" : "适合跟进闭环",
    tone: "emerald" as const,
  };
}
