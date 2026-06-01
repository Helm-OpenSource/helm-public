import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceInsightServiceAccess: vi.fn(),
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceInsightServiceAccess: serviceGovernanceMock.assertWorkspaceInsightServiceAccess,
}));

import { generateRecommendationsForObject } from "@/lib/recommendations/recommendation.service";

describe("recommendation generation service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-checks workspace insight capability before generating recommendations", async () => {
    serviceGovernanceMock.assertWorkspaceInsightServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, or operator can generate tenant-scoped reports or record recommendation feedback."),
    );

    await expect(
      generateRecommendationsForObject({
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        actorName: "Owner",
        actorType: "USER",
        sourcePage: "/recommendations",
        objectType: "COMPANY",
        objectId: "company-1",
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
