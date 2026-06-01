import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordLLMCall: vi.fn(),
  getWorkspaceLLMConfig: vi.fn(),
  resolveModelForTask: vi.fn(),
  adapterRun: vi.fn(),
  adapterIsConfigured: vi.fn(),
}));

vi.mock("@/lib/observability/llm-call-log.service", () => ({
  recordLLMCall: mocks.recordLLMCall,
}));

vi.mock("@/lib/llm/config", () => ({
  getWorkspaceLLMConfig: mocks.getWorkspaceLLMConfig,
}));

vi.mock("@/lib/llm/model-router", () => ({
  resolveModelForTask: mocks.resolveModelForTask,
}));

vi.mock("@/lib/llm/openai-adapter", () => ({
  openAIAdapter: {
    provider: "openai",
    label: "OpenAI Compatible",
    capabilities: {
      structuredOutput: true,
      configurableBaseUrl: true,
      audioTranscription: true,
    },
    isConfigured: mocks.adapterIsConfigured,
    run: mocks.adapterRun,
  },
}));

vi.mock("@/lib/llm/qwen-adapter", () => ({
  qwenAdapter: {
    provider: "qwen",
    label: "Qwen (DashScope Compatible)",
    capabilities: {
      structuredOutput: true,
      configurableBaseUrl: true,
      audioTranscription: false,
    },
    isConfigured: mocks.adapterIsConfigured,
    run: mocks.adapterRun,
  },
}));

import { executeLLMTask } from "@/lib/llm/provider-registry";

describe("provider registry logging guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adapterIsConfigured.mockReturnValue(true);
    mocks.recordLLMCall.mockResolvedValue(undefined);
    mocks.getWorkspaceLLMConfig.mockResolvedValue({
      provider: "openai",
      defaultModel: "gpt-4.1-mini",
      extractionModel: "gpt-4.1-mini",
      briefingModel: "gpt-4.1-mini",
      reasoningModel: "gpt-4.1-mini",
      llmEnabled: true,
      llmBudgetTier: "pilot",
    });
    mocks.resolveModelForTask.mockReturnValue({
      provider: "openai",
      model: "gpt-4.1-mini",
      modelRole: "REASONING",
      budgetTier: "pilot",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the successful LLM path working even if call-log persistence fails", async () => {
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "done" },
      rawOutput: "{\"summary\":\"done\"}",
      modelVersion: "gpt-4.1-mini",
      usage: { promptTokens: 12, completionTokens: 8 },
    });
    mocks.recordLLMCall.mockRejectedValue(new Error("sqlite busy"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await executeLLMTask({
      taskType: "RECOMMENDATION_EXPLANATION",
      workspaceId: "workspace_demo",
      userId: "user_demo",
      promptKey: "recommendation.explanation",
      promptVersion: "v1",
      systemPrompt: "system",
      userPrompt: "user",
      parseOutput: (rawText) => JSON.parse(rawText) as { summary: string },
      fallbackOutput: { summary: "fallback" },
      outputMode: "json",
      jsonSchema: {
        type: "object",
        properties: {
          summary: { type: "string" },
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.fallbackUsed).toBe(false);
    expect(result.output).toEqual({ summary: "done" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("Failed to record LLM call log");
  });

  it("keeps the fallback path working even if call-log persistence fails", async () => {
    mocks.getWorkspaceLLMConfig.mockResolvedValue({
      provider: "openai",
      defaultModel: "gpt-4.1-mini",
      extractionModel: "gpt-4.1-mini",
      briefingModel: "gpt-4.1-mini",
      reasoningModel: "gpt-4.1-mini",
      llmEnabled: false,
      llmBudgetTier: "pilot",
    });
    mocks.recordLLMCall.mockRejectedValue(new Error("stale prisma client"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await executeLLMTask({
      taskType: "MEETING_BRIEFING",
      workspaceId: "workspace_demo",
      promptKey: "meeting.briefing",
      promptVersion: "v1",
      systemPrompt: "system",
      userPrompt: "user",
      parseOutput: (rawText) => rawText,
      fallbackOutput: "fallback briefing",
      outputMode: "text",
    });

    expect(result.success).toBe(false);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("llm_disabled");
    expect(result.output).toBe("fallback briefing");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(mocks.adapterRun).not.toHaveBeenCalled();
  });

  it("routes to qwen adapter when workspace provider is qwen", async () => {
    mocks.getWorkspaceLLMConfig.mockResolvedValue({
      provider: "qwen",
      defaultModel: "qwen3.6-plus",
      extractionModel: "qwen3.6-plus",
      briefingModel: "qwen3.6-plus",
      reasoningModel: "qwen3.6-plus",
      llmEnabled: true,
      llmBudgetTier: "pilot",
    });
    mocks.resolveModelForTask.mockReturnValue({
      provider: "qwen",
      model: "qwen3.6-plus",
      modelRole: "REASONING",
      budgetTier: "pilot",
    });
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "qwen-ok" },
      rawOutput: "{\"summary\":\"qwen-ok\"}",
      modelVersion: "qwen3.6-plus",
      usage: { promptTokens: 9, completionTokens: 7 },
    });

    const result = await executeLLMTask({
      taskType: "RECOMMENDATION_EXPLANATION",
      workspaceId: "workspace_demo",
      userId: "user_demo",
      promptKey: "recommendation.explanation",
      promptVersion: "v1",
      systemPrompt: "system",
      userPrompt: "user",
      parseOutput: (rawText) => JSON.parse(rawText) as { summary: string },
      fallbackOutput: { summary: "fallback" },
      outputMode: "json",
      jsonSchema: {
        type: "object",
        properties: {
          summary: { type: "string" },
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.fallbackUsed).toBe(false);
    expect(result.provider).toBe("qwen");
    expect(result.output).toEqual({ summary: "qwen-ok" });
  });
});
