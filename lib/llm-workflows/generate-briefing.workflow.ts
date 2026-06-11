import { ObjectType } from "@prisma/client";
import { buildBriefingPrompt, briefingSchema, llmPromptVersions } from "@/lib/llm/prompt-registry";
import { executeLLMTask } from "@/lib/llm/provider-registry";
import type { MemoryRetrievalPackSurfaceTrace } from "@/lib/memory/retrieval-pack-adapter";
import { parseLlmJsonOrThrow } from "@/lib/llm/output-parse-error";

type BriefingLikePayload = {
  summary: string;
  recentFacts: Array<Record<string, unknown>>;
  openCommitments: Array<Record<string, unknown>>;
  activeBlockers: Array<Record<string, unknown>>;
  recommendedQuestions: string[];
  recommendedNextSteps: string[];
  recentMeetings: Array<Record<string, unknown>>;
  recentThreads: Array<Record<string, unknown>>;
  retrievalPackTrace?: MemoryRetrievalPackSurfaceTrace | null;
  generationMode?: string;
  llmMeta?: Record<string, unknown>;
};

type BriefingWorkflowInput = {
  workspaceId: string;
  userId?: string | null;
  objectType: ObjectType;
  objectLabel: string;
  currentStage?: string | null;
  fallbackPayload: BriefingLikePayload;
};

export async function generateBriefingWithLLM(input: BriefingWorkflowInput) {
  const prompt = buildBriefingPrompt({
    objectType: input.objectType,
    objectLabel: input.objectLabel,
    currentStage: input.currentStage,
    recentFacts: input.fallbackPayload.recentFacts.map((item) => String(item.content ?? item.title ?? "")),
    openCommitments: input.fallbackPayload.openCommitments.map((item) => String(item.title ?? "")),
    activeBlockers: input.fallbackPayload.activeBlockers.map((item) => String(item.title ?? "")),
    recentMeetings: input.fallbackPayload.recentMeetings.map((item) => String(item.title ?? "")),
    recentThreads: input.fallbackPayload.recentThreads.map((item) => String(item.subject ?? "")),
  });

  const result = await executeLLMTask<{
    summary: string;
    recommendedQuestions: string[];
    recommendedNextSteps: string[];
    importantFactHighlights: string[];
  }>({
    workspaceId: input.workspaceId,
    userId: input.userId,
    taskType: taskTypeForObject(input.objectType),
    promptKey: prompt.promptKey,
    promptVersion: llmPromptVersions.briefing,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    inputSummary: `${input.objectLabel} 的简报生成`,
    outputMode: "json",
    jsonSchema: briefingSchema,
    fallbackOutput: {
      summary: input.fallbackPayload.summary,
      recommendedQuestions: input.fallbackPayload.recommendedQuestions,
      recommendedNextSteps: input.fallbackPayload.recommendedNextSteps,
      importantFactHighlights: input.fallbackPayload.recentFacts.map((item) => String(item.content ?? item.title ?? "")).slice(0, 3),
    },
    parseOutput: (rawText) =>
      parseLlmJsonOrThrow<{
        summary: string;
        recommendedQuestions: string[];
        recommendedNextSteps: string[];
        importantFactHighlights: string[];
      }>(rawText),
  });

  const payload: BriefingLikePayload = {
    ...input.fallbackPayload,
    summary: result.output.summary || input.fallbackPayload.summary,
    recommendedQuestions: result.output.recommendedQuestions?.length
      ? result.output.recommendedQuestions.slice(0, 4)
      : input.fallbackPayload.recommendedQuestions,
    recommendedNextSteps: result.output.recommendedNextSteps?.length
      ? result.output.recommendedNextSteps.slice(0, 4)
      : input.fallbackPayload.recommendedNextSteps,
    recentFacts:
      result.output.importantFactHighlights?.length
        ? result.output.importantFactHighlights.slice(0, 4).map((item, index) => ({
            id: `llm-highlight-${index + 1}`,
            title: item,
            content: item,
            confidence: 88,
          }))
        : input.fallbackPayload.recentFacts,
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
      latencyMs: result.latencyMs,
    },
  };

  return {
    ...result,
    output: payload,
  };
}

function taskTypeForObject(objectType: ObjectType) {
  switch (objectType) {
    case ObjectType.CONTACT:
      return "CONTACT_BRIEFING" as const;
    case ObjectType.COMPANY:
      return "COMPANY_BRIEFING" as const;
    case ObjectType.OPPORTUNITY:
      return "OPPORTUNITY_BRIEFING" as const;
    case ObjectType.MEETING:
    default:
      return "MEETING_BRIEFING" as const;
  }
}
