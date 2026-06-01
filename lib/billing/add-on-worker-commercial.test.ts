import { describe, expect, it } from "vitest";
import { WorkerEntitlementStatus, WorkerEntitlementType } from "@prisma/client";
import {
  FIRST_PARTY_CORE_WORKERS,
  FUTURE_ADD_ON_WORKERS,
  buildWorkerCommercialWiringView,
} from "@/lib/billing/add-on-worker-commercial";

describe("add-on worker commercial wiring", () => {
  it("keeps core workers included and future add-ons reserved by default", () => {
    expect(FIRST_PARTY_CORE_WORKERS.map((worker) => worker.key)).toEqual([
      "meeting_os_worker",
      "review_memory_worker",
    ]);
    expect(FUTURE_ADD_ON_WORKERS.map((worker) => worker.key)).toEqual([
      "deal_desk_worker",
      "specialist_review_worker",
    ]);
    expect(FUTURE_ADD_ON_WORKERS.map((worker) => worker.defaultStatus)).toEqual([
      WorkerEntitlementStatus.INACTIVE,
      WorkerEntitlementStatus.INACTIVE,
    ]);
  });

  it("describes reserved monthly rails without implying a marketplace", () => {
    const view = buildWorkerCommercialWiringView({
      workerKey: "deal_desk_worker",
      entitlementType: WorkerEntitlementType.ADD_ON_MONTHLY,
      status: WorkerEntitlementStatus.INACTIVE,
      effectiveFrom: new Date("2026-03-01T00:00:00.000Z"),
      effectiveTo: null,
      internalLimit: null,
    });

    expect(view.railFamily).toBe("MONTHLY");
    expect(view.isReservedFuturePath).toBe(true);
    expect(view.commercialTruth.en).toContain("reserved monthly add-on path");
    expect(view.futurePath.en).toContain("does not imply a worker marketplace");
  });

  it("describes active per-use rails as commercial wiring, not as a worker store", () => {
    const view = buildWorkerCommercialWiringView({
      workerKey: "specialist_review_worker",
      entitlementType: WorkerEntitlementType.ADD_ON_PER_USE,
      status: WorkerEntitlementStatus.ACTIVE,
      effectiveFrom: new Date("2026-03-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-05-01T00:00:00.000Z"),
      internalLimit: 12,
    });

    expect(view.railFamily).toBe("PER_USE");
    expect(view.isCommercialActive).toBe(true);
    expect(view.commercialTruth.en).toContain("Per-use add-on commercial wiring is active");
    expect(view.usagePath.en).toContain("Future per-use add-on path");
  });
});
