import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Metering acceptance: every call that consumed provider tokens must appear
 * somewhere — as a measurement when it could be measured, and as an explicit
 * unknown when it could not. Never as zero, and never as an estimate written
 * into the measured total.
 *
 * Covers the three paths that used to disagree:
 *   - success with usage omitted by the provider (was billed as 0)
 *   - PII rejection (returned before spend was recorded at all)
 *   - output parse failure (usage was lost with the adapter's return object)
 */

const mocks = vi.hoisted(() => ({
  recordLLMCall: vi.fn(),
  getWorkspaceLLMConfig: vi.fn(),
  resolveModelForTask: vi.fn(),
  adapterRun: vi.fn(),
  adapterIsConfigured: vi.fn(),
  detectPIIInOutput: vi.fn(),
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
vi.mock("@/lib/llm/output-pii-scrubber", () => ({
  detectPIIInOutput: mocks.detectPIIInOutput,
}));
vi.mock("@/lib/llm/openai-adapter", () => ({
  openAIAdapter: {
    provider: "openai",
    label: "OpenAI Compatible",
    capabilities: { structuredOutput: true, configurableBaseUrl: true, audioTranscription: true },
    isConfigured: mocks.adapterIsConfigured,
    run: mocks.adapterRun,
  },
}));
vi.mock("@/lib/llm/qwen-adapter", () => ({
  qwenAdapter: {
    provider: "qwen",
    label: "Qwen",
    capabilities: { structuredOutput: true, configurableBaseUrl: true, audioTranscription: false },
    isConfigured: mocks.adapterIsConfigured,
    run: mocks.adapterRun,
  },
}));

import { LlmOutputParseError } from "@/lib/llm/output-parse-error";
import { executeLLMTask } from "@/lib/llm/provider-registry";
import {
  __resetAccumulatorForTests,
  getMonthToDateSpendUSD,
  getMonthToDateUnknownCallCount,
  getMonthToDateUnknownUpperBoundUSD,
} from "@/lib/llm/spend-tracker";
import { attachUsageObservation } from "@/lib/llm/usage-observation";

const WORKSPACE = "workspace_metering";

// A distinct user per call: the per-user rate limiter is 10/min and is real (not
// mocked), so reusing one id makes the 11th test in this file fail as
// `policy_rate_limited` — a harness artefact that would look like a defect.
let userSeq = 0;

function runTask() {
  return executeLLMTask({
    taskType: "RECOMMENDATION_EXPLANATION",
    workspaceId: WORKSPACE,
    userId: `user_metering_${(userSeq += 1)}`,
    promptKey: "recommendation.explanation",
    promptVersion: "v1",
    systemPrompt: "system prompt text",
    userPrompt: "user prompt text",
    parseOutput: (rawText) => JSON.parse(rawText) as { summary: string },
    fallbackOutput: { summary: "fallback" },
    outputMode: "json",
  });
}

function loggedRow() {
  expect(mocks.recordLLMCall).toHaveBeenCalledTimes(1);
  return mocks.recordLLMCall.mock.calls[0]![0] as Record<string, unknown>;
}

describe("LLM usage metering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetAccumulatorForTests();
    mocks.adapterIsConfigured.mockReturnValue(true);
    mocks.recordLLMCall.mockResolvedValue(undefined);
    mocks.detectPIIInOutput.mockReturnValue({ detected: false, hits: [] });
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
    __resetAccumulatorForTests();
    vi.restoreAllMocks();
  });

  it("records measured spend when the provider reported a complete usage", async () => {
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "ok" },
      rawOutput: '{"summary":"ok"}',
      modelVersion: "gpt-4.1-mini",
      usage: { promptTokens: 1200, completionTokens: 800 },
    });

    const result = await runTask();

    expect(result.success).toBe(true);
    expect(getMonthToDateSpendUSD(WORKSPACE)).toBeGreaterThan(0);
    expect(getMonthToDateUnknownCallCount(WORKSPACE)).toBe(0);
    expect(loggedRow()).toMatchObject({ tokenUsagePrompt: 1200, tokenUsageCompletion: 800 });
  });

  it("A02: a provider that omitted usage is recorded as unknown, not as zero", async () => {
    // The adapter always builds a usage object, so the old truthiness check
    // never fell through to the estimate and the call was billed as 0 + 0.
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "ok" },
      rawOutput: '{"summary":"ok"}',
      modelVersion: "gpt-4.1-mini",
      usage: { promptTokens: undefined, completionTokens: undefined },
    });

    const result = await runTask();

    expect(result.success).toBe(true);
    // Not folded into the measured total — an estimate there could never be
    // told apart from a measurement afterwards.
    expect(getMonthToDateSpendUSD(WORKSPACE)).toBe(0);
    // But it is no longer invisible.
    expect(getMonthToDateUnknownCallCount(WORKSPACE)).toBe(1);
    expect(loggedRow()).toMatchObject({ tokenUsagePrompt: null, tokenUsageCompletion: null });
  });

  it("A02: a half-reported usage is unknown, not a partial measurement", async () => {
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "ok" },
      rawOutput: '{"summary":"ok"}',
      modelVersion: "gpt-4.1-mini",
      usage: { promptTokens: 1200 },
    });

    await runTask();

    expect(getMonthToDateSpendUSD(WORKSPACE)).toBe(0);
    expect(getMonthToDateUnknownCallCount(WORKSPACE)).toBe(1);
  });

  it("A02: a measured zero stays a measurement", async () => {
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "ok" },
      rawOutput: '{"summary":"ok"}',
      modelVersion: "gpt-4.1-mini",
      usage: { promptTokens: 0, completionTokens: 0 },
    });

    await runTask();

    expect(getMonthToDateUnknownCallCount(WORKSPACE)).toBe(0);
    expect(loggedRow()).toMatchObject({ tokenUsagePrompt: 0, tokenUsageCompletion: 0 });
  });

  it("A03: a PII-rejected call still records what the provider charged for", async () => {
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "ok" },
      rawOutput: '{"summary":"ok"}',
      modelVersion: "gpt-4.1-mini",
      usage: { promptTokens: 1500, completionTokens: 900 },
    });
    mocks.detectPIIInOutput.mockReturnValue({ detected: true, hits: [{ type: "synthetic_marker" }] });

    const result = await runTask();

    expect(result.success).toBe(false);
    expect(result.fallbackReason).toBe("policy_pii_in_output");
    // The provider ran and charged; the rejection is ours. This used to return
    // before any spend was recorded.
    expect(getMonthToDateSpendUSD(WORKSPACE)).toBeGreaterThan(0);
    expect(loggedRow()).toMatchObject({ tokenUsagePrompt: 1500, tokenUsageCompletion: 900 });
  });

  it("A04: a parse failure keeps the usage the provider already reported", async () => {
    // parseOutput runs while the adapter builds its return object, so the usage
    // used to be thrown away with it. The adapter now attaches the observation
    // to the escaping error, keeping the error's own type intact.
    mocks.adapterRun.mockImplementation(async () => {
      throw attachUsageObservation(new LlmOutputParseError("LLM output was not valid JSON"), {
        kind: "known",
        promptTokens: 700,
        completionTokens: 300,
      });
    });

    const result = await runTask();

    expect(result.success).toBe(false);
    // The error type still drives the fallback reason — the attachment did not
    // wrap or replace the error.
    expect(result.fallbackReason).toBe("output_parse_failed");
    expect(getMonthToDateSpendUSD(WORKSPACE)).toBeGreaterThan(0);
    expect(loggedRow()).toMatchObject({ tokenUsagePrompt: 700, tokenUsageCompletion: 300 });
  });

  it("A04: a transport failure carries no usage and is recorded as unknown, not zero", async () => {
    mocks.adapterRun.mockRejectedValue(new Error("Synthetic transport failure"));

    const result = await runTask();

    expect(result.success).toBe(false);
    expect(result.fallbackReason).toBe("provider_error");
    expect(getMonthToDateSpendUSD(WORKSPACE)).toBe(0);
    // "We never observed a usage" is itself a fact worth counting: a failed call
    // may still have been charged upstream, and pretending it consumed nothing
    // is the same mistake as A02 in a different path.
    expect(getMonthToDateUnknownCallCount(WORKSPACE)).toBe(1);
    expect(loggedRow()).toMatchObject({ tokenUsagePrompt: null, tokenUsageCompletion: null });
  });

  it("unknown amounts accumulate separately from measured spend across calls", async () => {
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "ok" },
      rawOutput: '{"summary":"ok"}',
      modelVersion: "gpt-4.1-mini",
      usage: { promptTokens: 1200, completionTokens: 800 },
    });
    await runTask();
    const measuredAfterFirst = getMonthToDateSpendUSD(WORKSPACE);

    mocks.recordLLMCall.mockClear();
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "ok" },
      rawOutput: '{"summary":"ok"}',
      modelVersion: "gpt-4.1-mini",
      usage: {},
    });
    await runTask();

    // The unknown call did not move the measured total by a single unit.
    expect(getMonthToDateSpendUSD(WORKSPACE)).toBe(measuredAfterFirst);
    expect(getMonthToDateUnknownCallCount(WORKSPACE)).toBe(1);
    expect(getMonthToDateUnknownUpperBoundUSD(WORKSPACE)).toBeGreaterThanOrEqual(0);
  });
});

describe("prompt version override binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetAccumulatorForTests();
    mocks.adapterIsConfigured.mockReturnValue(true);
    mocks.recordLLMCall.mockResolvedValue(undefined);
    mocks.detectPIIInOutput.mockReturnValue({ detected: false, hits: [] });
    mocks.resolveModelForTask.mockReturnValue({
      provider: "openai",
      model: "gpt-4.1-mini",
      modelRole: "REASONING",
      budgetTier: "pilot",
    });
  });

  function configWithOverride(overrides: Record<string, string> | null) {
    mocks.getWorkspaceLLMConfig.mockResolvedValue({
      provider: "openai",
      defaultModel: "gpt-4.1-mini",
      extractionModel: "gpt-4.1-mini",
      briefingModel: "gpt-4.1-mini",
      reasoningModel: "gpt-4.1-mini",
      llmEnabled: true,
      llmBudgetTier: "pilot",
      promptVersionOverrides: overrides,
    });
  }

  it("A07: an override that cannot change the prompt is refused before the provider is called", async () => {
    // The resolver is consulted after the caller already built the prompts, so
    // its answer cannot select a template. Recording it as effective is what put
    // one version in the ledger and another behind the adapter's bytes.
    configWithOverride({ "recommendation.explanation": "recommendation.explanation-v-rollback" });
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "ok" },
      rawOutput: '{"summary":"ok"}',
      modelVersion: "gpt-4.1-mini",
      usage: { promptTokens: 10, completionTokens: 10 },
    });

    const result = await runTask();

    expect(result.success).toBe(false);
    expect(result.fallbackReason).toBe("policy_prompt_version_unbindable");
    // Zero charged calls: the provider was never contacted.
    expect(mocks.adapterRun).not.toHaveBeenCalled();
    expect(getMonthToDateSpendUSD(WORKSPACE)).toBe(0);
    expect(getMonthToDateUnknownCallCount(WORKSPACE)).toBe(0);
  });

  it("A07: the ledger records the EFFECTIVE version, with the requested one named in the error", async () => {
    configWithOverride({ "recommendation.explanation": "v-rollback" });

    const result = await runTask();

    const row = loggedRow();
    // Never the requested one: that is the mismatch this refuses to create.
    expect(row.promptVersion).toBe("v1");
    expect(result.promptVersion).toBe("v1");
    expect(String(row.errorMessage)).toContain("requested=v-rollback");
    expect(String(row.errorMessage)).toContain("effective=v1");
  });

  it("an override equal to the registry default is not a mismatch and proceeds", async () => {
    configWithOverride({ "recommendation.explanation": "v1" });
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "ok" },
      rawOutput: '{"summary":"ok"}',
      modelVersion: "gpt-4.1-mini",
      usage: { promptTokens: 10, completionTokens: 10 },
    });

    const result = await runTask();

    expect(result.success).toBe(true);
    expect(mocks.adapterRun).toHaveBeenCalledTimes(1);
  });

  it("no override configured keeps the default path untouched", async () => {
    configWithOverride(null);
    mocks.adapterRun.mockResolvedValue({
      output: { summary: "ok" },
      rawOutput: '{"summary":"ok"}',
      modelVersion: "gpt-4.1-mini",
      usage: { promptTokens: 10, completionTokens: 10 },
    });

    const result = await runTask();

    expect(result.success).toBe(true);
    expect(result.promptVersion).toBe("v1");
  });
});
