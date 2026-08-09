import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  confirmStage1DecisionRecord: vi.fn(),
  dispatchStage1DecisionWorkPacket: vi.fn(),
  recordStage1OwnerReviewOutcome: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: vi.fn(async () => ({
    user: { id: "owner-1", name: "Owner" },
    membership: { role: "OWNER" },
    workspace: { id: "workspace-1" },
  })),
}));

vi.mock("@/lib/stage1-owner-loop/decision-follow-through.service", () => ({
  ...service,
  Stage1DecisionGateError: class Stage1DecisionGateError extends Error {
    constructor(readonly reasons: string[]) {
      super(reasons.join(","));
    }
  },
}));

import { POST } from "@/app/api/stage1/decisions/[decisionId]/review/route";

const validApproveBody = {
  action: "approve",
  conclusion: "Proceed with the governed review",
  executionTargetRef: "team:operations",
  portfolioRef: "opportunity:portfolio-1",
  goal: "Verify the governed terminal result",
  workAction: "Prepare the evidence-bounded work packet",
  dueAt: "2099-08-10T08:00:00.000Z",
  acceptanceCriteria: ["Canonical receipt is independently verified"],
  evidenceRequirements: ["Trusted observation run"],
  invalidationConditions: ["Conflicting terminal evidence"],
  escalationOwnerRef: "role:owner",
} as const;

function request(body: unknown) {
  return new Request("http://localhost/api/stage1/decisions/decision-1/review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Stage1 decision review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.confirmStage1DecisionRecord.mockResolvedValue({
      id: "decision-1",
      status: "OWNER_CONFIRMED",
    });
    service.dispatchStage1DecisionWorkPacket.mockResolvedValue({
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      created: true,
    });
  });

  it("rejects approval without a canonical Portfolio before mutating the decision", async () => {
    const { portfolioRef: _portfolioRef, ...body } = validApproveBody;

    const response = await POST(request(body), {
      params: Promise.resolve({ decisionId: "decision-1" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ errorCode: "MALFORMED_REQUEST" });
    expect(service.confirmStage1DecisionRecord).not.toHaveBeenCalled();
    expect(service.dispatchStage1DecisionWorkPacket).not.toHaveBeenCalled();
  });

  it("carries the validated canonical Portfolio into the governed dispatch service", async () => {
    const response = await POST(request(validApproveBody), {
      params: Promise.resolve({ decisionId: "decision-1" }),
    });

    expect(response.status).toBe(200);
    expect(service.dispatchStage1DecisionWorkPacket).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        decisionRecordId: "decision-1",
        command: expect.objectContaining({
          workspaceRef: "workspace:workspace-1",
          decisionRef: "decision-1",
          portfolioRef: "opportunity:portfolio-1",
        }),
      }),
    );
  });
});
