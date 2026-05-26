import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeLLMTask: vi.fn(),
}));

vi.mock("@/lib/llm/provider-registry", () => ({
  executeLLMTask: mocks.executeLLMTask,
}));

import { reviewBiReportAnalysisWithLLM } from "@/lib/llm-workflows/review-bi-report.workflow";

describe("bi report review workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a no-op fallback that preserves the original analysis", async () => {
    mocks.executeLLMTask.mockImplementation(async (input) => ({
      output: input.fallbackOutput,
      provider: "openai",
      model: "gpt-5.4",
      modelVersion: "gpt-5.4",
      modelRole: "REASONING",
      promptKey: input.promptKey,
      promptVersion: input.promptVersion,
      success: false,
      fallbackUsed: true,
      fallbackReason: "llm_disabled",
      errorMessage: null,
      latencyMs: 1,
    }));

    const result = await reviewBiReportAnalysisWithLLM({
      workspaceId: "workspace-1",
      skillName: "营收日报",
      severityLabel: "告警",
      windowLabel: "2026-04-12 vs 2026-04-11",
      summaryMetrics: [{ label: "支付金额", value: "¥15,300" }],
      matchedRules: ["支付金额较前一日下降超过 20%"],
      boundaries: ["等级以 deterministic result 为准"],
      deterministicFindings: ["支付金额下降明显。"],
      candidate: {
        headline: "支付金额下降需要关注",
        summary: "summary",
        findings: ["finding"],
        possibleCauses: ["可能与渠道短期波动有关。"],
        recommendedActions: ["建议先复核主要异常渠道和口径变化。"],
        confidence: 0.7,
        continuityStatus: "recurring",
        historicalContext: null,
        feedbackContext: null,
        boundaryNote: "note",
      },
    });

    expect(result.output).toEqual({
      approved: true,
      issueCodes: [],
      issueNotes: [],
      rewrittenHeadline: null,
      rewrittenPossibleCauses: null,
      rewrittenRecommendedActions: null,
    });
  });
});
