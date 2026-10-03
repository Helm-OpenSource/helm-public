import { ordinaryPaidWriterClient } from "@/lib/llm/ordinary-paid-composition.service";
import { buildRecommendationExplanationPrompt, llmPromptVersions, recommendationExplanationSchema } from "@/lib/llm/prompt-registry";
import { executeLLMTask } from "@/lib/llm/provider-registry";
import { parseLlmJsonOrThrow } from "@/lib/llm/output-parse-error";
import { prepareOrdinaryPaidOperationOrFallback } from "@/lib/llm/ordinary-paid-operation.service";
import { isLLMEnabledByEnv } from "@/lib/llm/config";

type RecommendationExplanationFallback = {
  explanation: string;
  whyNow: string;
  expectedImpact: string;
  ifNoAction: string;
  currentBlocker: string | null;
  currentCommitment: string | null;
  personalizationHint: string | null;
  learnedPatternSummary?: string[];
  supportingHighlights: string[];
  evidenceSummary: string;
};

export async function enhanceRecommendationExplanationWithLLM(input: {
  workspaceId: string;
  userId?: string | null;
  objectLabel: string;
  recommendationTitle: string;
  recommendationDescription: string;
  deterministicExplanation: string;
  policyResultLabel: string;
  fallback: RecommendationExplanationFallback;
  briefingSummary?: string | null;
  /** Existing persisted log; first-generation candidates have no paid source. */
  recommendationLogId?: string | null;
}) {
  const ordinaryOperation = isLLMEnabledByEnv() && input.recommendationLogId && input.userId
    ? await prepareOrdinaryPaidOperationOrFallback({ client: ordinaryPaidWriterClient(), workspaceId: input.workspaceId,
        actorUserId: input.userId, kind: "recommendation_explanation",
        sourceType: "recommendation_log", sourceId: input.recommendationLogId,
        slot: "explanation" })
    : null;
  const prompt = buildRecommendationExplanationPrompt({
    objectLabel: input.objectLabel,
    recommendationTitle: input.recommendationTitle,
    recommendationDescription: input.recommendationDescription,
    deterministicExplanation: input.deterministicExplanation,
    whyNow: input.fallback.whyNow,
    currentBlocker: input.fallback.currentBlocker,
    currentCommitment: input.fallback.currentCommitment,
    policyResultLabel: input.policyResultLabel,
    supportingFacts: input.fallback.supportingHighlights,
    briefingSummary: input.briefingSummary,
  });

  const result = await executeLLMTask<RecommendationExplanationFallback>({
    workspaceId: input.workspaceId,
    userId: input.userId,
    taskType: "RECOMMENDATION_EXPLANATION",
    promptKey: prompt.promptKey,
    promptVersion: llmPromptVersions.recommendationExplanation,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    inputSummary: `${input.objectLabel} 的建议解释增强`,
    outputMode: "json",
    jsonSchema: recommendationExplanationSchema,
    fallbackOutput: input.fallback,
    ordinaryOperationId: ordinaryOperation?.id,
    parseOutput: (rawText) => parseLlmJsonOrThrow<RecommendationExplanationFallback>(rawText),
  });

  return result;
}
