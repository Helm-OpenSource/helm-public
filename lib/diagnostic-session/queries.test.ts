import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDS } = vi.hoisted(() => ({
  mockDS: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { diagnosticSession: mockDS },
}));

vi.mock("server-only", () => ({}));

import {
  DiagnosticSessionReservedOnlyError,
  assertReservedWorkspaceForDiagnosticSession,
  getDiagnosticSessionByKey,
  listDiagnosticSessionsForReservedWorkspace,
  mapDiagnosticSessionRow,
} from "./queries";
import { emptyRoleReadiness } from "./types";

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
    diagnosticKey: "diag-1",
    workspaceCandidate: "ws-trial-x",
    businessGoal: "提升续费率",
    availableResourcesJson: JSON.stringify(["CRM"]),
    roleReadinessJson: JSON.stringify(emptyRoleReadiness()),
    firstLoopCandidateType: "LEAD_FOLLOW_UP",
    firstLoopCandidateNote: "lead 量足",
    riskNotesJson: JSON.stringify(["数据样本不足"]),
    boundaryNotesJson: JSON.stringify(["试点客户 ≠ 所有客户"]),
    status: "REVIEWED",
    reviewerActor: "reviewer-1",
    reviewerDecisionNote: "evidence ready",
    sourceTraceJson: JSON.stringify([
      { ts: "2026-05-12T00:00:00Z", origin: "intake_sync", actor: "sales-1", note: "init" },
    ]),
    createdAt: new Date("2026-05-12T00:00:00.000Z"),
    updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockDS.findMany.mockReset();
  mockDS.findUnique.mockReset();
});

describe("assertReservedWorkspaceForDiagnosticSession", () => {
  it("throws for customer tenants", () => {
    expect(() =>
      assertReservedWorkspaceForDiagnosticSession(customer),
    ).toThrow(DiagnosticSessionReservedOnlyError);
  });
  it("throws for canceled reserved workspaces", () => {
    expect(() =>
      assertReservedWorkspaceForDiagnosticSession({
        ...reserved,
        status: "CANCELED" as const,
      }),
    ).toThrow(DiagnosticSessionReservedOnlyError);
  });
  it("passes for active reserved", () => {
    expect(() =>
      assertReservedWorkspaceForDiagnosticSession(reserved),
    ).not.toThrow();
  });
});

describe("mapDiagnosticSessionRow", () => {
  it("parses all JSON columns into typed shapes", () => {
    const r = mapDiagnosticSessionRow(row({}) as never);
    expect(r.availableResources).toEqual(["CRM"]);
    expect(r.roleReadiness).toEqual(emptyRoleReadiness());
    expect(r.riskNotes).toEqual(["数据样本不足"]);
    expect(r.boundaryNotes).toEqual(["试点客户 ≠ 所有客户"]);
    expect(r.sourceTrace[0].origin).toBe("intake_sync");
    expect(r.firstLoopCandidateType).toBe("LEAD_FOLLOW_UP");
    expect(r.status).toBe("REVIEWED");
  });

  it("falls back to empty readiness when roleReadinessJson is malformed", () => {
    const r = mapDiagnosticSessionRow(
      row({ roleReadinessJson: "not-json" }) as never,
    );
    expect(r.roleReadiness).toEqual(emptyRoleReadiness());
  });
});

describe("listDiagnosticSessionsForReservedWorkspace", () => {
  it("rejects customer workspaces before db", async () => {
    await expect(() =>
      listDiagnosticSessionsForReservedWorkspace({
        workspace: customer,
        workspaceId: "ws-1",
      }),
    ).rejects.toBeInstanceOf(DiagnosticSessionReservedOnlyError);
  });

  it("filters by status + leadId; default take=50", async () => {
    mockDS.findMany.mockResolvedValue([row({})]);
    await listDiagnosticSessionsForReservedWorkspace({
      workspace: reserved,
      workspaceId: "ws-1",
      status: "REVIEWED",
      leadId: "lead-1",
    });
    const args = mockDS.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      workspaceId: "ws-1",
      status: "REVIEWED",
      leadId: "lead-1",
    });
    expect(args.take).toBe(50);
    expect(args.orderBy).toEqual({ updatedAt: "desc" });
  });
});

describe("getDiagnosticSessionByKey", () => {
  it("returns null when missing", async () => {
    mockDS.findUnique.mockResolvedValue(null);
    const r = await getDiagnosticSessionByKey({
      workspace: reserved,
      workspaceId: "ws-1",
      diagnosticKey: "missing",
    });
    expect(r).toBeNull();
  });

  it("uses (workspaceId, diagnosticKey) compound key", async () => {
    mockDS.findUnique.mockResolvedValue(row({}));
    await getDiagnosticSessionByKey({
      workspace: reserved,
      workspaceId: "ws-1",
      diagnosticKey: "diag-1",
    });
    expect(mockDS.findUnique.mock.calls[0][0].where).toEqual({
      workspaceId_diagnosticKey: {
        workspaceId: "ws-1",
        diagnosticKey: "diag-1",
      },
    });
  });
});
