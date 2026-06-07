import { ActionExecutionMode, ActionType, ObjectType, RiskLevel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { LLMCriticResult } from "@/lib/llm/intelligence-contracts";
import {
  buildRecommendationCriticContextPacket,
  buildRecommendationJudgementCandidate,
  reviewRecommendationCandidateWithLLM,
} from "@/lib/recommendations/recommendation-critic.service";
import type {
  RankedRecommendationCandidate,
  RecommendationEvidence,
  RecommendationObjectContext,
} from "@/lib/recommendations/types";

vi.mock("@/lib/llm-workflows/review-judgement-boundary.workflow", () => ({
  reviewJudgementBoundaryWithLLM: vi.fn(async ({ candidate, contextPacket }) => ({
    resultId: "critic_result_synthetic",
    candidateId: candidate.candidateId,
    packetId: contextPacket.packetId,
    reviewState: "needs_review",
    requiredHumanReview: true,
    approvedForReview: false,
    issueCodes: ["OUT_OF_EVIDENCE_SCOPE"],
    issueNotes: ["Synthetic missing evidence note."],
    missingEvidenceIds: candidate.missingEvidenceIds,
    counterarguments: [],
    boundaryDecision: "advisory_only",
  })),
}));

const context: RecommendationObjectContext = {
  workspaceId: "workspace_public_safe",
  objectType: ObjectType.COMPANY,
  objectId: "company_synthetic_1",
  objectLabel: "Synthetic Company",
  daysSinceLastTouch: 5,
  dueSoon: true,
  baseRiskLevel: RiskLevel.LOW,
  priorityScore: 60,
  roleWeight: 1,
};

const evidence: RecommendationEvidence = {
  supportingFactIds: ["fact_1"],
  blockerIds: ["blocker_1"],
  commitmentIds: [],
  supportingFacts: [
    {
      id: "fact_1",
      title: "Synthetic meeting",
      content: "Synthetic meeting mentioned a timing risk.",
      confidence: 0.82,
      confirmedByUser: false,
      freshnessScore: 0.7,
    },
  ],
  blockers: [
    {
      id: "blocker_1",
      title: "Missing owner",
      blockerText: "No confirmed owner in synthetic evidence.",
      severity: 0.5,
      status: "OPEN",
    },
  ],
  commitments: [],
  recentMeetings: [],
  recentThreads: [],
  memoryRetrievalPack: null,
};

const ranked: RankedRecommendationCandidate = {
  actionType: ActionType.CREATE_TASK,
  title: "Synthetic next step",
  description: "Follow up on a synthetic opportunity.",
  aiReason: "Recent synthetic meeting needs human review.",
  riskLevel: RiskLevel.LOW,
  outbound: false,
  usesCommitment: false,
  addressesBlocker: true,
  sortHint: "control",
  score: 84.5,
  urgencyScore: 72,
  impactScore: 81,
  confidenceScore: 80,
  personalizationScore: 10,
  policyFitScore: 70,
  riskScore: 65,
  policyResult: ActionExecutionMode.REQUIRES_APPROVAL,
  policyReason: "Synthetic policy requires human review.",
  appliedPolicyName: "Synthetic review",
  appliedPolicyMode: ActionExecutionMode.REQUIRES_APPROVAL,
  appliedRiskThreshold: RiskLevel.MEDIUM,
  whyNotAutoExecute: "Synthetic review remains human-owned.",
  learnedPatternSummary: [],
};

describe("recommendation critic", () => {
  it("builds advisory-only context with ranking score preserved", () => {
    const contextPacket = buildRecommendationCriticContextPacket({
      workspaceId: "workspace_public_safe",
      context,
      evidence,
      ranked,
    });
    const judgementCandidate = buildRecommendationJudgementCandidate(
      {
        workspaceId: "workspace_public_safe",
        context,
        evidence,
        ranked,
      },
      contextPacket,
    );

    expect(contextPacket.policySnapshot.rankingScore).toBe(ranked.score);
    expect(contextPacket.permissions.forbiddenUses).toContain(
      "recommendation_feedback_creation",
    );
    expect(judgementCandidate.reviewState).toBe("candidate");
  });

  it("returns critic result without mutating deterministic rank fields", async () => {
    const beforeScore = ranked.score;
    const beforePolicyFit = ranked.policyFitScore;

    const result = await reviewRecommendationCandidateWithLLM({
      workspaceId: "workspace_public_safe",
      context,
      evidence,
      ranked,
    });

    expect(result.ranked.score).toBe(beforeScore);
    expect(result.ranked.policyFitScore).toBe(beforePolicyFit);
    expect((result.criticResult as LLMCriticResult).reviewState).toBe("needs_review");
    expect(result.contextPacket.permissions.forbiddenUses).toContain(
      "preference_signal_creation",
    );
  });
});
