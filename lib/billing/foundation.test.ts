import { AccessState, WorkerEntitlementStatus, WorkerEntitlementType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, getDefaultPaymentProviderMock } = vi.hoisted(() => ({
  dbMock: {
    workspace: {
      findUnique: vi.fn(),
    },
    billingAccount: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    trialState: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    workerEntitlement: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
  getDefaultPaymentProviderMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/billing/payment-provider-resolver", () => ({
  getDefaultPaymentProvider: getDefaultPaymentProviderMock,
}));

import { FIRST_PARTY_CORE_WORKERS, FUTURE_ADD_ON_WORKERS } from "@/lib/billing/add-on-worker-commercial";
import { ensureWorkspaceCommercialFoundation } from "@/lib/billing/foundation";

describe("ensureWorkspaceCommercialFoundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.workspace.findUnique.mockResolvedValue({
      id: "workspace-1",
      defaultLocale: "zh-CN",
    });
    dbMock.billingAccount.upsert.mockResolvedValue({ id: "billing-1" });
    dbMock.billingAccount.updateMany.mockResolvedValue({ count: 0 });
    dbMock.trialState.upsert.mockResolvedValue({ workspaceId: "workspace-1" });
    dbMock.trialState.update.mockResolvedValue({ workspaceId: "workspace-1" });
    dbMock.workerEntitlement.upsert.mockResolvedValue({ id: "entitlement-1" });
    getDefaultPaymentProviderMock.mockReturnValue("STRIPE");
  });

  it("skips bootstrap writes when the commercial foundation is already complete", async () => {
    dbMock.billingAccount.findUnique.mockResolvedValue({
      id: "billing-1",
      billingPeriodEndsAt: null,
    });
    dbMock.trialState.findUnique.mockResolvedValue({
      workspaceId: "workspace-1",
      trialEndsAt: new Date("2026-05-01T00:00:00Z"),
      graceEndsAt: new Date("2026-05-08T00:00:00Z"),
      status: AccessState.TRIALING,
    });
    dbMock.workerEntitlement.findMany.mockResolvedValue([
      ...FIRST_PARTY_CORE_WORKERS.map((worker) => ({
        workerKey: worker.key,
        entitlementType: WorkerEntitlementType.INCLUDED,
        status: WorkerEntitlementStatus.ACTIVE,
      })),
      ...FUTURE_ADD_ON_WORKERS.map((worker) => ({
        workerKey: worker.key,
        entitlementType: worker.entitlementType,
        status: worker.defaultStatus,
      })),
    ]);

    const result = await ensureWorkspaceCommercialFoundation("workspace-1", new Date("2026-04-12T00:00:00Z"));

    expect(result).toBe(AccessState.TRIALING);
    expect(dbMock.billingAccount.upsert).not.toHaveBeenCalled();
    expect(dbMock.trialState.upsert).not.toHaveBeenCalled();
    expect(dbMock.workerEntitlement.upsert).not.toHaveBeenCalled();
  });

  it("bootstraps missing billing, trial, and worker foundation records", async () => {
    dbMock.billingAccount.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        billingPeriodEndsAt: null,
      });
    dbMock.trialState.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        workspaceId: "workspace-1",
        trialEndsAt: new Date("2026-05-01T00:00:00Z"),
        graceEndsAt: new Date("2026-05-08T00:00:00Z"),
        status: AccessState.TRIALING,
      });
    dbMock.workerEntitlement.findMany.mockResolvedValue([]);

    const result = await ensureWorkspaceCommercialFoundation("workspace-1", new Date("2026-04-12T00:00:00Z"));

    expect(result).toBe(AccessState.TRIALING);
    expect(dbMock.billingAccount.upsert).toHaveBeenCalledTimes(1);
    expect(dbMock.trialState.upsert).toHaveBeenCalledTimes(1);
    expect(dbMock.workerEntitlement.upsert).toHaveBeenCalledTimes(
      FIRST_PARTY_CORE_WORKERS.length + FUTURE_ADD_ON_WORKERS.length,
    );
  });
});
