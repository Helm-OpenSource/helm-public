import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceInsightServiceAccess: vi.fn(),
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceInsightServiceAccess: serviceGovernanceMock.assertWorkspaceInsightServiceAccess,
}));

import { submitRecommendationFeedback } from "@/lib/recommendations/recommendation-feedback.service";

describe("recommendation feedback service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-checks workspace insight capability before recording recommendation feedback", async () => {
    serviceGovernanceMock.assertWorkspaceInsightServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, or operator can generate tenant-scoped reports or record recommendation feedback."),
    );

    await expect(
      submitRecommendationFeedback({
        workspaceId: "workspace-1",
        recommendationId: "recommendation-1",
        userId: "user-1",
        actorName: "Owner",
        feedbackType: "APPROVED",
        english: true,
      }),
    ).rejects.toThrow(
      "Only owner, admin, or operator can generate tenant-scoped reports or record recommendation feedback.",
    );

    expect(serviceGovernanceMock.assertWorkspaceInsightServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: true,
    });
  });
});
