import type {
  MemoryRetrievalPackSurfaceTrace,
} from "@/lib/memory/retrieval-pack-adapter";
import type { MemoryRetrievalSurface } from "@/lib/memory/retrieval-pack";

export type MemoryLoadScope =
  | "startup"
  | "briefing"
  | "recommendation"
  | "meeting_detail"
  | "runtime_review"
  | "operator_review";

export type MemoryObservabilityPosture = "ok" | "watch" | "review" | "fallback";
export type MemoryObservabilityReasonCode =
  | "within_budget"
  | "budget_pressure"
  | "budget_exceeded"
  | "fallback_used"
  | "insufficient_trace"
  | "scope_empty";
export type MemoryObservabilitySourceStepName =
  | "trace_truth"
  | "index_scope"
  | "load_budget"
  | "authority_boundary";
export type MemoryObservabilitySourceOutcome = "pass" | "warn" | "block";

export type MemoryObservabilitySourceStep = {
  step: MemoryObservabilitySourceStepName;
  sourceType: string;
  sourceRef: string | null;
  outcome: MemoryObservabilitySourceOutcome;
  note: string;
};

export type MemoryObservabilityBudgetInput = {
  traceKey: string;
  generatedAt?: Date | string;
  loadScope: MemoryLoadScope;
  topicKey?: string | null;
  topicSummary?: string | null;
  trace: MemoryRetrievalPackSurfaceTrace | null;
  operatorNextMove?: string | null;
};

export type MemoryObservabilityBudgetReadout = {
  readoutKey: string;
  generatedAt: string;
  posture: MemoryObservabilityPosture;
  primaryReasonCode: MemoryObservabilityReasonCode;
  memoryIndex: {
    topicKey: string;
    topicSummary: string;
    loadScope: MemoryLoadScope;
    surface: MemoryRetrievalSurface | "unknown";
    objectType: string | null;
    objectId: string | null;
    candidateCount: number;
    selectedCount: number;
    omittedCount: number;
    fallbackUsed: boolean;
    selectedRefs: string[];
    omittedReasons: Array<{ reason: string; count: number }>;
  };
  loadBudget: {
    maxItems: number;
    maxEstimatedTokens: number;
    estimatedTokensUsed: number;
    estimatedTokensRemaining: number;
    itemUsageRatio: number;
    tokenUsageRatio: number;
  };
  loadTrace: {
    loaded: Array<{
      id: string;
      title: string;
      selectedReason: string;
      estimatedTokens: number;
      evidenceRefs: string[];
    }>;
    skipped: Array<{
      id: string;
      title: string;
      omittedReason: string;
      estimatedTokens: number;
    }>;
    fallbackReason: string | null;
    sourceChain: MemoryObservabilitySourceStep[];
  };
  operator: {
    summary: string;
    nextMove: string;
    boundaryNotes: string[];
  };
  audit: {
    emittedBy: "memory-observability-budgeting";
    replaySafe: true;
  };
};

export type MemoryObservabilityBudgetSummary = {
  generatedAt: string;
  totalReadouts: number;
  postureCounts: Record<MemoryObservabilityPosture, number>;
  totalEstimatedTokensUsed: number;
  fallbackKeys: string[];
  reviewKeys: string[];
  watchKeys: string[];
  primaryNextMove: string;
  boundaryNotes: string[];
};

export function buildMemoryObservabilityBudgetReadout(
  input: MemoryObservabilityBudgetInput,
): MemoryObservabilityBudgetReadout {
  const generatedAt = toIsoString(input.generatedAt ?? new Date());
  const trace = input.trace;
  const topicKey = input.topicKey?.trim() || buildTopicKey(input);
  const topicSummary = input.topicSummary?.trim() || buildTopicSummary(input);
  const budget = trace?.budget ?? { maxItems: 0, maxEstimatedTokens: 0 };
  const selectedCount = trace?.trace.selectedCount ?? 0;
  const omittedCount = trace?.trace.omittedCount ?? 0;
  const candidateCount = trace?.trace.candidateCount ?? 0;
  const tokensUsed = trace?.trace.estimatedTokensUsed ?? 0;
  const tokensRemaining = trace?.trace.estimatedTokensRemaining ?? 0;
  const itemUsageRatio = toRatio(selectedCount, budget.maxItems);
  const tokenUsageRatio = toRatio(tokensUsed, budget.maxEstimatedTokens);
  const primaryReasonCode = resolveReasonCode(trace);
  const posture = resolvePosture(primaryReasonCode, tokenUsageRatio, trace);

  return {
    readoutKey: buildStableKey("memory_observability", input.traceKey),
    generatedAt,
    posture,
    primaryReasonCode,
    memoryIndex: {
      topicKey,
      topicSummary,
      loadScope: input.loadScope,
      surface: trace?.surface ?? "unknown",
      objectType: trace?.objectType ?? null,
      objectId: trace?.objectId ?? null,
      candidateCount,
      selectedCount,
      omittedCount,
      fallbackUsed: trace?.fallback.used ?? false,
      selectedRefs: trace?.selected.map((item) => item.id) ?? [],
      omittedReasons: trace?.trace.omittedReasons ?? [],
    },
    loadBudget: {
      maxItems: budget.maxItems,
      maxEstimatedTokens: budget.maxEstimatedTokens,
      estimatedTokensUsed: tokensUsed,
      estimatedTokensRemaining: tokensRemaining,
      itemUsageRatio,
      tokenUsageRatio,
    },
    loadTrace: {
      loaded:
        trace?.selected.map((item) => ({
          id: item.id,
          title: item.title,
          selectedReason: item.selectedReason,
          estimatedTokens: item.estimatedTokens,
          evidenceRefs: item.evidenceRefs,
        })) ?? [],
      skipped:
        trace?.omitted.map((item) => ({
          id: item.id,
          title: item.title,
          omittedReason: item.omittedReason,
          estimatedTokens: item.estimatedTokens,
        })) ?? [],
      fallbackReason: trace?.fallback.reason ?? null,
      sourceChain: [
        buildTraceTruthStep(input),
        buildIndexScopeStep(input, topicKey),
        buildLoadBudgetStep({
          trace,
          primaryReasonCode,
          tokenUsageRatio,
        }),
        {
          step: "authority_boundary",
          sourceType: "policy",
          sourceRef: "read_only_memory_observability_budgeting",
          outcome: "pass",
          note: "Memory observability readout explains index, budget, and load trace only; it does not change retrieval selection, ranking, promotion, write-back, or commitment authority.",
        },
      ],
    },
    operator: {
      summary: buildOperatorSummary({
        topicSummary,
        posture,
        selectedCount,
        omittedCount,
        tokensUsed,
        budget,
      }),
      nextMove:
        input.operatorNextMove?.trim() ||
        buildDefaultOperatorNextMove({
          posture,
          primaryReasonCode,
          loadScope: input.loadScope,
        }),
      boundaryNotes: [
        "read-only memory observability and budgeting; existing retrieval pack remains the loading source",
        "readout does not change recommendation ranking, approval routing, memory promotion, canonical fact writes, or commitment authority",
        "load budget uses conservative trace estimates and is not a precise tokenizer bill",
      ],
    },
    audit: {
      emittedBy: "memory-observability-budgeting",
      replaySafe: true,
    },
  };
}

export function buildMemoryObservabilityBudgetSummary(
  readouts: MemoryObservabilityBudgetReadout[],
  options: { generatedAt?: Date | string } = {},
): MemoryObservabilityBudgetSummary {
  const postureCounts: Record<MemoryObservabilityPosture, number> = {
    ok: 0,
    watch: 0,
    review: 0,
    fallback: 0,
  };

  for (const readout of readouts) {
    postureCounts[readout.posture] += 1;
  }

  const prioritized =
    readouts.find((readout) => readout.posture === "review") ??
    readouts.find((readout) => readout.posture === "fallback") ??
    readouts.find((readout) => readout.posture === "watch");

  return {
    generatedAt: toIsoString(options.generatedAt ?? new Date()),
    totalReadouts: readouts.length,
    postureCounts,
    totalEstimatedTokensUsed: readouts.reduce(
      (sum, readout) => sum + readout.loadBudget.estimatedTokensUsed,
      0,
    ),
    fallbackKeys: readouts
      .filter((readout) => readout.posture === "fallback")
      .map((readout) => readout.readoutKey),
    reviewKeys: readouts
      .filter((readout) => readout.posture === "review")
      .map((readout) => readout.readoutKey),
    watchKeys: readouts
      .filter((readout) => readout.posture === "watch")
      .map((readout) => readout.readoutKey),
    primaryNextMove: prioritized?.operator.nextMove ?? "No operator action required.",
    boundaryNotes: [
      "read-only memory observability budget summary; existing retrieval and diagnostics surfaces remain the source of truth",
      "summary does not create a full memory trace ledger, distillation runtime, auto-promotion lane, or broad auto-execution plane",
    ],
  };
}

function resolveReasonCode(
  trace: MemoryRetrievalPackSurfaceTrace | null,
): MemoryObservabilityReasonCode {
  if (!trace) return "insufficient_trace";
  if (trace.fallback.used) return "fallback_used";
  if (trace.trace.candidateCount <= 0) return "scope_empty";
  if (trace.trace.estimatedTokensUsed > trace.budget.maxEstimatedTokens) return "budget_exceeded";
  if (
    hasBudgetOmission(trace) ||
    toRatio(trace.trace.estimatedTokensUsed, trace.budget.maxEstimatedTokens) >= 0.85
  ) {
    return "budget_pressure";
  }
  return "within_budget";
}

function resolvePosture(
  reasonCode: MemoryObservabilityReasonCode,
  tokenUsageRatio: number,
  trace: MemoryRetrievalPackSurfaceTrace | null,
): MemoryObservabilityPosture {
  if (reasonCode === "fallback_used") return "fallback";
  if (reasonCode === "insufficient_trace" || reasonCode === "budget_exceeded") return "review";
  if (reasonCode === "budget_pressure" || tokenUsageRatio >= 0.85 || hasBudgetOmission(trace)) {
    return "watch";
  }
  return "ok";
}

function hasBudgetOmission(trace: MemoryRetrievalPackSurfaceTrace | null) {
  return Boolean(
    trace?.trace.omittedReasons.some((item) =>
      ["budget_item_limit", "budget_token_limit"].includes(item.reason),
    ),
  );
}

function buildTraceTruthStep(
  input: MemoryObservabilityBudgetInput,
): MemoryObservabilitySourceStep {
  if (!input.trace) {
    return {
      step: "trace_truth",
      sourceType: "memory_retrieval_pack_trace",
      sourceRef: input.traceKey,
      outcome: "block",
      note: "No retrieval pack trace is available for this memory observability readout.",
    };
  }

  return {
    step: "trace_truth",
    sourceType: "memory_retrieval_pack_trace",
    sourceRef: input.traceKey,
    outcome: "pass",
    note: "Retrieval pack trace is available and can be summarized without changing load behavior.",
  };
}

function buildIndexScopeStep(
  input: MemoryObservabilityBudgetInput,
  topicKey: string,
): MemoryObservabilitySourceStep {
  return {
    step: "index_scope",
    sourceType: "memory_index",
    sourceRef: topicKey,
    outcome: input.trace?.trace.candidateCount === 0 ? "warn" : "pass",
    note:
      input.trace?.trace.candidateCount === 0
        ? `No memory candidates were indexed for ${input.loadScope}.`
        : `Memory index scope is ${input.loadScope} for ${topicKey}.`,
  };
}

function buildLoadBudgetStep(input: {
  trace: MemoryRetrievalPackSurfaceTrace | null;
  primaryReasonCode: MemoryObservabilityReasonCode;
  tokenUsageRatio: number;
}): MemoryObservabilitySourceStep {
  if (!input.trace) {
    return {
      step: "load_budget",
      sourceType: "memory_load_budget",
      sourceRef: null,
      outcome: "block",
      note: "Budget posture cannot be computed without a retrieval trace.",
    };
  }

  if (input.primaryReasonCode === "fallback_used") {
    return {
      step: "load_budget",
      sourceType: "memory_load_budget",
      sourceRef: input.trace.fallback.reason,
      outcome: "warn",
      note: "Retrieval pack used fallback; operator should inspect missing or invalid budget context before relying on the trace.",
    };
  }

  if (input.primaryReasonCode === "budget_exceeded") {
    return {
      step: "load_budget",
      sourceType: "memory_load_budget",
      sourceRef: `${input.trace.trace.estimatedTokensUsed}/${input.trace.budget.maxEstimatedTokens}`,
      outcome: "block",
      note: "Estimated token usage exceeded the declared load budget.",
    };
  }

  if (input.primaryReasonCode === "budget_pressure") {
    return {
      step: "load_budget",
      sourceType: "memory_load_budget",
      sourceRef: `${input.trace.trace.estimatedTokensUsed}/${input.trace.budget.maxEstimatedTokens}`,
      outcome: "warn",
      note: "Trace is within hard budget but has budget pressure or budget-driven omissions.",
    };
  }

  return {
    step: "load_budget",
    sourceType: "memory_load_budget",
    sourceRef: `${Math.round(input.tokenUsageRatio * 100)}%`,
    outcome: "pass",
    note: "Trace stays within the declared load budget.",
  };
}

function buildOperatorSummary(input: {
  topicSummary: string;
  posture: MemoryObservabilityPosture;
  selectedCount: number;
  omittedCount: number;
  tokensUsed: number;
  budget: { maxEstimatedTokens: number };
}) {
  return `${input.topicSummary}: ${input.posture} with ${input.selectedCount} loaded, ${input.omittedCount} skipped, and ${input.tokensUsed}/${input.budget.maxEstimatedTokens} estimated tokens used.`;
}

function buildDefaultOperatorNextMove(input: {
  posture: MemoryObservabilityPosture;
  primaryReasonCode: MemoryObservabilityReasonCode;
  loadScope: MemoryLoadScope;
}) {
  if (input.posture === "ok") {
    return "Keep the current memory load policy; no operator action required.";
  }

  if (input.posture === "fallback") {
    return "Review the retrieval pack fallback reason before widening memory context.";
  }

  if (input.primaryReasonCode === "budget_pressure") {
    return `Review ${input.loadScope} omitted reasons before increasing memory load budget.`;
  }

  return `Route ${input.loadScope} memory trace to operator review before relying on this context.`;
}

function buildTopicKey(input: MemoryObservabilityBudgetInput) {
  if (!input.trace) return `${input.loadScope}:unknown`;
  return `${input.loadScope}:${input.trace.surface}:${input.trace.objectType}:${input.trace.objectId}`;
}

function buildTopicSummary(input: MemoryObservabilityBudgetInput) {
  if (!input.trace) return `${input.loadScope} memory trace is missing`;
  return `${input.loadScope} memory index for ${input.trace.objectType}:${input.trace.objectId}`;
}

function toRatio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function buildStableKey(...parts: string[]): string {
  return parts
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
