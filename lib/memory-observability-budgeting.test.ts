import { describe, expect, it } from "vitest";
import {
  buildMemoryObservabilityBudgetReadout,
  buildMemoryObservabilityBudgetSummary,
} from "@/lib/memory-observability-budgeting";
import type { MemoryRetrievalPackSurfaceTrace } from "@/lib/memory/retrieval-pack-adapter";

const now = new Date("2026-04-24T00:00:00.000Z");

function trace(
  overrides: Partial<MemoryRetrievalPackSurfaceTrace> = {},
): MemoryRetrievalPackSurfaceTrace {
  return {
    surface: "recommendation",
    objectType: "Opportunity",
    objectId: "opp-1",
    budget: {
      maxItems: 3,
      maxEstimatedTokens: 300,
    },
    fallback: {
      used: false,
      reason: null,
    },
    selected: [
      {
        id: "fact-1",
        title: "Budget owner confirmed",
        objectType: "Opportunity",
        objectId: "opp-1",
        selectedReason: "confirmed_by_user",
        score: 92,
        estimatedTokens: 80,
        trustScore: 95,
        recencyScore: 90,
        evidenceRefs: ["memoryFact:fact-1", "MEETING_NOTE:meeting-1"],
      },
    ],
    omitted: [],
    trace: {
      candidateCount: 1,
      selectedCount: 1,
      omittedCount: 0,
      estimatedTokensUsed: 80,
      estimatedTokensRemaining: 220,
      selectedReasons: [{ reason: "confirmed_by_user", count: 1 }],
      omittedReasons: [],
      staleSuppressionRefs: [],
      evidenceRefs: ["memoryFact:fact-1", "MEETING_NOTE:meeting-1"],
      boundaryNote:
        "Retrieval pack selection is evidence packaging only; it does not change recommendation ranking, approval ownership, or commitment authority.",
    },
    ...overrides,
  };
}

describe("memory observability budgeting", () => {
  it("builds a read-only memory index and load trace for a healthy retrieval trace", () => {
    const readout = buildMemoryObservabilityBudgetReadout({
      traceKey: "recommendation:opp-1",
      loadScope: "recommendation",
      generatedAt: now,
      trace: trace(),
    });

    expect(readout).toMatchObject({
      readoutKey: "memory_observability_recommendation_opp_1",
      generatedAt: "2026-04-24T00:00:00.000Z",
      posture: "ok",
      primaryReasonCode: "within_budget",
      memoryIndex: {
        selectedCount: 1,
        omittedCount: 0,
        selectedRefs: ["fact-1"],
      },
      loadBudget: {
        itemUsageRatio: 0.333,
        tokenUsageRatio: 0.267,
      },
    });
    expect(readout.loadTrace.sourceChain.map((step) => [step.step, step.outcome])).toEqual([
      ["trace_truth", "pass"],
      ["index_scope", "pass"],
      ["load_budget", "pass"],
      ["authority_boundary", "pass"],
    ]);
    expect(readout.operator.boundaryNotes.join("\n")).toContain("does not change recommendation ranking");
  });

  it("marks budget-driven omissions as watch without changing retrieval selection", () => {
    const readout = buildMemoryObservabilityBudgetReadout({
      traceKey: "briefing:company-1",
      loadScope: "briefing",
      generatedAt: now,
      trace: trace({
        surface: "briefing",
        objectType: "Company",
        objectId: "company-1",
        budget: {
          maxItems: 2,
          maxEstimatedTokens: 200,
        },
        selected: [],
        omitted: [
          {
            id: "fact-overflow",
            title: "Procurement timeline",
            objectType: "Company",
            objectId: "company-1",
            omittedReason: "budget_token_limit",
            score: 82,
            estimatedTokens: 160,
          },
        ],
        trace: {
          ...trace().trace,
          candidateCount: 3,
          selectedCount: 2,
          omittedCount: 1,
          estimatedTokensUsed: 172,
          estimatedTokensRemaining: 28,
          omittedReasons: [{ reason: "budget_token_limit", count: 1 }],
        },
      }),
    });

    expect(readout.posture).toBe("watch");
    expect(readout.primaryReasonCode).toBe("budget_pressure");
    expect(readout.memoryIndex.omittedReasons).toEqual([{ reason: "budget_token_limit", count: 1 }]);
    expect(readout.operator.nextMove).toBe(
      "Review briefing omitted reasons before increasing memory load budget.",
    );
    expect(readout.loadTrace.sourceChain.find((step) => step.step === "load_budget")).toMatchObject({
      outcome: "warn",
    });
  });

  it("keeps fallback traces reviewable without pretending context was loaded", () => {
    const readout = buildMemoryObservabilityBudgetReadout({
      traceKey: "meeting:missing-budget",
      loadScope: "meeting_detail",
      generatedAt: now,
      trace: trace({
        surface: "meeting_detail",
        objectType: "Meeting",
        objectId: "meeting-1",
        budget: {
          maxItems: 0,
          maxEstimatedTokens: 0,
        },
        fallback: {
          used: true,
          reason: "invalid_or_empty_budget",
        },
        selected: [],
        omitted: [],
        trace: {
          ...trace().trace,
          candidateCount: 2,
          selectedCount: 0,
          omittedCount: 2,
          estimatedTokensUsed: 0,
          estimatedTokensRemaining: 0,
        },
      }),
    });

    expect(readout.posture).toBe("fallback");
    expect(readout.primaryReasonCode).toBe("fallback_used");
    expect(readout.memoryIndex.fallbackUsed).toBe(true);
    expect(readout.loadTrace.fallbackReason).toBe("invalid_or_empty_budget");
    expect(readout.operator.nextMove).toContain("fallback reason");
  });

  it("blocks missing traces into operator review instead of inventing a memory index", () => {
    const readout = buildMemoryObservabilityBudgetReadout({
      traceKey: "startup:missing",
      loadScope: "startup",
      generatedAt: now,
      trace: null,
    });

    expect(readout.posture).toBe("review");
    expect(readout.primaryReasonCode).toBe("insufficient_trace");
    expect(readout.memoryIndex.surface).toBe("unknown");
    expect(readout.memoryIndex.selectedRefs).toEqual([]);
    expect(readout.loadTrace.sourceChain[0]).toMatchObject({
      step: "trace_truth",
      outcome: "block",
    });
  });

  it("aggregates readouts and selects the highest priority next move", () => {
    const healthy = buildMemoryObservabilityBudgetReadout({
      traceKey: "recommendation:opp-1",
      loadScope: "recommendation",
      generatedAt: now,
      trace: trace(),
    });
    const fallback = buildMemoryObservabilityBudgetReadout({
      traceKey: "runtime:missing-budget",
      loadScope: "runtime_review",
      generatedAt: now,
      trace: trace({
        fallback: {
          used: true,
          reason: "invalid_or_empty_budget",
        },
      }),
    });
    const summary = buildMemoryObservabilityBudgetSummary([healthy, fallback], {
      generatedAt: now,
    });

    expect(summary).toMatchObject({
      generatedAt: "2026-04-24T00:00:00.000Z",
      totalReadouts: 2,
      postureCounts: {
        ok: 1,
        watch: 0,
        review: 0,
        fallback: 1,
      },
      totalEstimatedTokensUsed: 160,
      fallbackKeys: ["memory_observability_runtime_missing_budget"],
      primaryNextMove: "Review the retrieval pack fallback reason before widening memory context.",
    });
    expect(summary.boundaryNotes.join("\n")).toContain("does not create a full memory trace ledger");
  });
});
