import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDS } = vi.hoisted(() => ({
  mockDS: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { diagnosticSession: mockDS },
}));

vi.mock("server-only", () => ({}));

import {
  DiagnosticSessionFirstLoopGateError,
  DiagnosticSessionReservedOnlyError,
  DiagnosticSessionStatusTransitionError,
  createDiagnosticSession,
  updateDiagnosticSessionFindings,
  updateDiagnosticSessionStatus,
} from "./actions";
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
    briefId: null,
    controlLineCandidateId: null,
    diagnosticKey: "diag-1",
    workspaceCandidate: null,
    businessGoal: "提升续费率",
    availableResourcesJson: JSON.stringify(["CRM"]),
    roleReadinessJson: JSON.stringify(emptyRoleReadiness()),
    firstLoopCandidateType: null,
    firstLoopCandidateNote: null,
    riskNotesJson: JSON.stringify([]),
    boundaryNotesJson: JSON.stringify([]),
    status: "DRAFT",
    reviewerActor: null,
    reviewerDecisionNote: null,
    sourceTraceJson: JSON.stringify([]),
    createdAt: new Date("2026-05-12T00:00:00.000Z"),
    updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockDS.create.mockReset();
  mockDS.update.mockReset();
  mockDS.findUnique.mockReset();
});

describe("reserved-only gating", () => {
  it("blocks customer tenants", async () => {
    await expect(() =>
      createDiagnosticSession({
        workspace: customer,
        data: {
          workspaceId: "ws-1",
          leadId: "lead-1",
          diagnosticKey: "diag-1",
          businessGoal: "x",
        },
      }),
    ).rejects.toBeInstanceOf(DiagnosticSessionReservedOnlyError);
  });
});

describe("createDiagnosticSession", () => {
  it("creates with DRAFT status and empty defaults", async () => {
    mockDS.create.mockResolvedValue(row({}));
    await createDiagnosticSession({
      workspace: reserved,
      data: {
        workspaceId: "ws-1",
        leadId: "lead-1",
        diagnosticKey: "  diag-1  ",
        businessGoal: "  提升续费率  ",
        availableResources: ["CRM", "表格"],
      },
    });
    const args = mockDS.create.mock.calls[0][0];
    expect(args.data.diagnosticKey).toBe("diag-1");
    expect(args.data.businessGoal).toBe("提升续费率");
    expect(args.data.status).toBe("DRAFT");
    expect(JSON.parse(args.data.availableResourcesJson)).toEqual(["CRM", "表格"]);
    expect(args.data.firstLoopCandidateType).toBeNull();
  });

  it("requires non-empty mandatory fields", async () => {
    await expect(() =>
      createDiagnosticSession({
        workspace: reserved,
        data: {
          workspaceId: "ws-1",
          leadId: "lead-1",
          diagnosticKey: " ",
          businessGoal: "x",
        },
      }),
    ).rejects.toThrow(/diagnosticKey is required/);
    await expect(() =>
      createDiagnosticSession({
        workspace: reserved,
        data: {
          workspaceId: "ws-1",
          leadId: "lead-1",
          diagnosticKey: "diag-1",
          businessGoal: " ",
        },
      }),
    ).rejects.toThrow(/businessGoal is required/);
  });
});

describe("updateDiagnosticSessionFindings", () => {
  it("requires a note (V2.3 §10.10 append-first)", async () => {
    await expect(() =>
      updateDiagnosticSessionFindings({
        workspace: reserved,
        workspaceId: "ws-1",
        diagnosticKey: "diag-1",
        patch: { workspaceCandidate: "ws-trial-x" },
        actor: "x",
        note: " ",
      }),
    ).rejects.toThrow(/note is required/);
  });

  it("returns existing row when patch is empty (no writes)", async () => {
    mockDS.findUnique.mockResolvedValue(row({}));
    await updateDiagnosticSessionFindings({
      workspace: reserved,
      workspaceId: "ws-1",
      diagnosticKey: "diag-1",
      patch: {},
      actor: "x",
      note: "syncing",
    });
    expect(mockDS.update).not.toHaveBeenCalled();
  });

  it("appends intake_sync source trace on valid patch", async () => {
    mockDS.findUnique.mockResolvedValue(
      row({ sourceTraceJson: JSON.stringify([]) }),
    );
    mockDS.update.mockResolvedValue(row({ firstLoopCandidateType: "LEAD_FOLLOW_UP" }));
    await updateDiagnosticSessionFindings({
      workspace: reserved,
      workspaceId: "ws-1",
      diagnosticKey: "diag-1",
      patch: {
        firstLoopCandidateType: "LEAD_FOLLOW_UP",
        firstLoopCandidateNote: "选这条因为线索量足",
      },
      actor: "reviewer-1",
      note: "选定 first loop 候选",
    });
    const args = mockDS.update.mock.calls[0][0];
    expect(args.data.firstLoopCandidateType).toBe("LEAD_FOLLOW_UP");
    expect(args.data.firstLoopCandidateNote).toBe("选这条因为线索量足");
    const trace = JSON.parse(args.data.sourceTraceJson);
    expect(trace).toHaveLength(1);
    expect(trace[0].origin).toBe("intake_sync");
  });

  it("can null out firstLoopCandidateType when caller passes null explicitly", async () => {
    mockDS.findUnique.mockResolvedValue(
      row({ firstLoopCandidateType: "LEAD_FOLLOW_UP", sourceTraceJson: JSON.stringify([]) }),
    );
    mockDS.update.mockResolvedValue(row({ firstLoopCandidateType: null }));
    await updateDiagnosticSessionFindings({
      workspace: reserved,
      workspaceId: "ws-1",
      diagnosticKey: "diag-1",
      patch: { firstLoopCandidateType: null },
      actor: "reviewer-1",
      note: "撤回 first loop 选择",
    });
    const args = mockDS.update.mock.calls[0][0];
    expect(args.data.firstLoopCandidateType).toBeNull();
  });
});

describe("updateDiagnosticSessionStatus", () => {
  it("requires both reviewerActor and reviewerDecisionNote", async () => {
    await expect(() =>
      updateDiagnosticSessionStatus({
        workspace: reserved,
        workspaceId: "ws-1",
        diagnosticKey: "diag-1",
        nextStatus: "REVIEWED",
        reviewerActor: " ",
        reviewerDecisionNote: "x",
      }),
    ).rejects.toThrow(/reviewerActor is required/);
    await expect(() =>
      updateDiagnosticSessionStatus({
        workspace: reserved,
        workspaceId: "ws-1",
        diagnosticKey: "diag-1",
        nextStatus: "REVIEWED",
        reviewerActor: "x",
        reviewerDecisionNote: " ",
      }),
    ).rejects.toThrow(/reviewerDecisionNote is required/);
  });

  it("rejects forbidden transitions", async () => {
    mockDS.findUnique.mockResolvedValue(row({ status: "DRAFT" }));
    await expect(() =>
      updateDiagnosticSessionStatus({
        workspace: reserved,
        workspaceId: "ws-1",
        diagnosticKey: "diag-1",
        nextStatus: "FIRST_LOOP_SELECTED",
        reviewerActor: "reviewer-1",
        reviewerDecisionNote: "trying to skip review",
      }),
    ).rejects.toBeInstanceOf(DiagnosticSessionStatusTransitionError);
  });

  it("rejects FIRST_LOOP_SELECTED when 4 dimensions or firstLoopCandidateType missing", async () => {
    mockDS.findUnique.mockResolvedValue(
      row({
        status: "REVIEWED",
        roleReadinessJson: JSON.stringify(emptyRoleReadiness()),
        firstLoopCandidateType: null,
      }),
    );
    await expect(() =>
      updateDiagnosticSessionStatus({
        workspace: reserved,
        workspaceId: "ws-1",
        diagnosticKey: "diag-1",
        nextStatus: "FIRST_LOOP_SELECTED",
        reviewerActor: "reviewer-1",
        reviewerDecisionNote: "skip the gate",
      }),
    ).rejects.toBeInstanceOf(DiagnosticSessionFirstLoopGateError);
  });

  it("promotes to FIRST_LOOP_SELECTED when the gate is satisfied", async () => {
    const fullReadiness = emptyRoleReadiness();
    fullReadiness.businessGoalClear = true;
    fullReadiness.resourcesConnectable = true;
    fullReadiness.firstLoopAvailable = true;
    fullReadiness.proofCollectionReady = true;
    mockDS.findUnique.mockResolvedValue(
      row({
        status: "REVIEWED",
        roleReadinessJson: JSON.stringify(fullReadiness),
        firstLoopCandidateType: "LEAD_FOLLOW_UP",
        sourceTraceJson: JSON.stringify([]),
      }),
    );
    mockDS.update.mockResolvedValue(row({ status: "FIRST_LOOP_SELECTED" }));
    await updateDiagnosticSessionStatus({
      workspace: reserved,
      workspaceId: "ws-1",
      diagnosticKey: "diag-1",
      nextStatus: "FIRST_LOOP_SELECTED",
      reviewerActor: "reviewer-1",
      reviewerDecisionNote: "证据齐备，选 LEAD_FOLLOW_UP",
    });
    const args = mockDS.update.mock.calls[0][0];
    expect(args.data.status).toBe("FIRST_LOOP_SELECTED");
    const trace = JSON.parse(args.data.sourceTraceJson);
    expect(trace[0].origin).toBe("internal_review");
    expect(trace[0].note).toContain("REVIEWED → FIRST_LOOP_SELECTED");
  });
});
