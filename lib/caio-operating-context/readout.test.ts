import { WorkspaceRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    caioQuickCheckTick: { findFirst: vi.fn() },
    caioAnomalyCandidate: { findMany: vi.fn() },
    caioMetricObservation: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { getCaioOperatingAttentionReadout } from "./readout";

const now = new Date("2026-09-16T02:15:00Z");
const candidate = (detectorId: string, severity: string, lastSeenAt: string) => ({
  detectorId, titleZh: "标题", titleEn: "Title", severity, reasonCode: "reason", hitCount: 2,
  firstSeenAt: new Date("2026-09-16T01:00:00Z"), lastSeenAt: new Date(lastSeenAt), evidenceRefsJson: "[\"caio-metric:x:y\"]",
});

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.caioQuickCheckTick.findFirst
    .mockResolvedValueOnce({ id: "tick_2", bucketStart: new Date("2026-09-16T02:10:00Z"), status: "RUNNING" })
    .mockResolvedValueOnce({ id: "tick_1" });
  dbMock.caioAnomalyCandidate.findMany.mockResolvedValue([
    candidate("info-late", "info", "2026-09-16T02:10:00Z"),
    candidate("critical-early", "critical", "2026-09-16T01:10:00Z"),
    candidate("critical-late", "critical", "2026-09-16T02:00:00Z"),
  ]);
  dbMock.caioMetricObservation.findMany.mockResolvedValue([{ templateId: "queue", domain: "operations", errorCode: "observation_gate_rejected" }]);
});

describe("getCaioOperatingAttentionReadout", () => {
  it("returns null for non-owners without reading", async () => {
    await expect(getCaioOperatingAttentionReadout({ workspaceId: "ws", membershipRole: WorkspaceRole.ADMIN, now })).resolves.toBeNull();
    expect(dbMock.caioQuickCheckTick.findFirst).not.toHaveBeenCalled();
  });

  it("orders by severity then recency, reads unknowns from the last finished tick, and never returns evidence refs", async () => {
    const readout = await getCaioOperatingAttentionReadout({ workspaceId: "ws", membershipRole: WorkspaceRole.OWNER, now });
    expect(readout).toMatchObject({
      available: true,
      lastTick: { bucketStart: "2026-09-16T02:10:00.000Z", status: "RUNNING", stale: false },
      unknownTemplates: [{ templateId: "queue", errorCode: "observation_gate_rejected" }],
    });
    if (!readout?.available) throw new Error("expected readout");
    expect(readout.openCandidates.map((c) => c.detectorId)).toEqual(["critical-late", "critical-early", "info-late"]);
    expect(dbMock.caioMetricObservation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tickId: "tick_1", status: "unknown" } }));
    expect(JSON.stringify(readout)).not.toContain("caio-metric:");
  });

  it("marks a tick older than 30 minutes as stale", async () => {
    const readout = await getCaioOperatingAttentionReadout({ workspaceId: "ws", membershipRole: WorkspaceRole.OWNER, now: new Date("2026-09-16T02:41:00Z") });
    expect(readout).toMatchObject({ lastTick: { stale: true } });
  });

  it("reports unavailable instead of empty when a read fails", async () => {
    dbMock.caioAnomalyCandidate.findMany.mockRejectedValue(Object.assign(new Error("missing table"), { code: "P2021" }));
    await expect(getCaioOperatingAttentionReadout({ workspaceId: "ws", membershipRole: WorkspaceRole.OWNER, now })).resolves.toEqual({ available: false });
  });
});
