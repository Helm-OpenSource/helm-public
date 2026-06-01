import { ActionExecutionMode, PreferenceSignalType, type PolicyRule } from "@prisma/client";
import { stageLabels } from "@/data/constants";
import { resolvePolicyDecision } from "@/lib/policies";
import type {
  RecommendationPatternFact,
  RankedRecommendationCandidate,
  RecommendationCandidate,
  RecommendationEvidence,
  RecommendationObjectContext,
} from "@/lib/recommendations/types";

type PreferenceSummary = {
  boostByActionType: Record<string, number>;
  rejectByActionType: Record<string, number>;
  timingPreferences: Record<string, { value: string; weight: number }>;
  riskPreferences: Record<string, { value: string; weight: number }>;
  communicationPreferences: Record<string, { value: string; weight: number }>;
};

const policyFitMap: Record<ActionExecutionMode, number> = {
  [ActionExecutionMode.SUGGEST_ONLY]: 58,
  [ActionExecutionMode.REQUIRES_APPROVAL]: 74,
  [ActionExecutionMode.AUTO_WITHIN_THRESHOLD]: 92,
  [ActionExecutionMode.FORBIDDEN]: 0,
};

function formatStagePatternKey(patternKey: string) {
  return stageLabels[patternKey as keyof typeof stageLabels] ?? patternKey.replace(/_/g, " ");
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function summarizePreferenceSignals(
  signals: Array<{
    signalType: PreferenceSignalType;
    signalKey: string;
    signalValue: string;
    weight: number;
  }>,
) {
  return signals.reduce<PreferenceSummary>(
    (acc, signal) => {
      const actionType = signal.signalKey;
      if (signal.signalValue.includes("approved") || signal.signalValue.includes("auto")) {
        acc.boostByActionType[actionType] = (acc.boostByActionType[actionType] ?? 0) + signal.weight;
      }

      if (signal.signalValue.includes("rejected")) {
        acc.rejectByActionType[actionType] = (acc.rejectByActionType[actionType] ?? 0) + signal.weight;
      }

      if (signal.signalType === PreferenceSignalType.TIMING_PREFERENCE) {
        acc.timingPreferences[signal.signalKey] = {
          value: signal.signalValue,
          weight: signal.weight,
        };
      }

      if (signal.signalType === PreferenceSignalType.RISK_TOLERANCE) {
        acc.riskPreferences[signal.signalKey] = {
          value: signal.signalValue,
          weight: signal.weight,
        };
      }

      if (signal.signalType === PreferenceSignalType.COMMUNICATION_STYLE) {
        acc.communicationPreferences[signal.signalKey] = {
          value: signal.signalValue,
          weight: signal.weight,
        };
      }

      return acc;
    },
    {
      boostByActionType: {},
      rejectByActionType: {},
      timingPreferences: {},
      riskPreferences: {},
      communicationPreferences: {},
    },
  );
}

function computeUrgencyScore(context: RecommendationObjectContext, evidence: RecommendationEvidence, candidate: RecommendationCandidate) {
  const overdueCount = evidence.commitments.filter((item) => item.overdueFlag).length;
  const maxBlockerSeverity = evidence.blockers[0]?.severity ?? 0;
  const dueSoonBoost = context.dueSoon ? 18 : 0;
  const staleBoost = Math.min(28, context.daysSinceLastTouch * 2);
  const blockerBoost = candidate.addressesBlocker ? maxBlockerSeverity * 0.22 : maxBlockerSeverity * 0.12;
  const commitmentBoost = candidate.usesCommitment ? overdueCount * 14 : overdueCount * 7;

  return clamp(24 + dueSoonBoost + staleBoost + blockerBoost + commitmentBoost);
}

function computeImpactScore(context: RecommendationObjectContext, evidence: RecommendationEvidence, candidate: RecommendationCandidate) {
  const blockerImpact = candidate.addressesBlocker ? (evidence.blockers[0]?.severity ?? 0) * 0.25 : 0;
  const relationshipImpact = context.roleWeight * 0.2;
  const priorityImpact = context.priorityScore * 0.45;
  const outboundBoost = candidate.outbound ? 8 : 0;

  return clamp(22 + priorityImpact + relationshipImpact + blockerImpact + outboundBoost);
}

function computeConfidenceScore(evidence: RecommendationEvidence) {
  if (!evidence.supportingFacts.length) {
    return 42;
  }

  const avgConfidence =
    evidence.supportingFacts.reduce((sum, fact) => sum + fact.confidence, 0) / evidence.supportingFacts.length;
  const avgFreshness =
    evidence.supportingFacts.reduce((sum, fact) => sum + fact.freshnessScore, 0) / evidence.supportingFacts.length;
  const confirmedCount = evidence.supportingFacts.filter((fact) => fact.confirmedByUser).length;

  return clamp(avgConfidence * 0.55 + avgFreshness * 0.2 + confirmedCount * 8 + evidence.supportingFacts.length * 4);
}

function computePersonalizationScore(candidate: RecommendationCandidate, preferences: PreferenceSummary) {
  const boost = preferences.boostByActionType[candidate.actionType] ?? 0;
  const reject = preferences.rejectByActionType[candidate.actionType] ?? 0;
  let score = 50 + boost * 0.35 - reject * 0.45;

  if (
    candidate.outbound &&
    preferences.communicationPreferences.outbound_message?.value === "concise_draft_preferred"
  ) {
    score += 8;
  }

  return clamp(score);
}

function buildSignalAdjustments(input: {
  context: RecommendationObjectContext;
  candidate: RecommendationCandidate;
  preferences: PreferenceSummary;
}) {
  const adjustments = {
    urgency: 0,
    impact: 0,
    personalization: 0,
    risk: 0,
    learnedSignalSummary: [] as string[],
  };

  const meetingFollowup = input.preferences.timingPreferences.meeting_followup;
  if (
    meetingFollowup?.value === "within_24h_preferred" &&
    input.context.objectType === "MEETING" &&
    ["SEND_MEETING_SUMMARY", "CREATE_TASK", "CREATE_MEETING", "DRAFT_EXTERNAL_EMAIL"].includes(input.candidate.actionType)
  ) {
    adjustments.urgency += 10;
    adjustments.personalization += 6;
    adjustments.learnedSignalSummary.push("系统已经把会后 24 小时窗口视为更优先的推进节奏");
  }

  const contactFollowup = input.preferences.timingPreferences.contact_followup;
  if (
    contactFollowup?.value === "within_48h_preferred" &&
    input.context.objectType === "CONTACT" &&
    ["DRAFT_EXTERNAL_EMAIL", "GENERATE_REPLY_DRAFT", "CREATE_MEETING", "CREATE_TASK"].includes(input.candidate.actionType)
  ) {
    adjustments.urgency += 12;
    adjustments.personalization += 5;
    adjustments.learnedSignalSummary.push("系统已经把关系恢复动作收紧到 48 小时窗口");
  }

  const stalledOpportunity = input.preferences.riskPreferences.stalled_opportunity;
  if (
    stalledOpportunity?.value === "high_risk" &&
    input.context.objectType === "OPPORTUNITY" &&
    input.context.daysSinceLastTouch >= 5 &&
    ["UPDATE_OPPORTUNITY_STAGE", "CREATE_TASK", "ASSIGN_OWNER", "CHANGE_DUE_DATE"].includes(input.candidate.actionType)
  ) {
    adjustments.urgency += 14;
    adjustments.impact += 8;
    adjustments.risk += 8;
    adjustments.learnedSignalSummary.push("系统已经把停滞机会视为更强风险信号");
  }

  const budgetBlocker = input.preferences.riskPreferences.budget_blocker;
  if (
    budgetBlocker?.value === "high_risk" &&
    ["UPDATE_OPPORTUNITY_STAGE", "CREATE_TASK", "ASSIGN_OWNER", "CHANGE_DUE_DATE", "DRAFT_EXTERNAL_EMAIL", "GENERATE_REPLY_DRAFT"].includes(
      input.candidate.actionType,
    )
  ) {
    adjustments.impact += 6;
    adjustments.risk += 10;
    adjustments.learnedSignalSummary.push("系统已经提高了预算类阻塞的风险权重");
  }

  return {
    ...adjustments,
    learnedSignalSummary: Array.from(new Set(adjustments.learnedSignalSummary)).slice(0, 3),
  };
}

function buildPatternAdjustments(input: {
  context: RecommendationObjectContext;
  evidence: RecommendationEvidence;
  candidate: RecommendationCandidate;
  policyResult: ActionExecutionMode;
  patternFacts: RecommendationPatternFact[];
}) {
  const adjustments = {
    urgency: 0,
    impact: 0,
    personalization: 0,
    risk: 0,
    learnedPatternSummary: [] as string[],
  };

  for (const pattern of input.patternFacts) {
    if (
      pattern.patternType === "communication_style_pattern" &&
      input.candidate.outbound &&
      ["DRAFT_EXTERNAL_EMAIL", "GENERATE_REPLY_DRAFT"].includes(input.candidate.actionType)
    ) {
      adjustments.personalization += 12;
      adjustments.learnedPatternSummary.push("你最近更偏好简洁直接的外发文案");
    }

    if (
      pattern.patternType === "approval_pattern" &&
      input.candidate.outbound &&
      pattern.patternKey === "external_commitment"
    ) {
      adjustments.personalization += input.policyResult === ActionExecutionMode.REQUIRES_APPROVAL ? 8 : 4;
      adjustments.learnedPatternSummary.push("你最近会保留外发承诺类动作的人工审批");
    }

    if (
      pattern.patternType === "followup_timing_pattern" &&
      input.context.objectType === "MEETING" &&
      ["SEND_MEETING_SUMMARY", "CREATE_TASK", "CREATE_MEETING", "DRAFT_EXTERNAL_EMAIL"].includes(input.candidate.actionType)
    ) {
      adjustments.urgency += 10;
      adjustments.learnedPatternSummary.push("你团队在会后 24 小时内的跟进采纳率更高");
    }

    if (
      pattern.patternType === "stalled_opportunity_pattern" &&
      input.context.objectType === "OPPORTUNITY" &&
      input.context.stageLabel === pattern.patternKey &&
      input.context.daysSinceLastTouch >= 5
    ) {
      adjustments.urgency += 12;
      adjustments.impact += 6;
      adjustments.learnedPatternSummary.push(`${formatStagePatternKey(pattern.patternKey)}超过 5 天未推进时更容易掉速`);
    }

    if (
      pattern.patternType === "blocker_pattern" &&
      pattern.patternKey === "budget" &&
      input.evidence.blockers.some((blocker) => /(budget|付款|预算|payment)/i.test(`${blocker.title} ${blocker.blockerText}`))
    ) {
      adjustments.impact += 8;
      adjustments.risk += 10;
      adjustments.learnedPatternSummary.push("预算相关阻塞最近在你的工作区里出现得更频繁");
    }
  }

  return {
    ...adjustments,
    learnedPatternSummary: Array.from(new Set(adjustments.learnedPatternSummary)).slice(0, 3),
  };
}

function computeRiskScore(context: RecommendationObjectContext, candidate: RecommendationCandidate, evidence: RecommendationEvidence) {
  const outboundRisk = candidate.outbound ? 26 : 0;
  const commitmentRisk = candidate.usesCommitment ? 12 : 0;
  const blockerRisk = (evidence.blockers[0]?.severity ?? 0) * 0.18;
  const baseRisk = {
    LOW: 18,
    MEDIUM: 38,
    HIGH: 64,
    CRITICAL: 82,
  }[context.baseRiskLevel];

  return clamp(baseRisk + outboundRisk + commitmentRisk + blockerRisk);
}

export function rankRecommendationCandidates(input: {
  context: RecommendationObjectContext;
  evidence: RecommendationEvidence;
  candidates: RecommendationCandidate[];
  policies: PolicyRule[];
  preferenceSummary: PreferenceSummary;
  patternFacts: RecommendationPatternFact[];
}) {
  return input.candidates
    .map<RankedRecommendationCandidate>((candidate) => {
      const policy = input.policies.find((item) => item.actionType === candidate.actionType) ?? null;
      const decision = resolvePolicyDecision({
        actionType: candidate.actionType,
        riskLevel: candidate.riskLevel,
        policy,
      });

      const urgencyScore = computeUrgencyScore(input.context, input.evidence, candidate);
      const impactScore = computeImpactScore(input.context, input.evidence, candidate);
      const confidenceScore = computeConfidenceScore(input.evidence);
      const personalizationScore = computePersonalizationScore(candidate, input.preferenceSummary);
      const policyFitScore = policyFitMap[decision.mode];
      const riskScore = computeRiskScore(input.context, candidate, input.evidence);
      const signalAdjustments = buildSignalAdjustments({
        context: input.context,
        candidate,
        preferences: input.preferenceSummary,
      });
      const adaptiveAdjustments = buildPatternAdjustments({
        context: input.context,
        evidence: input.evidence,
        candidate,
        policyResult: decision.mode,
        patternFacts: input.patternFacts,
      });

      const adjustedUrgency = clamp(urgencyScore + adaptiveAdjustments.urgency + signalAdjustments.urgency);
      const adjustedImpact = clamp(impactScore + adaptiveAdjustments.impact + signalAdjustments.impact);
      const adjustedPersonalization = clamp(
        personalizationScore + adaptiveAdjustments.personalization + signalAdjustments.personalization,
      );
      const adjustedRisk = clamp(riskScore + adaptiveAdjustments.risk + signalAdjustments.risk);

      const score = clamp(
        adjustedUrgency * 0.25 +
        adjustedImpact * 0.25 +
        confidenceScore * 0.2 +
        adjustedPersonalization * 0.15 +
        policyFitScore * 0.1 -
        adjustedRisk * 0.05,
      );

      return {
        ...candidate,
        score,
        urgencyScore: adjustedUrgency,
        impactScore: adjustedImpact,
        confidenceScore,
        personalizationScore: adjustedPersonalization,
        policyFitScore,
        riskScore: adjustedRisk,
        policyResult: decision.mode,
        policyReason: decision.reason,
        appliedPolicyName: decision.appliedPolicyName,
        appliedPolicyMode: decision.appliedPolicyMode,
        appliedRiskThreshold: decision.appliedRiskThreshold,
        whyNotAutoExecute:
          decision.mode === ActionExecutionMode.REQUIRES_APPROVAL && decision.resolvedBy !== "default_fallback"
            ? decision.reason
            : decision.mode === ActionExecutionMode.SUGGEST_ONLY
              ? "当前策略设为仅建议，系统不会自动替你执行。"
          : decision.mode === ActionExecutionMode.FORBIDDEN
                ? "当前策略禁止这类动作继续执行。"
                : null,
        learnedPatternSummary: Array.from(
          new Set([...adaptiveAdjustments.learnedPatternSummary, ...signalAdjustments.learnedSignalSummary]),
        ).slice(0, 4),
      };
    })
    .sort((left, right) => right.score - left.score);
}
