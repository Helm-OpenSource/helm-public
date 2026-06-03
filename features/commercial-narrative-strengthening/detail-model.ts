import type {
  CommercialNarrativeStrengtheningAudienceMode,
  CommercialNarrativeStrengtheningDetailReportingContract,
  CommercialNarrativeStrengtheningEvidenceGroup,
  CommercialNarrativeStrengtheningFallbackMode,
  CommercialNarrativeStrengtheningIntent,
  CommercialNarrativeStrengtheningLevel,
  CommercialNarrativeStrengtheningRiskSignal,
  CommercialNarrativeStrengtheningSendabilityMode,
} from "@/lib/presentation/commercial-narrative-strengthening-contract";
import { createCommercialNarrativeStrengtheningDetailReportingContract } from "@/lib/presentation/commercial-narrative-strengthening-contract";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import { formatDateLabel, formatRelative, trimText } from "@/lib/utils";

export function buildCommercialNarrativeStrengtheningPageContract({
  detail,
  english,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
}): CommercialNarrativeStrengtheningDetailReportingContract {
  const signals = summarizeSignals(detail);
  const strengtheningLevel = getStrengtheningLevel(detail, signals);
  const audienceMode = getAudienceMode(strengtheningLevel);
  const sendabilityMode = getSendabilityMode(strengtheningLevel);
  const fallbackMode = getFallbackMode(strengtheningLevel);
  const intent = getIntent(detail, strengtheningLevel, signals);
  const riskSignal = mapRiskSignal(detail.riskLevel, signals);

  return createCommercialNarrativeStrengtheningDetailReportingContract({
    strengtheningJudgement: buildJudgement(
      strengtheningLevel,
      sendabilityMode,
      english,
    ),
    strengtheningJudgementReason:
      detail.briefingSnapshot?.payload.summary ??
      (english
        ? "The current strengthening surface already brings commercial narrative pressure, the trust line, open commitments and sendability temperature together."
        : "当前这张加固决策面已经把商业叙事压力、信任话术、开放承诺和发送评估温度收在一起。"),
    strengtheningActionSummary: [
      english
        ? "The current page already separates recommendation-only, exploratory, pilot, customer-visible and fallback narrative layers."
        : "当前页已经把仅建议、探索性、试点、客户可见和兜底叙事层分开了。",
      signals.pendingApprovalCount
        ? english
          ? `${signals.pendingApprovalCount} approval-sensitive actions remain open, so stronger narrative cannot silently cross into customer-visible commitment.`
          : `当前仍有 ${signals.pendingApprovalCount} 条审批敏感动作未收口，所以更强的叙事不能悄悄越过客户可见承诺边界。`
        : english
          ? "The current strengthening path, sendability gate and fallback line are already grouped into one decision page."
          : "当前加固路径、发送评估闸口和兜底话术都已经被收进同一页决策面。",
      english
        ? "You do not need to infer strengthening level from scattered notes first; the current layer is already explicit."
        : "你不需要先从零散备注里倒推加固层级；当前层级已经说清楚了。",
    ],
    strengtheningDecisionRequest: [
      english
        ? `Confirm whether this should stay ${labelForLevel(strengtheningLevel, true)} or step back into ${fallbackLabel(fallbackMode, true)}.`
        : `确认这版当前是继续保持「${labelForLevel(strengtheningLevel, false)}」，还是需要退回「${fallbackLabel(fallbackMode, false)}」。`,
      english
        ? "Confirm who owns the next wording pass, and whether founder, sales or delivery must review it before anything customer-visible gets stronger."
        : "确认下一轮措辞由谁接，以及在任何客户可见表达继续变强之前，是否需要创始人、销售或交付先复核。",
    ],
    strengtheningBoundarySummary: [
      english
        ? "Commercial narrative strengthening can raise confidence and clarity, but it still cannot silently harden recommendation into commitment."
        : "商业叙事加固可以抬高信心和清晰度，但它仍然不能悄悄把建议硬化成承诺。",
      buildBoundaryLine(
        strengtheningLevel,
        sendabilityMode,
        fallbackMode,
        english,
      ),
      english
        ? "Exploratory, discussion-only, boundary-only and review-before-send wording still do not equal commitment."
        : "探索性、仅讨论、仅边界和发送前复核措辞仍然不等于承诺。",
    ],
    strengtheningEvidenceSummary: [
      english
        ? `${detail.auditLogs.length} audit changes, ${detail.actionItems.length} linked actions and the full strengthening trace are grouped below without interrupting the main narrative.`
        : `当前 ${detail.auditLogs.length} 条审计变化、${detail.actionItems.length} 条关联动作和完整加固轨迹已经分组收在下面，不会打断主叙事。`,
      english
        ? "Replay, audit, memory, worker output, boundary trace, sendability trace, strengthening trace, fallback trace and historical changes remain available on demand."
        : "回放、审计、经营记忆、执行输出、边界轨迹、发送评估轨迹、加固轨迹、兜底轨迹和历史变更都保留在附注层按需可看。",
    ],
    strengtheningWorkerSummary: [
      english
        ? "Sales worker keeps recommendation-only, pilot-strengthening and customer-visible narrative layers aligned to one commercial line."
        : "销售执行会持续把仅建议、试点加固和客户可见的叙事层对齐到同一条商业推进线上。",
      english
        ? "Founder / delivery review keeps sendability, promise pressure and trust-sensitive wording from being overstated too early."
        : "创始人 / 交付复核会持续防止发送评估、承诺压力和信任敏感 措辞被过早说实。",
    ],
    strengtheningNextAction: buildNextActions({
      id: detail.id,
      sendabilityMode,
      english,
    }),
    strengtheningRiskSignal: riskSignal,
    strengtheningLevel,
    strengtheningIntent: intent,
    strengtheningAudienceMode: audienceMode,
    strengtheningFallbackMode: fallbackMode,
    strengtheningSendabilityMode: sendabilityMode,
    strengtheningEvidenceGroups: buildEvidenceGroups(
      detail,
      strengtheningLevel,
      sendabilityMode,
      fallbackMode,
      english,
    ),
    strengtheningCustomerVisibleCue: english
      ? "Only strengthening that keeps scope, timing and outcome wording reversible may become customer-visible."
      : "只有仍然保持范围、时点和结果措辞可回退的加固，才允许继续变成客户可见。",
    strengtheningInternalOnlyCue: english
      ? "Internal objections, dependency repair and unresolved trust notes remain internal-only."
      : "internal 异议、依赖修复和未解决的信任备注仍然只适合仅内部。",
    strengtheningFallbackCue: english
      ? "When strengthening pressure runs ahead of evidence or boundary clarity, Helm falls back to non-commitment or boundary-only wording first."
      : "一旦加固压力跑在证据或边界清晰度前面，Helm 会先退回非承诺或仅边界措辞。",
    pageWhyItMatters: [
      english
        ? `The opportunity is already at ${detail.stageLabel}, so the current narrative layer now changes trust, urgency and whether the next move warms up or overreaches.`
        : `当前机会已经来到「${detail.stageLabel}」窗口，所以叙事层现在会直接改变信任、紧迫感以及下一步动作是继续升温还是过度伸出。`,
      signals.openCommitmentCount
        ? english
          ? `${signals.openCommitmentCount} open commitments are still shaping trust pressure, so stronger wording cannot pretend certainty that has not been earned yet.`
          : `当前仍有 ${signals.openCommitmentCount} 条开放承诺在塑造信任压力，所以更强的措辞不能假装已经获得了还没被兑现的确定性。`
        : english
          ? "There is room to strengthen the story, but only if sendability and non-commitment remain explicit."
          : "当前确实存在强化商业叙事的空间，但前提是发送评估和非承诺必须持续显式可见。",
      english
        ? "The current page already separates what can get stronger from what must remain soft, review-bound or fallback-safe, so the remaining value is choosing the right layer rather than rediscovering context."
        : "当前页已经把哪些可以更强、哪些必须继续保持柔性、复核-bound 或兜底安全分开了，所以现在真正的价值在于选对层级，而不是重新拼上下文。",
    ],
    pageEscalationHint:
      strengtheningLevel === "blocked-strengthening" ||
      sendabilityMode === "review-before-send" ||
      sendabilityMode === "not-safe-to-send"
        ? english
          ? "If anyone wants to harden promise, timing or outcome certainty, escalate into approvals before the next strengthening move becomes customer-visible."
          : "如果任何人想把承诺、时点或结果确定性说实，就先升级进审批，再允许下一步加固动作变成客户可见。"
        : english
          ? "If trust pressure or dependency pressure rises, step back from strengthening and return to boundary-led review first."
          : "如果信任压力或依赖压力开始上升，就先从加固退回边界-led 复核。",
    pageEvidenceLinks: [
      {
        label: english
          ? "Open reinforcement variants page"
          : "打开加固变体s 页面",
        href: `/reinforcement-variants/${detail.id}`,
      },
      {
        label: english ? "Open sendability page" : "打开发送评估页面",
        href: `/sendability/${detail.id}`,
      },
      {
        label: english ? "Open memory trace" : "查看记忆痕迹",
        href: `/memory?objectType=OPPORTUNITY&objectId=${detail.id}`,
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
  const missingPrerequisiteCount = [
    detail.ownerName ? 0 : 1,
    detail.nextAction ? 0 : 1,
  ].reduce((sum, value) => sum + value, 0);
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

function getStrengtheningLevel(
  detail: ProposalPackageCommercialDetail,
  signals: ReturnType<typeof summarizeSignals>,
): CommercialNarrativeStrengtheningLevel {
  if (
    !detail.nextAction &&
    !detail.briefingSnapshot?.payload.recommendedNextSteps?.length &&
    signals.workerPreparedCount < 2
  ) {
    return "recommendation-only";
  }
  if (detail.riskLevel === "CRITICAL" || signals.pendingApprovalCount > 1) {
    return "blocked-strengthening";
  }
  if (detail.riskLevel === "HIGH" || signals.blockerCount > 0) {
    return "risk-reduction-required";
  }
  if (signals.pendingApprovalCount > 0) {
    return "review-before-send";
  }
  if (signals.openCommitmentCount > 1) {
    return "non-commitment-fallback";
  }

  switch (detail.stageCode) {
    case "NEW":
    case "CONTACTED":
      return "exploratory-strengthening";
    case "ADVANCING":
      return "pilot-strengthening";
    case "WAITING_THEM":
    case "DONE":
      return signals.workerPreparedCount > 3
        ? "customer-visible-structured"
        : "customer-visible-light";
    case "INTERNAL_SYNC":
      return "boundary-only";
    case "LOST":
      return "non-commitment-fallback";
    default:
      return "recommendation-only";
  }
}

function getAudienceMode(
  level: CommercialNarrativeStrengtheningLevel,
): CommercialNarrativeStrengtheningAudienceMode {
  switch (level) {
    case "customer-visible-light":
    case "customer-visible-structured":
      return "customer-visible";
    case "pilot-strengthening":
    case "review-before-send":
    case "risk-reduction-required":
    case "boundary-only":
    case "non-commitment-fallback":
      return "shared-review";
    default:
      return "internal-only";
  }
}

function getSendabilityMode(
  level: CommercialNarrativeStrengtheningLevel,
): CommercialNarrativeStrengtheningSendabilityMode {
  switch (level) {
    case "customer-visible-structured":
      return "safe-to-send";
    case "customer-visible-light":
    case "boundary-only":
    case "pilot-strengthening":
      return "safe-with-boundary";
    case "exploratory-strengthening":
      return "discussion-only";
    case "review-before-send":
      return "review-before-send";
    case "risk-reduction-required":
    case "blocked-strengthening":
      return "not-safe-to-send";
    case "non-commitment-fallback":
      return "non-commitment-fallback";
    default:
      return "internal-only";
  }
}

function getFallbackMode(
  level: CommercialNarrativeStrengtheningLevel,
): CommercialNarrativeStrengtheningFallbackMode {
  switch (level) {
    case "non-commitment-fallback":
      return "non-commitment-fallback";
    case "boundary-only":
    case "risk-reduction-required":
      return "boundary-only";
    case "review-before-send":
      return "review-hold";
    case "blocked-strengthening":
      return "blocked";
    default:
      return "no-fallback";
  }
}

function getIntent(
  detail: ProposalPackageCommercialDetail,
  level: CommercialNarrativeStrengtheningLevel,
  signals: ReturnType<typeof summarizeSignals>,
): CommercialNarrativeStrengtheningIntent {
  if (level === "review-before-send" || level === "blocked-strengthening") {
    return "hold-review-line";
  }
  if (level === "risk-reduction-required") {
    return "reduce-risk";
  }
  if (level === "boundary-only" || level === "non-commitment-fallback") {
    return "fallback-to-boundary";
  }
  if (level === "exploratory-strengthening") {
    return "clarify-fit";
  }
  if (level === "pilot-strengthening" || detail.stageCode === "ADVANCING") {
    return "advance-pilot-story";
  }
  if (signals.openCommitmentCount > 0) {
    return "warm-up-trust";
  }
  return "build-customer-confidence";
}

function buildJudgement(
  level: CommercialNarrativeStrengtheningLevel,
  sendabilityMode: CommercialNarrativeStrengtheningSendabilityMode,
  english: boolean,
) {
  switch (level) {
    case "recommendation-only":
      return english
        ? "This commercial narrative should stay recommendation-only until Helm has enough evidence to justify any stronger outward wording."
        : "当前商业叙事应继续停留在仅建议，直到 Helm 有足够证据支撑更强的对外措辞。";
    case "exploratory-strengthening":
      return english
        ? "This commercial narrative can move into exploratory-strengthening, but it still belongs to discussion-safe and reversible wording."
        : "当前商业叙事可以进入探索性加固，但仍必须停留在仅讨论且可回退的措辞。";
    case "pilot-strengthening":
      return english
        ? "This commercial narrative can move into pilot-strengthening, while still keeping boundary and review cues explicit."
        : "当前商业叙事可以进入试点加固，但边界和复核线索仍必须显式可见。";
    case "customer-visible-light":
      return english
        ? "This commercial narrative can move into customer-visible-light wording, while still keeping non-commitment explicit."
        : "当前商业叙事可以进入客户可见-light 措辞，但非承诺仍必须显式可见。";
    case "customer-visible-structured":
      return english
        ? "This commercial narrative can move into customer-visible-structured wording, while still keeping sendability and non-commitment visible."
        : "当前商业叙事可以进入结构化客户可见措辞，但发送评估和非承诺仍必须继续挂在前台。";
    case "review-before-send":
      return english
        ? "This commercial narrative is already stronger, but it still must stop at review-before-send before any customer-visible move."
        : "当前商业叙事已经更强，但在任何客户可见动作之前仍必须先停在发送前复核。";
    case "risk-reduction-required":
      return english
        ? "This commercial narrative should pause until risk reduction happens, because stronger wording is still unsafe."
        : "当前商业叙事应先暂停，直到完成风险降低，因为更强表达当前仍然不安全。";
    case "boundary-only":
      return english
        ? "This commercial narrative should stay boundary-only, so it can clarify without pretending certainty."
        : "当前商业叙事应继续停留在仅边界，用来澄清而不是假装确定性。";
    case "non-commitment-fallback":
      return english
        ? "This commercial narrative should step back into non-commitment fallback until trust pressure and evidence become cleaner."
        : "当前商业叙事应先退回非承诺兜底，直到信任压力和证据都更干净。";
    default:
      return english
        ? `This commercial narrative should stay ${sendabilityMode} because the current pressure still blocks safe strengthening.`
        : `当前商业叙事应继续停在「${labelForSendabilityMode(sendabilityMode, false)}」对应层级，因为当前压力仍在挡住安全加固。`;
  }
}

function buildBoundaryLine(
  level: CommercialNarrativeStrengtheningLevel,
  sendabilityMode: CommercialNarrativeStrengtheningSendabilityMode,
  fallbackMode: CommercialNarrativeStrengtheningFallbackMode,
  english: boolean,
) {
  switch (level) {
    case "recommendation-only":
      return english
        ? "This layer is still internal recommendation, so it cannot be flattened into customer-visible commitment wording."
        : "当前这一层仍属于内部建议，不能直接压平成客户可见承诺措辞。";
    case "exploratory-strengthening":
      return english
        ? "Exploratory strengthening may warm up the story, but it still belongs to discussion-only wording."
        : "探索性加固可以帮助升温叙事，但它仍属于仅讨论 措辞。";
    case "review-before-send":
      return english
        ? "The narrative may already look stronger, but sendability is still gated by review-before-send."
        : "当前叙事看起来可能已经更强，但发送评估仍然被发送前复核严格卡住。";
    case "non-commitment-fallback":
      return english
        ? `This layer explicitly falls back to ${fallbackMode}, so stronger wording must not leak outward as commitment.`
        : `当前这一层显式退回到「${fallbackLabel(fallbackMode, false)}」，所以更强表达不能向外泄漏成承诺。`;
    case "customer-visible-light":
    case "customer-visible-structured":
      return english
        ? `This layer is ${sendabilityMode}, but customer-visible wording still stays non-commitment until a human approves stronger language.`
        : `当前这一层虽然是「${labelForSendabilityMode(sendabilityMode, false)}」，但客户可见措辞仍然属于非承诺，除非人工明确批准更强语言。`;
    default:
      return english
        ? "Boundary, fallback and sendability cues stay visible on the main page and do not get buried in evidence."
        : "边界、兜底和发送评估线索会继续留在主页面前台，而不会被埋进依据。";
  }
}

function buildNextActions({
  id,
  sendabilityMode,
  english,
}: {
  id: string;
  sendabilityMode: CommercialNarrativeStrengtheningSendabilityMode;
  english: boolean;
}) {
  return [
    {
      label:
        sendabilityMode === "review-before-send" ||
        sendabilityMode === "not-safe-to-send"
          ? english
            ? "Open approvals and hold the strengthening line"
            : "打开审批并守住加固边界"
          : english
            ? "Open reinforcement variants and confirm the next layer"
            : "打开加固变体s 并确认下一层加固",
      href:
        sendabilityMode === "review-before-send" ||
        sendabilityMode === "not-safe-to-send"
          ? "/approvals"
          : `/reinforcement-variants/${id}`,
    },
    {
      label: english ? "Open sendability page" : "打开发送评估页面",
      href: `/sendability/${id}`,
      variant: "secondary",
    },
    {
      label: english ? "Open evidence" : "查看依据",
      href: `/memory?objectType=OPPORTUNITY&objectId=${id}`,
      variant: "ghost",
    },
  ] satisfies CommercialNarrativeStrengtheningDetailReportingContract["strengtheningNextAction"];
}

function buildEvidenceGroups(
  detail: ProposalPackageCommercialDetail,
  level: CommercialNarrativeStrengtheningLevel,
  sendabilityMode: CommercialNarrativeStrengtheningSendabilityMode,
  fallbackMode: CommercialNarrativeStrengtheningFallbackMode,
  english: boolean,
): CommercialNarrativeStrengtheningEvidenceGroup[] {
  return [
    {
      groupId: "replay",
      label: english ? "Replay" : "回放",
      items: [
        english
          ? `Current strengthening level: ${labelForLevel(level, true)}.`
          : `当前加固层级：${labelForLevel(level, false)}。`,
        detail.briefingSnapshot?.payload.summary ??
          (english
            ? "Helm kept the latest commercial summary linked to this strengthening decision."
            : "Helm 已把最近一版商业摘要挂到这次加固判断上。"),
      ],
    },
    {
      groupId: "audit",
      label: english ? "Audit" : "审计",
      items: detail.auditLogs
        .slice(0, 3)
        .map((log) =>
          english
            ? `${formatRelative(log.createdAt)} · ${log.actor} · ${trimText(log.summary, 120)}`
            : `${formatRelative(log.createdAt)} · ${log.actor} · ${trimText(log.summary, 120)}`,
        ) || [
        english
          ? "No audit change has been recorded yet."
          : "当前还没有新的审计变化。",
      ],
    },
    {
      groupId: "memory",
      label: english ? "Memory" : "经营记忆",
      items: detail.memoryFacts
        .slice(0, 3)
        .map((fact) =>
          english
            ? `${trimText(fact.title, 48)} · ${trimText(fact.content, 120)}`
            : `${trimText(fact.title, 48)} · ${trimText(fact.content, 120)}`,
        ) || [
        english
          ? "No memory fact is attached yet."
          : "当前还没有新的经营记忆事实。",
      ],
    },
    {
      groupId: "worker_output",
      label: english ? "Worker output" : "执行输出",
      items: detail.briefingSnapshot?.payload.recommendedNextSteps?.slice(
        0,
        3,
      ) ?? [
        english
          ? "Worker output is currently folded into the strengthening next-step summary."
          : "当前执行输出已经折叠进加固下一步摘要。",
      ],
    },
    {
      groupId: "boundary_trace",
      label: english ? "Boundary trace" : "边界轨迹",
      items: [
        english
          ? "Boundary, fallback and sendability notes remain attached to the main strengthening page."
          : "边界、兜底和发送评估备注仍然牢牢挂在主加固页面上。",
        english
          ? "This layer still does not upgrade recommendation into commitment."
          : "当前这一层仍然不会把建议升级成承诺。",
      ],
    },
    {
      groupId: "sendability_trace",
      label: english ? "Sendability trace" : "发送评估轨迹",
      items: [
        english
          ? `Current sendability mode: ${sendabilityMode}.`
          : `当前发送评估模式：${labelForSendabilityMode(sendabilityMode, false)}。`,
        english
          ? "Outward wording only moves when the current layer keeps its review and non-commitment boundary explicit."
          : "只有当前层继续把复核和非承诺边界挂出来时，对外措辞才允许继续移动。",
      ],
    },
    {
      groupId: "strengthening_trace",
      label: english ? "Strengthening trace" : "加固轨迹",
      items: [
        english
          ? `Current strengthening level: ${labelForLevel(level, true)}.`
          : `当前加固层级：${labelForLevel(level, false)}。`,
        english
          ? `Current stage source: ${detail.stageCode} / ${detail.stageLabel}.`
          : `当前阶段来源：${detail.stageCode} / ${detail.stageLabel}。`,
      ],
    },
    {
      groupId: "fallback_trace",
      label: english ? "Fallback trace" : "兜底轨迹",
      items: [
        english
          ? `Current fallback mode: ${fallbackMode}.`
          : `当前兜底模式：${fallbackLabel(fallbackMode, false)}。`,
        english
          ? "Fallback keeps stronger language from leaking ahead of evidence."
          : "兜底会持续阻止更强表达跑在证据前面。",
      ],
    },
    {
      groupId: "historical_changes",
      label: english ? "Historical changes" : "历史变化",
      items: [
        english
          ? `Last updated ${formatRelative(detail.updatedAt)}.`
          : `最近更新于 ${formatRelative(detail.updatedAt)}。`,
        english
          ? `Current due date: ${formatDateLabel(detail.dueDate)}.`
          : `当前截止时间：${formatDateLabel(detail.dueDate)}。`,
      ],
    },
  ];
}

function mapRiskSignal(
  riskLevel: ProposalPackageCommercialDetail["riskLevel"],
  signals: ReturnType<typeof summarizeSignals>,
): CommercialNarrativeStrengtheningRiskSignal {
  if (
    riskLevel === "CRITICAL" ||
    riskLevel === "HIGH" ||
    signals.pendingApprovalCount > 0 ||
    signals.blockerCount > 0
  ) {
    return "high";
  }
  if (
    riskLevel === "MEDIUM" ||
    signals.openCommitmentCount > 0 ||
    signals.missingPrerequisiteCount > 0
  ) {
    return "caution";
  }
  return "watch";
}

function labelForLevel(
  level: CommercialNarrativeStrengtheningLevel,
  english: boolean,
) {
  switch (level) {
    case "recommendation-only":
      return english ? "recommendation-only" : "仅建议";
    case "exploratory-strengthening":
      return english
        ? "exploratory-strengthening"
        : "探索型加固";
    case "pilot-strengthening":
      return english ? "pilot-strengthening" : "试点加固";
    case "customer-visible-light":
      return english ? "customer-visible light" : "轻量客户可见";
    case "customer-visible-structured":
      return english
        ? "customer-visible structured"
        : "结构化客户可见";
    case "review-before-send":
      return english ? "review-before-send" : "发送前复核";
    case "risk-reduction-required":
      return english ? "risk-reduction-required" : "先降风险";
    case "boundary-only":
      return english ? "boundary-only" : "仅边界";
    case "non-commitment-fallback":
      return english ? "non-commitment fallback" : "非承诺回退";
    default:
      return english ? "blocked-strengthening" : "加固受阻";
  }
}

function labelForSendabilityMode(
  mode: CommercialNarrativeStrengtheningSendabilityMode,
  english: boolean,
) {
  switch (mode) {
    case "safe-to-send":
      return english ? "safe-to-send" : "可发送";
    case "safe-with-boundary":
      return english ? "safe-with-boundary" : "带边界可发送";
    case "discussion-only":
      return english ? "discussion-only" : "仅讨论";
    case "review-before-send":
      return english ? "review-before-send" : "发送前复核";
    case "not-safe-to-send":
      return english ? "not-safe-to-send" : "不可发送";
    case "internal-only":
      return english ? "internal-only" : "仅内部";
    default:
      return english ? "non-commitment fallback" : "非承诺兜底";
  }
}

function fallbackLabel(
  fallbackMode: CommercialNarrativeStrengtheningFallbackMode,
  english: boolean,
) {
  switch (fallbackMode) {
    case "boundary-only":
      return english ? "boundary-only review" : "仅边界复核";
    case "non-commitment-fallback":
      return english ? "non-commitment fallback" : "非承诺兜底";
    case "review-hold":
      return english ? "review hold" : "复核暂缓";
    case "blocked":
      return english ? "blocked state" : "受阻状态";
    default:
      return english ? "the current layer" : "当前层";
  }
}
