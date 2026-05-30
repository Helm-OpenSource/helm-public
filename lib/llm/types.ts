export type LLMTaskType =
  | "MEETING_MEMORY_EXTRACTION"
  | "CONTACT_BRIEFING"
  | "COMPANY_BRIEFING"
  | "OPPORTUNITY_BRIEFING"
  | "MEETING_BRIEFING"
  | "RECOMMENDATION_EXPLANATION"
  | "EXTERNAL_CASE_ASSIGNMENT"
  | "EXTERNAL_CASE_ASSIGNMENT_ACTION_BRIEFING"
  | "EXTERNAL_EMPLOYEE_SIGNAL_ACTION_BRIEFING"
  | "EXTERNAL_EMPLOYEE_SIGNAL_OWNER_ROUTING"
  | "BI_REPORT_ANALYSIS"
  | "BI_REPORT_REVIEW";

export type LLMProvider = "openai" | "qwen";

export type LLMModelRole = "EXTRACTION" | "BRIEFING" | "REASONING";

export type LLMProviderCapabilities = {
  structuredOutput: boolean;
  configurableBaseUrl: boolean;
  audioTranscription: boolean;
};

export type LLMTaskInput<TOutput> = {
  taskType: LLMTaskType;
  workspaceId: string;
  userId?: string | null;
  promptKey: string;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  inputSummary?: string | null;
  parseOutput: (rawText: string) => TOutput;
  fallbackOutput: TOutput;
  outputMode?: "json" | "text";
  jsonSchema?: Record<string, unknown>;
  providerHint?: string | null;
  modelHint?: string | null;
  temperature?: number;
  maxOutputTokens?: number;
};

export type LLMResolvedTask<TOutput> = LLMTaskInput<TOutput> & {
  provider: LLMProvider;
  model: string;
  modelRole: LLMModelRole;
  budgetTier?: string | null;
};

export type LLMUsage = {
  promptTokens?: number;
  completionTokens?: number;
};

export type LLMProviderRunResult<TOutput> = {
  output: TOutput;
  rawOutput: string;
  usage?: LLMUsage;
  modelVersion?: string | null;
};

export type LLMTaskExecutionResult<TOutput> = {
  output: TOutput;
  provider: string;
  model: string;
  modelVersion?: string | null;
  modelRole: LLMModelRole;
  promptKey: string;
  promptVersion: string;
  success: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string | null;
  errorMessage?: string | null;
  latencyMs: number;
  usage?: LLMUsage;
  rawOutput?: string | null;
  budgetTier?: string | null;
};

export type LLMProviderAdapter = {
  provider: LLMProvider;
  label: string;
  capabilities: LLMProviderCapabilities;
  isConfigured: () => boolean;
  run: <TOutput>(input: LLMResolvedTask<TOutput>) => Promise<LLMProviderRunResult<TOutput>>;
};

export type WorkspaceLLMConfig = {
  provider: LLMProvider;
  defaultModel: string;
  extractionModel: string;
  briefingModel: string;
  reasoningModel: string;
  llmEnabled: boolean;
  llmBudgetTier?: string | null;
  /**
   * Per-month USD spend budget. When set, the spend-tracker rejects calls
   * whose estimated cost would push month-to-date spending above this cap.
   * `null` or `undefined` = no budget enforcement (existing behavior).
   * See HELM_LLM_SPEND_AND_ABUSE_GUARDS_SPEC_V1 (internal) §二 Gap 3.
   */
  monthlySpendBudgetUSD?: number | null;
  /**
   * Per-prompt-key version override. When set, the runtime uses the
   * override version string instead of the registry default for that key.
   * Use for staged rollouts and per-workspace rollbacks. Key format:
   * Record<promptKey, versionString>.
   * `null` or `undefined` = use registry defaults (existing behavior).
   * See HELM_LLM_SPEND_AND_ABUSE_GUARDS_SPEC_V1 (internal) §二 Gap 5.
   */
  promptVersionOverrides?: Record<string, string> | null;
};
