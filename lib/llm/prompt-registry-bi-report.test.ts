import { describe, expect, it } from "vitest";
import { buildBiReportAnalysisPrompt, buildBiReportReviewPrompt } from "@/lib/llm/prompt-registry";

describe("bi report prompt registry", () => {
  it("includes the skill prompt supplement when provided", () => {
    const prompt = buildBiReportAnalysisPrompt({
      skillName: "日报",
      severityLabel: "告警",
      windowLabel: "2026-04-12 vs 2026-04-11",
      summaryMetrics: [
        {
          label: "支付金额",
          value: "¥15,300",
        },
      ],
      matchedRules: ["支付金额较前一日下降超过 20%"],
      deterministicFindings: ["支付金额下降明显。"],
      recentRunContext: {
        continuityStatus: "recurring",
        historicalContext: "最近两次也出现了同类波动。",
      },
      recentFeedbackContext: {
        feedbackContext: "最近一条人工复盘确认是口径变更导致。",
      },
      boundaries: ["等级以 deterministic result 为准"],
      skillPromptTemplate: "输出结构建议：possibleCauses / recommendedActions / boundaryNote。",
    });

    expect(prompt.systemPrompt).toContain("当前 skill 的补充解释约束如下");
    expect(prompt.systemPrompt).toContain("possibleCauses / recommendedActions / boundaryNote");
    expect(prompt.userPrompt).toContain("连续性状态：recurring");
    expect(prompt.userPrompt).toContain("最近两次也出现了同类波动");
    expect(prompt.userPrompt).toContain("最近一条人工复盘确认是口径变更导致");
  });

  it("builds a reviewer prompt that only targets explanation-layer fields", () => {
    const prompt = buildBiReportReviewPrompt({
      skillName: "日报",
      severityLabel: "告警",
      windowLabel: "2026-04-12 vs 2026-04-11",
      summaryMetrics: [{ label: "支付金额", value: "¥15,300" }],
      matchedRules: ["支付金额较前一日下降超过 20%"],
      boundaries: ["等级以 deterministic result 为准"],
      deterministicFindings: ["支付金额下降明显。"],
      candidate: {
        headline: "确认是渠道异常",
        possibleCauses: ["已经确定是渠道波动导致。"],
        recommendedActions: ["立即自动下线该渠道。"],
      },
    });

    expect(prompt.systemPrompt).toContain("不要修改 severity、summary、continuity 或 boundary");
    expect(prompt.userPrompt).toContain("核心指标：支付金额 ¥15,300");
    expect(prompt.userPrompt).toContain("命中规则：支付金额较前一日下降超过 20%");
    expect(prompt.userPrompt).toContain("候选 headline：确认是渠道异常");
    expect(prompt.userPrompt).toContain("不应判为 OUT_OF_EVIDENCE_SCOPE");
    expect(prompt.userPrompt).toContain("只允许保守重写 headline / possibleCauses / recommendedActions");
    expect(prompt.userPrompt).toContain("issueCodes 只能从以下枚举里选");
  });
});
