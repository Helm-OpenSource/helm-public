import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCandidate } = vi.hoisted(() => ({
  mockCandidate: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { operatingControlLineCandidate: mockCandidate },
}));

vi.mock("server-only", () => ({}));

import {
  ControlLineStatusTransitionError,
  EvidenceReadinessTransitionError,
  OperatingControlLineCandidateReservedOnlyError,
  TrialPremiseRequiresVerifiedEvidenceError,
  createControlLineCandidate,
  updateControlLineCandidateStatus,
  updateEvidenceReadiness,
} from "./actions";

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
    resourceInputsJson: JSON.stringify(["CRM", "表格"]),
    evidenceReadiness: "DECLARED",
    status: "DRAFT",
    evidenceNotesJson: JSON.stringify([]),
    reviewerNotes: null,
    createdAt: new Date("2026-05-12T00:00:00.000Z"),
    updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockCandidate.create.mockReset();
  mockCandidate.update.mockReset();
  mockCandidate.findUnique.mockReset();
});

describe("reserved-only gating", () => {
  it("blocks customer tenants", async () => {
    await expect(() =>
      createControlLineCandidate({
        workspace: customer,
        data: {
          workspaceId: "ws-1",
          briefId: "brief-1",
          candidateKey: "cand-1",
          painTag: "线索跟进混乱",
          controlLineTemplate: "LEAD_FOLLOW_UP",
          targetBusinessObject: "销售线索",
        },
      }),
    ).rejects.toBeInstanceOf(OperatingControlLineCandidateReservedOnlyError);
  });

  it("blocks canceled reserved workspaces", async () => {
    await expect(() =>
      updateEvidenceReadiness({
        workspace: { ...reserved, status: "CANCELED" as const },
        workspaceId: "ws-1",
        candidateKey: "cand-1",
        nextReadiness: "PARTIAL",
        actor: "x",
        origin: "sales_intake",
        note: "x",
      }),
    ).rejects.toBeInstanceOf(OperatingControlLineCandidateReservedOnlyError);
  });
});

describe("createControlLineCandidate", () => {
  it("forces DECLARED + DRAFT initial state regardless of caller intent", async () => {
    mockCandidate.create.mockResolvedValue(row({}));
    await createControlLineCandidate({
      workspace: reserved,
      data: {
        workspaceId: "ws-1",
        briefId: "brief-1",
        candidateKey: "cand-1",
        painTag: "线索跟进混乱",
        controlLineTemplate: "LEAD_FOLLOW_UP",
        targetBusinessObject: "销售线索",
        resourceInputs: ["CRM", "表格"],
      },
    });
    const args = mockCandidate.create.mock.calls[0][0];
    expect(args.data.evidenceReadiness).toBe("DECLARED");
    expect(args.data.status).toBe("DRAFT");
    expect(JSON.parse(args.data.resourceInputsJson)).toEqual(["CRM", "表格"]);
    expect(JSON.parse(args.data.evidenceNotesJson)).toEqual([]);
  });

  it("requires non-empty mandatory fields", async () => {
    await expect(() =>
      createControlLineCandidate({
        workspace: reserved,
        data: {
          workspaceId: "ws-1",
          briefId: "brief-1",
          candidateKey: " ",
          painTag: "x",
          controlLineTemplate: "LEAD_FOLLOW_UP",
          targetBusinessObject: "y",
        },
      }),
    ).rejects.toThrow(/candidateKey is required/);
  });
});

describe("updateEvidenceReadiness", () => {
  it("rejects forbidden transition (VERIFIED → DECLARED)", async () => {
    mockCandidate.findUnique.mockResolvedValue(row({ evidenceReadiness: "VERIFIED" }));
    await expect(() =>
      updateEvidenceReadiness({
        workspace: reserved,
        workspaceId: "ws-1",
        candidateKey: "cand-1",
        nextReadiness: "DECLARED",
        actor: "reviewer-1",
        origin: "internal_review",
        note: "trying to wipe verified",
      }),
    ).rejects.toBeInstanceOf(EvidenceReadinessTransitionError);
  });

  it("refuses VERIFIED set from non-internal_review origin (V2.3 §10.8)", async () => {
    mockCandidate.findUnique.mockResolvedValue(row({ evidenceReadiness: "READY" }));
    await expect(() =>
      updateEvidenceReadiness({
        workspace: reserved,
        workspaceId: "ws-1",
        candidateKey: "cand-1",
        nextReadiness: "VERIFIED",
        actor: "customer@x",
        origin: "customer_confirmation",
        note: "customer says verified",
      }),
    ).rejects.toThrow(/internal_review/);
  });

  it("appends evidence note with before/after readiness on valid transition", async () => {
    mockCandidate.findUnique.mockResolvedValue(
      row({ evidenceReadiness: "DECLARED", evidenceNotesJson: JSON.stringify([]) }),
    );
    mockCandidate.update.mockResolvedValue(row({ evidenceReadiness: "PARTIAL" }));
    await updateEvidenceReadiness({
      workspace: reserved,
      workspaceId: "ws-1",
      candidateKey: "cand-1",
      nextReadiness: "PARTIAL",
      actor: "sales-rep-1",
      origin: "sales_intake",
      note: "拿到 5 个样本",
    });
    const args = mockCandidate.update.mock.calls[0][0];
    expect(args.data.evidenceReadiness).toBe("PARTIAL");
    const notes = JSON.parse(args.data.evidenceNotesJson);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      origin: "sales_intake",
      actor: "sales-rep-1",
      beforeReadiness: "DECLARED",
      afterReadiness: "PARTIAL",
    });
  });

  it("auto-downgrades TRIAL_PREMISE to REVIEW_REQUIRED when readiness drops to DECLARED/PARTIAL", async () => {
    mockCandidate.findUnique.mockResolvedValue(
      row({ status: "TRIAL_PREMISE", evidenceReadiness: "VERIFIED" }),
    );
    mockCandidate.update.mockResolvedValue(
      row({ status: "REVIEW_REQUIRED", evidenceReadiness: "READY" }),
    );
    // First a valid VERIFIED → READY (allowed by readiness machine).
    await updateEvidenceReadiness({
      workspace: reserved,
      workspaceId: "ws-1",
      candidateKey: "cand-1",
      nextReadiness: "READY",
      actor: "reviewer-1",
      origin: "internal_review",
      note: "证据需要重核",
    });
    // No auto downgrade for READY (still allowed evidence band).
    expect(mockCandidate.update.mock.calls[0][0].data.status).toBe("TRIAL_PREMISE");

    mockCandidate.update.mockReset();
    mockCandidate.findUnique.mockResolvedValue(
      row({ status: "TRIAL_PREMISE", evidenceReadiness: "READY" }),
    );
    mockCandidate.update.mockResolvedValue(
      row({ status: "REVIEW_REQUIRED", evidenceReadiness: "PARTIAL" }),
    );
    await updateEvidenceReadiness({
      workspace: reserved,
      workspaceId: "ws-1",
      candidateKey: "cand-1",
      nextReadiness: "PARTIAL",
      actor: "reviewer-1",
      origin: "internal_review",
      note: "样本变 partial",
    });
    expect(mockCandidate.update.mock.calls[0][0].data.status).toBe("REVIEW_REQUIRED");
  });
});

describe("updateControlLineCandidateStatus", () => {
  it("rejects forbidden transition", async () => {
    mockCandidate.findUnique.mockResolvedValue(row({ status: "DRAFT" }));
    await expect(() =>
      updateControlLineCandidateStatus({
        workspace: reserved,
        workspaceId: "ws-1",
        candidateKey: "cand-1",
        nextStatus: "TRIAL_PREMISE",
        reviewerActor: "reviewer-1",
        reasonNote: "trying to skip review",
      }),
    ).rejects.toBeInstanceOf(ControlLineStatusTransitionError);
  });

  it("rejects TRIAL_PREMISE when evidence is not VERIFIED", async () => {
    mockCandidate.findUnique.mockResolvedValue(
      row({ status: "REVIEW_REQUIRED", evidenceReadiness: "READY" }),
    );
    await expect(() =>
      updateControlLineCandidateStatus({
        workspace: reserved,
        workspaceId: "ws-1",
        candidateKey: "cand-1",
        nextStatus: "TRIAL_PREMISE",
        reviewerActor: "reviewer-1",
        reasonNote: "let's go",
      }),
    ).rejects.toBeInstanceOf(TrialPremiseRequiresVerifiedEvidenceError);
    expect(mockCandidate.update).not.toHaveBeenCalled();
  });

  it("requires a reasonNote", async () => {
    await expect(() =>
      updateControlLineCandidateStatus({
        workspace: reserved,
        workspaceId: "ws-1",
        candidateKey: "cand-1",
        nextStatus: "REVIEW_REQUIRED",
        reviewerActor: "reviewer-1",
        reasonNote: " ",
      }),
    ).rejects.toThrow(/reasonNote is required/);
  });

  it("promotes to TRIAL_PREMISE when evidence is VERIFIED and prior is REVIEW_REQUIRED", async () => {
    mockCandidate.findUnique.mockResolvedValue(
      row({
        status: "REVIEW_REQUIRED",
        evidenceReadiness: "VERIFIED",
        evidenceNotesJson: JSON.stringify([]),
      }),
    );
    mockCandidate.update.mockResolvedValue(row({ status: "TRIAL_PREMISE" }));
    await updateControlLineCandidateStatus({
      workspace: reserved,
      workspaceId: "ws-1",
      candidateKey: "cand-1",
      nextStatus: "TRIAL_PREMISE",
      reviewerActor: "reviewer-1",
      reasonNote: "证据复核通过",
    });
    const args = mockCandidate.update.mock.calls[0][0];
    expect(args.data.status).toBe("TRIAL_PREMISE");
    expect(args.data.reviewerNotes).toContain("REVIEW_REQUIRED → TRIAL_PREMISE");
    expect(args.data.reviewerNotes).toContain("reviewer-1");
    const notes = JSON.parse(args.data.evidenceNotesJson);
    expect(notes[0].note).toContain("status: REVIEW_REQUIRED → TRIAL_PREMISE");
  });

  it("appends to existing reviewer notes (append-first)", async () => {
    mockCandidate.findUnique.mockResolvedValue(
      row({
        status: "DRAFT",
        reviewerNotes: "[2026-05-11T00:00:00Z] CAPTURED → DRAFT · sales-1: 初步整理",
        evidenceNotesJson: JSON.stringify([]),
      }),
    );
    mockCandidate.update.mockResolvedValue(row({ status: "EVIDENCE_NEEDED" }));
    await updateControlLineCandidateStatus({
      workspace: reserved,
      workspaceId: "ws-1",
      candidateKey: "cand-1",
      nextStatus: "EVIDENCE_NEEDED",
      reviewerActor: "reviewer-1",
      reasonNote: "证据不足",
    });
    const args = mockCandidate.update.mock.calls[0][0];
    expect(args.data.reviewerNotes).toContain("[2026-05-11T00:00:00Z]");
    expect(args.data.reviewerNotes).toContain("DRAFT → EVIDENCE_NEEDED");
  });
});
