import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUR } = vi.hoisted(() => ({
  mockUR: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { customerContextUpdateRequest: mockUR },
}));

vi.mock("server-only", () => ({}));

import {
  CustomerContextUpdateRequestReservedOnlyError,
  assertReservedWorkspaceForCustomerContextUpdateRequest,
  getCustomerContextUpdateRequestByKey,
  listCustomerContextUpdateRequestsForReservedWorkspace,
  mapCustomerContextUpdateRequestRow,
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
    leadId: "lead-1",
    briefId: "brief-1",
    controlLineCandidateId: "cand-1",
    requestKey: "req-1",
    origin: "CUSTOMER",
    scope: "ROLES",
    proposedChangesJson: JSON.stringify({ roles: { decisionMakers: ["X"] } }),
    materiality: "MINOR",
    reviewStatus: "DIRECT_APPLY",
    reviewerActor: null,
    reviewerDecisionNote: null,
    appliedAt: new Date("2026-05-12T00:00:00.000Z"),
    supersededByRequestId: null,
    sourceTraceJson: JSON.stringify([
      { ts: "2026-05-12T00:00:00Z", origin: "customer_in_usage_supplement", actor: "customer", note: "init" },
    ]),
    createdAt: new Date("2026-05-12T00:00:00.000Z"),
    updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockUR.findMany.mockReset();
  mockUR.findUnique.mockReset();
});

describe("assertReservedWorkspaceForCustomerContextUpdateRequest", () => {
  it("throws for customer tenants", () => {
    expect(() =>
      assertReservedWorkspaceForCustomerContextUpdateRequest(customer),
    ).toThrow(CustomerContextUpdateRequestReservedOnlyError);
  });
  it("throws for canceled reserved workspaces", () => {
    expect(() =>
      assertReservedWorkspaceForCustomerContextUpdateRequest({
        ...reserved,
        status: "CANCELED" as const,
      }),
    ).toThrow(CustomerContextUpdateRequestReservedOnlyError);
  });
  it("passes for active reserved", () => {
    expect(() =>
      assertReservedWorkspaceForCustomerContextUpdateRequest(reserved),
    ).not.toThrow();
  });
});

describe("mapCustomerContextUpdateRequestRow", () => {
  it("parses proposedChanges and sourceTrace JSON", () => {
    const r = mapCustomerContextUpdateRequestRow(row({}) as never);
    expect(r.proposedChanges).toEqual({ roles: { decisionMakers: ["X"] } });
    expect(r.sourceTrace).toHaveLength(1);
    expect(r.sourceTrace[0].origin).toBe("customer_in_usage_supplement");
  });

  it("converts appliedAt to ISO string when present, null otherwise", () => {
    expect(mapCustomerContextUpdateRequestRow(row({}) as never).appliedAt).toBe(
      "2026-05-12T00:00:00.000Z",
    );
    expect(
      mapCustomerContextUpdateRequestRow(row({ appliedAt: null }) as never).appliedAt,
    ).toBeNull();
  });

  it("returns empty objects/arrays for malformed JSON", () => {
    const r = mapCustomerContextUpdateRequestRow(
      row({
        proposedChangesJson: "not-json",
        sourceTraceJson: "not-json",
      }) as never,
    );
    expect(r.proposedChanges).toEqual({});
    expect(r.sourceTrace).toEqual([]);
  });
});

describe("listCustomerContextUpdateRequestsForReservedWorkspace", () => {
  it("rejects customer workspaces before db", async () => {
    await expect(() =>
      listCustomerContextUpdateRequestsForReservedWorkspace({
        workspace: customer,
        workspaceId: "ws-1",
      }),
    ).rejects.toBeInstanceOf(CustomerContextUpdateRequestReservedOnlyError);
  });

  it("filters by reviewStatus + briefId + leadId; default take=50", async () => {
    mockUR.findMany.mockResolvedValue([row({})]);
    await listCustomerContextUpdateRequestsForReservedWorkspace({
      workspace: reserved,
      workspaceId: "ws-1",
      reviewStatus: "REVIEW_REQUIRED",
      briefId: "brief-1",
      leadId: "lead-1",
    });
    const args = mockUR.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      workspaceId: "ws-1",
      reviewStatus: "REVIEW_REQUIRED",
      briefId: "brief-1",
      leadId: "lead-1",
    });
    expect(args.take).toBe(50);
    expect(args.orderBy).toEqual({ updatedAt: "desc" });
  });
});

describe("getCustomerContextUpdateRequestByKey", () => {
  it("returns null when missing", async () => {
    mockUR.findUnique.mockResolvedValue(null);
    const r = await getCustomerContextUpdateRequestByKey({
      workspace: reserved,
      workspaceId: "ws-1",
      requestKey: "missing",
    });
    expect(r).toBeNull();
  });

  it("uses (workspaceId, requestKey) compound key", async () => {
    mockUR.findUnique.mockResolvedValue(row({}));
    await getCustomerContextUpdateRequestByKey({
      workspace: reserved,
      workspaceId: "ws-1",
      requestKey: "req-1",
    });
    expect(mockUR.findUnique.mock.calls[0][0].where).toEqual({
      workspaceId_requestKey: { workspaceId: "ws-1", requestKey: "req-1" },
    });
  });
});
