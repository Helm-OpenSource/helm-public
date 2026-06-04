import { describe, expect, it } from "vitest";
import { ObjectType, OpportunityStage, RiskLevel } from "@prisma/client";
import { getRecommendationCandidates } from "@/lib/recommendations/recommendation-candidates.service";
import type { RecommendationEvidence, RecommendationObjectContext } from "@/lib/recommendations/types";

const baseContext: RecommendationObjectContext = {
  workspaceId: "workspace-1",
  objectType: ObjectType.CONTACT,
  objectId: "contact-1",
  objectLabel: "Acme Champion",
  contactId: "contact-1",
  companyId: "company-1",
  opportunityId: "opportunity-1",
  daysSinceLastTouch: 8,
  dueSoon: false,
  baseRiskLevel: RiskLevel.MEDIUM,
  priorityScore: 72,
  roleWeight: 76,
  stageLabel: "WARM",
};

const evidence: RecommendationEvidence = {
  supportingFactIds: ["fact-1"],
  blockerIds: ["blocker-1"],
  commitmentIds: ["commitment-1"],
  supportingFacts: [
    {
      id: "fact-1",
      title: "Budget owner confirmed",
      content: "Budget owner confirmed the review window is still active.",
      confidence: 0.86,
      confirmedByUser: true,
      freshnessScore: 82,
    },
  ],
  blockers: [
    {
      id: "blocker-1",
      title: "Security review missing",
      blockerText: "Security review still needs an owner.",
      severity: 82,
      status: "OPEN",
    },
  ],
  commitments: [
    {
      id: "commitment-1",
      title: "Send the implementation scope",
      commitmentText: "Send the implementation scope by Friday.",
      dueDate: null,
      overdueFlag: true,
      status: "OPEN",
    },
  ],
};

function visibleText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(visibleText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(visibleText).join(" ");
  return "";
}

describe("getRecommendationCandidates", () => {
  it("keeps zh-CN as the default recommendation candidate language", () => {
    const candidates = getRecommendationCandidates({
      context: baseContext,
      evidence,
    });

    expect(candidates[0]?.title).toBe("给 Acme Champion 发结构化跟进");
    expect(candidates[0]?.description).toContain("先把“Send the implementation scope”补齐");
    expect(candidates[0]?.resultPreview).toContain("按策略");
  });

  it("generates English recommendation candidate copy for en-US", () => {
    const candidates = getRecommendationCandidates({
      context: baseContext,
      evidence,
      locale: "en-US",
    });

    const copy = visibleText(candidates);
    expect(candidates[0]?.title).toBe("Send a structured follow-up to Acme Champion");
    expect(candidates[0]?.description).toContain("Close the open commitment");
    expect(candidates[0]?.aiReason).toContain("overdue commitment");
    expect(candidates[0]?.draftContent).toContain("I organized the key points");
    expect(candidates[0]?.resultPreview).toContain("Workspace policy");
    expect(candidates[0]?.resultPreview).toContain("after approval");
    expect(copy).not.toMatch(/[给安排会先把通过后写入]/);
  });

  it("keeps policy and sorting metadata stable across locales", () => {
    const zh = getRecommendationCandidates({ context: baseContext, evidence });
    const en = getRecommendationCandidates({ context: baseContext, evidence, locale: "en-US" });

    expect(en).toHaveLength(zh.length);
    expect(en.map((item) => item.actionType)).toEqual(zh.map((item) => item.actionType));
    expect(en.map((item) => item.riskLevel)).toEqual(zh.map((item) => item.riskLevel));
    expect(en.map((item) => item.outbound)).toEqual(zh.map((item) => item.outbound));
    expect(en.map((item) => item.sortHint)).toEqual(zh.map((item) => item.sortHint));
  });

  it("localizes opportunity candidate metadata without changing the next stage contract", () => {
    const opportunityContext: RecommendationObjectContext = {
      ...baseContext,
      objectType: ObjectType.OPPORTUNITY,
      objectId: "opportunity-1",
      objectLabel: "Expansion pilot",
      stageLabel: OpportunityStage.CONTACTED,
    };

    const candidates = getRecommendationCandidates({
      context: opportunityContext,
      evidence,
      locale: "en-US",
    });

    const stageCandidate = candidates.find((item) => item.actionType === "UPDATE_OPPORTUNITY_STAGE");
    expect(stageCandidate?.title).toBe("Sync the current stage for Expansion pilot");
    expect(stageCandidate?.metadata).toMatchObject({
      nextStage: OpportunityStage.ADVANCING,
      nextAction: "Resolve blocker first: Security review missing",
    });
    expect(stageCandidate?.resultPreview).toContain("After approval");
  });
});
