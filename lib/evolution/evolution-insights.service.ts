import { ActionType, PreferenceSignalType, RecommendationFeedbackType } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getFormalSkillReviewQueue,
  getOpenSkillSuggestions,
  getRecentFormalReviewDecisions,
  getRecentSkillAdoptions,
} from "@/lib/evolution/skill-suggestion.service";
import type { UiLocale } from "@/lib/i18n/config";
import { ENGINE_DEFAULT_UI_LOCALE, isEnglishLocale } from "@/lib/i18n/config";
import {
  getLocalizedActionModeLabels,
  getLocalizedActionTypeLabels,
  getLocalizedRiskLabels,
} from "@/lib/i18n/labels";
import { safeParseJson } from "@/lib/utils";

const HAN_PATTERN = /[\u4E00-\u9FFF]/;

export async function getActivePatternFacts(input: {
  workspaceId: string;
  userId?: string | null;
  limit?: number;
}) {
  return db.patternFact.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: "ACTIVE",
      OR: [
        { scopeType: "WORKSPACE" },
        { scopeType: "TEAM" },
        ...(input.userId ? [{ scopeType: "USER", scopeId: input.userId }] : []),
      ],
    },
    orderBy: [{ lastDetectedAt: "desc" }, { confidence: "desc" }],
    take: input.limit ?? 12,
  });
}

export async function getOpenStrategySuggestions(workspaceId: string) {
  return db.strategySuggestion.findMany({
    where: {
      workspaceId,
      status: "OPEN",
    },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take: 6,
  });
}

export async function getRecentStrategyAdoptions(workspaceId: string, limit = 4) {
  return db.strategySuggestion.findMany({
    where: {
      workspaceId,
      status: "ACCEPTED",
      appliedAt: { not: null },
    },
    orderBy: [{ appliedAt: "desc" }, { confirmedAt: "desc" }],
    take: limit,
  });
}

export async function getOpenSkillSuggestionPanels(workspaceId: string) {
  return getOpenSkillSuggestions(workspaceId);
}

export async function getFormalSkillReviewPanels(workspaceId: string) {
  return getFormalSkillReviewQueue(workspaceId, 3);
}

export async function getRecentFormalSkillReviewDecisionPanels(workspaceId: string) {
  return getRecentFormalReviewDecisions(workspaceId, 3);
}

function summarizePattern(
  record: {
    patternType: string;
    patternKey?: string | null;
    patternValue?: string | null;
    title: string | null;
    summary: string | null;
    confidence: number;
    evidenceCount: number;
  },
  locale: UiLocale,
) {
  const english = isEnglishLocale(locale);
  const fallback =
    record.patternType === "approval_pattern"
      ? english
        ? "Helm observed that you recently keep manual approval on outbound commitment actions."
        : "系统观察到你最近会保留外发承诺类动作的人工审批。"
      : record.patternType === "communication_style_pattern"
        ? english
          ? "Helm observed that you recently prefer concise outbound wording."
          : "系统观察到你最近更偏好简洁直接的外发文案。"
        : record.patternType === "followup_timing_pattern"
          ? english
            ? "Helm observed that follow-ups within 24 hours after a meeting are more likely to be accepted."
            : "系统观察到会后 24 小时内的跟进行动更容易被采纳。"
          : record.patternType === "blocker_pattern"
            ? english
              ? "Helm observed that budget blockers are becoming a frequent pattern."
              : "系统观察到预算类阻塞正在成为高频模式。"
            : record.patternType === "stalled_opportunity_pattern"
              ? english
                ? "Helm observed that stalled opportunities lose momentum when they sit for more than 5 days."
                : "系统观察到停滞机会超过 5 天未推进时更容易掉速。"
              : record.patternType === "contact_cooling_pattern"
                ? english
                  ? "Helm observed that warm relationships cool down when there is no touchpoint for more than 7 days."
                  : "系统观察到暖关系超过 7 天未触达时更容易降温。"
                : english
                  ? "Helm recently identified a new operating pattern."
                  : "系统最近识别出新的推进规律。";

  return {
    title: selectStoredOrFallback(record.title, fallback, english),
    summary: selectStoredOrFallback(record.summary, fallback, english),
  };
}

function selectStoredOrFallback(value: string | null | undefined, fallback: string, english: boolean) {
  if (!value) return fallback;
  if (english && HAN_PATTERN.test(value)) return fallback;
  return value;
}

export async function getEvolutionInsights(input: {
  workspaceId: string;
  userId?: string | null;
  limit?: number;
  locale?: UiLocale;
}) {
  const locale = input.locale ?? ENGINE_DEFAULT_UI_LOCALE;
  const [patterns, suggestions, skillSuggestions, formalSkillReviewQueue, recentFormalReviewDecisions] = await Promise.all([
    getActivePatternFacts({
      workspaceId: input.workspaceId,
      userId: input.userId,
      limit: input.limit ?? 4,
    }),
    getOpenStrategySuggestions(input.workspaceId),
    getOpenSkillSuggestionPanels(input.workspaceId),
    getFormalSkillReviewPanels(input.workspaceId),
    getRecentFormalSkillReviewDecisionPanels(input.workspaceId),
  ]);
  const [recentAdoptions, recentSkillAdoptions] = await Promise.all([
    getRecentStrategyAdoptions(input.workspaceId, 3),
    getRecentSkillAdoptions(input.workspaceId, 3),
  ]);

  const insights = patterns.slice(0, input.limit ?? 4).map((pattern) => {
    const content = summarizePattern(pattern, locale);
    const evidence = safeParseJson<Record<string, unknown>>(pattern.evidenceSnapshot, {});
    return {
      id: pattern.id,
      type: "pattern" as const,
      title: content.title,
      summary: content.summary,
      confidence: pattern.confidence,
      evidenceCount: pattern.evidenceCount,
      patternType: pattern.patternType,
      scopeType: pattern.scopeType,
      scopeId: pattern.scopeId,
      evidence,
    };
  });

  return {
    insights,
    patterns,
    strategySuggestions: suggestions,
    skillSuggestions,
    formalSkillReviewQueue,
    recentFormalReviewDecisions,
    recentAdoptions,
    recentSkillAdoptions,
  };
}

function patternSupportsActionType(patternType: string, actionType: ActionType) {
  if (patternType === "approval_pattern" || patternType === "communication_style_pattern") {
    return actionType === ActionType.DRAFT_EXTERNAL_EMAIL || actionType === ActionType.GENERATE_REPLY_DRAFT;
  }

  if (patternType === "followup_timing_pattern") {
    return ([ActionType.CREATE_MEETING, ActionType.SEND_MEETING_SUMMARY, ActionType.SCHEDULE_INTERVIEW, ActionType.CREATE_TASK] as ActionType[]).includes(actionType);
  }

  if (patternType === "blocker_pattern") {
    return ([
      ActionType.UPDATE_OPPORTUNITY_STAGE,
      ActionType.CREATE_TASK,
      ActionType.ASSIGN_OWNER,
      ActionType.CHANGE_DUE_DATE,
      ActionType.DRAFT_EXTERNAL_EMAIL,
      ActionType.GENERATE_REPLY_DRAFT,
    ] as ActionType[]).includes(actionType);
  }

  if (patternType === "stalled_opportunity_pattern") {
    return ([ActionType.UPDATE_OPPORTUNITY_STAGE, ActionType.CREATE_TASK, ActionType.ASSIGN_OWNER, ActionType.CHANGE_DUE_DATE] as ActionType[]).includes(actionType);
  }

  if (patternType === "contact_cooling_pattern") {
    return ([ActionType.DRAFT_EXTERNAL_EMAIL, ActionType.GENERATE_REPLY_DRAFT, ActionType.CREATE_MEETING, ActionType.CREATE_TASK] as ActionType[]).includes(actionType);
  }

  return false;
}

function suggestionSupportsActionType(targetPolicyKey: string, actionType: ActionType) {
  if (targetPolicyKey === actionType) return true;
  if (targetPolicyKey === "meeting_followup") {
    return ([ActionType.CREATE_MEETING, ActionType.SEND_MEETING_SUMMARY, ActionType.SCHEDULE_INTERVIEW, ActionType.CREATE_TASK] as ActionType[]).includes(actionType);
  }
  if (targetPolicyKey === "budget_blocker") {
    return ([ActionType.UPDATE_OPPORTUNITY_STAGE, ActionType.CREATE_TASK, ActionType.ASSIGN_OWNER, ActionType.CHANGE_DUE_DATE] as ActionType[]).includes(actionType);
  }
  if (targetPolicyKey === "stalled_opportunity") {
    return ([ActionType.UPDATE_OPPORTUNITY_STAGE, ActionType.CREATE_TASK, ActionType.ASSIGN_OWNER, ActionType.CHANGE_DUE_DATE] as ActionType[]).includes(actionType);
  }
  if (targetPolicyKey === "contact_followup") {
    return ([ActionType.DRAFT_EXTERNAL_EMAIL, ActionType.GENERATE_REPLY_DRAFT, ActionType.CREATE_MEETING, ActionType.CREATE_TASK] as ActionType[]).includes(actionType);
  }
  return false;
}

function summarizePreferenceSignal(
  signal: {
    signalType: PreferenceSignalType;
    signalKey: string;
    signalValue: string;
    weight: number;
  },
  locale: UiLocale,
) {
  const english = isEnglishLocale(locale);
  if (signal.signalType === PreferenceSignalType.APPROVAL_PREFERENCE) {
    if (signal.signalValue === "approved_after_edit") {
      return english
        ? "You usually edit before approving similar actions, so Helm will keep editable drafts."
        : "你通常会先改写再批准同类动作，系统会继续保留可编辑草稿。";
    }
    if (signal.signalValue === "approved") {
      return english
        ? "You recently accept similar actions more often, so Helm will rank this suggestion type higher."
        : "你最近更常直接采纳同类动作，系统会把这类建议排得更靠前。";
    }
    if (signal.signalValue === "rejected") {
      return english
        ? "You recently reject similar actions more often, so Helm will reduce automatic push tendency."
        : "你最近更常拒绝同类动作，系统会降低自动推进倾向。";
    }
  }

  if (signal.signalType === PreferenceSignalType.TIMING_PREFERENCE) {
    return english
      ? `Helm observed that "${signal.signalKey}" fits a ${signal.signalValue} timing window.`
      : `系统观察到“${signal.signalKey}”更适合按 ${signal.signalValue} 的窗口推进。`;
  }

  if (signal.signalType === PreferenceSignalType.RISK_TOLERANCE) {
    return english
      ? `Helm now treats "${signal.signalKey}" as a higher-priority risk signal.`
      : `系统已经把“${signal.signalKey}”视为更高优先级的风险信号。`;
  }

  return english
    ? `Helm recently recorded a new preference signal: ${signal.signalKey}.`
    : `系统最近记录了一个新的偏好信号：${signal.signalKey}。`;
}

export async function getApprovalLearningPanels(input: {
  workspaceId: string;
  userId?: string | null;
  actionTypes: ActionType[];
  locale?: UiLocale;
}) {
  const locale = input.locale ?? ENGINE_DEFAULT_UI_LOCALE;
  const actionTypeLabels = getLocalizedActionTypeLabels(locale);
  const actionModeLabels = getLocalizedActionModeLabels(locale);
  const riskLabels = getLocalizedRiskLabels(locale);
  const actionTypes = Array.from(new Set(input.actionTypes));
  if (!actionTypes.length) {
    return {} as Record<string, never>;
  }

  const [policies, patterns, userSignals, workspaceSignals, feedbacks, suggestions] = await Promise.all([
    db.policyRule.findMany({
      where: {
        workspaceId: input.workspaceId,
        actionType: { in: actionTypes },
      },
    }),
    db.patternFact.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: "ACTIVE",
      },
      orderBy: [{ lastDetectedAt: "desc" }, { confidence: "desc" }],
    }),
    input.userId
      ? db.preferenceSignal.findMany({
          where: {
            workspaceId: input.workspaceId,
            userId: input.userId,
          },
          orderBy: [{ updatedAt: "desc" }],
        })
      : Promise.resolve([]),
    db.preferenceSignal.findMany({
      where: {
        workspaceId: input.workspaceId,
        userId: null,
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    db.recommendationFeedback.findMany({
      where: {
        workspaceId: input.workspaceId,
        recommendationLog: {
          actionType: { in: actionTypes },
        },
      },
      include: {
        recommendationLog: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 80,
    }),
    db.strategySuggestion.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: { in: ["OPEN", "ACCEPTED"] },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
  ]);

  return Object.fromEntries(
    actionTypes.map((actionType) => {
      const relevantPatterns = patterns.filter((pattern) => patternSupportsActionType(pattern.patternType, actionType)).slice(0, 4);
      const relevantSignals = [
        ...userSignals.filter((signal) => signal.signalKey === actionType),
        ...workspaceSignals.filter((signal) => suggestionSupportsActionType(signal.signalKey, actionType)),
      ].slice(0, 4);
      const relevantFeedbacks = feedbacks.filter((feedback) => feedback.recommendationLog.actionType === actionType);
      const openSuggestions = suggestions.filter((suggestion) => suggestion.status === "OPEN" && suggestionSupportsActionType(suggestion.targetPolicyKey, actionType)).slice(0, 2);
      const acceptedSuggestions = suggestions.filter((suggestion) => suggestion.status === "ACCEPTED" && suggestionSupportsActionType(suggestion.targetPolicyKey, actionType)).slice(0, 2);
      const policy = policies.find((item) => item.actionType === actionType) ?? null;

      const feedbackStats = {
        total: relevantFeedbacks.length,
        approved: relevantFeedbacks.filter((item) => item.feedbackType === RecommendationFeedbackType.APPROVED).length,
        editedApproved: relevantFeedbacks.filter((item) => item.feedbackType === RecommendationFeedbackType.EDITED_AND_APPROVED).length,
        rejected: relevantFeedbacks.filter((item) => item.feedbackType === RecommendationFeedbackType.REJECTED).length,
        autoExecuted: relevantFeedbacks.filter((item) => item.feedbackType === RecommendationFeedbackType.AUTO_EXECUTED).length,
      };

      const summaryLines = [
        ...relevantPatterns.slice(0, 2).map((pattern) => {
          const content = summarizePattern(pattern, locale);
          return content.summary ?? content.title;
        }),
        ...relevantSignals.slice(0, 2).map((signal) => summarizePreferenceSignal(signal, locale)),
      ].slice(0, 3);

      return [
        actionType,
        {
          actionType,
          actionLabel: actionTypeLabels[actionType],
          policy: policy
            ? {
                id: policy.id,
                name: policy.name,
                mode: policy.mode,
                riskThreshold: policy.riskThreshold,
                enabled: policy.enabled,
                modeLabel: actionModeLabels[policy.mode],
                riskLabel: riskLabels[policy.riskThreshold],
              }
            : null,
          feedbackStats,
          learnedPatterns: relevantPatterns.map((pattern) => {
            const content = summarizePattern(pattern, locale);
            return {
              id: pattern.id,
              title: content.title,
              summary: content.summary,
              confidence: pattern.confidence,
              evidenceCount: pattern.evidenceCount,
            };
          }),
          signalHints: relevantSignals.map((signal) => ({
            id: signal.id,
            summary: summarizePreferenceSignal(signal, locale),
            weight: signal.weight,
            updatedAt: signal.updatedAt,
          })),
          openSuggestions: openSuggestions.map((suggestion) => ({
            id: suggestion.id,
            title: suggestion.title,
            reason: suggestion.reason,
            currentValue: suggestion.currentValue,
            suggestedValue: suggestion.suggestedValue,
            confidence: suggestion.confidence,
            createdAt: suggestion.createdAt,
          })),
          acceptedSuggestions: acceptedSuggestions.map((suggestion) => ({
            id: suggestion.id,
            title: suggestion.title,
            appliedEffectSummary: suggestion.appliedEffectSummary,
            confirmedAt: suggestion.confirmedAt,
            appliedAt: suggestion.appliedAt,
          })),
          summaryLines,
        },
      ];
    }),
  ) as Record<
    string,
    {
      actionType: ActionType;
      actionLabel: string;
      policy: {
        id: string;
        name: string;
        mode: string;
        riskThreshold: string;
        enabled: boolean;
        modeLabel: string;
        riskLabel: string;
      } | null;
      feedbackStats: {
        total: number;
        approved: number;
        editedApproved: number;
        rejected: number;
        autoExecuted: number;
      };
      learnedPatterns: Array<{
        id: string;
        title: string;
        summary: string;
        confidence: number;
        evidenceCount: number;
      }>;
      signalHints: Array<{
        id: string;
        summary: string;
        weight: number;
        updatedAt: Date;
      }>;
      openSuggestions: Array<{
        id: string;
        title: string;
        reason: string;
        currentValue: string | null;
        suggestedValue: string | null;
        confidence: number;
        createdAt: Date;
      }>;
      acceptedSuggestions: Array<{
        id: string;
        title: string;
        appliedEffectSummary: string | null;
        confirmedAt: Date | null;
        appliedAt: Date | null;
      }>;
      summaryLines: string[];
    }
  >;
}
