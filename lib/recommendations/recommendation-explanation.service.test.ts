import { ActionExecutionMode, ActionType, ObjectType, RiskLevel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildRecommendationExplanation } from "./recommendation-explanation.service";
import type {
  RankedRecommendationCandidate,
  RecommendationEvidence,
  RecommendationObjectContext,
} from "./types";

const context: RecommendationObjectContext = {
  workspaceId: "workspace-1",
  objectType: ObjectType.OPPORTUNITY,
  objectId: "opportunity-1",
  objectLabel: "Northwind renewal",
  daysSinceLastTouch: 6,
  dueSoon: true,
  baseRiskLevel: RiskLevel.HIGH,
  priorityScore: 82,
  roleWeight: 1,
};

const evidence: RecommendationEvidence = {
  supportingFactIds: ["fact-1"],
  blockerIds: ["blocker-1"],
  commitmentIds: ["commitment-1"],
  briefingSummary: "Customer wants a concrete migration plan",
  supportingFacts: [
    {
      id: "fact-1",
      title: "Migration risk",
      content: "Champion asked for rollout dates",
      confidence: 0.9,
      confirmedByUser: true,
      freshnessScore: 88,
    },
  ],
  blockers: [
    {
      id: "blocker-1",
      title: "Security review is pending",
      blockerText: "Security team has not signed off",
      severity: 80,
      status: "OPEN",
    },
  ],
  commitments: [
    {
      id: "commitment-1",
      title: "Send migration plan",
      commitmentText: "Send the plan by Friday",
      dueDate: null,
      overdueFlag: true,
      status: "OPEN",
    },
  ],
  recentThreads: [
    {
      id: "thread-1",
      subject: "Migration timeline confirmation",
      status: "WAITING_US",
    },
  ],
};

const ranked: RankedRecommendationCandidate = {
  actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
  title: "Send follow-up",
  description: "Clarify next step",
  aiReason: "Keep momentum",
  score: 90,
  urgencyScore: 72,
  impactScore: 81,
  confidenceScore: 75,
  personalizationScore: 60,
  policyFitScore: 70,
  riskScore: 65,
  policyResult: ActionExecutionMode.REQUIRES_APPROVAL,
  policyReason: "外部承诺需要人工复核。",
  appliedPolicyName: "External outreach review",
  appliedPolicyMode: ActionExecutionMode.REQUIRES_APPROVAL,
  appliedRiskThreshold: RiskLevel.MEDIUM,
  learnedPatternSummary: ["你最近会保留外发承诺类动作的人工审批"],
  riskLevel: RiskLevel.HIGH,
  outbound: true,
  usesCommitment: true,
  addressesBlocker: true,
  sortHint: "relationship",
};

describe("buildRecommendationExplanation", () => {
  it("builds English deterministic explanation copy", () => {
    const result = buildRecommendationExplanation({
      context,
      evidence,
      ranked,
      locale: "en-US",
    });

    expect(result.explanation).toContain("high-priority window");
    expect(result.explanation).toContain('The current commitment "Send migration plan" is overdue');
    expect(result.explanation).toContain('Main blocker is "Security review is pending"');
    expect(result.explanation).toContain(
      "Recently learned: Helm applied a recent learned operating pattern.",
    );
    expect(result.explanation).toContain(
      "Under current rules, this action requires review. Review is required by workspace policy.",
    );
    expect(result.explanation).not.toMatch(/[\u4E00-\u9FFF]/);
  });

  it("keeps the default Chinese explanation when no locale is supplied", () => {
    const result = buildRecommendationExplanation({
      context,
      evidence,
      ranked,
    });

    expect(result.explanation).toContain("这件事已经进入高优先级窗口");
    expect(result.explanation).toContain("当前还有承诺");
    expect(result.explanation).toMatch(/[\u4E00-\u9FFF]/);
  });
});
