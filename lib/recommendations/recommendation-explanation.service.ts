import { compactText, trimText } from "@/lib/utils";
import type { RankedRecommendationCandidate, RecommendationEvidence, RecommendationObjectContext } from "@/lib/recommendations/types";
import type { UiLocale } from "@/lib/i18n/config";
import { ENGINE_DEFAULT_UI_LOCALE, isEnglishLocale } from "@/lib/i18n/config";

const HAN_PATTERN = /[\u4E00-\u9FFF]/;

function englishSafe(value: string, fallback: string) {
  if (!value || HAN_PATTERN.test(value)) return fallback;
  return value;
}

export function buildRecommendationExplanation(input: {
  context: RecommendationObjectContext;
  evidence: RecommendationEvidence;
  ranked: RankedRecommendationCandidate;
  locale?: UiLocale;
}) {
  const { evidence, ranked } = input;
  const locale = input.locale ?? ENGINE_DEFAULT_UI_LOCALE;
  const english = isEnglishLocale(locale);
  const topFact = evidence.supportingFacts[0];
  const topBlocker = evidence.blockers[0];
  const overdueCommitment = evidence.commitments.find((item) => item.overdueFlag) ?? evidence.commitments[0];

  const segments = english
    ? [
        overdueCommitment
          ? `The current commitment "${overdueCommitment.title}" is ${overdueCommitment.overdueFlag ? "overdue" : "still open"}`
          : null,
        topBlocker ? `Main blocker is "${topBlocker.title}"` : null,
        topFact ? `Recently confirmed signal is "${trimText(topFact.content, 28)}"` : null,
        evidence.briefingSummary ? `Recent briefing judgement is "${trimText(evidence.briefingSummary, 36)}"` : null,
        evidence.recentThreads?.[0]?.subject ? `Recent external thread centers on "${trimText(evidence.recentThreads[0].subject, 24)}"` : null,
      ].filter(Boolean)
    : [
        overdueCommitment
          ? `当前还有承诺“${overdueCommitment.title}”${overdueCommitment.overdueFlag ? "已经逾期" : "仍未完成"}`
          : null,
        topBlocker ? `主要阻塞是“${topBlocker.title}”` : null,
        topFact ? `最近确认的关键信号是“${trimText(topFact.content, 28)}”` : null,
        evidence.briefingSummary ? `最近简报的判断是“${trimText(evidence.briefingSummary, 36)}”` : null,
        evidence.recentThreads?.[0]?.subject ? `最近外部线程主要围绕“${trimText(evidence.recentThreads[0].subject, 24)}”` : null,
      ].filter(Boolean);

  const priorityReason =
    ranked.urgencyScore >= 70
      ? english
        ? "This has entered a high-priority window"
        : "这件事已经进入高优先级窗口"
      : ranked.impactScore >= 70
        ? english
          ? "This has a stronger impact on the current operating outcome"
          : "这件事对当前推进结果影响更大"
        : english
          ? "This is the right next step because it closes the loop faster"
          : "这件事适合先做，因为能更快把下一步收口";

  const policyLine =
    ranked.policyResult === "AUTO_WITHIN_THRESHOLD"
      ? english
        ? "Under current rules, this action can be prepared within policy thresholds while keeping review visible."
        : "按当前规则，这类动作会在条件内准备，并先保留复核。"
      : ranked.policyResult === "REQUIRES_APPROVAL"
        ? english
          ? `Under current rules, this action requires review. ${englishSafe(
              ranked.policyReason,
              "Review is required by workspace policy.",
            )}`
          : `按当前规则，这类动作需要复核。${ranked.policyReason}`
        : ranked.policyResult === "SUGGEST_ONLY"
          ? english
            ? "Under current rules, this action is suggestion-only and will not execute for you."
            : "按当前规则，这类动作目前只给建议，不会直接替你执行。"
          : english
            ? "Under current rules, this action cannot be executed directly."
            : "按当前规则，这类动作当前不能直接执行。";

  const learnedPatternLine = ranked.learnedPatternSummary.length
    ? english
      ? `Recently learned: ${ranked.learnedPatternSummary
          .map((summary) => englishSafe(summary, "Helm applied a recent learned operating pattern"))
          .join("; ")}.`
      : `最近还学到：${ranked.learnedPatternSummary.join("；")}。`
    : "";

  const explanation = english
    ? `${priorityReason}. ${segments.length ? `${segments.join(", ")}. ` : ""}${learnedPatternLine}${policyLine}`
    : `${priorityReason}。${segments.length ? `${segments.join("，")}。` : ""}${learnedPatternLine}${policyLine}`;

  return {
    supportingFactIds: evidence.supportingFactIds,
    blockerIds: evidence.blockerIds,
    commitmentIds: evidence.commitmentIds,
    appliedPolicyRules: [
      {
        name: ranked.appliedPolicyName,
        mode: ranked.appliedPolicyMode,
        reason: ranked.policyReason,
      },
    ],
    explanation: compactText(explanation),
    whyNotAutoExecute: ranked.whyNotAutoExecute ?? null,
  };
}
