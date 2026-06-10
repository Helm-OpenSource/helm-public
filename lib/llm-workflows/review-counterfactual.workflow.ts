/**
 * Counterfactual Reviewer — fail-closed workflow (LLM Intelligence v2).
 *
 * Takes the minimal `SelectedContextStub` (never the full selector receipt),
 * asks the reviewer to challenge a judgement candidate, and returns a
 * `CounterfactualReviewerOutput` that may only downgrade or require human
 * review. Every abnormal condition fails closed to `needs_review` +
 * `requiredHumanReview=true` with a concrete reason:
 *
 *   missing policy, missing permission, unsafe capability request, timeout,
 *   parse failure, schema failure, provider failure, empty response.
 *
 * Latency fence (owner decision): default 5000ms, batch/eval upper bound
 * 15000ms. On timeout the result is `needs_review` with reason `timeout`; a
 * timeout must NOT raise human-review queue priority, so the output carries no
 * priority signal.
 */

import {
  buildCounterfactualReviewPrompt,
  counterfactualReviewSchema,
  llmPromptVersions,
} from "@/lib/llm/prompt-registry";
import { executeLLMTask } from "@/lib/llm/provider-registry";
import {
  buildFailClosedCounterfactualResult,
  counterfactualReviewerOutputSchema,
  prepareCounterfactualEgress,
  selectedContextStubSchema,
  type CounterfactualEgressPolicy,
  type CounterfactualReviewerOutput,
} from "@/lib/llm/intelligence-contracts-v2";
import {
  resolveRuntimePermissionForCapability,
  type CapabilityRequested,
} from "@/lib/llm/runtime-permission";

export const COUNTERFACTUAL_DEFAULT_MAX_LATENCY_MS = 5000;
export const COUNTERFACTUAL_MAX_LATENCY_CEILING_MS = 15000;

/**
 * Boundary decision receipt for the counterfactual reviewer. This is the
 * authoritative, caller-facing record of the boundary decision. Emit it at the
 * workflow layer so the audit chain is consistent even when the underlying
 * provider call cannot be cancelled (see `providerCallCancelled`).
 */
export interface CounterfactualBoundaryReceipt {
  objectRef: { objectType: string; objectId: string } | null;
  reviewState: CounterfactualReviewerOutput["reviewState"];
  requiredHumanReview: boolean;
  reason: string | null;
  /** Trace correlation id; lets a late provider result be marked superseded. */
  traceId: string | null;
  timedOut: boolean;
  /**
   * `executeLLMTask` exposes no cancellation, so on timeout the in-flight
   * provider call is NOT aborted and may still record its own (independent)
   * call log. This receipt is the authoritative boundary decision for the
   * caller; treat the provider-registry log as a separate, possibly-later
   * record. Always `false` until provider-level abort is wired.
   */
  providerCallCancelled: boolean;
  latencyBudgetMs: number;
}

export interface CounterfactualReviewInput {
  workspaceId: string;
  userId?: string | null;
  /** Minimal reviewer input. Validated defensively; bad shape fails closed. */
  contextStub: unknown;
  judgementSummary: string;
  /** LLM workflows may only *request* a capability by reference. */
  capabilityRequested?: CapabilityRequested;
  /**
   * Remote-egress policy. A non-`public_safe_synthetic` stub defaults to
   * remote-risk and requires consent + prompt preview, or the workflow fails
   * closed before dispatch.
   */
  egressPolicy?: CounterfactualEgressPolicy;
  maxLatencyMs?: number;
  /** Optional audit sink. Invoked once with the authoritative boundary decision. */
  recordBoundaryDecision?: (receipt: CounterfactualBoundaryReceipt) => void;
  traceId?: string;
}

function resolveLatencyBudget(requested?: number): number {
  if (typeof requested !== "number" || !Number.isFinite(requested) || requested <= 0) {
    return COUNTERFACTUAL_DEFAULT_MAX_LATENCY_MS;
  }
  return Math.min(Math.floor(requested), COUNTERFACTUAL_MAX_LATENCY_CEILING_MS);
}

function coerceToReviewOnly(
  output: CounterfactualReviewerOutput,
): CounterfactualReviewerOutput {
  // The reviewer may only downgrade or require review — a clean `candidate`
  // pass is coerced up to needs_review with required human review.
  if (output.reviewState === "candidate") {
    return {
      ...output,
      reviewState: "needs_review",
      requiredHumanReview: true,
    };
  }
  if (output.reviewState === "needs_review") {
    return { ...output, requiredHumanReview: true };
  }
  return output;
}

export async function reviewCounterfactualWithLLM(
  input: CounterfactualReviewInput,
): Promise<CounterfactualReviewerOutput> {
  const latencyBudgetMs = resolveLatencyBudget(input.maxLatencyMs);

  const emit = (
    output: CounterfactualReviewerOutput,
    meta: { timedOut: boolean; objectRef?: { objectType: string; objectId: string } | null },
  ): CounterfactualReviewerOutput => {
    input.recordBoundaryDecision?.({
      objectRef: meta.objectRef ?? null,
      reviewState: output.reviewState,
      requiredHumanReview: output.requiredHumanReview,
      reason: output.reason,
      traceId: input.traceId ?? null,
      timedOut: meta.timedOut,
      providerCallCancelled: false,
      latencyBudgetMs,
    });
    return output;
  };

  // 1. Missing permission — the workflow requires an explicit capability request.
  if (!input.capabilityRequested) {
    return emit(buildFailClosedCounterfactualResult("missing_permission"), { timedOut: false });
  }
  // 2. Unsafe capability — any non-allow-listed request fails closed.
  if (resolveRuntimePermissionForCapability(input.capabilityRequested) === "blocked_side_effect") {
    return emit(buildFailClosedCounterfactualResult("unsafe_capability_request"), {
      timedOut: false,
    });
  }
  // 3. Missing policy snapshot on the selected context.
  const rawStub = input.contextStub;
  const hasPolicyHash =
    rawStub != null &&
    typeof rawStub === "object" &&
    typeof (rawStub as { policySnapshotHash?: unknown }).policySnapshotHash === "string" &&
    ((rawStub as { policySnapshotHash: string }).policySnapshotHash.trim().length > 0);
  if (!hasPolicyHash) {
    return emit(buildFailClosedCounterfactualResult("missing_policy"), { timedOut: false });
  }
  // 4. Schema failure — defensively validate the stub shape (strict).
  const stubResult = selectedContextStubSchema.safeParse(rawStub);
  if (!stubResult.success) {
    return emit(buildFailClosedCounterfactualResult("schema_failure"), { timedOut: false });
  }
  const contextStub = stubResult.data;
  const objectRef = {
    objectType: contextStub.objectRef.objectType,
    objectId: contextStub.objectRef.objectId,
  };

  // 5. Remote egress gate (mirrors v1). Non-synthetic / remote path requires
  // consent + prompt preview; otherwise fail closed BEFORE any dispatch. The
  // stub + judgement summary are redacted before reaching the provider.
  const egress = prepareCounterfactualEgress({
    contextStub,
    judgementSummary: input.judgementSummary,
    policy: input.egressPolicy,
  });
  if (!egress.ok || !egress.safeStub || egress.safeJudgementSummary === null) {
    return emit(buildFailClosedCounterfactualResult("egress_blocked"), {
      timedOut: false,
      objectRef,
    });
  }
  const safeStub = egress.safeStub;
  const safeJudgementSummary = egress.safeJudgementSummary;

  const fallback = buildFailClosedCounterfactualResult("provider_failure");
  const prompt = buildCounterfactualReviewPrompt({
    contextStub: safeStub,
    judgementSummary: safeJudgementSummary,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  // Tag each branch so the winning result is unambiguously the timeout or not,
  // independent of timer-fire ordering.
  const timeout = new Promise<{ output: CounterfactualReviewerOutput; timedOut: boolean }>(
    (resolve) => {
      timer = setTimeout(
        () => resolve({ output: buildFailClosedCounterfactualResult("timeout"), timedOut: true }),
        latencyBudgetMs,
      );
    },
  );

  const run = (async (): Promise<{ output: CounterfactualReviewerOutput; timedOut: boolean }> => {
    try {
      const result = await executeLLMTask<CounterfactualReviewerOutput>({
        taskType: "COUNTERFACTUAL_REVIEW",
        workspaceId: input.workspaceId,
        userId: input.userId ?? undefined,
        promptKey: prompt.promptKey,
        promptVersion: llmPromptVersions.counterfactualReview,
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
        inputSummary: `${safeStub.objectRef.objectType}:${safeStub.objectRef.objectId} 的反证复核`,
        outputMode: "json",
        jsonSchema: counterfactualReviewSchema,
        maxOutputTokens: safeStub.tokenBudget.maxOutputTokens,
        fallbackOutput: fallback,
        parseOutput(rawText) {
          const trimmed = (rawText ?? "").trim();
          if (trimmed.length === 0) {
            return buildFailClosedCounterfactualResult("empty_response");
          }
          let parsed: unknown;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            return buildFailClosedCounterfactualResult("parse_failure");
          }
          // Strict parse: an unsafe extra key fails closed rather than being stripped.
          const validated = counterfactualReviewerOutputSchema.safeParse(parsed);
          if (!validated.success) {
            return buildFailClosedCounterfactualResult("schema_failure");
          }
          return coerceToReviewOnly(validated.data);
        },
      });
      return { output: result.output, timedOut: false };
    } catch {
      return { output: buildFailClosedCounterfactualResult("provider_failure"), timedOut: false };
    }
  })();

  const raced = await Promise.race([run, timeout]);
  if (timer) {
    clearTimeout(timer);
  }
  const output = counterfactualReviewerOutputSchema.parse(raced.output);
  return emit(output, { timedOut: raced.timedOut, objectRef });
}
