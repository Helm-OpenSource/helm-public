import { ActorType, RecommendationFeedbackType, RecommendationStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  serviceGovernanceMock,
  dbMock,
  auditMock,
  analyticsMock,
  deltaMock,
  evolutionMock,
} = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceInsightServiceAccess: vi.fn(),
  },
  dbMock: {
    recommendationLog: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  auditMock: {
    writeAuditLog: vi.fn(),
  },
  analyticsMock: {
    logEvent: vi.fn(),
  },
  deltaMock: {
    recordRecommendationFeedbackDelta: vi.fn(),
  },
  evolutionMock: {
    refreshEvolutionState: vi.fn(),
  },
}));

type RecommendationFeedbackTransaction = {
  recommendationFeedback: {
    create: ReturnType<typeof vi.fn>;
  };
  recommendationLog: {
    update: ReturnType<typeof vi.fn>;
  };
  preferenceSignal: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceInsightServiceAccess: serviceGovernanceMock.assertWorkspaceInsightServiceAccess,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: analyticsMock.logEvent,
}));

vi.mock("@/lib/evolution/delta-event.service", () => ({
  recordRecommendationFeedbackDelta: deltaMock.recordRecommendationFeedbackDelta,
}));

vi.mock("@/lib/evolution/pattern-detection.service", () => ({
  refreshEvolutionState: evolutionMock.refreshEvolutionState,
}));

import { submitRecommendationFeedback } from "@/lib/recommendations/recommendation-feedback.service";

describe("recommendation feedback seed batch suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceGovernanceMock.assertWorkspaceInsightServiceAccess.mockResolvedValue(undefined);
    dbMock.recommendationLog.findUnique.mockResolvedValue({
      id: "rec-1",
      title: "Send follow-up",
      actionType: "DRAFT_EXTERNAL_EMAIL",
      objectType: "OPPORTUNITY",
      objectId: "opp-1",
      policyResult: "REQUIRES_APPROVAL",
    });
    dbMock.$transaction.mockImplementation(async (callback: (tx: RecommendationFeedbackTransaction) => Promise<unknown>) =>
      callback({
        recommendationFeedback: {
          create: vi.fn().mockResolvedValue({ id: "feedback-1" }),
        },
        recommendationLog: {
          update: vi.fn().mockResolvedValue({ id: "rec-1", status: RecommendationStatus.ACCEPTED }),
        },
        preferenceSignal: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "signal-1" }),
          update: vi.fn(),
        },
      }),
    );
    auditMock.writeAuditLog.mockResolvedValue(undefined);
    analyticsMock.logEvent.mockResolvedValue(undefined);
    deltaMock.recordRecommendationFeedbackDelta.mockResolvedValue(undefined);
    evolutionMock.refreshEvolutionState.mockResolvedValue(undefined);
  });

  it("skips evolution refresh when suppressEvolutionRefresh is true", async () => {
    await submitRecommendationFeedback({
      workspaceId: "workspace-1",
      recommendationId: "rec-1",
      userId: "user-1",
      actorName: "Seeder",
      actorType: ActorType.SYSTEM,
      suppressEvolutionRefresh: true,
      feedbackType: RecommendationFeedbackType.APPROVED,
      sourcePage: "/seed",
    });

    expect(deltaMock.recordRecommendationFeedbackDelta).toHaveBeenCalled();
    expect(evolutionMock.refreshEvolutionState).not.toHaveBeenCalled();
  });
});
