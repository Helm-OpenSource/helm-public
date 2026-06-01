import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockBrief } = vi.hoisted(() => ({
  mockBrief: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { customerDemandBrief: mockBrief },
}));

vi.mock("server-only", () => ({}));

import {
  CustomerDemandBriefReservedOnlyError,
  assertReservedWorkspaceForCustomerDemandBrief,
  getCustomerDemandBriefByKey,
  listCustomerDemandBriefsForReservedWorkspace,
  mapCustomerDemandBriefRow,
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
    briefKey: "brief-1",
    entryMode: "SALES_LED",
    prefillSource: null,
    customerSummary: "Acme",
    businessPressureTagsJson: JSON.stringify(["growth-stall"]),
    currentResourceTagsJson: JSON.stringify(["CRM"]),
    resourceEvidenceReadinessJson: JSON.stringify([
      { resource: "CRM", readiness: "declared" },
    ]),
    painToControlLineCandidatesJson: JSON.stringify(["lead-follow-up"]),
    roleMapJson: JSON.stringify({
      decisionMakers: ["A"],
      endUsers: ["B"],
      executors: [],
      reviewers: [],
    }),
    firstLoopCandidatesJson: JSON.stringify(["renewal-control-line"]),
    successCriteria: "节省时间",
    riskBoundaryTagsJson: JSON.stringify(["数据不足"]),
    customerVisibleSummary: "for customer",
    internalSalesNotes: "internal stuff",
    trialInitializationPayloadJson: null,
    sourceTraceJson: JSON.stringify([
      {
        ts: "2026-05-12T00:00:00Z",
        origin: "sales_prefill",
        actor: "sales-rep",
        note: "init",
      },
    ]),
    reviewStatus: "DRAFT",
    customerConfirmationStatus: "NOT_INVITED",
    createdAt: new Date("2026-05-12T00:00:00.000Z"),
    updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockBrief.findMany.mockReset();
  mockBrief.findUnique.mockReset();
});

describe("assertReservedWorkspaceForCustomerDemandBrief", () => {
  it("throws for customer workspaces", () => {
    expect(() =>
      assertReservedWorkspaceForCustomerDemandBrief(customer),
    ).toThrow(CustomerDemandBriefReservedOnlyError);
  });

  it("throws for canceled reserved workspaces", () => {
    expect(() =>
      assertReservedWorkspaceForCustomerDemandBrief({
        ...reserved,
        status: "CANCELED" as const,
      }),
    ).toThrow(CustomerDemandBriefReservedOnlyError);
  });

  it("passes for an active reserved workspace", () => {
    expect(() => assertReservedWorkspaceForCustomerDemandBrief(reserved)).not.toThrow();
  });
});

describe("mapCustomerDemandBriefRow", () => {
  it("deserializes all JSON fields into typed shapes", () => {
    const record = mapCustomerDemandBriefRow(row({}) as never);
    expect(record.businessPressureTags).toEqual(["growth-stall"]);
    expect(record.roleMap.decisionMakers).toEqual(["A"]);
    expect(record.resourceEvidenceReadiness[0].readiness).toBe("declared");
    expect(record.sourceTrace[0].origin).toBe("sales_prefill");
    expect(record.createdAt).toBe("2026-05-12T00:00:00.000Z");
  });

  it("returns null trial payload when JSON column is null", () => {
    const record = mapCustomerDemandBriefRow(
      row({ trialInitializationPayloadJson: null }) as never,
    );
    expect(record.trialInitializationPayload).toBeNull();
  });

  it("returns empty arrays / canonical roleMap for malformed JSON", () => {
    const record = mapCustomerDemandBriefRow(
      row({
        businessPressureTagsJson: "not-json",
        roleMapJson: "also-not-json",
      }) as never,
    );
    expect(record.businessPressureTags).toEqual([]);
    expect(record.roleMap.decisionMakers).toEqual([]);
  });
});

describe("listCustomerDemandBriefsForReservedWorkspace", () => {
  it("rejects customer workspaces before touching db", async () => {
    await expect(() =>
      listCustomerDemandBriefsForReservedWorkspace({
        workspace: customer,
        workspaceId: "ws-1",
      }),
    ).rejects.toBeInstanceOf(CustomerDemandBriefReservedOnlyError);
    expect(mockBrief.findMany).not.toHaveBeenCalled();
  });

  it("filters by reviewStatus + leadId and applies default take=50", async () => {
    mockBrief.findMany.mockResolvedValue([row({})]);
    await listCustomerDemandBriefsForReservedWorkspace({
      workspace: reserved,
      workspaceId: "ws-1",
      reviewStatus: "REVIEW_REQUIRED",
      leadId: "lead-1",
    });
    const args = mockBrief.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      workspaceId: "ws-1",
      reviewStatus: "REVIEW_REQUIRED",
      leadId: "lead-1",
    });
    expect(args.take).toBe(50);
    expect(args.orderBy).toEqual({ updatedAt: "desc" });
  });
});

describe("getCustomerDemandBriefByKey", () => {
  it("returns null when not found", async () => {
    mockBrief.findUnique.mockResolvedValue(null);
    const record = await getCustomerDemandBriefByKey({
      workspace: reserved,
      workspaceId: "ws-1",
      briefKey: "missing",
    });
    expect(record).toBeNull();
  });

  it("uses (workspaceId, briefKey) compound unique key", async () => {
    mockBrief.findUnique.mockResolvedValue(row({}));
    await getCustomerDemandBriefByKey({
      workspace: reserved,
      workspaceId: "ws-1",
      briefKey: "brief-1",
    });
    expect(mockBrief.findUnique.mock.calls[0][0].where).toEqual({
      workspaceId_briefKey: { workspaceId: "ws-1", briefKey: "brief-1" },
    });
  });
});
