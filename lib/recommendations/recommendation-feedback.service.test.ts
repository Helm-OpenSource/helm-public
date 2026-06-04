import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@prisma/client", () => ({
  ActorType: {
    SYSTEM: "SYSTEM",
    USER: "USER",
  },
  PreferenceSignalType: {
    APPROVAL_PREFERENCE: "APPROVAL_PREFERENCE",
  },
  RecommendationFeedbackType: {
    APPROVED: "APPROVED",
    AUTO_EXECUTED: "AUTO_EXECUTED",
    EDITED_AND_APPROVED: "EDITED_AND_APPROVED",
    FAILED: "FAILED",
    IGNORED: "IGNORED",
    REJECTED: "REJECTED",
  },
  RecommendationStatus: {
    ACCEPTED: "ACCEPTED",
    EXECUTED: "EXECUTED",
    EXPIRED: "EXPIRED",
    IGNORED: "IGNORED",
    REJECTED: "REJECTED",
  },
}));

import { ActorType, RecommendationFeedbackType, RecommendationStatus } from "@prisma/client";

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

  it("keeps Chinese audit summaries by default", async () => {
    await submitRecommendationFeedback({
      workspaceId: "workspace-1",
      recommendationId: "rec-1",
      userId: "user-1",
      actorName: "Reviewer",
      feedbackType: RecommendationFeedbackType.REJECTED,
      sourcePage: "/recommendations",
    });

    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: "用户拒绝了判断建议：Send follow-up",
      }),
    );
  });

  it("localizes recommendation feedback audit summaries for English workspaces", async () => {
    await submitRecommendationFeedback({
      workspaceId: "workspace-1",
      recommendationId: "rec-1",
      userId: "user-1",
      actorName: "Reviewer",
      english: true,
      feedbackType: RecommendationFeedbackType.APPROVED,
      sourcePage: "/recommendations",
    });

    const summary = auditMock.writeAuditLog.mock.calls.at(-1)?.[0]?.summary;
    expect(summary).toBe("User accepted the recommendation: Send follow-up");
    expect(summary).not.toMatch(/[\u3400-\u9fff]/u);
  });
});
