import { ObjectType } from "@prisma/client";
import llmContextFixturePack from "@/evals/llm-context/context-quality-cases.json";
import {
  buildBiReportAnalysisPrompt,
  buildBriefingPrompt,
  buildMeetingMemoryExtractionPrompt,
  buildRecommendationExplanationPrompt,
} from "@/lib/llm/prompt-registry";
import {
  buildLLMContextAudit,
  type LLMContextAuditSummary,
  type LLMContextRequirement,
} from "@/lib/llm/context-audit";
import type { LLMTaskType } from "@/lib/llm/types";

export type LLMContextPromptBuilder =
  | "briefing"
  | "recommendationExplanation"
  | "biReportAnalysis"
  | "meetingMemoryExtraction";

export type LLMContextEvalCase = {
  id: string;
  promptBuilder: LLMContextPromptBuilder;
  taskType: LLMTaskType;
  expectedReady: boolean;
  maxEstimatedPromptTokens?: number;
  input: Record<string, unknown>;
  requirements: LLMContextRequirement[];
};

export type LLMContextDecisivenessPair = {
  id: string;
  withContextCaseId: string;
  ablationCaseId: string;
  minimumScoreDelta: number;
};

export type LLMContextEvalFixturePack = {
  version: string;
  status: string;
  redactionPosture: string;
  boundary: string;
  targets: {
    minimumReadyScore: number;
    maximumReadyFailures: number;
    minimumDecisiveScoreDelta: number;
  };
  decisivenessPairs: LLMContextDecisivenessPair[];
  cases: LLMContextEvalCase[];
};

export type LLMContextEvalCaseResult = {
  caseId: string;
  promptBuilder: LLMContextPromptBuilder;
  taskType: LLMTaskType;
  expectedReady: boolean;
  ready: boolean;
  passed: boolean;
  audit: LLMContextAuditSummary;
};

export type LLMContextDecisivenessResult = {
  id: string;
  withContextCaseId: string;
  ablationCaseId: string;
  scoreDelta: number;
  minimumScoreDelta: number;
  passed: boolean;
};

export type LLMContextEvalFailure = {
  caseId: string;
  reason: string;
};

export type LLMContextEvalSummary = {
  passed: boolean;
  version: string;
  totalCases: number;
  readyCases: number;
  expectedReadyCases: number;
  averageReadyScore: number;
  averageAblationScore: number;
  caseResults: LLMContextEvalCaseResult[];
  decisiveness: LLMContextDecisivenessResult[];
  failures: LLMContextEvalFailure[];
};

export function runLLMContextEval(
  fixturePack: LLMContextEvalFixturePack = llmContextFixturePack as LLMContextEvalFixturePack,
): LLMContextEvalSummary {
  const caseResults = fixturePack.cases.map((item) => evaluateCase(item, fixturePack));
  const resultsById = new Map(caseResults.map((item) => [item.caseId, item]));
  const decisiveness = fixturePack.decisivenessPairs.map((pair) => evaluateDecisivenessPair(pair, resultsById));
  const failures = [
    ...caseResults.flatMap((item) => (item.passed ? [] : [{ caseId: item.caseId, reason: "readiness_expectation_mismatch" }])),
    ...caseResults.flatMap((item) =>
      item.expectedReady
        ? item.audit.failures.map((reason) => ({
            caseId: item.caseId,
            reason,
          }))
        : [],
    ),
    ...decisiveness.flatMap((item) =>
      item.passed
        ? []
        : [
            {
              caseId: item.id,
              reason: `context_not_decisive:${item.scoreDelta}/${item.minimumScoreDelta}`,
            },
          ],
    ),
  ];
  const readyResults = caseResults.filter((item) => item.expectedReady);
  const ablationResults = caseResults.filter((item) => !item.expectedReady);

  return {
    passed: caseResults.every((item) => item.passed) && decisiveness.every((item) => item.passed),
    version: fixturePack.version,
    totalCases: caseResults.length,
    readyCases: caseResults.filter((item) => item.ready).length,
    expectedReadyCases: readyResults.length,
    averageReadyScore: averageScore(readyResults),
    averageAblationScore: averageScore(ablationResults),
    caseResults,
    decisiveness,
    failures,
  };
}

function evaluateCase(
  item: LLMContextEvalCase,
  fixturePack: LLMContextEvalFixturePack,
): LLMContextEvalCaseResult {
  const prompt = buildPromptForCase(item);
  const audit = buildLLMContextAudit({
    taskType: item.taskType,
    promptKey: prompt.promptKey,
    promptVersion: prompt.promptVersion,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    requirements: item.requirements,
    maxEstimatedPromptTokens: item.maxEstimatedPromptTokens,
  });
  const ready =
    audit.scores.overall >= fixturePack.targets.minimumReadyScore &&
    audit.failures.length <= fixturePack.targets.maximumReadyFailures;

  return {
    caseId: item.id,
    promptBuilder: item.promptBuilder,
    taskType: item.taskType,
    expectedReady: item.expectedReady,
    ready,
    passed: item.expectedReady ? ready : !ready,
    audit,
  };
}

function evaluateDecisivenessPair(
  pair: LLMContextDecisivenessPair,
  resultsById: Map<string, LLMContextEvalCaseResult>,
): LLMContextDecisivenessResult {
  const withContext = resultsById.get(pair.withContextCaseId);
  const ablation = resultsById.get(pair.ablationCaseId);
  const scoreDelta = withContext && ablation ? withContext.audit.scores.overall - ablation.audit.scores.overall : 0;

  return {
    id: pair.id,
    withContextCaseId: pair.withContextCaseId,
    ablationCaseId: pair.ablationCaseId,
    scoreDelta,
    minimumScoreDelta: pair.minimumScoreDelta,
    passed: Boolean(withContext && ablation && scoreDelta >= pair.minimumScoreDelta),
  };
}

function buildPromptForCase(item: LLMContextEvalCase) {
  const input = item.input;
  if (item.promptBuilder === "briefing") {
    return buildBriefingPrompt({
      objectType: parseObjectType(readString(input, "objectType")),
      objectLabel: readString(input, "objectLabel"),
      currentStage: readNullableString(input, "currentStage"),
      recentFacts: readStringArray(input, "recentFacts"),
      openCommitments: readStringArray(input, "openCommitments"),
      activeBlockers: readStringArray(input, "activeBlockers"),
      recentMeetings: readStringArray(input, "recentMeetings"),
      recentThreads: readStringArray(input, "recentThreads"),
    });
  }

  if (item.promptBuilder === "recommendationExplanation") {
    return buildRecommendationExplanationPrompt({
      objectLabel: readString(input, "objectLabel"),
      recommendationTitle: readString(input, "recommendationTitle"),
      recommendationDescription: readString(input, "recommendationDescription"),
      deterministicExplanation: readString(input, "deterministicExplanation"),
      whyNow: readString(input, "whyNow"),
      currentBlocker: readNullableString(input, "currentBlocker"),
      currentCommitment: readNullableString(input, "currentCommitment"),
      policyResultLabel: readString(input, "policyResultLabel"),
      supportingFacts: readStringArray(input, "supportingFacts"),
      briefingSummary: readNullableString(input, "briefingSummary"),
    });
  }

  if (item.promptBuilder === "biReportAnalysis") {
    return buildBiReportAnalysisPrompt({
      skillName: readString(input, "skillName"),
      severityLabel: readString(input, "severityLabel"),
      windowLabel: readString(input, "windowLabel"),
      summaryMetrics: readSummaryMetrics(input),
      matchedRules: readStringArray(input, "matchedRules"),
      deterministicFindings: readStringArray(input, "deterministicFindings"),
      recentRunContext: readNullableObject(input, "recentRunContext") as
        | { continuityStatus: string; historicalContext: string | null }
        | undefined,
      recentFeedbackContext: readNullableObject(input, "recentFeedbackContext") as
        | { feedbackContext: string | null }
        | undefined,
      similarCaseContext: readNullableObject(input, "similarCaseContext") as
        | { caseContext: string | null }
        | undefined,
      odpsKnowledgeContext: readNullableObject(input, "odpsKnowledgeContext") as
        | {
            matchedAliases: string[];
            tableAliases: string[];
            fieldConventions: string[];
            enumKnowledge: string[];
            queryConventions: string[];
          }
        | null
        | undefined,
      boundaries: readStringArray(input, "boundaries"),
      skillPromptTemplate: readNullableString(input, "skillPromptTemplate"),
    });
  }

  return buildMeetingMemoryExtractionPrompt({
    title: readString(input, "title"),
    companyName: readNullableString(input, "companyName"),
    opportunityTitle: readNullableString(input, "opportunityTitle"),
    attendees: readStringArray(input, "attendees"),
    noteText: readString(input, "noteText"),
  });
}

function parseObjectType(raw: string) {
  if (raw in ObjectType) {
    return ObjectType[raw as keyof typeof ObjectType];
  }
  throw new Error(`Unsupported ObjectType in llm context fixture: ${raw}`);
}

function readString(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string field "${key}" in llm context fixture`);
  }
  return value;
}

function readNullableString(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (value == null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected nullable string field "${key}" in llm context fixture`);
  }
  return value;
}

function readStringArray(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Expected string array field "${key}" in llm context fixture`);
  }
  return value as string[];
}

function readNullableObject(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected nullable object field "${key}" in llm context fixture`);
  }
  return value as Record<string, unknown>;
}

function readSummaryMetrics(input: Record<string, unknown>) {
  const value = input.summaryMetrics;
  if (!Array.isArray(value)) {
    throw new Error('Expected array field "summaryMetrics" in llm context fixture');
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error('Expected summaryMetrics items to be objects in llm context fixture');
    }
    const metric = item as Record<string, unknown>;
    return {
      label: readString(metric, "label"),
      value: readString(metric, "value"),
    };
  });
}

function averageScore(items: LLMContextEvalCaseResult[]) {
  if (items.length === 0) {
    return 0;
  }
  return Math.round(items.reduce((sum, item) => sum + item.audit.scores.overall, 0) / items.length);
}
