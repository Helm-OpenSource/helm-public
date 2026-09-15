import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, catalogMock } = vi.hoisted(() => ({
  dbMock: {
    membership: { findUnique: vi.fn() },
    dataAssetCatalogEntry: { findMany: vi.fn() },
    observationSource: { findFirst: vi.fn() },
    observationSourceRun: { findFirst: vi.fn() },
    caioMetricObservation: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  catalogMock: { recordDataAssetInitializationReceipt: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth/service-governance", () => ({ assertWorkspacePolicyServiceAccess: vi.fn(async () => undefined) }));
vi.mock("@/lib/stage1-owner-loop/data-asset-catalog.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stage1-owner-loop/data-asset-catalog.service")>()),
  ...catalogMock,
}));

import { prepareCaioG0FromLiveObservation } from "./g0-preparation.service";

const now = new Date("2026-09-16T02:01:00.000Z");
const windowStart = new Date("2026-09-16T01:50:00.000Z");
const windowEnd = new Date("2026-09-16T02:00:00.000Z");

function asset(id: string) {
  return {
    id, version: 4, displayName: `Asset ${id}`, businessDomain: "operations", sourceKind: "relational_database", purpose: "Observe",
    freshnessSlaMinutes: 30, authorizationReceiptRef: `auth-${id}`, connectionReceiptRef: `conn-${id}`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.membership.findUnique.mockResolvedValue({ role: WorkspaceRole.OWNER, status: MembershipStatus.ACTIVE });
  dbMock.dataAssetCatalogEntry.findMany.mockResolvedValue(["a", "b", "c"].map(asset));
  dbMock.observationSource.findFirst.mockImplementation(async ({ where }) => ({ id: `source-${where.catalogEntryId}`, sensitivity: "INTERNAL" }));
  dbMock.observationSourceRun.findFirst.mockImplementation(async ({ where }) => ({
    id: `run-${where.sourceId}`, status: "SUCCEEDED", windowStart, windowEnd, observedAt: now, summaryHash: `sha256:${"a".repeat(64)}`,
  }));
  dbMock.caioMetricObservation.findMany.mockImplementation(async ({ where }) => {
    // Template ids are unique across the registry, so each source contributes its own templates.
    const source = String(where.observationRunId).slice(-1);
    return Array.from({ length: 30 }, (_, index) => {
      const token = `${source}${"abcdefghijklmnopqrstuvwxyzABCD"[index]}`;
      return {
        templateId: `t-${token}`, sourceKey: `sk-${source}`, domain: "operations", windowStart, windowEnd, observedAt: now,
        contentHash: `sha256:${Buffer.from(token.padEnd(32, "x")).toString("hex").slice(0, 64)}`,
        evidenceRef: `caio-metric:t-${token}:x`, valuesJson: "{\"count\":1}",
      };
    });
  });
});

describe("prepareCaioG0FromLiveObservation", () => {
  it("refuses a non-owner before reading any catalog data", async () => {
    dbMock.membership.findUnique.mockResolvedValue({ role: WorkspaceRole.ADMIN, status: MembershipStatus.ACTIVE });
    await expect(prepareCaioG0FromLiveObservation({ workspaceId: "w", actorUserId: "u", actorName: "n", apply: true, now }))
      .resolves.toEqual({ ok: false, code: "not_owner" });
    expect(dbMock.dataAssetCatalogEntry.findMany).not.toHaveBeenCalled();
  });

  it("lists every asset without a successful quick-check run", async () => {
    dbMock.observationSourceRun.findFirst.mockImplementation(async ({ where }) => (where.sourceId === "source-b" ? null : {
      id: `run-${where.sourceId}`, status: "SUCCEEDED", windowStart, windowEnd, observedAt: now, summaryHash: `sha256:${"a".repeat(64)}`,
    }));
    await expect(prepareCaioG0FromLiveObservation({ workspaceId: "w", actorUserId: "u", actorName: "n", apply: false, now }))
      .resolves.toEqual({ ok: false, code: "no_successful_run", assetRefs: ["b"] });
  });

  it("validates without writing and keeps the evidence trace budget at or under 50", async () => {
    const result = await prepareCaioG0FromLiveObservation({ workspaceId: "w", actorUserId: "u", actorName: "n", apply: false, now });
    expect(result).toMatchObject({ ok: true, summary: { assets: 3, validated: true, initializationReceipts: 0 } });
    if (!result.ok) throw new Error(result.code);
    expect(result.summary.traces).toBeLessThanOrEqual(50);
    expect(result.summary.traces).toBe(48);
    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(catalogMock.recordDataAssetInitializationReceipt).not.toHaveBeenCalled();
  });
});
