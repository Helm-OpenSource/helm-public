import {
  buildBiReportReviewPrompt,
  biReportReviewSchema,
  llmPromptVersions,
} from "@/lib/llm/prompt-registry";
import { executeLLMTask } from "@/lib/llm/provider-registry";
import { safeParseJson } from "@/lib/utils";
import type {
  BiReportAnalysisOutput,
  BiReportAnalysisReviewOutput,
} from "@/lib/bi-report-skill/types";

export async function reviewBiReportAnalysisWithLLM(input: {
  workspaceId: string;
  userId?: string | null;
  skillName: string;
  severityLabel: string;
  windowLabel: string;
  summaryMetrics?: Array<{ label: string; value: string }>;
  matchedRules?: string[];
  boundaries: string[];
  deterministicFindings: string[];
  candidate: BiReportAnalysisOutput;
}) {
  const prompt = buildBiReportReviewPrompt({
    skillName: input.skillName,
    severityLabel: input.severityLabel,
    windowLabel: input.windowLabel,
    summaryMetrics: input.summaryMetrics,
    matchedRules: input.matchedRules,
    boundaries: input.boundaries,
    deterministicFindings: input.deterministicFindings,
    candidate: {
      headline: input.candidate.headline,
      possibleCauses: input.candidate.possibleCauses,
      recommendedActions: input.candidate.recommendedActions,
    },
  });

  const fallback: BiReportAnalysisReviewOutput = {
    approved: true,
    issueCodes: [],
    issueNotes: [],
    rewrittenHeadline: null,
    rewrittenPossibleCauses: null,
    rewrittenRecommendedActions: null,
  };

  return executeLLMTask<BiReportAnalysisReviewOutput>({
    workspaceId: input.workspaceId,
    userId: input.userId,
    taskType: "BI_REPORT_REVIEW",
    promptKey: prompt.promptKey,
    promptVersion: llmPromptVersions.biReportReview,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    inputSummary: `${input.skillName} 的 BI 报表复核`,
    outputMode: "json",
    jsonSchema: biReportReviewSchema,
    fallbackOutput: fallback,
    parseOutput: (rawText) => safeParseJson(rawText, fallback),
  });
}
