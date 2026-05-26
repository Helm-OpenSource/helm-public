import { compactText, trimText } from "@/lib/utils";
import type { RankedRecommendationCandidate, RecommendationEvidence, RecommendationObjectContext } from "@/lib/recommendations/types";

export function buildRecommendationExplanation(input: {
  context: RecommendationObjectContext;
  evidence: RecommendationEvidence;
  ranked: RankedRecommendationCandidate;
}) {
  const { evidence, ranked } = input;
  const topFact = evidence.supportingFacts[0];
  const topBlocker = evidence.blockers[0];
  const overdueCommitment = evidence.commitments.find((item) => item.overdueFlag) ?? evidence.commitments[0];

  const segments = [
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
      ? "这件事已经进入高优先级窗口"
      : ranked.impactScore >= 70
        ? "这件事对当前推进结果影响更大"
        : "这件事适合先做，因为能更快把下一步收口";

  const policyLine =
    ranked.policyResult === "AUTO_WITHIN_THRESHOLD"
      ? "按当前规则，这类动作会在条件内准备，并先保留复核。"
      : ranked.policyResult === "REQUIRES_APPROVAL"
        ? `按当前规则，这类动作需要复核。${ranked.policyReason}`
        : ranked.policyResult === "SUGGEST_ONLY"
          ? "按当前规则，这类动作目前只给建议，不会直接替你执行。"
          : "按当前规则，这类动作当前不能直接执行。";

  const learnedPatternLine = ranked.learnedPatternSummary.length
    ? `最近还学到：${ranked.learnedPatternSummary.join("；")}。`
    : "";

  const explanation = `${priorityReason}。${segments.length ? `${segments.join("，")}。` : ""}${learnedPatternLine}${policyLine}`;

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
