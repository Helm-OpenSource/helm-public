import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordLLMCall: vi.fn(),
  getWorkspaceLLMConfig: vi.fn(),
  resolveModelForTask: vi.fn(),
  adapterRun: vi.fn(),
  bridgeRun: vi.fn(),
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

vi.mock("@/lib/llm/ordinary-paid-adapter-bridge.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/llm/ordinary-paid-adapter-bridge.service")>()),
  runOrdinaryPaidAdapter: mocks.bridgeRun,
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
import { LlmOutputSchemaError } from "@/lib/llm/output-parse-error";
import { OrdinaryPaidEgressError } from "@/lib/llm/ordinary-paid-adapter-bridge.service";

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
    mocks.bridgeRun.mockRejectedValue(new OrdinaryPaidEgressError("paid_egress_operation_or_policy_unconfigured"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses paid dispatch without a persisted trusted operation and reservation", async () => {
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "synthetic" },
      rawOutput: '{"summary":"synthetic"}',
      usage: { promptTokens: 1, completionTokens: 1 },
    });
    const result = await executeLLMTask({
      taskType: "RECOMMENDATION_EXPLANATION",
      workspaceId: "workspace_demo",
      promptKey: "synthetic.prompt",
      promptVersion: "v1",
      systemPrompt: "synthetic",
      userPrompt: "synthetic",
      parseOutput: (raw) => JSON.parse(raw) as { summary: string },
      fallbackOutput: { summary: "fallback" },
    });
    expect(mocks.adapterRun).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.fallbackUsed).toBe(true);
  });

  it("keeps the successful LLM path working even if call-log persistence fails", async () => {
    mocks.bridgeRun.mockResolvedValue({
      output: { summary: "done" },
      rawOutput: "{\"summary\":\"done\"}",
      modelVersion: "gpt-4.1-mini",
      governedRoute: { provider: "openai", model: "gpt-4.1-mini", modelVersion: "gpt-4.1-mini" },
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
    expect(result.rawOutput).toBe('{"summary":"done"}');
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

  it("records the committed governed route even when legacy routing suggests another model", async () => {
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
    mocks.bridgeRun.mockResolvedValue({
      output: { summary: "qwen-ok" },
      rawOutput: "{\"summary\":\"qwen-ok\"}",
      modelVersion: "qwen3.6-plus",
      governedRoute: { provider: "openai", model: "governed-synthetic", modelVersion: "governed-synthetic-v1" },
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
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("governed-synthetic");
    expect(result.modelVersion).toBe("governed-synthetic-v1");
    expect(mocks.recordLLMCall).toHaveBeenCalledWith(expect.objectContaining({
      provider: "openai", model: "governed-synthetic", modelVersion: "governed-synthetic-v1",
      success: true,
    }));
    expect(result.output).toEqual({ summary: "qwen-ok" });
  });

  it("records strict output-schema failures as an explicit fallback reason", async () => {
    mocks.bridgeRun.mockRejectedValue(new LlmOutputSchemaError("unexpected field"));

    const result = await executeLLMTask({
      taskType: "MULTI_PASS_REVIEW",
      workspaceId: "workspace_demo",
      promptKey: "multi-pass-review",
      promptVersion: "multi-pass-review-v1",
      systemPrompt: "system",
      userPrompt: "user",
      parseOutput: () => ({ ok: true }),
      fallbackOutput: { ok: false },
      outputMode: "json",
    });

    expect(result.success).toBe(false);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("output_schema_failed");
    expect(mocks.recordLLMCall).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackReason: "output_schema_failed" }),
    );
  });

  it("does not hand a business fallback to callers after an unknown charged attempt", async () => {
    mocks.bridgeRun.mockRejectedValue(new OrdinaryPaidEgressError("paid_egress_in_doubt"));
    await expect(executeLLMTask({
      taskType: "BI_REPORT_ANALYSIS", workspaceId: "workspace_demo",
      promptKey: "synthetic.bi", promptVersion: "v1",
      systemPrompt: "system", userPrompt: "user",
      parseOutput: (raw) => raw, fallbackOutput: "fallback",
    })).rejects.toMatchObject({ code: "paid_egress_in_doubt" });
    expect(mocks.recordLLMCall).not.toHaveBeenCalled();
  });

  it("omits input and output content when metadata-only observability is requested", async () => {
    mocks.bridgeRun.mockResolvedValue({
      output: { disposition: "review" },
      rawOutput: '{"disposition":"review","private":"do-not-log"}',
      modelVersion: "gpt-4.1-mini",
      governedRoute: { provider: "openai", model: "gpt-4.1-mini", modelVersion: "gpt-4.1-mini" },
      usage: { promptTokens: 10, completionTokens: 4 },
    });

    const result = await executeLLMTask({
      taskType: "MULTI_PASS_REVIEW",
      workspaceId: "workspace_demo",
      promptKey: "model-shadow-review",
      promptVersion: "v1",
      systemPrompt: "system-private-marker",
      userPrompt: "user-private-marker",
      inputSummary: "input-summary-private-marker",
      parseOutput: (rawText) => JSON.parse(rawText) as { disposition: string },
      fallbackOutput: { disposition: "defer" },
      outputMode: "json",
      observabilityPolicy: "metadata_only",
    });

    expect(result.success).toBe(true);
    expect(result.output).toEqual({ disposition: "review" });
    expect(result.rawOutput).toBeNull();
    expect(mocks.bridgeRun).toHaveBeenCalledWith(
      expect.objectContaining({ inputSummary: null }),
    );
    const logged = JSON.stringify(mocks.recordLLMCall.mock.calls);
    expect(logged).not.toContain("input-summary-private-marker");
    expect(logged).not.toContain("system-private-marker");
    expect(logged).not.toContain("user-private-marker");
    expect(logged).not.toContain("do-not-log");
    expect(mocks.recordLLMCall).toHaveBeenCalledWith(
      expect.objectContaining({
        outputSummary: "LLM call succeeded; content omitted by metadata-only policy.",
      }),
    );
  });

  it("omits provider error details from metadata-only logs and results", async () => {
    mocks.bridgeRun.mockRejectedValue(new Error("provider-private-error-marker"));

    const result = await executeLLMTask({
      taskType: "MULTI_PASS_REVIEW",
      workspaceId: "workspace_demo",
      promptKey: "model-shadow-review",
      promptVersion: "v1",
      systemPrompt: "system",
      userPrompt: "user",
      parseOutput: () => ({ disposition: "review" }),
      fallbackOutput: { disposition: "defer" },
      outputMode: "json",
      observabilityPolicy: "metadata_only",
    });

    expect(result.success).toBe(false);
    expect(result.fallbackReason).toBe("provider_error");
    expect(result.errorMessage).toBe(
      "LLM execution failure details omitted by metadata-only policy.",
    );
    const logged = JSON.stringify(mocks.recordLLMCall.mock.calls);
    expect(logged).not.toContain("provider-private-error-marker");
  });

  it("rejects an unknown observability policy before provider dispatch", async () => {
    await expect(
      executeLLMTask({
        taskType: "MULTI_PASS_REVIEW",
        workspaceId: "workspace_demo",
        promptKey: "model-shadow-review",
        promptVersion: "v1",
        systemPrompt: "system",
        userPrompt: "user",
        parseOutput: () => ({ disposition: "review" }),
        fallbackOutput: { disposition: "defer" },
        observabilityPolicy: "raw_content" as never,
      }),
    ).rejects.toThrow("unsupported_observability_policy");
    expect(mocks.adapterRun).not.toHaveBeenCalled();
    expect(mocks.recordLLMCall).not.toHaveBeenCalled();
  });
});
