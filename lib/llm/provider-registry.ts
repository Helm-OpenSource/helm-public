import { recordLLMCall } from "@/lib/observability/llm-call-log.service";
import { getWorkspaceLLMConfig } from "@/lib/llm/config";
import { appendLLMContextAuditToInputSummary, buildLLMContextAudit } from "@/lib/llm/context-audit";
import {
  MaxTokensExceededError,
  applyMaxOutputTokensPolicy,
} from "@/lib/llm/max-tokens-policy";
import { resolveModelForTask } from "@/lib/llm/model-router";
import { openAIAdapter } from "@/lib/llm/openai-adapter";
import { qwenAdapter } from "@/lib/llm/qwen-adapter";
import { detectPIIInOutput } from "@/lib/llm/output-pii-scrubber";
import { resolvePromptVersionForKey } from "@/lib/llm/prompt-version-resolver";
import {
  RateLimitedError,
  applyRateLimitPolicy,
} from "@/lib/llm/rate-limiter";
import {
  SpendBudgetExceededError,
  applySpendBudgetPolicyAsync,
  recordActualSpend,
} from "@/lib/llm/spend-tracker";
import { estimateSpendUSD } from "@/lib/llm/token-cost-table";
import type { LLMProviderAdapter, LLMTaskExecutionResult, LLMTaskInput } from "@/lib/llm/types";
import { trimText } from "@/lib/utils";

const registry = new Map<string, LLMProviderAdapter>([
  ["openai", openAIAdapter],
  ["qwen", qwenAdapter],
]);

export function getProviderAdapter(provider: string) {
  return registry.get(provider) ?? null;
}

export function listRegisteredProviders() {
  return Array.from(registry.values()).map((provider) => ({
    provider: provider.provider,
    label: provider.label,
    capabilities: provider.capabilities,
    configured: provider.isConfigured(),
  }));
}

export async function executeLLMTask<TOutput>(input: LLMTaskInput<TOutput>): Promise<LLMTaskExecutionResult<TOutput>> {
  const workspaceConfig = await getWorkspaceLLMConfig(input.workspaceId);
  const routed = resolveModelForTask(workspaceConfig, input.taskType, input.modelHint);

  // T019 P2 — apply workspace prompt-version override before adapter dispatch.
  // If workspace has promptVersionOverrides[input.promptKey], use that version
  // instead of the caller-supplied registry default. This enables per-workspace
  // rollback / staged rollout. The resolved version is what gets logged via
  // recordLLMCall and returned to the caller.
  const resolvedPromptVersion = resolvePromptVersionForKey({
    promptKey: input.promptKey,
    registryDefaultVersion: input.promptVersion,
    workspaceConfig,
  });
  const promptVersion = resolvedPromptVersion.version;
  const hintedAdapter = input.providerHint ? getProviderAdapter(input.providerHint) : null;
  const adapter = hintedAdapter ?? getProviderAdapter(routed.provider);
  const start = Date.now();
  const contextAudit = buildLLMContextAudit({
    taskType: input.taskType,
    promptKey: input.promptKey,
    promptVersion,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
  });
  const inputSummary = appendLLMContextAuditToInputSummary({
    inputSummary: input.inputSummary,
    audit: contextAudit,
  });

  // Guard 1 · Max-tokens cap (T019 P0 #1). Apply per-task default if
  // caller did not set, reject if caller exceeded the sanity ceiling.
  // Excess is logged as a fallback (lenient mode) rather than thrown
  // upward, to preserve existing executeLLMTask non-throwing contract.
  let effectiveMaxOutputTokens: number;
  try {
    effectiveMaxOutputTokens = applyMaxOutputTokensPolicy({
      taskType: input.taskType,
      requestedMaxOutputTokens: input.maxOutputTokens,
    });
  } catch (policyError) {
    if (policyError instanceof MaxTokensExceededError) {
      const latencyMs = Date.now() - start;
      await recordLLMCallSafely({
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: adapter?.provider ?? routed.provider,
        model: routed.model,
        modelVersion: routed.model,
        modelRole: routed.modelRole,
        taskType: input.taskType,
        promptKey: input.promptKey,
        promptVersion,
        budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
        outputMode: input.outputMode ?? "text",
        inputSummary,
        outputSummary: "本次调用违反 max-tokens 策略，已回退到规则逻辑。",
        latencyMs,
        success: false,
        fallbackReason: "policy_max_tokens_exceeded",
        errorMessage: policyError.message,
      });
      return {
        output: input.fallbackOutput,
        provider: adapter?.provider ?? routed.provider,
        model: routed.model,
        modelVersion: routed.model,
        modelRole: routed.modelRole,
        promptKey: input.promptKey,
        promptVersion,
        success: false,
        fallbackUsed: true,
        fallbackReason: "policy_max_tokens_exceeded",
        errorMessage: policyError.message,
        latencyMs,
        rawOutput: null,
        budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
      };
    }
    throw policyError;
  }

  // Guard 3 · Rate limit (T019 P1). Three-tier token bucket: per-user
  // (briefing 60/min, reasoning 10/min), per-workspace (1000/hour),
  // per-IP (30/min when ip is present, e.g. trial users).
  // Lenient mode like guards 1 + 2.
  try {
    applyRateLimitPolicy({
      taskType: input.taskType,
      workspaceId: input.workspaceId,
      userId: input.userId,
    });
  } catch (policyError) {
    if (policyError instanceof RateLimitedError) {
      const latencyMs = Date.now() - start;
      await recordLLMCallSafely({
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: adapter?.provider ?? routed.provider,
        model: routed.model,
        modelVersion: routed.model,
        modelRole: routed.modelRole,
        taskType: input.taskType,
        promptKey: input.promptKey,
        promptVersion,
        budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
        outputMode: input.outputMode ?? "text",
        inputSummary,
        outputSummary: `本次调用被 rate-limit 拦截（scope=${policyError.scope}，retry=${policyError.retryAfterSeconds}s）。`,
        latencyMs,
        success: false,
        fallbackReason: "policy_rate_limited",
        errorMessage: policyError.message,
      });
      return {
        output: input.fallbackOutput,
        provider: adapter?.provider ?? routed.provider,
        model: routed.model,
        modelVersion: routed.model,
        modelRole: routed.modelRole,
        promptKey: input.promptKey,
        promptVersion,
        success: false,
        fallbackUsed: true,
        fallbackReason: "policy_rate_limited",
        errorMessage: policyError.message,
        latencyMs,
        rawOutput: null,
        budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
      };
    }
    throw policyError;
  }

  // Guard 2 · Monthly spending budget (T019 P0 #2). Estimate the call's
  // cost using token-cost-table; reject if month-to-date + estimate
  // exceeds workspace budget. Lenient mode like guard 1.
  let spendPolicyResult: Awaited<ReturnType<typeof applySpendBudgetPolicyAsync>> | null = null;
  if (adapter) {
    try {
      spendPolicyResult = await applySpendBudgetPolicyAsync({
        workspaceConfig,
        workspaceId: input.workspaceId,
        provider: adapter.provider,
        model: routed.model,
        taskType: input.taskType,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        effectiveMaxOutputTokens,
      });
    } catch (policyError) {
      if (policyError instanceof SpendBudgetExceededError) {
        const latencyMs = Date.now() - start;
        await recordLLMCallSafely({
          workspaceId: input.workspaceId,
          userId: input.userId,
          provider: adapter.provider,
          model: routed.model,
          modelVersion: routed.model,
          modelRole: routed.modelRole,
          taskType: input.taskType,
          promptKey: input.promptKey,
          promptVersion,
          budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
          outputMode: input.outputMode ?? "text",
          inputSummary,
          outputSummary: "本次调用违反 spend-budget 策略，已回退到规则逻辑。",
          latencyMs,
          success: false,
          fallbackReason: "policy_spend_budget_exceeded",
          errorMessage: policyError.message,
        });
        return {
          output: input.fallbackOutput,
          provider: adapter.provider,
          model: routed.model,
          modelVersion: routed.model,
          modelRole: routed.modelRole,
          promptKey: input.promptKey,
          promptVersion,
          success: false,
          fallbackUsed: true,
          fallbackReason: "policy_spend_budget_exceeded",
          errorMessage: policyError.message,
          latencyMs,
          rawOutput: null,
          budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
        };
      }
      throw policyError;
    }
  }

  if (!workspaceConfig.llmEnabled || !adapter || !adapter.isConfigured()) {
    const latencyMs = Date.now() - start;
    await recordLLMCallSafely({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: adapter?.provider ?? routed.provider,
      model: routed.model,
      modelVersion: routed.model,
      modelRole: routed.modelRole,
      taskType: input.taskType,
      promptKey: input.promptKey,
      promptVersion,
      budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
      outputMode: input.outputMode ?? "text",
      inputSummary,
      outputSummary: "本次调用走规则回退。",
      latencyMs,
      success: false,
      fallbackReason: workspaceConfig.llmEnabled ? "provider_not_configured" : "llm_disabled",
      errorMessage: workspaceConfig.llmEnabled ? "LLM provider not configured" : "LLM disabled by configuration",
    });

    return {
      output: input.fallbackOutput,
      provider: adapter?.provider ?? routed.provider,
      model: routed.model,
      modelVersion: routed.model,
      modelRole: routed.modelRole,
      promptKey: input.promptKey,
      promptVersion,
      success: false,
      fallbackUsed: true,
      fallbackReason: workspaceConfig.llmEnabled ? "provider_not_configured" : "llm_disabled",
      errorMessage: workspaceConfig.llmEnabled ? "LLM provider not configured" : "LLM disabled by configuration",
      latencyMs,
      rawOutput: null,
      budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
    };
  }

  try {
    const result = await adapter.run({
      ...input,
      maxOutputTokens: effectiveMaxOutputTokens,
      provider: adapter.provider,
      model: routed.model,
      modelRole: routed.modelRole,
      budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
    });
    const latencyMs = Date.now() - start;

    // Guard 4 · PII output scrub (T019 P1). If the LLM produced output
    // containing PII patterns (Chinese mobile / ID card / bank card /
    // real email), reject persistence: record the call as fallback and
    // return fallbackOutput instead of the raw output.
    const piiResult = detectPIIInOutput(result.rawOutput ?? "");
    if (piiResult.detected) {
      await recordLLMCallSafely({
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: adapter.provider,
        model: routed.model,
        modelVersion: result.modelVersion ?? routed.model,
        modelRole: routed.modelRole,
        taskType: input.taskType,
        promptKey: input.promptKey,
        promptVersion,
        budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
        outputMode: input.outputMode ?? "text",
        inputSummary,
        outputSummary: `LLM 输出含 PII 模式 (${piiResult.hits.map((h) => h.type).join(", ")})，已回退到规则逻辑。`,
        tokenUsagePrompt: result.usage?.promptTokens,
        tokenUsageCompletion: result.usage?.completionTokens,
        latencyMs,
        success: false,
        fallbackReason: "policy_pii_in_output",
        errorMessage: `PII detected: ${piiResult.hits.length} hits across ${[...new Set(piiResult.hits.map((h) => h.type))].join(", ")}`,
      });
      return {
        output: input.fallbackOutput,
        provider: adapter.provider,
        model: routed.model,
        modelVersion: result.modelVersion ?? routed.model,
        modelRole: routed.modelRole,
        promptKey: input.promptKey,
        promptVersion,
        success: false,
        fallbackUsed: true,
        fallbackReason: "policy_pii_in_output",
        errorMessage: `PII detected: ${piiResult.hits.length} hits`,
        latencyMs,
        usage: result.usage,
        rawOutput: null,
        budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
      };
    }

    // Record actual spend post-call using real usage if available;
    // otherwise fall back to the pre-call estimate.
    if (spendPolicyResult) {
      const actualUSD = result.usage
        ? estimateSpendUSD({
            provider: adapter.provider,
            model: routed.model,
            inputTokens: result.usage.promptTokens ?? 0,
            outputTokens: result.usage.completionTokens ?? 0,
          })
        : spendPolicyResult.estimatedCallUSD;
      recordActualSpend({
        workspaceId: input.workspaceId,
        monthKey: spendPolicyResult.monthKey,
        spendUSD: actualUSD,
      });
    }
    await recordLLMCallSafely({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: adapter.provider,
      model: routed.model,
      modelVersion: result.modelVersion ?? routed.model,
      modelRole: routed.modelRole,
      taskType: input.taskType,
      promptKey: input.promptKey,
      promptVersion,
      budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
      outputMode: input.outputMode ?? "text",
      inputSummary,
      outputSummary: trimText(result.rawOutput, 220),
      tokenUsagePrompt: result.usage?.promptTokens,
      tokenUsageCompletion: result.usage?.completionTokens,
      latencyMs,
      success: true,
    });

    return {
      output: result.output,
      provider: adapter.provider,
      model: routed.model,
      modelVersion: result.modelVersion ?? routed.model,
      modelRole: routed.modelRole,
      promptKey: input.promptKey,
      promptVersion,
      success: true,
      fallbackUsed: false,
      latencyMs,
      usage: result.usage,
      rawOutput: result.rawOutput,
      budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知 LLM 错误";
    const latencyMs = Date.now() - start;

    await recordLLMCallSafely({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: adapter.provider,
      model: routed.model,
      modelVersion: routed.model,
      modelRole: routed.modelRole,
      taskType: input.taskType,
      promptKey: input.promptKey,
      promptVersion,
      budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
      outputMode: input.outputMode ?? "text",
      inputSummary,
      outputSummary: "本次调用失败，已回退到规则逻辑。",
      latencyMs,
      success: false,
      fallbackReason: "provider_error",
      errorMessage: message,
    });

    return {
      output: input.fallbackOutput,
      provider: adapter.provider,
      model: routed.model,
      modelVersion: routed.model,
      modelRole: routed.modelRole,
      promptKey: input.promptKey,
      promptVersion,
      success: false,
      fallbackUsed: true,
      fallbackReason: "provider_error",
      errorMessage: message,
      latencyMs,
      rawOutput: null,
      budgetTier: routed.budgetTier ?? workspaceConfig.llmBudgetTier,
    };
  }
}

async function recordLLMCallSafely(input: Parameters<typeof recordLLMCall>[0]) {
  try {
    await recordLLMCall(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知日志写入错误";
    const code =
      error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : null;
    if (code === "P2003") {
      console.warn(`[LLM observability] Skipped LLM call log due to foreign key constraint: ${trimText(message, 180)}`);
      return;
    }
    console.warn(`[LLM observability] Failed to record LLM call log: ${trimText(message, 180)}`, error);
  }
}
