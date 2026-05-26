import { describe, expect, it } from "vitest";
import {
  appendLLMContextAuditToInputSummary,
  buildLLMContextAudit,
  estimatePromptTokens,
  formatLLMContextAuditSummary,
} from "@/lib/llm/context-audit";

describe("LLM context audit", () => {
  it("scores a rich review-first prompt without exposing raw prompt text in the summary", () => {
    const audit = buildLLMContextAudit({
      taskType: "OPPORTUNITY_BRIEFING",
      promptKey: "object-briefing",
      promptVersion: "briefing-v1",
      systemPrompt: "你是 Helm 经营推进控制台的机会简报引擎。只输出符合 schema 的 JSON，不要写成自动发送承诺。",
      userPrompt: [
        "对象：Atlas 续约",
        "对象类型：机会",
        "当前阶段：PROPOSAL",
        "关键事实：客户要求 5 月 8 日前确认安全审查清单",
        "未完成承诺：销售承诺本周五前补齐报价边界",
        "当前卡点：法务 DPA 未确认",
        "最近会议：4 月 29 日续约推进会",
        "最近线程：客户追问报价和数据边界",
      ].join("\n"),
      requirements: [
        {
          id: "object_identity",
          description: "对象身份必须可见",
          markers: ["对象：Atlas 续约", "对象类型：机会", "当前阶段：PROPOSAL"],
        },
        {
          id: "advancement_evidence",
          description: "推进判断需要事实、承诺、卡点和最近信号",
          markers: ["关键事实：", "未完成承诺：", "当前卡点：", "最近会议：", "最近线程："],
          minMatches: 4,
        },
        {
          id: "review_boundary",
          description: "客户可见动作必须保留边界",
          markers: ["不要", "自动发送", "承诺"],
          minMatches: 2,
        },
      ],
    });

    expect(audit.failures).toEqual([]);
    expect(audit.scores.overall).toBeGreaterThanOrEqual(85);
    expect(audit.requirementResults.every((item) => item.passed)).toBe(true);

    const summary = formatLLMContextAuditSummary(audit);
    expect(summary).toContain("ctx=");
    expect(summary).toContain("prompt≈");
    expect(summary).not.toContain("Atlas 续约");
    expect(summary).not.toContain("安全审查清单");
  });

  it("flags thin context that cannot explain the model output quality", () => {
    const audit = buildLLMContextAudit({
      taskType: "COMPANY_BRIEFING",
      promptKey: "object-briefing",
      promptVersion: "briefing-v1",
      systemPrompt: "请生成简报。",
      userPrompt: "对象：星河连锁",
      requirements: [
        {
          id: "advancement_evidence",
          description: "推进判断需要经营证据",
          markers: ["关键事实：", "未完成承诺：", "当前卡点："],
          minMatches: 2,
        },
      ],
    });

    expect(audit.failures).toContain("missing_required_context:advancement_evidence");
    expect(audit.warnings).toContain("context_too_thin_to_explain_model_output");
    expect(audit.scores.overall).toBeLessThan(70);
  });

  it("adds a compact audit prefix to persisted input summaries", () => {
    const audit = buildLLMContextAudit({
      taskType: "RECOMMENDATION_EXPLANATION",
      promptKey: "recommendation-explanation",
      promptVersion: "recommendation-explanation-v1",
      systemPrompt: "你是判断解释引擎，只输出 JSON，不重新排序，不自动执行。",
      userPrompt: "对象：Atlas\n规则解释基线：客户等待超过 48 小时\n支持性记忆：客户追问报价",
    });

    const summary = appendLLMContextAuditToInputSummary({
      audit,
      inputSummary: "Atlas recommendation explanation",
    });

    expect(summary).toContain("ctx=");
    expect(summary).toContain("Atlas recommendation explanation");
    expect(summary.length).toBeLessThanOrEqual(240);
  });

  it("detects secret-shaped context before persistence", () => {
    const audit = buildLLMContextAudit({
      taskType: "BI_REPORT_ANALYSIS",
      promptKey: "bi-report-analysis",
      promptVersion: "bi-report-analysis-v2",
      systemPrompt: "只输出 JSON。",
      userPrompt: "DATABASE_URL=mysql://root:secret@127.0.0.1:3306/helm",
    });

    expect(audit.failures.some((failure) => failure.startsWith("forbidden_context_pattern:"))).toBe(true);
  });

  it("keeps token estimates deterministic", () => {
    expect(estimatePromptTokens("对象：Atlas\nstage: PROPOSAL")).toBe(7);
  });
});
