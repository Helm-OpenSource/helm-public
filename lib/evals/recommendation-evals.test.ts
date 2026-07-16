import { ActionType, RecommendationStatus, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getRecommendationQualityOverview } from "@/lib/evals/recommendation-evals";

describe("getRecommendationQualityOverview", () => {
  it("aggregates recommendation metrics without loading every recommendation row", async () => {
    const recommendationFindMany = vi.fn(() => {
      throw new Error("recommendationLog.findMany must not be used for overview aggregation");
    });
    const prisma = {
      recommendationLog: {
        findMany: recommendationFindMany,
        groupBy: vi.fn().mockResolvedValue([
          {
            actionType: ActionType.CREATE_TASK,
            status: RecommendationStatus.ACTIVE,
            _count: { _all: 10 },
            _sum: { score: 700 },
          },
          {
            actionType: ActionType.CREATE_TASK,
            status: RecommendationStatus.ACCEPTED,
            _count: { _all: 4 },
            _sum: { score: 320 },
          },
          {
            actionType: ActionType.CREATE_TASK,
            status: RecommendationStatus.EXECUTED,
            _count: { _all: 1 },
            _sum: { score: 90 },
          },
          {
            actionType: ActionType.CREATE_TASK,
            status: RecommendationStatus.REJECTED,
            _count: { _all: 2 },
            _sum: { score: 60 },
          },
          {
            actionType: ActionType.UPDATE_OPPORTUNITY_STAGE,
            status: RecommendationStatus.ACTIVE,
            _count: { _all: 3 },
            _sum: { score: 150 },
          },
        ]),
      },
      recommendationFeedback: {
        findMany: vi.fn().mockResolvedValue([
          { recommendationLog: { actionType: ActionType.CREATE_TASK } },
          { recommendationLog: { actionType: ActionType.CREATE_TASK } },
          { recommendationLog: { actionType: ActionType.UPDATE_OPPORTUNITY_STAGE } },
        ]),
      },
      eventLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            eventName: "recommendation_action_created",
            metadata: JSON.stringify({ actionType: ActionType.CREATE_TASK }),
          },
          {
            eventName: "recommendation_action_created",
            metadata: JSON.stringify({ actionType: ActionType.CREATE_TASK }),
          },
          { eventName: "recommendation_explanation_viewed", metadata: null },
          { eventName: "recommendation_card_viewed", metadata: null },
        ]),
      },
      contact: { findFirst: vi.fn().mockResolvedValue(null) },
      opportunity: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;

    const overview = await getRecommendationQualityOverview(
      "workspace-1",
      new Date("2026-07-01T00:00:00.000Z"),
      prisma,
    );

    expect(recommendationFindMany).not.toHaveBeenCalled();
    expect(overview).toMatchObject({
      generated: 20,
      accepted: 5,
      rejected: 2,
      editedApproved: 3,
      actionCreated: 2,
      explanationViewed: 1,
      cardViewed: 1,
      acceptanceRate: 25,
      rejectionRate: 10,
      actionCreationRate: 10,
      editedApprovalRate: 15,
      averageScore: 66,
    });
    expect(overview.byActionType).toEqual([
      {
        actionType: ActionType.CREATE_TASK,
        generated: 17,
        accepted: 5,
        rejected: 2,
        editedApproved: 2,
        actionCreated: 2,
        acceptanceRate: 29.4,
        rejectionRate: 11.8,
      },
      {
        actionType: ActionType.UPDATE_OPPORTUNITY_STAGE,
        generated: 3,
        accepted: 0,
        rejected: 0,
        editedApproved: 1,
        actionCreated: 0,
        acceptanceRate: 0,
        rejectionRate: 0,
      },
    ]);
  });
});
