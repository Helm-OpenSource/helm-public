import type {
  ExternalNarrativeDetailAudienceMode,
  ExternalNarrativeDetailEvidenceGroup,
  ExternalNarrativeDetailFallbackMode,
  ExternalNarrativeDetailIntent,
  ExternalNarrativeDetailLevel,
  ExternalNarrativeDetailReportingContract,
  ExternalNarrativeDetailRiskSignal,
  ExternalNarrativeDetailSendabilityMode,
} from "@/lib/presentation/external-narrative-detail-contract";
import type { PageNextAction } from "@/lib/presentation/reporting-protocol";
import {
  createExternalNarrativeDetailReportingContract,
} from "@/lib/presentation/external-narrative-detail-contract";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import { formatRelative, trimText } from "@/lib/utils";

export function buildExternalNarrativeDetailPageContract({
  detail,
  english,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
}): ExternalNarrativeDetailReportingContract {
  const signals = summarizeSignals(detail);
  const level = getNarrativeLevel(detail, signals);
  const audienceMode = getAudienceMode(level);
  const sendabilityMode = getSendabilityMode(level);
  const fallbackMode = getFallbackMode(level);
  const intent = getIntent(level);
  const riskSignal = mapRiskSignal(detail.riskLevel, signals);

  return createExternalNarrativeDetailReportingContract({
    externalNarrativeDetailJudgement: buildJudgement(
      level,
      sendabilityMode,
      fallbackMode,
      english,
    ),
    externalNarrativeDetailJudgementReason:
      detail.briefingSnapshot?.payload.summary ??
      (english
        ? "The current narrative surface already brings external narrative pressure, the trust line, open commitments and fallback pressure together."
        : "当前这张叙事决策面已经把 对外叙事压力、信任话术、开放承诺和兜底压力收在一起。"),
    externalNarrativeDetailActionSummary: [
      english
        ? "The current page already separates internal framing, exploratory narrative, customer-visible layers and fallback-safe narrative."
        : "当前页已经把 internal 措辞、探索性 叙事、客户可见层和兜底安全叙事分开了。",
      signals.pendingApprovalCount
        ? english
          ? `${signals.pendingApprovalCount} approval-sensitive actions remain open, so stronger narrative cannot silently cross into commitment.`
          : `当前仍有 ${signals.pendingApprovalCount} 条审批敏感动作未收口，所以更强的叙事不能悄悄越过承诺边界。`
        : english
          ? "The current narrative level, sendability gate and fallback line are already grouped into one decision page."
          : "当前叙事层级、发送评估闸口和兜底话术都已经被收进同一页决策面。",
      english
        ? "You do not need to reconstruct this from scattered scripts and cue packs first; the current external narrative level is already explicit."
        : "你不需要先从零散的 script 和线索 资料 里重拼；当前对外叙事层级已经说清楚了。",
    ],
    externalNarrativeDetailDecisionRequest: [
      english
        ? `Confirm whether this should stay ${labelForLevel(level, true)} or fall back to ${fallbackLabel(fallbackMode, true)} before it travels outward.`
        : `确认当前是继续保持「${labelForLevel(level, false)}」，还是在继续向外前先退回「${fallbackLabel(fallbackMode, false)}」。`,
      english
        ? "Confirm whether founder, sales or delivery owns the next narrative pass, and whether review-before-send is still required."
        : "确认下一轮叙事 pass 由创始人、销售还是交付接手，以及是否仍必须先发送前复核。",
    ],
    externalNarrativeDetailBoundarySummary: [
      english
        ? "External narrative can raise clarity and confidence, but it still cannot silently harden recommendation into commitment."
        : "对外叙事可以提高清晰度和信心，但它仍然不能悄悄把建议硬化成承诺。",
      buildBoundaryLine(level, sendabilityMode, fallbackMode, english),
      english
        ? "Exploratory, boundary-only and non-commitment fallback narrative still do not equal a customer promise."
        : "探索性、仅边界和非承诺兜底的叙事仍然不等于客户承诺。",
    ],
    externalNarrativeDetailEvidenceSummary: [
      english
        ? `${detail.auditLogs.length} audit changes, ${detail.memoryFacts.length} memory facts and the full narrative trace are grouped below without interrupting the main narrative.`
        : `当前 ${detail.auditLogs.length} 条审计变化、${detail.memoryFacts.length} 条经营记忆事实 和完整叙事轨迹已经分组收在下面，不会打断主叙事。`,
      english
        ? "Replay, audit, memory, worker output, boundary trace, sendability trace, narrative trace, fallback trace and historical changes remain available on demand."
        : "回放、审计、经营记忆、执行输出、边界轨迹、发送评估轨迹、叙事轨迹、兜底轨迹和历史变更都保留在附注层按需可看。",
    ],
    externalNarrativeDetailWorkerSummary: [
      english
        ? "Sales worker keeps proposal-supporting and customer-visible narrative layers aligned to one commercial line."
        : "销售执行会持续把提案-supporting 和客户可见的叙事层对齐到同一条商业推进线上。",
      english
        ? "Founder / delivery review keeps trust-sensitive, scope-sensitive and fallback-sensitive wording from overstating certainty."
        : "创始人 / 交付复核会持续防止信任敏感、范围-敏感和兜底-敏感措辞被过早说实。",
    ],
    externalNarrativeDetailNextAction: buildNextActions({
      id: detail.id,
      english,
    }),
    externalNarrativeDetailRiskSignal: riskSignal,
    externalNarrativeDetailAudienceMode: audienceMode,
    externalNarrativeDetailIntent: intent,
    externalNarrativeDetailLevel: level,
    externalNarrativeDetailFallbackMode: fallbackMode,
    externalNarrativeDetailSendabilityMode: sendabilityMode,
    externalNarrativeDetailEvidenceGroups: buildEvidenceGroups(
      detail,
      level,
      sendabilityMode,
      fallbackMode,
      english,
    ),
    externalNarrativeDetailFounderCue: buildFounderCue(level, english),
    externalNarrativeDetailSalesCue: buildSalesCue(level, english),
    externalNarrativeDetailDeliveryCue: buildDeliveryCue(level, english),
    pageWhyItMatters: [
      english
        ? `The opportunity is already in ${detail.stageLabel}, so the current narrative layer now directly changes trust, urgency and what the next external conversation may safely carry.`
        : `当前机会已经进入「${detail.stageLabel}」窗口，所以叙事层现在会直接改变信任、紧迫感以及下一次外部对话能安全承载什么。`,
      signals.openCommitmentCount
        ? english
          ? `${signals.openCommitmentCount} open commitments are still shaping trust pressure, so stronger narrative cannot pretend certainty that has not been earned yet.`
          : `当前仍有 ${signals.openCommitmentCount} 条开放承诺在塑造信任压力，所以更强的叙事不能假装已经获得了还没被兑现的确定性。`
        : english
          ? "There is room to strengthen the story, but only if sendability, fallback and non-commitment remain explicit."
          : "当前确实存在强化故事的空间，但前提是发送评估、兜底和非承诺必须持续显式可见。",
      english
        ? "The current page already separates internal framing, proposal support, strengthening and fallback-safe narrative, so the remaining value is choosing the right layer rather than rediscovering context."
        : "当前页已经把 internal 措辞、提案 support、加固和兜底安全叙事分开了，所以现在真正的价值在于选对层级，而不是重新拼上下文。",
    ],
    pageEscalationHint:
      sendabilityMode === "review-before-send" ||
      sendabilityMode === "not-safe-to-send"
        ? english
          ? "If anyone wants to harden timing, scope or outcome certainty, escalate into approvals before this narrative becomes customer-visible."
          : "如果任何人想把 时点、范围或结果确定性说实，就先升级进审批，再让这层叙事变成客户可见。"
        : english
          ? "If trust pressure or dependency pressure rises, step back from the current narrative layer and return to conversation or proposal review first."
          : "如果信任压力或依赖压力开始上升，就先从当前叙事层退回对话或提案复核。",
    pageEvidenceLinks: [
      {
        label: english ? "Open conversation detail" : "打开对话页面",
        href: `/conversations/${detail.id}`,
      },
      {
        label: english ? "Open external proposal page" : "打开外部提案页面",
        href: `/external-proposals/${detail.id}`,
      },
      {
        label: english ? "Open reinforcement page" : "打开加固页面",
        href: `/reinforcements/${detail.id}`,
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

function getNarrativeLevel(
  detail: ProposalPackageCommercialDetail,
  signals: ReturnType<typeof summarizeSignals>,
): ExternalNarrativeDetailLevel {
  if (detail.riskLevel === "CRITICAL" || signals.pendingApprovalCount > 1) {
    return "blocked-narrative";
  }
  if (detail.riskLevel === "HIGH" || signals.blockerCount > 0) {
    return "boundary-only";
  }
  if (signals.pendingApprovalCount > 0) {
    return "review-before-send";
  }
  if (signals.openCommitmentCount > 1) {
    return "non-commitment-fallback";
  }
  if (signals.missingPrerequisiteCount > 0) {
    return "internal-framing";
  }

  switch (detail.stageCode) {
    case "NEW":
    case "CONTACTED":
      return "exploratory-narrative";
    case "ADVANCING":
      return signals.workerPreparedCount > 3
        ? "strengthening-narrative"
        : "proposal-supporting-narrative";
    case "WAITING_THEM":
      return signals.workerPreparedCount > 3
        ? "customer-visible-structured"
        : "customer-visible-light";
    case "DONE":
      return "customer-visible-structured";
    default:
      return "internal-framing";
  }
}

function getAudienceMode(
  level: ExternalNarrativeDetailLevel,
): ExternalNarrativeDetailAudienceMode {
  switch (level) {
    case "customer-visible-light":
    case "customer-visible-structured":
      return "customer-visible";
    case "proposal-supporting-narrative":
    case "strengthening-narrative":
    case "review-before-send":
    case "boundary-only":
    case "non-commitment-fallback":
      return "shared-review";
    case "internal-framing":
      return "founder-led";
    default:
      return "internal-only";
  }
}

function getSendabilityMode(
  level: ExternalNarrativeDetailLevel,
): ExternalNarrativeDetailSendabilityMode {
  switch (level) {
    case "customer-visible-structured":
      return "safe-to-send";
    case "customer-visible-light":
    case "strengthening-narrative":
      return "safe-with-boundary";
    case "proposal-supporting-narrative":
    case "exploratory-narrative":
      return "discussion-only";
    case "review-before-send":
      return "review-before-send";
    case "boundary-only":
      return "not-safe-to-send";
    case "non-commitment-fallback":
      return "non-commitment-fallback";
    case "internal-framing":
      return "internal-only";
    default:
      return "not-safe-to-send";
  }
}

function getFallbackMode(
  level: ExternalNarrativeDetailLevel,
): ExternalNarrativeDetailFallbackMode {
  switch (level) {
    case "boundary-only":
      return "boundary-only";
    case "non-commitment-fallback":
      return "non-commitment-fallback";
    case "review-before-send":
      return "review-hold";
    case "blocked-narrative":
      return "blocked";
    default:
      return "no-fallback";
  }
}

function getIntent(level: ExternalNarrativeDetailLevel): ExternalNarrativeDetailIntent {
  switch (level) {
    case "internal-framing":
      return "frame-internally";
    case "proposal-supporting-narrative":
      return "support-proposal";
    case "strengthening-narrative":
      return "support-strengthening";
    case "customer-visible-light":
    case "customer-visible-structured":
      return "warm-up-trust";
    case "review-before-send":
      return "hold-review-line";
    case "boundary-only":
    case "non-commitment-fallback":
      return "fallback-to-boundary";
    default:
      return "reduce-risk";
  }
}

function mapRiskSignal(
  riskLevel: ProposalPackageCommercialDetail["riskLevel"],
  signals: ReturnType<typeof summarizeSignals>,
): ExternalNarrativeDetailRiskSignal {
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
  level: ExternalNarrativeDetailLevel,
  sendabilityMode: ExternalNarrativeDetailSendabilityMode,
  fallbackMode: ExternalNarrativeDetailFallbackMode,
  english: boolean,
) {
  if (english) {
    return `Keep the external narrative at ${labelForLevel(level, true)} with ${labelForSendability(sendabilityMode, true)} and ${fallbackLabel(fallbackMode, true)} still explicit.`;
  }

  return `当前对外叙事应停在「${labelForLevel(level, false)}」，并保持「${labelForSendability(sendabilityMode, false)}」，且继续把「${fallbackLabel(fallbackMode, false)}」挂在前台。`;
}

function buildBoundaryLine(
  level: ExternalNarrativeDetailLevel,
  sendabilityMode: ExternalNarrativeDetailSendabilityMode,
  fallbackMode: ExternalNarrativeDetailFallbackMode,
  english: boolean,
) {
  if (english) {
    return `Current level: ${labelForLevel(level, true)}. Current sendability: ${labelForSendability(sendabilityMode, true)}. Current fallback: ${fallbackLabel(fallbackMode, true)}.`;
  }

  return `当前层级是「${labelForLevel(level, false)}」，当前发送评估是「${labelForSendability(sendabilityMode, false)}」，当前兜底是「${fallbackLabel(fallbackMode, false)}」。`;
}

function buildFounderCue(level: ExternalNarrativeDetailLevel, english: boolean) {
  if (english) {
    return level === "internal-framing" || level === "blocked-narrative"
      ? "Founder should keep the line at strategic framing, reversible confidence and explicit non-commitment."
      : "Founder should step in only when trust, timing or strategic posture needs a higher-level frame.";
  }

  return level === "internal-framing" || level === "blocked-narrative"
    ? "创始人这时最适合停在战略措辞、可回退信心和显式非承诺。"
    : "创始人只在信任、时点或战略姿态需要更高层措辞时介入。";
}

function buildSalesCue(level: ExternalNarrativeDetailLevel, english: boolean) {
  if (english) {
    return level === "customer-visible-light" ||
      level === "customer-visible-structured"
      ? "Sales should use the current narrative as customer-visible guidance without hardening it into a promise."
      : "Sales should translate the current layer into the next safe follow-up instead of overstating certainty.";
  }

  return level === "customer-visible-light" ||
    level === "customer-visible-structured"
    ? "销售这时最适合把当前叙事作为客户可见指引使用，但不能把它说成承诺。"
    : "销售应把当前层翻成下一步安全跟进，而不是过度夸大确定性。";
}

function buildDeliveryCue(level: ExternalNarrativeDetailLevel, english: boolean) {
  if (english) {
    return level === "boundary-only" ||
      level === "review-before-send" ||
      level === "non-commitment-fallback"
      ? "Delivery should keep scope, prerequisite and dependency caveats explicit before this narrative becomes customer-visible."
      : "Delivery should protect implementation caveats whenever the story starts touching delivery expectation.";
  }

  return level === "boundary-only" ||
    level === "review-before-send" ||
    level === "non-commitment-fallback"
    ? "交付这时最适合先把范围、前置和依赖注脚挂在前台，再允许这层叙事变成客户可见。"
    : "只要故事开始触碰交付 预期，交付就该先保护 implementation 注脚。";
}

function buildNextActions({
  id,
  english,
}: {
  id: string;
  english: boolean;
}): PageNextAction[] {
  return [
    {
      label: english ? "Open reinforcement detail" : "打开加固页面",
      href: `/reinforcements/${id}`,
    },
    {
      label: english ? "Open conversation detail" : "打开对话页面",
      href: `/conversations/${id}`,
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
  level: ExternalNarrativeDetailLevel,
  sendabilityMode: ExternalNarrativeDetailSendabilityMode,
  fallbackMode: ExternalNarrativeDetailFallbackMode,
  english: boolean,
): ExternalNarrativeDetailEvidenceGroup[] {
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
      label: english ? "Replay" : "Replay",
      items: [
        english
          ? `Use the current narrative layer ${labelForLevel(level, true)} to replay the next outward-safe story.`
          : `可按当前叙事层「${labelForLevel(level, false)}」回放下一轮对外安全 故事。`,
      ],
    },
    {
      groupId: "audit",
      label: english ? "Audit" : "Audit",
      items: [latestAudit],
    },
    {
      groupId: "memory",
      label: english ? "Memory" : "Memory",
      items: [latestMemory],
    },
    {
      groupId: "worker_output",
      label: english ? "Worker output" : "Worker output",
      items: [latestAction],
    },
    {
      groupId: "boundary_trace",
      label: english ? "Boundary trace" : "Boundary trace",
      items: [topBlocker],
    },
    {
      groupId: "sendability_trace",
      label: english ? "Sendability trace" : "Sendability trace",
      items: [
        english
          ? `Current sendability remains ${labelForSendability(sendabilityMode, true)}.`
          : `当前发送评估仍停在「${labelForSendability(sendabilityMode, false)}」。`,
      ],
    },
    {
      groupId: "narrative_trace",
      label: english ? "Narrative trace" : "Narrative trace",
      items: [summary],
    },
    {
      groupId: "fallback_trace",
      label: english ? "Fallback trace" : "Fallback trace",
      items: [
        english
          ? `Fallback stays ${fallbackLabel(fallbackMode, true)}.`
          : `兜底仍停在「${fallbackLabel(fallbackMode, false)}」。`,
      ],
    },
    {
      groupId: "historical_changes",
      label: english ? "Historical changes" : "Historical changes",
      items: [
        english
          ? `${topCommitment} · updated ${formatRelative(detail.updatedAt)}`
          : `${topCommitment} · 最近更新于 ${formatRelative(detail.updatedAt)}`,
      ],
    },
  ];
}

function labelForLevel(level: ExternalNarrativeDetailLevel, english: boolean) {
  switch (level) {
    case "internal-framing":
      return english ? "internal framing" : "internal framing";
    case "customer-visible-light":
      return english ? "customer-visible light" : "customer-visible light";
    case "customer-visible-structured":
      return english ? "customer-visible structured" : "customer-visible structured";
    case "exploratory-narrative":
      return english ? "exploratory narrative" : "exploratory narrative";
    case "proposal-supporting-narrative":
      return english ? "proposal-supporting narrative" : "proposal-supporting narrative";
    case "strengthening-narrative":
      return english ? "strengthening narrative" : "strengthening narrative";
    case "review-before-send":
      return english ? "review before send" : "review-before-send";
    case "boundary-only":
      return english ? "boundary only" : "boundary-only";
    case "non-commitment-fallback":
      return english ? "non-commitment fallback" : "non-commitment fallback";
    default:
      return english ? "blocked narrative" : "blocked narrative";
  }
}

function fallbackLabel(
  mode: ExternalNarrativeDetailFallbackMode,
  english: boolean,
) {
  switch (mode) {
    case "boundary-only":
      return english ? "boundary only" : "boundary-only";
    case "non-commitment-fallback":
      return english ? "non-commitment fallback" : "non-commitment fallback";
    case "review-hold":
      return english ? "review hold" : "review-hold";
    case "blocked":
      return english ? "blocked" : "blocked";
    default:
      return english ? "no fallback" : "无需兜底";
  }
}

function labelForSendability(
  mode: ExternalNarrativeDetailSendabilityMode,
  english: boolean,
) {
  switch (mode) {
    case "safe-to-send":
      return english ? "safe to send" : "可安全外发";
    case "safe-with-boundary":
      return english ? "safe with boundary" : "带边界可外发";
    case "discussion-only":
      return english ? "discussion only" : "只适合讨论";
    case "review-before-send":
      return english ? "review before send" : "先复核再发";
    case "internal-only":
      return english ? "internal only" : "仅内部";
    case "non-commitment-fallback":
      return english ? "non-commitment fallback" : "non-commitment fallback";
    default:
      return english ? "not safe to send" : "当前不能外发";
  }
}
