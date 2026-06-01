import { db } from "@/lib/db";
import { readEnvVarFromRootFiles } from "@/lib/root-env";
import type { LLMProvider, WorkspaceLLMConfig } from "@/lib/llm/types";

const DEFAULT_QWEN_MODEL = "qwen3.6-plus";

function readLLMEnv(name: string) {
  const value = process.env[name];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return readEnvVarFromRootFiles(name);
}

function normalizeProviderValue(provider?: string | null): LLMProvider | null {
  const normalized = provider?.trim().toLowerCase();
  if (normalized === "openai" || normalized === "qwen") {
    return normalized;
  }
  return null;
}

const DEFAULT_PROVIDER = normalizeProviderValue(readLLMEnv("LLM_DEFAULT_PROVIDER")) ?? "qwen";

const DEFAULT_MODEL = readLLMEnv("LLM_DEFAULT_MODEL") || DEFAULT_QWEN_MODEL;
const DEFAULT_EXTRACTION_MODEL = readLLMEnv("LLM_EXTRACTION_MODEL") || DEFAULT_MODEL;
const DEFAULT_BRIEFING_MODEL = readLLMEnv("LLM_BRIEFING_MODEL") || DEFAULT_MODEL;
const DEFAULT_REASONING_MODEL = readLLMEnv("LLM_REASONING_MODEL") || DEFAULT_MODEL;

function normalizeProvider(provider?: string | null): WorkspaceLLMConfig["provider"] {
  return normalizeProviderValue(provider) ?? DEFAULT_PROVIDER;
}

export function isLLMEnabledByEnv() {
  return readLLMEnv("LLM_ENABLED") !== "false";
}

export function getOpenAIBaseUrl() {
  return readLLMEnv("LLM_BASE_URL") || "http://127.0.0.1:8000/v1";
}

export function getOpenAIApiKey() {
  return readLLMEnv("OPENAI_API_KEY") || "";
}

export function getQwenBaseUrl() {
  return readLLMEnv("DASHSCOPE_BASE_URL") || "https://dashscope.aliyuncs.com/compatible-mode/v1";
}

export function getQwenApiKey() {
  return readLLMEnv("DASHSCOPE_API_KEY") || readLLMEnv("OPENAI_API_KEY") || "";
}

export function getOpenAICompatibleBaseUrl(provider: LLMProvider) {
  return provider === "qwen" ? getQwenBaseUrl() : getOpenAIBaseUrl();
}

export function getOpenAICompatibleApiKey(provider: LLMProvider) {
  return provider === "qwen" ? getQwenApiKey() : getOpenAIApiKey();
}

export function isLLMProviderConfigured(provider: LLMProvider) {
  return Boolean(getOpenAICompatibleApiKey(provider));
}

export function getDefaultWorkspaceLLMConfig(): WorkspaceLLMConfig {
  return {
    provider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
    extractionModel: DEFAULT_EXTRACTION_MODEL,
    briefingModel: DEFAULT_BRIEFING_MODEL,
    reasoningModel: DEFAULT_REASONING_MODEL,
    llmEnabled: isLLMEnabledByEnv(),
    llmBudgetTier: "pilot",
  };
}

export function isOpenAIConfigured() {
  return Boolean(getOpenAIApiKey());
}

export async function getWorkspaceLLMConfig(workspaceId: string): Promise<WorkspaceLLMConfig> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      defaultLLMProvider: true,
      defaultLLMModel: true,
      extractionModel: true,
      briefingModel: true,
      reasoningModel: true,
      llmEnabled: true,
      llmBudgetTier: true,
    },
  });

  const defaults = getDefaultWorkspaceLLMConfig();

  return {
    provider: normalizeProvider(workspace?.defaultLLMProvider) || defaults.provider,
    defaultModel: workspace?.defaultLLMModel || defaults.defaultModel,
    extractionModel: workspace?.extractionModel || defaults.extractionModel,
    briefingModel: workspace?.briefingModel || defaults.briefingModel,
    reasoningModel: workspace?.reasoningModel || defaults.reasoningModel,
    llmEnabled: (workspace?.llmEnabled ?? defaults.llmEnabled) && isLLMEnabledByEnv(),
    llmBudgetTier: workspace?.llmBudgetTier || defaults.llmBudgetTier,
  };
}
