import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeLLMTask: vi.fn(),
}));

vi.mock("@/lib/llm/provider-registry", () => ({
  executeLLMTask: mocks.executeLLMTask,
}));

import { __testOnly, analyzeBiReportWithLLM } from "@/lib/llm-workflows/analyze-bi-report.workflow";
import type { BiReportAnalysisOutput } from "@/lib/bi-report-skill/types";

function buildFallback(): BiReportAnalysisOutput {
  return {
    headline: "支付金额较前一日下降超过 20%",
    summary: "时间窗口 2026-04-12 vs 2026-04-11，当前等级为 告警。",
    findings: ["支付金额下降明显。"],
    possibleCauses: ["先检查主要渠道波动。"],
    recommendedActions: ["先复核异常维度。"],
    confidence: 0.78,
    continuityStatus: "recurring",
    historicalContext: "最近两次也出现了同类波动。",
    feedbackContext: "最近一条人工复盘确认是口径变更导致。",
    boundaryNote: "本次结论等级来自既定规则。",
  };
}

describe("bi report analysis workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes llm output into the structured schema", () => {
    const normalized = __testOnly.normalizeBiReportAnalysisOutput(
      {
        headline: "  支付金额波动需要关注  ",
        summary: "模型自己写的 summary",
        findings: ["  支付金额较前一日下降超过 20%  ", "x"],
        possibleCauses: ["  渠道短期波动  "],
        recommendedActions: ["  先复核 wechat_h5  "],
        confidence: 1.2,
        continuityStatus: "worsening",
        historicalContext: "模型写的历史",
        feedbackContext: "模型写的反馈",
        boundaryNote: "模型写的边界",
      },
      buildFallback(),
    );

    expect(normalized.headline).toBe("支付金额波动需要关注");
    expect(normalized.summary).toBe(buildFallback().summary);
    expect(normalized.findings).toEqual(["支付金额较前一日下降超过 20%"]);
    expect(normalized.possibleCauses).toEqual(["渠道短期波动"]);
    expect(normalized.recommendedActions).toEqual(["先复核 wechat_h5"]);
    expect(normalized.confidence).toBe(1);
    expect(normalized.continuityStatus).toBe("recurring");
    expect(normalized.historicalContext).toBe(buildFallback().historicalContext);
    expect(normalized.feedbackContext).toBe(buildFallback().feedbackContext);
    expect(normalized.boundaryNote).toBe(buildFallback().boundaryNote);
  });

  it("preserves fallback structure and prompt version metadata when llm succeeds", async () => {
    mocks.executeLLMTask
      .mockResolvedValueOnce({
        output: {
          ...buildFallback(),
          headline: "支付金额下降需要关注",
          confidence: 0.66,
        },
        provider: "openai",
        model: "gpt-5.4",
        modelVersion: "gpt-5.4",
        modelRole: "REASONING",
        promptKey: "bi-report-analysis",
        promptVersion: "bi-report-analysis-v2",
        success: true,
        fallbackUsed: false,
        fallbackReason: null,
        errorMessage: null,
        latencyMs: 123,
      })
      .mockResolvedValueOnce({
        output: {
          approved: false,
          issueCodes: ["SPECULATION_AS_FACT"],
          issueNotes: ["possibleCauses 把推测写成事实"],
          rewrittenHeadline: "支付金额下降需要关注",
          rewrittenPossibleCauses: ["可能与渠道短期波动有关。"],
          rewrittenRecommendedActions: ["建议先复核主要异常渠道和口径变化。"],
        },
        provider: "openai",
        model: "gpt-5.4",
        modelVersion: "gpt-5.4",
        modelRole: "REASONING",
        promptKey: "bi-report-review",
        promptVersion: "bi-report-review-v1",
        success: true,
        fallbackUsed: false,
        fallbackReason: null,
        errorMessage: null,
        latencyMs: 88,
      });

    const result = await analyzeBiReportWithLLM({
      workspaceId: "workspace-1",
      skillName: "营收日报",
      severityLabel: "告警",
      windowLabel: "2026-04-12 vs 2026-04-11",
      summaryMetrics: [{ label: "支付金额", value: "¥15,300" }],
      matchedRules: ["支付金额较前一日下降超过 20%"],
      deterministicFindings: ["支付金额下降明显。"],
      recentRunContext: {
        continuityStatus: "recurring",
        historicalContext: "最近两次也出现了同类波动。",
      },
      recentFeedbackContext: {
        feedbackContext: "最近一条人工复盘确认是口径变更导致。",
      },
      similarCaseContext: {
        caseContext: "最近相似运行是 2026-04-11 vs 2026-04-10；相似案例曾确认原因：渠道口径切换。",
      },
      odpsKnowledgeContext: {
        matchedAliases: ["mini_loan", "withdraw"],
        tableAliases: ["mini_loan: 取现订单表 -> xxx（分区字段 thedate）"],
        fieldConventions: ["mini_loan.status: 订单状态；常用方式：用于判断生命周期"],
        enumKnowledge: ["mini_loan.status.5 = 放款成功，还款中"],
        queryConventions: ["金额单位规则：数据库中的金额单位为厘，1元 = 1000厘"],
      },
      boundaries: ["等级以 deterministic result 为准"],
      fallback: buildFallback(),
    });

    expect(result.output.headline).toBe("支付金额下降需要关注");
    expect(result.output.confidence).toBe(0.66);
    expect(result.output.possibleCauses).toEqual(["可能与渠道短期波动有关。"]);
    expect(result.output.recommendedActions).toEqual(["建议先复核主要异常渠道和口径变化。"]);
    expect(result.output.summary).toBe(buildFallback().summary);
    expect(result.output.llmMeta).toMatchObject({
      promptVersion: "bi-report-analysis-v2",
      model: "gpt-5.4",
      fallbackUsed: false,
      odpsKnowledgeContext: {
        matchedAliases: ["mini_loan", "withdraw"],
        tableAliases: 1,
        fieldConventions: 1,
        enumKnowledge: 1,
        queryConventions: 1,
      },
      similarCaseContext: {
        hasCaseContext: true,
      },
      reviewer: {
        promptVersion: "bi-report-review-v1",
        approved: false,
        issueCodes: ["SPECULATION_AS_FACT"],
        issueNotes: ["possibleCauses 把推测写成事实"],
        rewritten: true,
      },
    });
    expect(result.output.generationMode).toBe("llm_enhanced");
    expect(mocks.executeLLMTask.mock.calls[0]?.[0]?.userPrompt).toContain("相关 ODPS 表");
    expect(mocks.executeLLMTask.mock.calls[0]?.[0]?.userPrompt).toContain("金额单位规则");
    expect(mocks.executeLLMTask.mock.calls[0]?.[0]?.userPrompt).toContain("相似案例");
  });
});
