import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGtmLead } = vi.hoisted(() => ({
  mockGtmLead: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { gtmLead: mockGtmLead },
}));

vi.mock("server-only", () => ({}));

import {
  GtmLeadReservedOnlyError,
  assertReservedWorkspaceForGtmLead,
  countGtmLeadsByStage,
  getGtmLeadByKey,
  listGtmLeadsForReservedWorkspace,
  mapGtmLeadRow,
} from "./queries";

const reservedWorkspace = {
  workspaceClass: "HELM_RESERVED" as const,
  systemKey: "helm_reserved_primary",
  status: "ACTIVE" as const,
};

const customerWorkspace = {
  workspaceClass: "CUSTOMER" as const,
  systemKey: null,
  status: "ACTIVE" as const,
};

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "row-1",
    workspaceId: "ws-1",
    leadKey: "lead-1",
    sourceType: "REFERRAL",
    sourceRef: null,
    referrerMembershipId: null,
    companyName: "Acme",
    industry: null,
    icpFit: "UNKNOWN",
    readinessStage: "UNKNOWN",
    ownerMembershipId: null,
    stage: "CAPTURED",
    nextAction: null,
    blocker: null,
    evidenceRefsJson: null,
    internalNotes: null,
    createdAt: new Date("2026-05-12T00:00:00.000Z"),
    updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockGtmLead.findMany.mockReset();
  mockGtmLead.findUnique.mockReset();
  mockGtmLead.groupBy.mockReset();
});

describe("assertReservedWorkspaceForGtmLead", () => {
  it("throws GtmLeadReservedOnlyError for non-reserved workspaces", () => {
    expect(() => assertReservedWorkspaceForGtmLead(customerWorkspace)).toThrow(
      GtmLeadReservedOnlyError,
    );
    expect(() => assertReservedWorkspaceForGtmLead(null)).toThrow(
      GtmLeadReservedOnlyError,
    );
  });

  it("passes silently for an active HELM_RESERVED workspace", () => {
    expect(() => assertReservedWorkspaceForGtmLead(reservedWorkspace)).not.toThrow();
  });

  it("emits english error text when requested", () => {
    try {
      assertReservedWorkspaceForGtmLead(customerWorkspace, true);
    } catch (error) {
      expect(error).toBeInstanceOf(GtmLeadReservedOnlyError);
      expect((error as Error).message).toContain("Helm internal");
    }
  });
});

describe("mapGtmLeadRow", () => {
  it("parses evidenceRefsJson and serializes timestamps to ISO", () => {
    const r = row({
      evidenceRefsJson: JSON.stringify(["a", "b"]),
      createdAt: new Date("2026-05-12T10:00:00.000Z"),
      updatedAt: new Date("2026-05-12T11:00:00.000Z"),
    });
    const record = mapGtmLeadRow(r as never);
    expect(record.evidenceRefs).toEqual(["a", "b"]);
    expect(record.createdAt).toBe("2026-05-12T10:00:00.000Z");
    expect(record.updatedAt).toBe("2026-05-12T11:00:00.000Z");
  });

  it("returns empty array for null evidenceRefsJson", () => {
    const record = mapGtmLeadRow(row({ evidenceRefsJson: null }) as never);
    expect(record.evidenceRefs).toEqual([]);
  });
});

describe("listGtmLeadsForReservedWorkspace", () => {
  it("rejects customer workspaces before touching the database", async () => {
    await expect(() =>
      listGtmLeadsForReservedWorkspace({
        workspace: customerWorkspace,
        workspaceId: "ws-1",
      }),
    ).rejects.toBeInstanceOf(GtmLeadReservedOnlyError);
    expect(mockGtmLead.findMany).not.toHaveBeenCalled();
  });

  it("queries with workspace scoping and orders by updatedAt desc", async () => {
    mockGtmLead.findMany.mockResolvedValue([row({ leadKey: "a" }), row({ leadKey: "b" })]);
    const records = await listGtmLeadsForReservedWorkspace({
      workspace: reservedWorkspace,
      workspaceId: "ws-1",
      stage: "QUALIFIED",
      take: 25,
    });
    expect(mockGtmLead.findMany).toHaveBeenCalledOnce();
    const args = mockGtmLead.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      workspaceId: "ws-1",
      stage: "QUALIFIED",
      ownerMembershipId: undefined,
    });
    expect(args.orderBy).toEqual({ updatedAt: "desc" });
    expect(args.take).toBe(25);
    expect(records).toHaveLength(2);
  });

  it("applies a default page size when take is omitted", async () => {
    mockGtmLead.findMany.mockResolvedValue([]);
    await listGtmLeadsForReservedWorkspace({
      workspace: reservedWorkspace,
      workspaceId: "ws-1",
    });
    const args = mockGtmLead.findMany.mock.calls[0][0];
    expect(args.take).toBe(50);
  });
});

describe("getGtmLeadByKey", () => {
  it("returns null when no row matches", async () => {
    mockGtmLead.findUnique.mockResolvedValue(null);
    const record = await getGtmLeadByKey({
      workspace: reservedWorkspace,
      workspaceId: "ws-1",
      leadKey: "missing",
    });
    expect(record).toBeNull();
  });

  it("uses the (workspaceId, leadKey) compound unique key", async () => {
    mockGtmLead.findUnique.mockResolvedValue(row({}));
    await getGtmLeadByKey({
      workspace: reservedWorkspace,
      workspaceId: "ws-1",
      leadKey: "lead-1",
    });
    const args = mockGtmLead.findUnique.mock.calls[0][0];
    expect(args.where).toEqual({
      workspaceId_leadKey: { workspaceId: "ws-1", leadKey: "lead-1" },
    });
  });
});

describe("countGtmLeadsByStage", () => {
  it("rejects non-reserved workspaces", async () => {
    await expect(() =>
      countGtmLeadsByStage({
        workspace: customerWorkspace,
        workspaceId: "ws-1",
      }),
    ).rejects.toBeInstanceOf(GtmLeadReservedOnlyError);
  });

  it("aggregates groupBy results into a stage→count record", async () => {
    mockGtmLead.groupBy.mockResolvedValue([
      { stage: "CAPTURED", _count: { _all: 3 } },
      { stage: "FIRST_LOOP_ACTIVE", _count: { _all: 1 } },
    ]);
    const counts = await countGtmLeadsByStage({
      workspace: reservedWorkspace,
      workspaceId: "ws-1",
    });
    expect(counts.CAPTURED).toBe(3);
    expect(counts.FIRST_LOOP_ACTIVE).toBe(1);
  });
});
