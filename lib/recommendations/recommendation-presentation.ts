import {
  ActionExecutionMode,
  ActionType,
  ObjectType,
  RiskLevel,
} from "@prisma/client";
import { actionModeLabels, actionTypeLabels } from "@/data/constants";
import { isEnglishLocale, type UiLocale } from "@/lib/i18n/config";
import type { MemoryRetrievalPackSurfaceTrace } from "@/lib/memory/retrieval-pack-adapter";
import { compactText, safeParseJson, trimText } from "@/lib/utils";
import type {
  RankedRecommendationCandidate,
  RecommendationEvidence,
  RecommendationObjectContext,
} from "@/lib/recommendations/types";

type PreferenceSummary = {
  boostByActionType: Record<string, number>;
  rejectByActionType: Record<string, number>;
};

export type RecommendationPresentationPayload = {
  decisionRole: "primary" | "secondary" | "defer";
  decisionLabel: string;
  tradeoffSummary: string;
  alternativeActionTitle: string | null;
  whyNow: string;
  evidenceLead: string;
  currentBlocker: string | null;
  currentCommitment: string | null;
  expectedImpact: string;
  ifNoAction: string;
  personalizationHint: string | null;
  learnedPatternSummary: string[];
  supportingHighlights: string[];
  briefingSummary: string | null;
  evidenceSummary: string;
  memoryRetrievalPack: MemoryRetrievalPackSurfaceTrace | null;
};

export type RecommendationPresentationModel =
  RecommendationPresentationPayload & {
    explanation: string;
    policyResultLabel: string;
    policyHint: string | null;
    appliedPolicyReason: string | null;
    llmEnhanced: boolean;
    llmHint: string | null;
  };

type RecommendationLike = {
  explanation: string;
  policyResult: ActionExecutionMode | string;
  whyNotAutoExecute?: string | null;
  appliedPolicyRules?: Array<{
    name: string | null;
    mode: ActionExecutionMode | null;
    reason: string;
  }> | null;
  recommendationPayload?: Record<string, unknown> | string | null;
  supportingFactIds?: string[] | string | null;
  blockerIds?: string[] | string | null;
  commitmentIds?: string[] | string | null;
};

type RecommendationPresentationReadOptions = {
  locale?: UiLocale;
};

const cjkTextPattern = /[\u3400-\u9fff]/u;

const actionModeEnglishLabels: Record<string, string> = {
  SUGGEST_ONLY: "Suggest only",
  REQUIRES_APPROVAL: "Requires approval",
  AUTO_WITHIN_THRESHOLD: "Auto within threshold",
  FORBIDDEN: "Forbidden",
};

function hasCjkText(value: string) {
  return cjkTextPattern.test(value);
}

function englishSafeString(
  value: string | null,
  english: boolean,
): string | null {
  if (!value) return value;
  if (!english) return value;
  return hasCjkText(value) ? null : value;
}

function readPresentationString(
  payload: Record<string, unknown>,
  key: string,
  fallback: string,
  english: boolean,
) {
  const value = typeof payload[key] === "string" ? payload[key] : null;
  return englishSafeString(value, english) ?? fallback;
}

function readNullablePresentationString(
  payload: Record<string, unknown>,
  key: string,
  english: boolean,
) {
  const value = typeof payload[key] === "string" ? payload[key] : null;
  return englishSafeString(value, english);
}

function readPresentationStringArray(
  payload: Record<string, unknown>,
  key: string,
  english: boolean,
) {
  if (!Array.isArray(payload[key])) return [];
  return payload[key].filter(
    (item): item is string =>
      typeof item === "string" && englishSafeString(item, english) !== null,
  );
}

function policyResultLabel(policyResult: ActionExecutionMode | string, english: boolean) {
  if (english) {
    return actionModeEnglishLabels[String(policyResult)] ?? String(policyResult);
  }

  return (
    actionModeLabels[
      policyResult as keyof typeof actionModeLabels
    ] ?? String(policyResult)
  );
}

function buildWhyNow(
  context: RecommendationObjectContext,
  evidence: RecommendationEvidence,
) {
  const overdueCommitment = evidence.commitments.find(
    (item) => item.overdueFlag,
  );
  const activeBlocker = evidence.blockers[0];

  if (overdueCommitment) {
    return `当前承诺“${overdueCommitment.title}”已经进入超时窗口，今天继续拖延会直接削弱对方对推进节奏的信任。`;
  }

  if (activeBlocker?.status === "MONITORING") {
    return `当前仍在观察“${activeBlocker.title}”这类阻塞，现在先用低阻力动作验证变化，比直接重投入更稳。`;
  }

  if (activeBlocker?.severity >= 70) {
    return `当前最大阻塞“${activeBlocker.title}”已经开始压住推进节奏，现在先处理它，后续动作才不会反复返工。`;
  }

  if (context.daysSinceLastTouch >= 5) {
    return `这条事项已经 ${context.daysSinceLastTouch} 天没有实质推进，正在进入掉速区间，现在最适合先把下一步钉住。`;
  }

  if (context.dueSoon) {
    return "当前事项已经进入明确时间窗口，如果现在不推进，后面的动作会被动且更贵。";
  }

  return "现在推进这一步，最容易把已有判断转成真实动作，而不是继续停留在状态更新或讨论里。";
}

function buildCurrentBlocker(evidence: RecommendationEvidence) {
  const blocker = evidence.blockers[0];
  if (!blocker) return null;
  const statusLabel =
    blocker.status === "MONITORING"
      ? "观察中"
      : blocker.status === "RESOLVED"
        ? "已解决"
        : blocker.status === "IGNORED"
          ? "暂不处理"
          : "待处理";
  return compactText(
    `${statusLabel} · ${blocker.title}：${trimText(blocker.blockerText, 48)}`,
  );
}

function buildCurrentCommitment(evidence: RecommendationEvidence) {
  const commitment =
    evidence.commitments.find((item) => item.overdueFlag) ??
    evidence.commitments[0];
  if (!commitment) return null;
  const statusLabel = commitment.overdueFlag
    ? "已逾期"
    : commitment.status === "IN_PROGRESS"
      ? "推进中"
      : commitment.status === "FULFILLED"
        ? "已兑现"
        : commitment.status === "CANCELED"
          ? "已取消"
          : "待兑现";
  return compactText(
    `${statusLabel} · ${commitment.title}：${trimText(commitment.commitmentText, 48)}`,
  );
}

function buildExpectedImpact(actionType: ActionType) {
  switch (actionType) {
    case ActionType.DRAFT_EXTERNAL_EMAIL:
    case ActionType.GENERATE_REPLY_DRAFT:
      return "先把对外等待重新拉回我方节奏，并尽快验证对方真实阻塞，而不是继续靠猜。";
    case ActionType.CREATE_MEETING:
    case ActionType.SCHEDULE_INTERVIEW:
      return "把口头意向尽快转成确定时间窗口，减少机会或候选人继续空转。";
    case ActionType.UPDATE_OPPORTUNITY_STAGE:
      return "让判断与真实推进重新对齐，后续排序、风险和审批边界都会更准确。";
    case ActionType.SEND_MEETING_SUMMARY:
    case ActionType.DRAFT_INTERNAL_NOTE:
      return "把会后结论快速变成组织协同，避免关键决定继续停留在个人记忆里。";
    case ActionType.CREATE_TASK:
    case ActionType.ASSIGN_OWNER:
    case ActionType.CHANGE_DUE_DATE:
    default:
      return "把责任人、时间和下一步动作重新钉住，减少会后遗漏和推进漂移。";
  }
}

function buildInactionRisk(
  context: RecommendationObjectContext,
  riskLevel: RiskLevel,
) {
  if (context.objectType === ObjectType.MEETING) {
    return "如果不在会后 24 小时内推进，这场会议的结论很快就会重新退回纪要层，后续推进成本会明显升高。";
  }

  if (context.objectType === ObjectType.CONTACT) {
    return "如果继续不跟进，这段关系会继续降温，后续再重新启动通常需要更高的沟通成本。";
  }

  if (context.objectType === ObjectType.COMPANY) {
    return "如果不先处理当前卡点，这个账户会继续停在观察态，团队很难判断该继续投入还是及时收口。";
  }

  if (riskLevel === RiskLevel.CRITICAL || riskLevel === RiskLevel.HIGH) {
    return "如果今天不推进，这条机会很可能继续降温，并开始进入竞争对手或内部搁置窗口。";
  }

  return "如果今天不推进，这条事项会继续停在当前阶段，后续判断建议的成本和不确定性都会上升。";
}

function buildPersonalizationHint(input: {
  actionType: ActionType;
  policyResult: ActionExecutionMode;
  context: RecommendationObjectContext;
  ranked: RankedRecommendationCandidate;
  preferenceSummary: PreferenceSummary;
}) {
  const boost =
    input.preferenceSummary.boostByActionType[input.actionType] ?? 0;
  const reject =
    input.preferenceSummary.rejectByActionType[input.actionType] ?? 0;
  const actionLabel = actionTypeLabels[input.actionType];

  if (boost >= reject + 24) {
    return `系统观察到你过去更常接受“${actionLabel}”这类动作，因此这次把它提前成主推荐。`;
  }

  if (
    input.ranked.outbound &&
    input.policyResult === ActionExecutionMode.REQUIRES_APPROVAL
  ) {
    return "你对外承诺类动作通常会先审批，因此系统保留了你的控制边界，没有直接替你执行。";
  }

  if (
    input.context.objectType === ObjectType.MEETING &&
    input.ranked.usesCommitment
  ) {
    return "你团队通常会在会后 24 小时内完成跟进，这条动作因此被提高了优先级。";
  }

  if (input.ranked.sortHint === "clarity") {
    return "基于你过往更常接受先澄清、再推进的处理方式，系统优先给出这条低阻力动作。";
  }

  if (reject >= boost + 24) {
    return `你过去较少直接采用“${actionLabel}”这类动作，所以系统不会把它直接推成唯一选项。`;
  }

  return null;
}

function buildDecisionRole(input: {
  rankIndex: number;
  ranked: RankedRecommendationCandidate;
  topCandidate: RankedRecommendationCandidate;
}) {
  if (input.rankIndex === 0) {
    return {
      role: "primary" as const,
      label: "首选动作",
    };
  }

  if (
    input.ranked.policyResult === ActionExecutionMode.FORBIDDEN ||
    input.ranked.score <= input.topCandidate.score - 12
  ) {
    return {
      role: "defer" as const,
      label: "暂缓处理",
    };
  }

  return {
    role: "secondary" as const,
    label: "次优动作",
  };
}

function buildTradeoffSummary(input: {
  role: "primary" | "secondary" | "defer";
  ranked: RankedRecommendationCandidate;
  topCandidate: RankedRecommendationCandidate;
  evidence: RecommendationEvidence;
}) {
  const blockerTitle = input.evidence.blockers[0]?.title ?? null;
  const overdueCommitment =
    input.evidence.commitments.find((item) => item.overdueFlag) ?? null;

  if (input.role === "primary") {
    if (input.ranked.addressesBlocker && blockerTitle) {
      return `这一步先直接处理“${blockerTitle}”，比其他候选动作更能先解除当前阻力。`;
    }

    if (input.ranked.usesCommitment && overdueCommitment) {
      return `这一步先补齐逾期承诺“${overdueCommitment.title}”，比其他动作更能恢复推进信任。`;
    }

    if (
      input.ranked.policyResult === ActionExecutionMode.AUTO_WITHIN_THRESHOLD
    ) {
      return "综合紧迫度、影响和策略边界，这是当前最稳、最容易立即落地的首选动作。";
    }

    return "综合紧迫度、影响和当前证据，这是当前最值得先推进的一步。";
  }

  if (input.role === "secondary") {
    if (
      input.topCandidate.addressesBlocker &&
      !input.ranked.addressesBlocker &&
      blockerTitle
    ) {
      return `这一步也能推进，但首选动作更直接处理“${blockerTitle}”，所以它排在后面。`;
    }

    if (
      input.topCandidate.usesCommitment &&
      !input.ranked.usesCommitment &&
      overdueCommitment
    ) {
      return `这一步也有价值，但当前更优先的是先补齐“${overdueCommitment.title}”这类承诺压力。`;
    }

    if (
      input.ranked.policyResult === ActionExecutionMode.REQUIRES_APPROVAL &&
      input.topCandidate.policyResult ===
        ActionExecutionMode.AUTO_WITHIN_THRESHOLD
    ) {
      return "这一步需要更多人工确认，而首选动作能更快落地，所以当前先排在第二位。";
    }

    return "这一步仍然值得做，但相比首选动作，它对当前节奏的拉动没有那么直接。";
  }

  if (input.ranked.policyResult === ActionExecutionMode.FORBIDDEN) {
    return "当前策略边界不允许直接这样做，系统保留它是为了说明为什么现在不建议先推进。";
  }

  if (
    input.topCandidate.addressesBlocker &&
    !input.ranked.addressesBlocker &&
    blockerTitle
  ) {
    return `现在先做它的收益不如首选动作明显，因为“${blockerTitle}”还没有先被处理。`;
  }

  return "这一步不是没有价值，而是当前卡点、承诺压力或策略边界让它的时机还不对。";
}

export function buildRecommendationPresentationPayload(input: {
  context: RecommendationObjectContext;
  evidence: RecommendationEvidence;
  ranked: RankedRecommendationCandidate;
  preferenceSummary: PreferenceSummary;
  rankIndex?: number;
  topCandidate?: RankedRecommendationCandidate;
}): RecommendationPresentationPayload {
  const { context, evidence, ranked } = input;
  const topCandidate = input.topCandidate ?? ranked;
  const { role, label } = buildDecisionRole({
    rankIndex: input.rankIndex ?? 0,
    ranked,
    topCandidate,
  });

  return {
    decisionRole: role,
    decisionLabel: label,
    tradeoffSummary: buildTradeoffSummary({
      role,
      ranked,
      topCandidate,
      evidence,
    }),
    alternativeActionTitle: role === "primary" ? null : topCandidate.title,
    whyNow: buildWhyNow(context, evidence),
    evidenceLead:
      buildCurrentBlocker(evidence) ??
      buildCurrentCommitment(evidence) ??
      evidence.supportingFacts[0]?.content ??
      "当前还没有更强的证据链，系统先用最近互动和风险窗口给出保守判断。",
    currentBlocker: buildCurrentBlocker(evidence),
    currentCommitment: buildCurrentCommitment(evidence),
    expectedImpact: buildExpectedImpact(ranked.actionType),
    ifNoAction: buildInactionRisk(context, ranked.riskLevel),
    personalizationHint: buildPersonalizationHint({
      actionType: ranked.actionType,
      policyResult: ranked.policyResult,
      context,
      ranked,
      preferenceSummary: input.preferenceSummary,
    }),
    learnedPatternSummary: input.ranked.learnedPatternSummary,
    supportingHighlights: evidence.supportingFacts
      .slice(0, 3)
      .map((fact) => trimText(fact.content, 42)),
    briefingSummary: evidence.briefingSummary ?? null,
    evidenceSummary: evidence.memoryRetrievalPack
      ? `已引用 ${evidence.supportingFactIds.length} 条事实、${evidence.blockerIds.length} 个阻塞、${evidence.commitmentIds.length} 个承诺；检索包入选 ${evidence.memoryRetrievalPack.trace.selectedCount} 条、省略 ${evidence.memoryRetrievalPack.trace.omittedCount} 条。`
      : `已引用 ${evidence.supportingFactIds.length} 条事实、${evidence.blockerIds.length} 个阻塞、${evidence.commitmentIds.length} 个承诺。`,
    memoryRetrievalPack: evidence.memoryRetrievalPack ?? null,
  };
}

export function readRecommendationPresentation(
  recommendation: RecommendationLike,
  options: RecommendationPresentationReadOptions = {},
): RecommendationPresentationModel {
  const english = options.locale ? isEnglishLocale(options.locale) : false;
  const payload =
    typeof recommendation.recommendationPayload === "string"
      ? safeParseJson<Record<string, unknown>>(
          recommendation.recommendationPayload,
          {},
        )
      : (recommendation.recommendationPayload ?? {});

  const rawAppliedPolicyReason =
    recommendation.appliedPolicyRules?.[0]?.reason ?? null;
  const appliedPolicyReason = englishSafeString(rawAppliedPolicyReason, english);
  const rawPolicyHint =
    recommendation.whyNotAutoExecute ??
    (typeof payload.whyNotAutoExecute === "string"
      ? payload.whyNotAutoExecute
      : null) ??
    rawAppliedPolicyReason;
  const policyHint = englishSafeString(rawPolicyHint, english);

  const llmMeta =
    payload.llmMeta && typeof payload.llmMeta === "object"
      ? (payload.llmMeta as Record<string, unknown>)
      : null;
  const decisionRole =
    payload.decisionRole === "secondary" || payload.decisionRole === "defer"
      ? payload.decisionRole
      : "primary";
  const decisionLabelFallback = english
    ? decisionRole === "secondary"
      ? "Alternate move"
      : decisionRole === "defer"
        ? "Defer for now"
        : "Primary move"
    : decisionRole === "secondary"
      ? "次优动作"
      : decisionRole === "defer"
        ? "暂缓处理"
        : "首选动作";
  const evidenceSummaryFallback = english
    ? `References ${parseIdArray(recommendation.supportingFactIds).length} fact(s), ${parseIdArray(recommendation.blockerIds).length} blocker(s), and ${parseIdArray(recommendation.commitmentIds).length} commitment(s).`
    : `已引用 ${parseIdArray(recommendation.supportingFactIds).length} 条事实、${parseIdArray(recommendation.blockerIds).length} 个阻塞、${parseIdArray(recommendation.commitmentIds).length} 个承诺。`;

  return {
    decisionRole,
    decisionLabel: readPresentationString(
      payload,
      "decisionLabel",
      decisionLabelFallback,
      english,
    ),
    tradeoffSummary: readPresentationString(
      payload,
      "tradeoffSummary",
      english
        ? "This recommendation is still ranked by memory, blockers, commitments, and policy boundaries."
        : "当前判断建议仍然主要基于记忆、阻塞、承诺和策略边界做排序。",
      english,
    ),
    alternativeActionTitle: readNullablePresentationString(
      payload,
      "alternativeActionTitle",
      english,
    ),
    whyNow: readPresentationString(
      payload,
      "whyNow",
      english
        ? "This recommendation is ready for review because the current evidence points to a concrete next move."
        : recommendation.explanation,
      english,
    ),
    evidenceLead: readPresentationString(
      payload,
      "evidenceLead",
      english
        ? "This judgement is based on recent activity, structured memory, and the current risk window."
        : "当前判断主要基于最近互动、结构化记忆和风险窗口。",
      english,
    ),
    currentBlocker: readNullablePresentationString(
      payload,
      "currentBlocker",
      english,
    ),
    currentCommitment: readNullablePresentationString(
      payload,
      "currentCommitment",
      english,
    ),
    expectedImpact: readPresentationString(
      payload,
      "expectedImpact",
      english
        ? "This move helps turn the next step into reviewed follow-through instead of leaving it at the judgement layer."
        : "这条动作会帮助你把下一步收口，而不是继续停留在判断层。",
      english,
    ),
    ifNoAction: readPresentationString(
      payload,
      "ifNoAction",
      english
        ? "If no action is taken, resistance and uncertainty around this object will keep accumulating."
        : "如果继续不推进，当前对象的阻力和不确定性都会继续累积。",
      english,
    ),
    personalizationHint: readNullablePresentationString(
      payload,
      "personalizationHint",
      english,
    ),
    learnedPatternSummary: readPresentationStringArray(
      payload,
      "learnedPatternSummary",
      english,
    ),
    supportingHighlights: readPresentationStringArray(
      payload,
      "supportingHighlights",
      english,
    ),
    briefingSummary:
      readNullablePresentationString(payload, "briefingSummary", english),
    evidenceSummary: readPresentationString(
      payload,
      "evidenceSummary",
      evidenceSummaryFallback,
      english,
    ),
    memoryRetrievalPack:
      payload.memoryRetrievalPack &&
      typeof payload.memoryRetrievalPack === "object"
        ? (payload.memoryRetrievalPack as MemoryRetrievalPackSurfaceTrace)
        : null,
    explanation: recommendation.explanation,
    policyResultLabel: policyResultLabel(recommendation.policyResult, english),
    policyHint,
    appliedPolicyReason,
    llmEnhanced: Boolean(payload.llmEnhanced),
    llmHint: llmMeta
      ? english
        ? `LLM explanation layer applied: ${typeof llmMeta.promptKey === "string" ? llmMeta.promptKey : "unlabeled prompt"} / ${
            typeof llmMeta.modelVersion === "string"
              ? llmMeta.modelVersion
              : typeof llmMeta.model === "string"
                ? llmMeta.model
                : "unlabeled model"
          }.${typeof llmMeta.fallbackReason === "string" ? ` Fallback used: ${llmMeta.fallbackReason}.` : " Original policy and ranking boundaries are preserved."}`
        : `已由 LLM 增强解释层处理：${typeof llmMeta.promptKey === "string" ? llmMeta.promptKey : "未标记提示"} / ${
            typeof llmMeta.modelVersion === "string"
              ? llmMeta.modelVersion
              : typeof llmMeta.model === "string"
                ? llmMeta.model
                : "未标记模型"
          }。${typeof llmMeta.fallbackReason === "string" ? ` 当前走了回退：${llmMeta.fallbackReason}。` : " 保留原有策略与排序边界。"}`
      : null,
  };
}

function parseIdArray(value?: string[] | string | null) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return safeParseJson<string[]>(value, []);
}
