import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGtmLead } = vi.hoisted(() => ({
  mockGtmLead: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { gtmLead: mockGtmLead },
}));

vi.mock("server-only", () => ({}));

import {
  GtmLeadReservedOnlyError,
  GtmLeadStageTransitionError,
  createGtmLead,
  updateGtmLeadDetails,
  updateGtmLeadStage,
} from "./actions";

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
    id: "row-id",
    workspaceId: "ws-1",
    leadKey: "lead-key",
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
  mockGtmLead.create.mockReset();
  mockGtmLead.update.mockReset();
  mockGtmLead.findUnique.mockReset();
});

describe("reserved-only gating", () => {
  it("throws GtmLeadReservedOnlyError when caller is a customer tenant", async () => {
    await expect(() =>
      createGtmLead({
        workspace: customerWorkspace,
        data: {
          workspaceId: "ws-1",
          leadKey: "k",
          sourceType: "REFERRAL",
          companyName: "Acme",
        },
      }),
    ).rejects.toBeInstanceOf(GtmLeadReservedOnlyError);
    expect(mockGtmLead.create).not.toHaveBeenCalled();
  });

  it("throws when reserved workspace is canceled", async () => {
    await expect(() =>
      createGtmLead({
        workspace: { ...reservedWorkspace, status: "CANCELED" as const },
        data: {
          workspaceId: "ws-1",
          leadKey: "k",
          sourceType: "REFERRAL",
          companyName: "Acme",
        },
      }),
    ).rejects.toBeInstanceOf(GtmLeadReservedOnlyError);
  });
});

describe("createGtmLead", () => {
  it("requires non-empty leadKey and companyName", async () => {
    await expect(() =>
      createGtmLead({
        workspace: reservedWorkspace,
        data: {
          workspaceId: "ws-1",
          leadKey: "  ",
          sourceType: "REFERRAL",
          companyName: "Acme",
        },
      }),
    ).rejects.toThrow(/leadKey is required/);
    await expect(() =>
      createGtmLead({
        workspace: reservedWorkspace,
        data: {
          workspaceId: "ws-1",
          leadKey: "k",
          sourceType: "REFERRAL",
          companyName: "  ",
        },
      }),
    ).rejects.toThrow(/companyName is required/);
  });

  it("creates with sensible defaults and trims free-text fields", async () => {
    mockGtmLead.create.mockResolvedValue(
      row({ companyName: "Acme", leadKey: "lead-1" }),
    );
    const result = await createGtmLead({
      workspace: reservedWorkspace,
      data: {
        workspaceId: "ws-1",
        leadKey: "  lead-1  ",
        sourceType: "REFERRAL",
        companyName: "  Acme  ",
        industry: "  enterprise software  ",
        evidenceRefs: ["  https://a  ", "https://a", "  ", ""], // de-dup + trim
      },
    });
    expect(mockGtmLead.create).toHaveBeenCalledOnce();
    const callArgs = mockGtmLead.create.mock.calls[0][0];
    expect(callArgs.data.leadKey).toBe("lead-1");
    expect(callArgs.data.companyName).toBe("Acme");
    expect(callArgs.data.industry).toBe("enterprise software");
    expect(callArgs.data.evidenceRefsJson).toBe(JSON.stringify(["https://a"]));
    expect(callArgs.data.icpFit).toBe("UNKNOWN");
    expect(callArgs.data.stage).toBe("CAPTURED");
    expect(result.leadKey).toBe("lead-1");
  });
});

describe("updateGtmLeadStage", () => {
  it("requires a reason note (V2.3 §10.10 append-first source trace)", async () => {
    await expect(() =>
      updateGtmLeadStage({
        workspace: reservedWorkspace,
        workspaceId: "ws-1",
        leadKey: "lead-1",
        nextStage: "QUALIFIED",
        reasonNote: "  ",
      }),
    ).rejects.toThrow(/reasonNote is required/);
  });

  it("rejects an invalid transition via GtmLeadStageTransitionError", async () => {
    mockGtmLead.findUnique.mockResolvedValue(row({ stage: "CAPTURED" }));
    await expect(() =>
      updateGtmLeadStage({
        workspace: reservedWorkspace,
        workspaceId: "ws-1",
        leadKey: "lead-1",
        nextStage: "CONVERTED",
        reasonNote: "trying to skip phases",
      }),
    ).rejects.toBeInstanceOf(GtmLeadStageTransitionError);
    expect(mockGtmLead.update).not.toHaveBeenCalled();
  });

  it("applies a valid transition and appends the reason note to internalNotes", async () => {
    mockGtmLead.findUnique.mockResolvedValue(
      row({ stage: "CAPTURED", internalNotes: "previous note" }),
    );
    mockGtmLead.update.mockResolvedValue(
      row({ stage: "QUALIFIED", internalNotes: "previous note\n[2026-05-12...] CAPTURED → QUALIFIED: ok" }),
    );
    const result = await updateGtmLeadStage({
      workspace: reservedWorkspace,
      workspaceId: "ws-1",
      leadKey: "lead-1",
      nextStage: "QUALIFIED",
      reasonNote: "discovery call confirms ICP",
    });
    expect(mockGtmLead.update).toHaveBeenCalledOnce();
    const updateArgs = mockGtmLead.update.mock.calls[0][0];
    expect(updateArgs.data.stage).toBe("QUALIFIED");
    expect(updateArgs.data.internalNotes).toContain("previous note");
    expect(updateArgs.data.internalNotes).toContain("CAPTURED → QUALIFIED");
    expect(updateArgs.data.internalNotes).toContain("discovery call confirms ICP");
    expect(result.stage).toBe("QUALIFIED");
  });

  it("returns gracefully when row missing", async () => {
    mockGtmLead.findUnique.mockResolvedValue(null);
    await expect(() =>
      updateGtmLeadStage({
        workspace: reservedWorkspace,
        workspaceId: "ws-1",
        leadKey: "missing",
        nextStage: "QUALIFIED",
        reasonNote: "x",
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("updateGtmLeadDetails", () => {
  it("refuses to be used as a stage-change backdoor", async () => {
    await expect(() =>
      updateGtmLeadDetails({
        workspace: reservedWorkspace,
        workspaceId: "ws-1",
        leadKey: "lead-1",
        patch: { stage: "QUALIFIED" },
      }),
    ).rejects.toThrow(/Use updateGtmLeadStage/);
  });

  it("normalizes evidenceRefs (trim + dedup + drop empties)", async () => {
    mockGtmLead.update.mockResolvedValue(row({}));
    await updateGtmLeadDetails({
      workspace: reservedWorkspace,
      workspaceId: "ws-1",
      leadKey: "lead-1",
      patch: { evidenceRefs: ["  a  ", "a", "b", "", "  "] },
    });
    const callArgs = mockGtmLead.update.mock.calls[0][0];
    expect(callArgs.data.evidenceRefsJson).toBe(JSON.stringify(["a", "b"]));
  });

  it("returns the existing row unchanged when patch is empty", async () => {
    mockGtmLead.findUnique.mockResolvedValue(
      row({ stage: "CAPTURED", companyName: "Acme" }),
    );
    const result = await updateGtmLeadDetails({
      workspace: reservedWorkspace,
      workspaceId: "ws-1",
      leadKey: "lead-1",
      patch: {},
    });
    expect(mockGtmLead.update).not.toHaveBeenCalled();
    expect(result.companyName).toBe("Acme");
  });

  it("supports partial patches without touching unaffected fields", async () => {
    mockGtmLead.update.mockResolvedValue(
      row({ icpFit: "STRONG", readinessStage: "PILOT_READY" }),
    );
    await updateGtmLeadDetails({
      workspace: reservedWorkspace,
      workspaceId: "ws-1",
      leadKey: "lead-1",
      patch: { icpFit: "STRONG", readinessStage: "PILOT_READY" },
    });
    const callArgs = mockGtmLead.update.mock.calls[0][0];
    expect(callArgs.data).toEqual({
      icpFit: "STRONG",
      readinessStage: "PILOT_READY",
    });
  });
});
