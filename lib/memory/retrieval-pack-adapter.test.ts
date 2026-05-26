import { describe, expect, it } from "vitest";
import {
  ActionExecutionMode,
  ActionType,
  MemoryFactType,
  MemoryStatus,
  ObjectType,
  RiskLevel,
  SourceType,
} from "@prisma/client";
import { buildBriefingPayload } from "@/lib/memory/briefing.service";
import {
  buildMemoryFactRetrievalPack,
  type MemoryFactForRetrievalPack,
} from "@/lib/memory/retrieval-pack-adapter";
import { buildRecommendationPresentationPayload } from "@/lib/recommendations/recommendation-presentation";

function fact(overrides: Partial<MemoryFactForRetrievalPack> & { id: string }): MemoryFactForRetrievalPack {
  const { id, ...rest } = overrides;
  return {
    id,
    objectType: ObjectType.OPPORTUNITY,
    objectId: "opp-1",
    factType: MemoryFactType.SUMMARY,
    title: `Fact ${overrides.id}`,
    content: `Content ${overrides.id}`,
    normalizedValue: null,
    sourceType: SourceType.MEETING_NOTE,
    sourceId: `source-${overrides.id}`,
    status: MemoryStatus.ACTIVE,
    confidence: 70,
    importance: 70,
    freshnessScore: 70,
    confirmedByUser: false,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-20T00:00:00.000Z"),
    ...rest,
  };
}

describe("memory retrieval pack surface adapter", () => {
  it("builds a serializable trace and selected fact list from memory facts", () => {
    const result = buildMemoryFactRetrievalPack({
      surface: "meeting_detail",
      objectType: ObjectType.OPPORTUNITY,
      objectId: "opp-1",
      budget: {
        maxItems: 2,
        maxEstimatedTokens: 100,
      },
      now: new Date("2026-04-20T00:00:00.000Z"),
      facts: [
        fact({
          id: "confirmed",
          confirmedByUser: true,
          confidence: 85,
          importance: 90,
        }),
        fact({
          id: "duplicate-keeper",
          normalizedValue: "same fact",
          confidence: 82,
          importance: 82,
        }),
        fact({
          id: "duplicate-omitted",
          normalizedValue: "same fact",
          confidence: 60,
          importance: 60,
        }),
        fact({
          id: "overflow",
          confidence: 75,
          importance: 75,
        }),
      ],
    });

    expect(result.selectedFacts.map((item) => item.id)).toEqual(["confirmed", "duplicate-keeper"]);
    expect(result.trace.selected.map((item) => item.id)).toEqual(["confirmed", "duplicate-keeper"]);
    expect(result.trace.omitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "duplicate-omitted", omittedReason: "duplicate_candidate" }),
        expect.objectContaining({ id: "overflow", omittedReason: "budget_item_limit" }),
      ]),
    );
    expect(result.trace.trace.boundaryNote).toContain("does not change recommendation ranking");
  });

  it("keeps briefing payload retrieval trace without replacing commitments or blockers", () => {
    const retrievalPack = buildMemoryFactRetrievalPack({
      surface: "briefing",
      objectType: ObjectType.MEETING,
      objectId: "meeting-1",
      budget: {
        maxItems: 1,
        maxEstimatedTokens: 120,
      },
      facts: [fact({ id: "briefing-fact", objectType: ObjectType.MEETING, objectId: "meeting-1" })],
    });

    const payload = buildBriefingPayload({
      resource: {
        objectType: ObjectType.MEETING,
        objectId: "meeting-1",
        objectLabel: "Quarterly review",
        objectRefs: [{ objectType: ObjectType.MEETING, objectId: "meeting-1" }],
        recentMeetings: [],
        recentThreads: [],
      },
      facts: retrievalPack.selectedFacts,
      commitments: [{ id: "commitment-1", title: "Send notes", dueDate: null, status: "OPEN" }],
      blockers: [{ id: "blocker-1", title: "Missing owner", severity: 80, status: "OPEN" }],
      retrievalPackTrace: retrievalPack.trace,
    });

    expect(payload.retrievalPackTrace?.trace.selectedCount).toBe(1);
    expect(payload.openCommitments).toHaveLength(1);
    expect(payload.activeBlockers).toHaveLength(1);
  });

  it("carries retrieval trace into recommendation presentation without owning ranking", () => {
    const retrievalPack = buildMemoryFactRetrievalPack({
      surface: "recommendation",
      objectType: ObjectType.OPPORTUNITY,
      objectId: "opp-1",
      budget: {
        maxItems: 1,
        maxEstimatedTokens: 120,
      },
      facts: [fact({ id: "recommendation-fact" })],
    });

    const payload = buildRecommendationPresentationPayload({
      context: {
        workspaceId: "workspace-1",
        objectType: ObjectType.OPPORTUNITY,
        objectId: "opp-1",
        objectLabel: "Acme renewal",
        daysSinceLastTouch: 6,
        dueSoon: false,
        baseRiskLevel: RiskLevel.MEDIUM,
        priorityScore: 70,
        roleWeight: 70,
      },
      evidence: {
        supportingFactIds: retrievalPack.selectedFacts.map((item) => item.id),
        blockerIds: [],
        commitmentIds: [],
        supportingFacts: retrievalPack.selectedFacts,
        blockers: [],
        commitments: [],
        memoryRetrievalPack: retrievalPack.trace,
      },
      ranked: {
        actionType: ActionType.CREATE_TASK,
        title: "Confirm owner",
        description: "Confirm the next owner.",
        aiReason: "Owner is needed.",
        riskLevel: RiskLevel.MEDIUM,
        outbound: false,
        usesCommitment: false,
        addressesBlocker: false,
        sortHint: "control",
        score: 80,
        urgencyScore: 70,
        impactScore: 70,
        confidenceScore: 70,
        personalizationScore: 60,
        policyFitScore: 80,
        riskScore: 30,
        policyResult: ActionExecutionMode.SUGGEST_ONLY,
        policyReason: "Review-first recommendation.",
        appliedPolicyName: null,
        appliedPolicyMode: null,
        appliedRiskThreshold: null,
        learnedPatternSummary: [],
      },
      preferenceSummary: {
        boostByActionType: {},
        rejectByActionType: {},
      },
    });

    expect(payload.memoryRetrievalPack?.surface).toBe("recommendation");
    expect(payload.evidenceSummary).toContain("retrieval pack");
    expect(payload.decisionRole).toBe("primary");
  });
});
