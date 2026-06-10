import { describe, expect, it, vi } from "vitest";
import { readRecommendationPresentation } from "@/lib/recommendations/recommendation-presentation";

vi.mock("@prisma/client", () => ({
  ActionExecutionMode: {
    AUTO_WITHIN_THRESHOLD: "AUTO_WITHIN_THRESHOLD",
    FORBIDDEN: "FORBIDDEN",
    REQUIRES_APPROVAL: "REQUIRES_APPROVAL",
    SUGGEST_ONLY: "SUGGEST_ONLY",
  },
  ActionType: {
    ASSIGN_OWNER: "ASSIGN_OWNER",
    CHANGE_DUE_DATE: "CHANGE_DUE_DATE",
    CREATE_MEETING: "CREATE_MEETING",
    CREATE_TASK: "CREATE_TASK",
    DRAFT_EXTERNAL_EMAIL: "DRAFT_EXTERNAL_EMAIL",
    DRAFT_INTERNAL_NOTE: "DRAFT_INTERNAL_NOTE",
    GENERATE_REPLY_DRAFT: "GENERATE_REPLY_DRAFT",
    SCHEDULE_INTERVIEW: "SCHEDULE_INTERVIEW",
    SEND_MEETING_SUMMARY: "SEND_MEETING_SUMMARY",
    UPDATE_OPPORTUNITY_STAGE: "UPDATE_OPPORTUNITY_STAGE",
  },
  ObjectType: {
    COMPANY: "COMPANY",
    CONTACT: "CONTACT",
    MEETING: "MEETING",
    OPPORTUNITY: "OPPORTUNITY",
  },
  RiskLevel: {
    CRITICAL: "CRITICAL",
    HIGH: "HIGH",
    LOW: "LOW",
    MEDIUM: "MEDIUM",
  },
}));

describe("readRecommendationPresentation", () => {
  const baseRecommendation = {
    explanation: "Fallback explanation can be source-provided.",
    policyResult: "REQUIRES_APPROVAL",
    supportingFactIds: ["fact_a", "fact_b"],
    blockerIds: ["blocker_a"],
    commitmentIds: ["commitment_a"],
  };

  it("keeps Chinese fallback copy by default", () => {
    const presentation = readRecommendationPresentation(baseRecommendation);

    expect(presentation.decisionLabel).toBe("首选动作");
    expect(presentation.policyResultLabel).toBe("需逐条审批");
    expect(presentation.evidenceSummary).toContain("2 条事实");
  });

  it("localizes generated fallback copy for English recommendation cards", () => {
    const presentation = readRecommendationPresentation(baseRecommendation, {
      locale: "en-US",
    });
    const rendered = [
      presentation.decisionLabel,
      presentation.tradeoffSummary,
      presentation.whyNow,
      presentation.evidenceLead,
      presentation.expectedImpact,
      presentation.ifNoAction,
      presentation.evidenceSummary,
      presentation.policyResultLabel,
    ].join("\n");

    expect(rendered).toContain("Primary move");
    expect(rendered).toContain("Requires approval");
    expect(rendered).toContain("2 fact(s)");
    expect(rendered).not.toMatch(/[\u3400-\u9fff]/u);
  });

  it("does not leak legacy Chinese presentation payload copy in English cards", () => {
    const presentation = readRecommendationPresentation(
      {
        ...baseRecommendation,
        whyNotAutoExecute: "这条动作需要人工审批。",
        appliedPolicyRules: [
          {
            name: "approval",
            mode: "REQUIRES_APPROVAL",
            reason: "当前策略要求审批。",
          },
        ],
        recommendationPayload: {
          decisionRole: "secondary",
          decisionLabel: "次优动作",
          tradeoffSummary: "这一步仍然值得做，但当前不是首选。",
          alternativeActionTitle: "给客户发结构化跟进",
          whyNow: "当前事项已经进入明确时间窗口。",
          evidenceLead: "当前判断主要基于最近互动。",
          currentBlocker: "待处理 · 预算阻塞：客户还没有确认。",
          currentCommitment: "已逾期 · 发送材料：今天需要补齐。",
          expectedImpact: "把责任人、时间和下一步动作重新钉住。",
          ifNoAction: "如果今天不推进，机会会继续降温。",
          personalizationHint: "你过去更常接受这类动作。",
          learnedPatternSummary: ["你最近会保留外发承诺类动作的人工审批"],
          supportingHighlights: ["客户上周提到预算需要复核"],
          briefingSummary: "最近简报显示当前风险升高。",
          evidenceSummary: "已引用 2 条事实、1 个阻塞、1 个承诺。",
        },
      },
      { locale: "en-US" },
    );

    const rendered = [
      presentation.decisionLabel,
      presentation.tradeoffSummary,
      presentation.alternativeActionTitle,
      presentation.whyNow,
      presentation.evidenceLead,
      presentation.currentBlocker,
      presentation.currentCommitment,
      presentation.expectedImpact,
      presentation.ifNoAction,
      presentation.personalizationHint,
      presentation.briefingSummary,
      presentation.evidenceSummary,
      presentation.policyHint,
      presentation.appliedPolicyReason,
      ...presentation.learnedPatternSummary,
      ...presentation.supportingHighlights,
    ]
      .filter(Boolean)
      .join("\n");

    expect(presentation.decisionLabel).toBe("Alternate move");
    expect(presentation.alternativeActionTitle).toBeNull();
    expect(presentation.currentBlocker).toBeNull();
    expect(presentation.currentCommitment).toBeNull();
    expect(presentation.policyHint).toBeNull();
    expect(presentation.appliedPolicyReason).toBeNull();
    expect(presentation.learnedPatternSummary).toEqual([]);
    expect(presentation.supportingHighlights).toEqual([]);
    expect(rendered).not.toMatch(/[\u3400-\u9fff]/u);
  });
});
