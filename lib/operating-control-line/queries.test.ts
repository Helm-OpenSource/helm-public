import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCandidate } = vi.hoisted(() => ({
  mockCandidate: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { operatingControlLineCandidate: mockCandidate },
}));

vi.mock("server-only", () => ({}));

import {
  OperatingControlLineCandidateReservedOnlyError,
  assertReservedWorkspaceForControlLineCandidate,
  countControlLineCandidatesByStatus,
  getControlLineCandidateByKey,
  listControlLineCandidatesForReservedWorkspace,
  mapControlLineCandidateRow,
} from "./queries";

const reserved = {
  workspaceClass: "HELM_RESERVED" as const,
  systemKey: "helm_reserved_primary",
  status: "ACTIVE" as const,
};
const customer = {
  workspaceClass: "CUSTOMER" as const,
  systemKey: null,
  status: "ACTIVE" as const,
};

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "id-1",
    workspaceId: "ws-1",
    briefId: "brief-1",
    candidateKey: "cand-1",
    painTag: "线索跟进混乱",
    controlLineTemplate: "LEAD_FOLLOW_UP",
    targetBusinessObject: "销售线索",
    resourceInputsJson: JSON.stringify(["CRM"]),
    evidenceReadiness: "DECLARED",
    status: "DRAFT",
    evidenceNotesJson: JSON.stringify([
      {
        ts: "2026-05-12T00:00:00Z",
        origin: "sales_intake",
        actor: "sales-1",
        beforeReadiness: "DECLARED",
        afterReadiness: "DECLARED",
        note: "初始",
      },
    ]),
    reviewerNotes: null,
    createdAt: new Date("2026-05-12T00:00:00.000Z"),
    updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockCandidate.findMany.mockReset();
  mockCandidate.findUnique.mockReset();
  mockCandidate.groupBy.mockReset();
});

describe("assertReservedWorkspaceForControlLineCandidate", () => {
  it("throws for customer tenants", () => {
    expect(() =>
      assertReservedWorkspaceForControlLineCandidate(customer),
    ).toThrow(OperatingControlLineCandidateReservedOnlyError);
  });

  it("throws for canceled reserved workspaces", () => {
    expect(() =>
      assertReservedWorkspaceForControlLineCandidate({
        ...reserved,
        status: "CANCELED" as const,
      }),
    ).toThrow(OperatingControlLineCandidateReservedOnlyError);
  });

  it("passes for active reserved", () => {
    expect(() =>
      assertReservedWorkspaceForControlLineCandidate(reserved),
    ).not.toThrow();
  });
});

describe("mapControlLineCandidateRow", () => {
  it("parses resourceInputs and evidenceNotes JSON", () => {
    const r = mapControlLineCandidateRow(row({}) as never);
    expect(r.resourceInputs).toEqual(["CRM"]);
    expect(r.evidenceNotes).toHaveLength(1);
    expect(r.evidenceNotes[0].origin).toBe("sales_intake");
  });

  it("returns empty arrays for malformed JSON", () => {
    const r = mapControlLineCandidateRow(
      row({
        resourceInputsJson: "not-json",
        evidenceNotesJson: "{not-json",
      }) as never,
    );
    expect(r.resourceInputs).toEqual([]);
    expect(r.evidenceNotes).toEqual([]);
  });
});

describe("listControlLineCandidatesForReservedWorkspace", () => {
  it("rejects customer workspaces before db", async () => {
    await expect(() =>
      listControlLineCandidatesForReservedWorkspace({
        workspace: customer,
        workspaceId: "ws-1",
      }),
    ).rejects.toBeInstanceOf(OperatingControlLineCandidateReservedOnlyError);
    expect(mockCandidate.findMany).not.toHaveBeenCalled();
  });

  it("filters by status + briefId; default take=50", async () => {
    mockCandidate.findMany.mockResolvedValue([row({})]);
    await listControlLineCandidatesForReservedWorkspace({
      workspace: reserved,
      workspaceId: "ws-1",
      status: "REVIEW_REQUIRED",
      briefId: "brief-1",
    });
    const args = mockCandidate.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      workspaceId: "ws-1",
      status: "REVIEW_REQUIRED",
      briefId: "brief-1",
    });
    expect(args.take).toBe(50);
    expect(args.orderBy).toEqual({ updatedAt: "desc" });
  });
});

describe("getControlLineCandidateByKey", () => {
  it("returns null when not found", async () => {
    mockCandidate.findUnique.mockResolvedValue(null);
    const r = await getControlLineCandidateByKey({
      workspace: reserved,
      workspaceId: "ws-1",
      candidateKey: "missing",
    });
    expect(r).toBeNull();
  });

  it("uses (workspaceId, candidateKey) compound key", async () => {
    mockCandidate.findUnique.mockResolvedValue(row({}));
    await getControlLineCandidateByKey({
      workspace: reserved,
      workspaceId: "ws-1",
      candidateKey: "cand-1",
    });
    expect(mockCandidate.findUnique.mock.calls[0][0].where).toEqual({
      workspaceId_candidateKey: {
        workspaceId: "ws-1",
        candidateKey: "cand-1",
      },
    });
  });
});

describe("countControlLineCandidatesByStatus", () => {
  it("aggregates groupBy results", async () => {
    mockCandidate.groupBy.mockResolvedValue([
      { status: "DRAFT", _count: { _all: 2 } },
      { status: "TRIAL_PREMISE", _count: { _all: 1 } },
    ]);
    const counts = await countControlLineCandidatesByStatus({
      workspace: reserved,
      workspaceId: "ws-1",
    });
    expect(counts.DRAFT).toBe(2);
    expect(counts.TRIAL_PREMISE).toBe(1);
  });
});
