import { biReportAnalysisSchema, buildBiReportAnalysisPrompt, llmPromptVersions } from "@/lib/llm/prompt-registry";
import { executeLLMTask } from "@/lib/llm/provider-registry";
import { reviewBiReportAnalysisWithLLM } from "@/lib/llm-workflows/review-bi-report.workflow";
import { parseLlmJsonOrThrow } from "@/lib/llm/output-parse-error";
import type { BiReportAnalysisOutput } from "@/lib/bi-report-skill/types";
import type { BiReportOdpsKnowledgeContext } from "@/lib/bi-report-skill/odps-knowledge";

export async function analyzeBiReportWithLLM(input: {
  workspaceId: string;
  userId?: string | null;
  skillName: string;
  severityLabel: string;
  windowLabel: string;
  summaryMetrics: Array<{ label: string; value: string }>;
  matchedRules: string[];
  deterministicFindings: string[];
  recentRunContext?: {
    continuityStatus: string;
    historicalContext: string | null;
  };
  recentFeedbackContext?: {
    feedbackContext: string | null;
  };
  similarCaseContext?: {
    caseContext: string | null;
  };
  odpsKnowledgeContext?: BiReportOdpsKnowledgeContext | null;
  boundaries: string[];
  skillPromptTemplate?: string | null;
  fallback: BiReportAnalysisOutput;
}) {
  const prompt = buildBiReportAnalysisPrompt({
    skillName: input.skillName,
    severityLabel: input.severityLabel,
    windowLabel: input.windowLabel,
    summaryMetrics: input.summaryMetrics,
    matchedRules: input.matchedRules,
    deterministicFindings: input.deterministicFindings,
    recentRunContext: input.recentRunContext,
    recentFeedbackContext: input.recentFeedbackContext,
    similarCaseContext: input.similarCaseContext,
    odpsKnowledgeContext: input.odpsKnowledgeContext,
    boundaries: input.boundaries,
    skillPromptTemplate: input.skillPromptTemplate,
  });

  const result = await executeLLMTask<BiReportAnalysisOutput>({
    workspaceId: input.workspaceId,
    userId: input.userId,
    taskType: "BI_REPORT_ANALYSIS",
    promptKey: prompt.promptKey,
    promptVersion: llmPromptVersions.biReportAnalysis,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    inputSummary: `${input.skillName} 的 BI report 解释`,
    outputMode: "json",
    jsonSchema: biReportAnalysisSchema,
    fallbackOutput: input.fallback,
    parseOutput: (rawText) => parseLlmJsonOrThrow<BiReportAnalysisOutput>(rawText),
  });

  const normalized = normalizeBiReportAnalysisOutput(result.output, input.fallback);
  const reviewResult = await reviewBiReportAnalysisWithLLM({
    workspaceId: input.workspaceId,
    userId: input.userId,
    skillName: input.skillName,
    severityLabel: input.severityLabel,
    windowLabel: input.windowLabel,
    summaryMetrics: input.summaryMetrics,
    matchedRules: input.matchedRules,
    boundaries: input.boundaries,
    deterministicFindings: input.deterministicFindings,
    candidate: normalized,
  });
  const reviewed = applyBiReportReview(normalized, reviewResult.output);

  const output: BiReportAnalysisOutput = {
    ...reviewed,
    generationMode: result.fallbackUsed ? "fallback" : "llm_enhanced",
    llmMeta: {
      provider: result.provider,
      model: result.model,
      modelVersion: result.modelVersion,
      modelRole: result.modelRole,
      promptKey: result.promptKey,
      promptVersion: result.promptVersion,
      success: result.success,
      fallbackUsed: result.fallbackUsed,
      fallbackReason: result.fallbackReason,
      errorMessage: result.errorMessage ?? null,
      latencyMs: result.latencyMs,
      similarCaseContext: input.similarCaseContext
        ? {
            hasCaseContext: Boolean(input.similarCaseContext.caseContext),
          }
        : null,
      odpsKnowledgeContext: input.odpsKnowledgeContext
        ? {
            matchedAliases: input.odpsKnowledgeContext.matchedAliases,
            tableAliases: input.odpsKnowledgeContext.tableAliases.length,
            fieldConventions: input.odpsKnowledgeContext.fieldConventions.length,
            enumKnowledge: input.odpsKnowledgeContext.enumKnowledge.length,
            queryConventions: input.odpsKnowledgeContext.queryConventions.length,
          }
        : null,
      reviewer: {
        provider: reviewResult.provider,
        model: reviewResult.model,
        modelVersion: reviewResult.modelVersion,
        promptKey: reviewResult.promptKey,
        promptVersion: reviewResult.promptVersion,
        success: reviewResult.success,
        fallbackUsed: reviewResult.fallbackUsed,
        fallbackReason: reviewResult.fallbackReason ?? null,
        approved: reviewResult.output.approved,
        issueCodes: reviewResult.output.issueCodes,
        issueNotes: reviewResult.output.issueNotes ?? [],
        rewritten: didBiReportReviewRewrite(normalized, reviewResult.output),
      },
    },
  };

  return {
    ...result,
    output,
  };
}

function normalizeBiReportAnalysisOutput(
  candidate: BiReportAnalysisOutput,
  fallback: BiReportAnalysisOutput,
): BiReportAnalysisOutput {
  return {
    headline: selectPreferredSentence(candidate.headline, fallback.headline),
    // Keep the deterministic summary as the default source of truth.
    summary: selectPreferredSentence(fallback.summary, fallback.summary),
    findings: selectPreferredList(candidate.findings, fallback.findings),
    possibleCauses: selectPreferredList(candidate.possibleCauses, fallback.possibleCauses),
    recommendedActions: selectPreferredList(candidate.recommendedActions, fallback.recommendedActions),
    confidence: normalizeConfidence(candidate.confidence, fallback.confidence ?? null),
    continuityStatus: fallback.continuityStatus,
    historicalContext: fallback.historicalContext,
    feedbackContext: fallback.feedbackContext,
    // Keep boundary wording deterministic so LLM cannot weaken the guardrail.
    boundaryNote: selectPreferredSentence(fallback.boundaryNote, fallback.boundaryNote),
  };
}

function selectPreferredSentence(primary: unknown, fallback: string) {
  if (typeof primary !== "string") {
    return fallback;
  }

  const normalized = primary.trim().replace(/\s+/g, " ");
  if (normalized.length < 6) {
    return fallback;
  }

  return normalized;
}

function selectPreferredList(primary: unknown, fallback: string[]) {
  if (!Array.isArray(primary)) {
    return fallback;
  }

  const normalized = primary
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter((item) => item.length >= 6)
    .slice(0, 5);

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeConfidence(primary: unknown, fallback: number | null) {
  if (typeof primary !== "number" || Number.isNaN(primary)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, primary));
}

function applyBiReportReview(
  candidate: BiReportAnalysisOutput,
  review: {
    approved: boolean;
    issueCodes: string[];
    issueNotes?: string[] | null;
    rewrittenHeadline?: string | null;
    rewrittenPossibleCauses?: string[] | null;
    rewrittenRecommendedActions?: string[] | null;
  },
): BiReportAnalysisOutput {
  return {
    ...candidate,
    headline: selectPreferredSentence(review.rewrittenHeadline, candidate.headline),
    possibleCauses: selectPreferredList(review.rewrittenPossibleCauses, candidate.possibleCauses),
    recommendedActions: selectPreferredList(
      review.rewrittenRecommendedActions,
      candidate.recommendedActions,
    ),
  };
}

function didBiReportReviewRewrite(
  candidate: BiReportAnalysisOutput,
  review: {
    rewrittenHeadline?: string | null;
    rewrittenPossibleCauses?: string[] | null;
    rewrittenRecommendedActions?: string[] | null;
  },
) {
  const nextCandidate = applyBiReportReview(candidate, {
    approved: true,
    issueCodes: [],
    issueNotes: [],
    ...review,
  });

  return (
    nextCandidate.headline !== candidate.headline ||
    JSON.stringify(nextCandidate.possibleCauses) !== JSON.stringify(candidate.possibleCauses) ||
    JSON.stringify(nextCandidate.recommendedActions) !== JSON.stringify(candidate.recommendedActions)
  );
}

export const __testOnly = {
  normalizeBiReportAnalysisOutput,
  applyBiReportReview,
  didBiReportReviewRewrite,
};
