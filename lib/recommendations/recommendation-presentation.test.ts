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
});
