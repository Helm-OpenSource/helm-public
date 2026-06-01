import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceInsightServiceAccess: vi.fn(),
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceInsightServiceAccess: serviceGovernanceMock.assertWorkspaceInsightServiceAccess,
}));

import { generateWeeklyReport } from "@/lib/reports";

describe("weekly report service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-checks workspace insight capability before running the report service", async () => {
    serviceGovernanceMock.assertWorkspaceInsightServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, or operator can generate tenant-scoped reports or record recommendation feedback."),
    );

    await expect(
      generateWeeklyReport({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Owner",
        english: true,
      }),
    ).rejects.toThrow("Only owner, admin, or operator can generate tenant-scoped reports or record recommendation feedback.");

    expect(serviceGovernanceMock.assertWorkspaceInsightServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: true,
    });
  });
});
