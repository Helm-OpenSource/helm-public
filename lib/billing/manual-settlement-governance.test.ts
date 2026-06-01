import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceReservedManualSettlementServiceAccess: vi.fn(),
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceReservedManualSettlementServiceAccess:
    serviceGovernanceMock.assertWorkspaceReservedManualSettlementServiceAccess,
}));

import {
  createSettlementBatchForPeriod,
  markSettlementBatchExported,
} from "@/lib/billing/manual-settlement";

describe("manual settlement service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-checks manual settlement capability before creating a settlement batch", async () => {
    serviceGovernanceMock.assertWorkspaceReservedManualSettlementServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, billing admin or admin can manage manual settlement"),
    );

    await expect(
      createSettlementBatchForPeriod({
        workspaceId: "workspace-1",
        periodLabel: "2026-04",
        actorUserId: "user-1",
        actorType: "USER",
        english: true,
      }),
    ).rejects.toThrow("Only owner, billing admin or admin can manage manual settlement");

    expect(serviceGovernanceMock.assertWorkspaceReservedManualSettlementServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: true,
    });
  });

  it("re-checks manual settlement capability before exporting a settlement batch", async () => {
    serviceGovernanceMock.assertWorkspaceReservedManualSettlementServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, billing admin or admin can manage manual settlement"),
    );

    await expect(
      markSettlementBatchExported({
        workspaceId: "workspace-1",
        batchId: "batch-1",
        actorUserId: "user-1",
        actorType: "USER",
        english: true,
      }),
    ).rejects.toThrow("Only owner, billing admin or admin can manage manual settlement");

    expect(serviceGovernanceMock.assertWorkspaceReservedManualSettlementServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: true,
    });
  });
});
