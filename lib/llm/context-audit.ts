import type { LLMTaskType } from "@/lib/llm/types";
import { trimText } from "@/lib/utils";

export type LLMContextRequirement = {
  id: string;
  description: string;
  markers: string[];
  minMatches?: number;
  required?: boolean;
};

export type LLMContextRequirementResult = {
  id: string;
  description: string;
  required: boolean;
  matchedMarkers: string[];
  missingMarkers: string[];
  passed: boolean;
};

export type LLMContextAuditInput = {
  taskType: LLMTaskType;
  promptKey: string;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  requirements?: LLMContextRequirement[];
  maxEstimatedPromptTokens?: number;
};

export type LLMContextAuditSummary = {
  taskType: LLMTaskType;
  promptKey: string;
  promptVersion: string;
  estimatedPromptTokens: number;
  maxEstimatedPromptTokens: number;
  lineCount: number;
  scores: {
    instructionClarity: number;
    contextCoverage: number;
    boundaryCoverage: number;
    tokenFitness: number;
    overall: number;
  };
  requirementResults: LLMContextRequirementResult[];
  failures: string[];
  warnings: string[];
};

const DEFAULT_MAX_ESTIMATED_PROMPT_TOKENS = 1_600;

const OUTPUT_CONSTRAINT_MARKERS = [
  "JSON",
  "schema",
  "只输出",
  "符合 schema",
  "不要闲聊",
  "不要输出解释",
];

const BOUNDARY_MARKERS = [
  "不要",
  "不能",
  "不得",
  "边界",
  "承诺",
  "自动执行",
  "自动发送",
  "审批",
  "deterministic",
  "severity",
  "只检查",
  "不重新",
];

const FORBIDDEN_CONTEXT_PATTERNS = [
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /secret[_-]?key/i,
  /api[_-]?key/i,
  /password/i,
  /mysql:\/\/[^@\s]+@/i,
  /bearer\s+[a-z0-9._-]{12,}/i,
];

export function buildLLMContextAudit(input: LLMContextAuditInput): LLMContextAuditSummary {
  const systemPrompt = input.systemPrompt.trim();
  const userPrompt = input.userPrompt.trim();
  const combinedPrompt = [systemPrompt, userPrompt].join("\n");
  const estimatedPromptTokens = estimatePromptTokens(combinedPrompt);
  const maxEstimatedPromptTokens = input.maxEstimatedPromptTokens ?? DEFAULT_MAX_ESTIMATED_PROMPT_TOKENS;
  const requirementResults = evaluateRequirements(combinedPrompt, input.requirements ?? []);

  const instructionClarity = scoreInstructionClarity(systemPrompt, userPrompt);
  const contextCoverage = scoreRequirementCoverage(requirementResults);
  const boundaryCoverage = scoreBoundaryCoverage(combinedPrompt);
  const tokenFitness = scoreTokenFitness(estimatedPromptTokens, maxEstimatedPromptTokens);
  const overall = weightedScore({
    instructionClarity,
    contextCoverage,
    boundaryCoverage,
    tokenFitness,
  });

  const failures = [
    ...(!systemPrompt ? ["missing_system_prompt"] : []),
    ...(!userPrompt ? ["missing_user_prompt"] : []),
    ...requirementResults
      .filter((item) => item.required && !item.passed)
      .map((item) => `missing_required_context:${item.id}`),
    ...(estimatedPromptTokens > maxEstimatedPromptTokens
      ? [`prompt_token_estimate_exceeds_budget:${estimatedPromptTokens}/${maxEstimatedPromptTokens}`]
      : []),
    ...findForbiddenContextPatterns(combinedPrompt),
  ];

  const warnings = [
    ...(instructionClarity < 70 ? ["weak_instruction_clarity"] : []),
    ...(boundaryCoverage < 70 ? ["weak_boundary_coverage"] : []),
    ...(contextCoverage < 70 ? ["weak_context_coverage"] : []),
    ...(estimatedPromptTokens < 80 ? ["context_too_thin_to_explain_model_output"] : []),
  ];

  return {
    taskType: input.taskType,
    promptKey: input.promptKey,
    promptVersion: input.promptVersion,
    estimatedPromptTokens,
    maxEstimatedPromptTokens,
    lineCount: combinedPrompt.split(/\n+/).filter(Boolean).length,
    scores: {
      instructionClarity,
      contextCoverage,
      boundaryCoverage,
      tokenFitness,
      overall,
    },
    requirementResults,
    failures,
    warnings,
  };
}

export function formatLLMContextAuditSummary(audit: LLMContextAuditSummary) {
  const required = audit.requirementResults.filter((item) => item.required);
  const passedRequired = required.filter((item) => item.passed).length;
  const flags = [...audit.failures, ...audit.warnings].slice(0, 3);
  return [
    `ctx=${audit.scores.overall}`,
    `prompt≈${audit.estimatedPromptTokens}t`,
    `req=${passedRequired}/${required.length}`,
    `flags=${flags.length ? flags.join("|") : "none"}`,
  ].join(" ");
}

export function appendLLMContextAuditToInputSummary(input: {
  inputSummary?: string | null;
  audit: LLMContextAuditSummary;
}) {
  const auditSummary = formatLLMContextAuditSummary(input.audit);
  const original = input.inputSummary?.trim();
  return trimText(original ? `${auditSummary} · ${original}` : auditSummary, 240);
}

export function estimatePromptTokens(text: string) {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  const asciiWordCount = (normalized.match(/[A-Za-z0-9_]+/g) ?? []).length;
  const cjkCharCount = (normalized.match(/[\u3400-\u9FFF]/g) ?? []).length;
  const punctuationCount = (normalized.match(/[^\sA-Za-z0-9_\u3400-\u9FFF]/g) ?? []).length;
  return Math.ceil(asciiWordCount * 1.25 + cjkCharCount * 0.75 + punctuationCount * 0.4);
}

function evaluateRequirements(prompt: string, requirements: LLMContextRequirement[]) {
  return requirements.map((requirement) => {
    const matchedMarkers = requirement.markers.filter((marker) => prompt.includes(marker));
    const minMatches = requirement.minMatches ?? requirement.markers.length;
    const required = requirement.required ?? true;
    return {
      id: requirement.id,
      description: requirement.description,
      required,
      matchedMarkers,
      missingMarkers: requirement.markers.filter((marker) => !matchedMarkers.includes(marker)),
      passed: matchedMarkers.length >= minMatches,
    } satisfies LLMContextRequirementResult;
  });
}

function scoreInstructionClarity(systemPrompt: string, userPrompt: string) {
  let score = 0;
  if (systemPrompt.length >= 20) score += 35;
  if (userPrompt.length >= 40) score += 25;
  if (OUTPUT_CONSTRAINT_MARKERS.some((marker) => systemPrompt.includes(marker) || userPrompt.includes(marker))) score += 25;
  if (/你是|your task|你的任务|请生成|请输出/i.test(systemPrompt + userPrompt)) score += 15;
  return Math.min(100, score);
}

function scoreRequirementCoverage(results: LLMContextRequirementResult[]) {
  const required = results.filter((item) => item.required);
  if (required.length === 0) {
    return 100;
  }
  const passed = required.filter((item) => item.passed).length;
  return Math.round((passed / required.length) * 100);
}

function scoreBoundaryCoverage(prompt: string) {
  const matched = BOUNDARY_MARKERS.filter((marker) => prompt.includes(marker)).length;
  return Math.min(100, Math.round((matched / 4) * 100));
}

function scoreTokenFitness(estimatedPromptTokens: number, maxEstimatedPromptTokens: number) {
  if (estimatedPromptTokens === 0) return 0;
  if (estimatedPromptTokens <= maxEstimatedPromptTokens * 0.75) return 100;
  if (estimatedPromptTokens <= maxEstimatedPromptTokens) return 80;
  if (estimatedPromptTokens <= maxEstimatedPromptTokens * 1.25) return 50;
  return 20;
}

function weightedScore(scores: {
  instructionClarity: number;
  contextCoverage: number;
  boundaryCoverage: number;
  tokenFitness: number;
}) {
  return Math.round(
    scores.instructionClarity * 0.25 +
      scores.contextCoverage * 0.35 +
      scores.boundaryCoverage * 0.25 +
      scores.tokenFitness * 0.15,
  );
}

function findForbiddenContextPatterns(prompt: string) {
  return FORBIDDEN_CONTEXT_PATTERNS.flatMap((pattern) =>
    pattern.test(prompt) ? [`forbidden_context_pattern:${String(pattern)}`] : [],
  );
}
