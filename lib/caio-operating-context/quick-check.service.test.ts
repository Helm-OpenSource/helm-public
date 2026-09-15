import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, observationMock } = vi.hoisted(() => {
  const dbMock = {
    caioQuickCheckTick: { create: vi.fn(), update: vi.fn() },
    caioMetricObservation: { create: vi.fn() },
    caioAnomalyCandidate: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return {
    dbMock,
    observationMock: { beginObservationSourceRun: vi.fn(), completeObservationSourceRun: vi.fn() },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/stage1-owner-loop/observation.service", () => observationMock);

import type { CaioDetector, CaioMetricQueryTemplate } from "./contracts";
import { caioQuickCheckBucketStart, runCaioQuickCheck } from "./quick-check.service";

const now = new Date("2026-09-16T02:07:30Z");

function template(templateId: string, sourceKey: string, run: CaioMetricQueryTemplate["run"]): CaioMetricQueryTemplate {
  return { templateId, domain: "operations", sourceKey, run };
}

const deadLetterDetector: CaioDetector = {
  detectorId: "dead-letter-surge",
  title: { zh: "死信激增", en: "Dead-letter surge" },
  requiredTemplateIds: ["dead-letters"],
  evaluate: ({ observations }) => ((observations.get("dead-letters")?.values?.count ?? 0) >= 10
    ? [{ mergeKey: "closure", objectKey: "job:closure", severity: "critical", reasonCode: "dead_letters_over_threshold", evidenceTemplateIds: ["dead-letters"] }]
    : []),
};

let observationRows: Array<Record<string, unknown>>;
let openCandidates: Array<{ id: string; detectorId: string; mergeKey: string }>;

beforeEach(() => {
  vi.clearAllMocks();
  observationRows = [];
  openCandidates = [];
  dbMock.caioQuickCheckTick.create.mockResolvedValue({ id: "tick_1" });
  dbMock.caioQuickCheckTick.update.mockResolvedValue({});
  dbMock.caioMetricObservation.create.mockImplementation(async ({ data }) => {
    observationRows.push(data);
    return data;
  });
  dbMock.caioAnomalyCandidate.findMany.mockImplementation(async () => openCandidates);
  dbMock.caioAnomalyCandidate.create.mockResolvedValue({});
  dbMock.caioAnomalyCandidate.update.mockResolvedValue({});
  dbMock.caioAnomalyCandidate.updateMany.mockResolvedValue({ count: 1 });
  dbMock.$transaction.mockImplementation(async (fn: (tx: typeof dbMock) => unknown) => fn(dbMock));
  observationMock.beginObservationSourceRun.mockResolvedValue({ id: "run_1", status: "RUNNING" });
  observationMock.completeObservationSourceRun.mockResolvedValue({});
});

describe("caioQuickCheckBucketStart", () => {
  it("floors to the 10-minute UTC bucket", () => {
    expect(caioQuickCheckBucketStart(now).toISOString()).toBe("2026-09-16T02:00:00.000Z");
    expect(caioQuickCheckBucketStart(new Date("2026-09-16T02:10:00Z")).toISOString()).toBe("2026-09-16T02:10:00.000Z");
  });
});

describe("runCaioQuickCheck", () => {
  it("does nothing else when another instance already claimed the bucket", async () => {
    dbMock.caioQuickCheckTick.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" }));
    const run = vi.fn();
    await expect(runCaioQuickCheck({ workspaceId: "ws", now, templates: [template("dead-letters", "source-a", run)], detectors: [] }))
      .resolves.toEqual({ status: "claimed_elsewhere" });
    expect(observationMock.beginObservationSourceRun).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(dbMock.caioMetricObservation.create).not.toHaveBeenCalled();
  });

  it("opens a candidate from a known reading and completes the source run with evidence", async () => {
    const result = await runCaioQuickCheck({
      workspaceId: "ws", now,
      templates: [template("dead-letters", "source-a", async () => ({ values: { count: 12 }, denominator: 40 }))],
      detectors: [deadLetterDetector],
    });
    expect(result).toMatchObject({ status: "completed", tickId: "tick_1", known: 1, unknown: 0, opened: 1, refreshed: 0, cleared: 0 });
    expect(observationMock.beginObservationSourceRun).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "ws", sourceKey: "source-a", executionKey: "caio-quick-check:2026-09-16T02:00:00.000Z",
      windowStart: new Date("2026-09-16T01:50:00Z"), windowEnd: new Date("2026-09-16T02:00:00Z"),
    }));
    expect(observationRows[0]).toMatchObject({ status: "ok", observationRunId: "run_1", valuesJson: "{\"count\":12}", denominator: 40 });
    const evidenceRef = observationRows[0].evidenceRef as string;
    expect(observationMock.completeObservationSourceRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: "run_1", outcome: "success", freshness: "fresh", completenessPercent: 100, evidenceRefs: [evidenceRef], errorCodes: [],
    }));
    expect(dbMock.caioAnomalyCandidate.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      detectorId: "dead-letter-surge", mergeKey: "closure", openKey: "dead-letter-surge:closure", status: "OPEN",
      titleZh: "死信激增", evidenceRefsJson: JSON.stringify([evidenceRef]), lastTickId: "tick_1",
    }) });
  });

  it("refreshes an existing open candidate instead of adding a second row", async () => {
    openCandidates = [{ id: "cand_1", detectorId: "dead-letter-surge", mergeKey: "closure" }];
    const result = await runCaioQuickCheck({
      workspaceId: "ws", now,
      templates: [template("dead-letters", "source-a", async () => ({ values: { count: 12 }, denominator: null }))],
      detectors: [deadLetterDetector],
    });
    expect(result).toMatchObject({ opened: 0, refreshed: 1 });
    expect(dbMock.caioAnomalyCandidate.create).not.toHaveBeenCalled();
    expect(dbMock.caioAnomalyCandidate.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "cand_1" }, data: expect.objectContaining({ hitCount: { increment: 1 }, lastTickId: "tick_1" }),
    }));
  });

  it("never reads a source whose observation gate refused, and keeps its candidates open", async () => {
    observationMock.beginObservationSourceRun.mockRejectedValue(new Error("private gate detail"));
    openCandidates = [{ id: "cand_1", detectorId: "dead-letter-surge", mergeKey: "closure" }];
    const run = vi.fn();
    const result = await runCaioQuickCheck({ workspaceId: "ws", now, templates: [template("dead-letters", "source-a", run)], detectors: [deadLetterDetector] });
    expect(run).not.toHaveBeenCalled();
    expect(observationRows[0]).toMatchObject({ status: "unknown", errorCode: "observation_gate_rejected", valuesJson: null });
    expect(observationMock.completeObservationSourceRun).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "completed", known: 0, unknown: 1, cleared: 0, skippedDetectors: 1 });
    expect(dbMock.caioAnomalyCandidate.updateMany).not.toHaveBeenCalled();
  });

  it("clears an open candidate when its detector ran on known inputs and did not hit", async () => {
    openCandidates = [{ id: "cand_1", detectorId: "dead-letter-surge", mergeKey: "closure" }];
    const result = await runCaioQuickCheck({
      workspaceId: "ws", now,
      templates: [template("dead-letters", "source-a", async () => ({ values: { count: 0 }, denominator: null }))],
      detectors: [deadLetterDetector],
    });
    expect(result).toMatchObject({ cleared: 1 });
    expect(dbMock.caioAnomalyCandidate.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws", openKey: "dead-letter-surge:closure", status: "OPEN" },
      data: { status: "CLEARED", openKey: null, clearedAt: now },
    });
  });

  it.each([
    ["an invalid result", async () => ({ values: { name: "x" }, denominator: null }), "metric_result_invalid"],
    ["an unsafe key", async () => ({ values: { customerName: 1 }, denominator: null }), "metric_result_unsafe"],
    ["a thrown query", async () => { throw new Error("private sql detail"); }, "metric_query_failed"],
  ] as const)("records %s as unknown with a closed code and no value", async (_label, run, errorCode) => {
    const result = await runCaioQuickCheck({ workspaceId: "ws", now, templates: [template("dead-letters", "source-a", run)], detectors: [] });
    expect(observationRows[0]).toMatchObject({ status: "unknown", errorCode, valuesJson: null, contentHash: null, evidenceRef: null });
    expect(observationMock.completeObservationSourceRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failure", errorCodes: ["metric_unknown"] }));
    expect(JSON.stringify(observationRows)).not.toMatch(/private/u);
    expect(result).toMatchObject({ known: 0, unknown: 1 });
  });

  it("times out a hanging query as unknown", async () => {
    const result = await runCaioQuickCheck({
      workspaceId: "ws", now, templateTimeoutMs: 5,
      templates: [template("dead-letters", "source-a", () => new Promise(() => undefined))], detectors: [],
    });
    expect(observationRows[0]).toMatchObject({ status: "unknown", errorCode: "metric_query_timeout" });
    expect(result).toMatchObject({ unknown: 1 });
  });

  it("skips completion for a run another instance already finished", async () => {
    observationMock.beginObservationSourceRun.mockResolvedValue({ id: "run_1", status: "SUCCEEDED" });
    const run = vi.fn();
    await runCaioQuickCheck({ workspaceId: "ws", now, templates: [template("dead-letters", "source-a", run)], detectors: [] });
    expect(run).not.toHaveBeenCalled();
    expect(observationMock.completeObservationSourceRun).not.toHaveBeenCalled();
    expect(observationRows[0]).toMatchObject({ status: "unknown", errorCode: "observation_run_already_terminal" });
  });

  it("marks the tick failed without leaking details when an unexpected error escapes", async () => {
    dbMock.$transaction.mockRejectedValue(new Error("private deadlock detail"));
    const result = await runCaioQuickCheck({
      workspaceId: "ws", now,
      templates: [template("dead-letters", "source-a", async () => ({ values: { count: 12 }, denominator: null }))],
      detectors: [deadLetterDetector],
    });
    expect(result).toMatchObject({ status: "failed", tickId: "tick_1" });
    expect(dbMock.caioQuickCheckTick.update).toHaveBeenCalledWith({
      where: { id: "tick_1" },
      data: { status: "FAILED", completedAt: expect.any(Date), summaryJson: JSON.stringify({ errorCode: "quick_check_failed" }) },
    });
    expect(JSON.stringify(result)).not.toMatch(/private/u);
  });
});
