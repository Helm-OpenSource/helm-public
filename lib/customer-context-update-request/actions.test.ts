import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUR } = vi.hoisted(() => ({
  mockUR: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { customerContextUpdateRequest: mockUR },
}));

vi.mock("server-only", () => ({}));

import {
  CustomerContextUpdateRequestForbiddenChangeError,
  CustomerContextUpdateRequestReservedOnlyError,
  CustomerContextUpdateRequestReviewTransitionError,
  createCustomerContextUpdateRequest,
  resolveCustomerContextUpdateRequestReview,
  supersedeCustomerContextUpdateRequest,
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
    sourceTraceJson: JSON.stringify([]),
    createdAt: new Date("2026-05-12T00:00:00.000Z"),
    updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockUR.create.mockReset();
  mockUR.update.mockReset();
  mockUR.findUnique.mockReset();
});

describe("reserved-only gating", () => {
  it("blocks customer tenants", async () => {
    await expect(() =>
      createCustomerContextUpdateRequest({
        workspace: customer,
        data: {
          workspaceId: "ws-1",
          leadId: "lead-1",
          requestKey: "req-1",
          origin: "CUSTOMER",
          scope: "ROLES",
          proposedChanges: { roles: { decisionMakers: ["X"] } },
        },
      }),
    ).rejects.toBeInstanceOf(CustomerContextUpdateRequestReservedOnlyError);
  });
});

describe("createCustomerContextUpdateRequest", () => {
  it("MINOR change becomes DIRECT_APPLY immediately with appliedAt set", async () => {
    mockUR.create.mockResolvedValue(row({ scope: "ROLES", materiality: "MINOR", reviewStatus: "DIRECT_APPLY" }));
    const result = await createCustomerContextUpdateRequest({
      workspace: reserved,
      data: {
        workspaceId: "ws-1",
        leadId: "lead-1",
        briefId: "brief-1",
        requestKey: "req-1",
        origin: "CUSTOMER",
        scope: "ROLES",
        proposedChanges: { roles: { endUsers: ["NewUser"] } },
      },
    });
    const args = mockUR.create.mock.calls[0][0];
    expect(args.data.materiality).toBe("MINOR");
    expect(args.data.reviewStatus).toBe("DIRECT_APPLY");
    expect(args.data.appliedAt).toBeInstanceOf(Date);
    expect(result.acceptanceCascadeHint.shouldDowngradeBrief).toBe(false);
  });

  it("MATERIAL change (CONTROL_LINE) becomes REVIEW_REQUIRED with appliedAt=null + cascade hint", async () => {
    mockUR.create.mockResolvedValue(row({ scope: "CONTROL_LINE", materiality: "MATERIAL", reviewStatus: "REVIEW_REQUIRED", appliedAt: null }));
    const result = await createCustomerContextUpdateRequest({
      workspace: reserved,
      data: {
        workspaceId: "ws-1",
        leadId: "lead-1",
        briefId: "brief-1",
        controlLineCandidateId: "cand-1",
        requestKey: "req-1",
        origin: "CUSTOMER",
        scope: "CONTROL_LINE",
        proposedChanges: { controlLineTemplate: "RENEWAL_EXPANSION" },
      },
    });
    const args = mockUR.create.mock.calls[0][0];
    expect(args.data.materiality).toBe("MATERIAL");
    expect(args.data.reviewStatus).toBe("REVIEW_REQUIRED");
    expect(args.data.appliedAt).toBeNull();
    expect(result.acceptanceCascadeHint.shouldDowngradeBrief).toBe(true);
    expect(result.acceptanceCascadeHint.shouldDowngradeControlLine).toBe(true);
  });

  it("rejects forbidden keys (V2.3 §10.9)", async () => {
    await expect(() =>
      createCustomerContextUpdateRequest({
        workspace: reserved,
        data: {
          workspaceId: "ws-1",
          leadId: "lead-1",
          requestKey: "req-1",
          origin: "CUSTOMER",
          scope: "OTHER",
          proposedChanges: {
            roles: { x: "y" },
            internalNote: "trying to inject",
            settlement: "trying to inject",
          },
        },
      }),
    ).rejects.toBeInstanceOf(CustomerContextUpdateRequestForbiddenChangeError);
    expect(mockUR.create).not.toHaveBeenCalled();
  });

  it("rejects empty proposedChanges", async () => {
    await expect(() =>
      createCustomerContextUpdateRequest({
        workspace: reserved,
        data: {
          workspaceId: "ws-1",
          leadId: "lead-1",
          requestKey: "req-1",
          origin: "CUSTOMER",
          scope: "ROLES",
          proposedChanges: {},
        },
      }),
    ).rejects.toThrow(/at least one key/);
  });

  it("explicitMaterialityOverride forces MATERIAL even for ROLES scope", async () => {
    mockUR.create.mockResolvedValue(row({ scope: "ROLES", materiality: "MATERIAL", reviewStatus: "REVIEW_REQUIRED" }));
    const result = await createCustomerContextUpdateRequest({
      workspace: reserved,
      data: {
        workspaceId: "ws-1",
        leadId: "lead-1",
        requestKey: "req-1",
        origin: "INTERNAL",
        scope: "ROLES",
        proposedChanges: { roles: { decisionMakers: ["NewCEO"] } },
        explicitMaterialityOverride: "MATERIAL",
      },
    });
    const args = mockUR.create.mock.calls[0][0];
    expect(args.data.materiality).toBe("MATERIAL");
    expect(args.data.reviewStatus).toBe("REVIEW_REQUIRED");
    expect(result.acceptanceCascadeHint).toBeDefined();
  });
});

describe("resolveCustomerContextUpdateRequestReview", () => {
  it("rejects forbidden transitions (e.g. ACCEPTED → REJECTED)", async () => {
    mockUR.findUnique.mockResolvedValue(row({ reviewStatus: "ACCEPTED" }));
    await expect(() =>
      resolveCustomerContextUpdateRequestReview({
        workspace: reserved,
        workspaceId: "ws-1",
        requestKey: "req-1",
        decision: "REJECTED",
        reviewerActor: "reviewer-1",
        reviewerDecisionNote: "changed mind",
      }),
    ).rejects.toBeInstanceOf(CustomerContextUpdateRequestReviewTransitionError);
  });

  it("requires both reviewerActor and reviewerDecisionNote", async () => {
    await expect(() =>
      resolveCustomerContextUpdateRequestReview({
        workspace: reserved,
        workspaceId: "ws-1",
        requestKey: "req-1",
        decision: "ACCEPTED",
        reviewerActor: "  ",
        reviewerDecisionNote: "x",
      }),
    ).rejects.toThrow(/reviewerActor is required/);
    await expect(() =>
      resolveCustomerContextUpdateRequestReview({
        workspace: reserved,
        workspaceId: "ws-1",
        requestKey: "req-1",
        decision: "ACCEPTED",
        reviewerActor: "x",
        reviewerDecisionNote: "  ",
      }),
    ).rejects.toThrow(/reviewerDecisionNote is required/);
  });

  it("ACCEPT sets appliedAt and surfaces cascade hint matching the original scope", async () => {
    mockUR.findUnique.mockResolvedValue(
      row({
        scope: "RESOURCES",
        materiality: "MATERIAL",
        reviewStatus: "REVIEW_REQUIRED",
        appliedAt: null,
        sourceTraceJson: JSON.stringify([]),
      }),
    );
    mockUR.update.mockResolvedValue(row({ reviewStatus: "ACCEPTED" }));
    const result = await resolveCustomerContextUpdateRequestReview({
      workspace: reserved,
      workspaceId: "ws-1",
      requestKey: "req-1",
      decision: "ACCEPTED",
      reviewerActor: "reviewer-1",
      reviewerDecisionNote: "ok",
    });
    const args = mockUR.update.mock.calls[0][0];
    expect(args.data.reviewStatus).toBe("ACCEPTED");
    expect(args.data.appliedAt).toBeInstanceOf(Date);
    expect(result.acceptanceCascadeHint.shouldDowngradeBrief).toBe(true);
    expect(result.acceptanceCascadeHint.shouldDowngradeControlLine).toBe(true);
  });

  it("REJECT does not produce cascade hint", async () => {
    mockUR.findUnique.mockResolvedValue(
      row({
        scope: "CONTROL_LINE",
        materiality: "MATERIAL",
        reviewStatus: "REVIEW_REQUIRED",
        sourceTraceJson: JSON.stringify([]),
      }),
    );
    mockUR.update.mockResolvedValue(row({ reviewStatus: "REJECTED" }));
    const result = await resolveCustomerContextUpdateRequestReview({
      workspace: reserved,
      workspaceId: "ws-1",
      requestKey: "req-1",
      decision: "REJECTED",
      reviewerActor: "reviewer-1",
      reviewerDecisionNote: "not now",
    });
    expect(result.acceptanceCascadeHint.shouldDowngradeBrief).toBe(false);
    expect(result.acceptanceCascadeHint.shouldDowngradeControlLine).toBe(false);
  });

  it("appends an internal_review trace entry on resolve", async () => {
    mockUR.findUnique.mockResolvedValue(
      row({
        reviewStatus: "REVIEW_REQUIRED",
        sourceTraceJson: JSON.stringify([{ ts: "x", origin: "customer_change_request", actor: "customer", note: "init" }]),
      }),
    );
    mockUR.update.mockResolvedValue(row({ reviewStatus: "ACCEPTED" }));
    await resolveCustomerContextUpdateRequestReview({
      workspace: reserved,
      workspaceId: "ws-1",
      requestKey: "req-1",
      decision: "ACCEPTED",
      reviewerActor: "reviewer-1",
      reviewerDecisionNote: "ok",
    });
    const args = mockUR.update.mock.calls[0][0];
    const trace = JSON.parse(args.data.sourceTraceJson);
    expect(trace).toHaveLength(2);
    expect(trace[1].origin).toBe("internal_review");
    expect(trace[1].actor).toBe("reviewer-1");
    expect(trace[1].note).toContain("REVIEW_REQUIRED → ACCEPTED");
  });
});

describe("supersedeCustomerContextUpdateRequest", () => {
  it("supersedes a DIRECT_APPLY entry by linking to the new request id", async () => {
    mockUR.findUnique.mockResolvedValue(
      row({ reviewStatus: "DIRECT_APPLY", sourceTraceJson: JSON.stringify([]) }),
    );
    mockUR.update.mockResolvedValue(row({ reviewStatus: "SUPERSEDED" }));
    const result = await supersedeCustomerContextUpdateRequest({
      workspace: reserved,
      workspaceId: "ws-1",
      requestKey: "req-1",
      supersededByRequestId: "req-2",
      reasonNote: "客户在新 request 中重述",
      reviewerActor: "reviewer-1",
    });
    const args = mockUR.update.mock.calls[0][0];
    expect(args.data.reviewStatus).toBe("SUPERSEDED");
    expect(args.data.supersededByRequestId).toBe("req-2");
    expect(result.reviewStatus).toBe("SUPERSEDED");
  });
});
