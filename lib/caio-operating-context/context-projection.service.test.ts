import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    caioMetricObservation: { findMany: vi.fn() },
    observationSourceRun: { findMany: vi.fn() },
    dataAssetStageReceipt: { findFirst: vi.fn() },
    caioOperatingContextSnapshot: { create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { projectTemporalOperatingContext } from "@/lib/operating-harness/context-projector";

import { projectCaioQuickCheckContext } from "./context-projection.service";

const bucket = new Date("2026-09-16T02:00:00.000Z");
const windowStart = new Date("2026-09-16T01:50:00.000Z");
const asOf = new Date("2026-09-16T02:00:30.000Z");
const digest = (c: string) => `sha256:${c.repeat(64)}`;
const hits = [{ detectorId: "dead-letter-surge", mergeKey: "closure", objectKey: "job:closure", evidenceTemplateIds: ["dead-letters"] }];
const run = () => projectCaioQuickCheckContext({ workspaceId: "cmworkspace123", tickId: "tick_1", tickBucketStart: bucket, windowStart, asOf, hits });
const created = () => dbMock.caioOperatingContextSnapshot.create.mock.calls[0][0].data;

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.caioMetricObservation.findMany.mockResolvedValue([
    { templateId: "dead-letters", sourceKey: "source-a", observationRunId: "run_a1", windowStart, windowEnd: bucket, observedAt: asOf, contentHash: digest("a") },
  ]);
  dbMock.observationSourceRun.findMany.mockResolvedValue([
    { id: "run_a1", status: "SUCCEEDED", windowStart, windowEnd: bucket, observedAt: asOf, summaryHash: digest("b"), source: { catalogEntryId: "catalog_a" } },
  ]);
  dbMock.dataAssetStageReceipt.findFirst.mockImplementation(async ({ where }) => ({ id: `${where.receiptType.toLowerCase()}_receipt_a` }));
  dbMock.caioOperatingContextSnapshot.create.mockResolvedValue({});
});

describe("projectCaioQuickCheckContext", () => {
  it("stores a projected snapshot whose stored input replays to the same hash, without raw ids", async () => {
    await expect(run()).resolves.toBe("projected");
    const data = created();
    expect(data).toMatchObject({ status: "PROJECTED", tickId: "tick_1", objectCount: 1, signalCount: 1 });
    const replay = projectTemporalOperatingContext(JSON.parse(data.projectionInputJson));
    expect(replay.snapshot?.contentHash).toBe(data.snapshotHash);
    const stored = `${data.projectionInputJson}${data.snapshotJson}`;
    for (const raw of ["cmworkspace123", "run_a1", "catalog_a", "authorization_receipt_a", "connection_receipt_a"]) expect(stored).not.toContain(raw);
  });

  it("records no_signals when no hit is backed by a known reading", async () => {
    dbMock.caioMetricObservation.findMany.mockResolvedValue([]);
    await expect(run()).resolves.toBe("no_signals");
    expect(created()).toEqual({ workspaceId: "cmworkspace123", tickId: "tick_1", status: "NO_SIGNALS", reasonCode: "no_signals" });
  });

  it("rejects evidence from a source without catalog receipts instead of adopting it", async () => {
    dbMock.dataAssetStageReceipt.findFirst.mockResolvedValue(null);
    await expect(run()).resolves.toBe("rejected");
    expect(created()).toMatchObject({ status: "REJECTED", reasonCode: "evidence_run_missing" });
    expect(created().projectionInputJson).toBeUndefined();
  });

  it("rejects a projection the P3a contract refuses and keeps only error codes", async () => {
    await expect(projectCaioQuickCheckContext({
      workspaceId: "cmworkspace123", tickId: "tick_1", tickBucketStart: bucket, windowStart, asOf,
      hits: [{ ...hits[0], objectKey: "job:13812345678" }],
    })).resolves.toBe("rejected");
    expect(created()).toMatchObject({ status: "REJECTED", reasonCode: "context_projection_rejected" });
    expect(JSON.parse(created().errorCodesJson).length).toBeGreaterThan(0);
    expect(created().snapshotJson).toBeUndefined();
  });
});
