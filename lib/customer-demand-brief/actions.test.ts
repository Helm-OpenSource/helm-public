import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockBrief } = vi.hoisted(() => ({
  mockBrief: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { customerDemandBrief: mockBrief },
}));

vi.mock("server-only", () => ({}));

import {
  CustomerDemandBriefCustomerConfirmationTransitionError,
  CustomerDemandBriefForbiddenTrialPayloadError,
  CustomerDemandBriefReservedOnlyError,
  CustomerDemandBriefReviewTransitionError,
  attachTrialInitializationPayload,
  createCustomerDemandBrief,
  updateCustomerDemandBriefCustomerConfirmation,
  updateCustomerDemandBriefReviewStatus,
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
    briefKey: "brief-1",
    entryMode: "SALES_LED",
    prefillSource: null,
    customerSummary: "Acme",
    businessPressureTagsJson: JSON.stringify([]),
    currentResourceTagsJson: JSON.stringify([]),
    resourceEvidenceReadinessJson: JSON.stringify([]),
    painToControlLineCandidatesJson: JSON.stringify([]),
    roleMapJson: JSON.stringify({
      decisionMakers: [],
      endUsers: [],
      executors: [],
      reviewers: [],
    }),
    firstLoopCandidatesJson: JSON.stringify([]),
    successCriteria: "success",
    riskBoundaryTagsJson: JSON.stringify([]),
    customerVisibleSummary: "summary",
    internalSalesNotes: null,
    trialInitializationPayloadJson: null,
    sourceTraceJson: JSON.stringify([]),
    reviewStatus: "DRAFT",
    customerConfirmationStatus: "NOT_INVITED",
    createdAt: new Date("2026-05-12T00:00:00.000Z"),
    updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockBrief.create.mockReset();
  mockBrief.update.mockReset();
  mockBrief.findUnique.mockReset();
});

describe("reserved-only gating", () => {
  it("createCustomerDemandBrief throws for customer tenants", async () => {
    await expect(() =>
      createCustomerDemandBrief({
        workspace: customer,
        data: {
          workspaceId: "ws-1",
          leadId: "lead-1",
          briefKey: "brief-1",
          entryMode: "SALES_LED",
          customerSummary: "Acme",
          successCriteria: "x",
          customerVisibleSummary: "y",
        },
      }),
    ).rejects.toBeInstanceOf(CustomerDemandBriefReservedOnlyError);
    expect(mockBrief.create).not.toHaveBeenCalled();
  });
});

describe("createCustomerDemandBrief", () => {
  it("forces reviewStatus=DRAFT and trialInitializationPayloadJson=null on create", async () => {
    mockBrief.create.mockResolvedValue(row({}));
    await createCustomerDemandBrief({
      workspace: reserved,
      data: {
        workspaceId: "ws-1",
        leadId: "lead-1",
        briefKey: "brief-1",
        entryMode: "SALES_LED",
        customerSummary: "Acme",
        successCriteria: "节省时间",
        customerVisibleSummary: "客户可见摘要",
        businessPressureTags: ["growth-stall"],
        internalSalesNotes: "  internal only  ",
      },
    });
    const args = mockBrief.create.mock.calls[0][0];
    expect(args.data.reviewStatus).toBe("DRAFT");
    expect(args.data.customerConfirmationStatus).toBe("NOT_INVITED");
    expect(args.data.trialInitializationPayloadJson).toBeNull();
    expect(args.data.internalSalesNotes).toBe("internal only");
    expect(JSON.parse(args.data.businessPressureTagsJson)).toEqual([
      "growth-stall",
    ]);
  });

  it("requires non-empty mandatory fields", async () => {
    await expect(() =>
      createCustomerDemandBrief({
        workspace: reserved,
        data: {
          workspaceId: "ws-1",
          leadId: "lead-1",
          briefKey: "  ",
          entryMode: "SALES_LED",
          customerSummary: "Acme",
          successCriteria: "x",
          customerVisibleSummary: "y",
        },
      }),
    ).rejects.toThrow(/briefKey is required/);
  });
});

describe("updateCustomerDemandBriefReviewStatus", () => {
  it("rejects invalid transitions", async () => {
    mockBrief.findUnique.mockResolvedValue(row({ reviewStatus: "DRAFT" }));
    await expect(() =>
      updateCustomerDemandBriefReviewStatus({
        workspace: reserved,
        workspaceId: "ws-1",
        briefKey: "brief-1",
        nextStatus: "APPROVED_FOR_TRIAL_INIT",
        reviewerActor: "reviewer-1",
        reasonNote: "skip review",
      }),
    ).rejects.toBeInstanceOf(CustomerDemandBriefReviewTransitionError);
    expect(mockBrief.update).not.toHaveBeenCalled();
  });

  it("requires a reasonNote", async () => {
    await expect(() =>
      updateCustomerDemandBriefReviewStatus({
        workspace: reserved,
        workspaceId: "ws-1",
        briefKey: "brief-1",
        nextStatus: "REVIEW_REQUIRED",
        reviewerActor: "reviewer-1",
        reasonNote: "  ",
      }),
    ).rejects.toThrow(/reasonNote is required/);
  });

  it("appends an internal_review trace entry on valid transition", async () => {
    mockBrief.findUnique.mockResolvedValue(
      row({ reviewStatus: "DRAFT", sourceTraceJson: JSON.stringify([]) }),
    );
    mockBrief.update.mockResolvedValue(
      row({ reviewStatus: "REVIEW_REQUIRED" }),
    );
    await updateCustomerDemandBriefReviewStatus({
      workspace: reserved,
      workspaceId: "ws-1",
      briefKey: "brief-1",
      nextStatus: "REVIEW_REQUIRED",
      reviewerActor: "reviewer-1",
      reasonNote: "evidence still partial",
    });
    const args = mockBrief.update.mock.calls[0][0];
    const trace = JSON.parse(args.data.sourceTraceJson);
    expect(trace).toHaveLength(1);
    expect(trace[0].origin).toBe("internal_review");
    expect(trace[0].actor).toBe("reviewer-1");
    expect(trace[0].note).toContain("DRAFT → REVIEW_REQUIRED");
    expect(trace[0].note).toContain("evidence still partial");
  });
});

describe("updateCustomerDemandBriefCustomerConfirmation", () => {
  it("rejects invalid transitions", async () => {
    mockBrief.findUnique.mockResolvedValue(
      row({ customerConfirmationStatus: "NOT_INVITED" }),
    );
    await expect(() =>
      updateCustomerDemandBriefCustomerConfirmation({
        workspace: reserved,
        workspaceId: "ws-1",
        briefKey: "brief-1",
        nextStatus: "FULLY_CONFIRMED",
        customerActor: "customer@x.com",
        origin: "customer_confirmation",
        reasonNote: "looks good",
      }),
    ).rejects.toBeInstanceOf(CustomerDemandBriefCustomerConfirmationTransitionError);
  });

  it("downgrades reviewStatus to REVIEW_REQUIRED when origin is customer_change_request and prior was APPROVED", async () => {
    mockBrief.findUnique.mockResolvedValue(
      row({
        reviewStatus: "APPROVED_FOR_TRIAL_INIT",
        customerConfirmationStatus: "FULLY_CONFIRMED",
        sourceTraceJson: JSON.stringify([]),
      }),
    );
    mockBrief.update.mockResolvedValue(
      row({
        reviewStatus: "REVIEW_REQUIRED",
        customerConfirmationStatus: "CHANGE_REQUESTED",
      }),
    );
    const result = await updateCustomerDemandBriefCustomerConfirmation({
      workspace: reserved,
      workspaceId: "ws-1",
      briefKey: "brief-1",
      nextStatus: "CHANGE_REQUESTED",
      customerActor: "customer@x.com",
      origin: "customer_change_request",
      reasonNote: "client wants new owner",
    });
    expect(result.reviewStatus).toBe("REVIEW_REQUIRED");
    const args = mockBrief.update.mock.calls[0][0];
    expect(args.data.reviewStatus).toBe("REVIEW_REQUIRED");
  });
});

describe("attachTrialInitializationPayload", () => {
  it("requires reviewStatus to be APPROVED_FOR_TRIAL_INIT first", async () => {
    mockBrief.findUnique.mockResolvedValue(row({ reviewStatus: "DRAFT" }));
    await expect(() =>
      attachTrialInitializationPayload({
        workspace: reserved,
        workspaceId: "ws-1",
        briefKey: "brief-1",
        payload: {
          acceptedBusinessGoals: ["g"],
          acceptedRoles: [],
          acceptedResources: [],
          acceptedSuccessCriteria: [],
          riskBoundaryNotes: [],
          prerequisiteNotes: [],
        },
        reviewerActor: "reviewer-1",
        reasonNote: "ready",
      }),
    ).rejects.toThrow(/APPROVED_FOR_TRIAL_INIT/);
  });

  it("rejects payloads carrying referral / settlement / contribution keys", async () => {
    mockBrief.findUnique.mockResolvedValue(
      row({ reviewStatus: "APPROVED_FOR_TRIAL_INIT" }),
    );
    await expect(() =>
      attachTrialInitializationPayload({
        workspace: reserved,
        workspaceId: "ws-1",
        briefKey: "brief-1",
        payload: {
          acceptedBusinessGoals: ["g"],
          acceptedRoles: [],
          acceptedResources: [],
          acceptedSuccessCriteria: [],
          riskBoundaryNotes: [],
          prerequisiteNotes: [],
          // dirty additions:
          referralId: "r1",
          settlementProposal: "x",
        } as never,
        reviewerActor: "reviewer-1",
        reasonNote: "trying to sneak",
      }),
    ).rejects.toBeInstanceOf(CustomerDemandBriefForbiddenTrialPayloadError);
    expect(mockBrief.update).not.toHaveBeenCalled();
  });

  it("attaches a clean payload and appends an internal_review trace", async () => {
    mockBrief.findUnique.mockResolvedValue(
      row({
        reviewStatus: "APPROVED_FOR_TRIAL_INIT",
        sourceTraceJson: JSON.stringify([]),
      }),
    );
    mockBrief.update.mockResolvedValue(row({}));
    await attachTrialInitializationPayload({
      workspace: reserved,
      workspaceId: "ws-1",
      briefKey: "brief-1",
      payload: {
        acceptedBusinessGoals: ["growth"],
        acceptedRoles: ["owner"],
        acceptedResources: ["CRM"],
        acceptedSuccessCriteria: ["节省时间"],
        riskBoundaryNotes: ["数据不足"],
        prerequisiteNotes: [],
      },
      reviewerActor: "reviewer-1",
      reasonNote: "ready for trial init",
    });
    const args = mockBrief.update.mock.calls[0][0];
    const payload = JSON.parse(args.data.trialInitializationPayloadJson);
    expect(payload.acceptedBusinessGoals).toEqual(["growth"]);
    const trace = JSON.parse(args.data.sourceTraceJson);
    expect(trace[0].origin).toBe("internal_review");
    expect(trace[0].note).toContain("attach trial-init payload");
  });
});
