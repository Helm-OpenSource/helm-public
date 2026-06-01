import { describe, expect, it } from "vitest";
import { buildCustomerSuccessHandoffPageModel } from "@/features/customer-success-handoff/detail-model";
import { buildCustomerSuccessQueueSurfaceModel } from "@/features/customer-success-handoff/queue-model";
import {
  createCustomerSuccessDetailReportingContract,
  createCustomerSuccessHandoffSurfaceContract,
  customerSuccessEvidenceGroupIds,
  toCustomerSuccessDetailPageReportingProtocol,
  toCustomerSuccessHandoffPageReportingProtocol,
} from "@/lib/presentation/customer-success-handoff-surface-contract";

const baseEvidenceGroups = customerSuccessEvidenceGroupIds.map((groupId) => ({
  groupId,
  label: groupId,
  items: [`${groupId} item`],
}));

type CustomerSuccessDetailInput =
  Parameters<typeof buildCustomerSuccessHandoffPageModel>[0]["detail"];
type CustomerSuccessCompanyInput =
  Parameters<typeof buildCustomerSuccessHandoffPageModel>[0]["company"];
type CustomerSuccessReviewTaskInput =
  Parameters<typeof buildCustomerSuccessHandoffPageModel>[0]["reviewTasks"][number];

function createCustomerSuccessDetailFixture(): CustomerSuccessDetailInput {
  const now = new Date("2026-03-30T09:00:00.000Z");

  return {
    id: "opp_customer_success",
    title: "A-level retention motion",
    stage: "customer-success-follow-through",
    riskLevel: "MEDIUM",
    nextAction: "Confirm recovery plan",
    dueDate: null,
    updatedAt: now,
    company: { id: "company_1", name: "Acme Cloud" },
    contacts: [{ id: "contact_1", name: "Lin" }],
    owner: { id: "owner_1", name: "Owner" },
    actionItems: [],
    meetings: [],
    emailThreads: [
      {
        id: "thread_1",
        subject: "Need clarification on rollout",
        status: "WAITING_US",
        updatedAt: now,
        messages: [
          {
            id: "message_1",
            sender: "buyer@acme.com",
            body: "Can you confirm the recovery path?",
            sentAt: now,
            isInbound: true,
          },
        ],
      },
    ],
    memoryFacts: [],
    memoryEntries: [],
    commitments: [],
    blockers: [],
    briefingSnapshot: null,
    auditLogs: [],
  };
}

function createCustomerSuccessCompanyFixture(): CustomerSuccessCompanyInput {
  const now = new Date("2026-03-30T09:00:00.000Z");

  return {
    id: "company_1",
    name: "Acme Cloud",
    industry: "Software",
    contacts: [{ id: "contact_1", name: "Lin" }],
    meetings: [{ id: "meeting_1", title: "Recovery sync", startsAt: now }],
    opportunities: [
      {
        id: "opp_customer_success",
        title: "A-level retention motion",
        stage: "customer-success-follow-through",
      },
    ],
    memoryEntries: [],
    briefingSnapshot: null,
  };
}

function createCustomerSuccessReviewTaskFixture(): CustomerSuccessReviewTaskInput {
  const now = new Date("2026-03-30T09:00:00.000Z");

  return {
    id: "review_1",
    status: "PENDING",
    channel: "email",
    isHighRisk: false,
    createdAt: now,
    updatedAt: now,
    reviewedAt: null,
    approver: { name: "Approver" },
    reviewedBy: null,
    actionItem: {
      id: "action_1",
      title: "Boundary-safe clarification",
      actionType: "DRAFT_EMAIL",
      description: "Prepare the clarification draft.",
      riskLevel: "MEDIUM",
      opportunity: {
        id: "opp_customer_success",
        title: "A-level retention motion",
        company: { id: "company_1", name: "Acme Cloud" },
      },
    },
    recommendationFacts: [],
    recommendationBlockers: [],
    recommendationCommitments: [],
  };
}

describe("customer success handoff surface contract", () => {
  it("keeps customer success handoff and detail reporting aligned to the shared protocol", () => {
    const surfaceContract = createCustomerSuccessHandoffSurfaceContract({
      customerSuccessHandoffJudgement:
        "当前应把 customer success handoff 当作跟进判断层，而不是继续把 company detail 当作 success proxy。",
      customerSuccessHandoffReason:
        "当前 review、follow-through 和 expansion pressure 已经足够强，需要 dedicated customer success 接手面。",
      customerSuccessHandoffSummary: [
        "Helm 已经把 follow-through、review pressure 和 expansion route 收到同一页里。",
      ],
      customerSuccessHandoffBoundary: [
        "customer success handoff 可以澄清 owner 和 next action，但它仍然不能悄悄把 follow-through 写成 commitment。",
      ],
      customerSuccessHandoffWorkerSummary: [
        "customer success worker 已整理 success / expansion handoff cue。",
      ],
      customerSuccessHandoffEvidenceSummary: [
        "evidence drawer 已收住 replay / audit / memory / success trace。",
      ],
      customerSuccessHandoffDecisionRequest: [
        "确认当前是否由 customer success 正式接手下一步。",
      ],
      customerSuccessHandoffNextAction: [
        { label: "打开 customer success 页面", href: "/customer-success/test" },
      ],
      customerSuccessHandoffRiskSignal: "caution",
      customerSuccessHandoffAudienceMode: "customer-success",
      customerSuccessHandoffOwnership: "customer-success",
      customerSuccessHandoffStage: "success-follow-through",
      customerSuccessHandoffEvidenceGroups: baseEvidenceGroups,
      pageWhyItMatters: ["当前 follow-through 已经出现。", "边界仍需显式可见。"],
    });

    const detailContract = createCustomerSuccessDetailReportingContract({
      customerSuccessDetailJudgement:
        "当前应先用 customer success detail 判断 success check 与 expansion review 是否已经值得继续推进。",
      customerSuccessDetailReason:
        "当前 success / expansion / review pressure 已经需要放在同一页里判断。",
      customerSuccessDetailActionSummary: [
        "Helm 已先把 customer success handoff、success check 和 expansion review 链路收在同一页里。",
      ],
      customerSuccessDetailDecision: [
        "当前 decision posture 仍停在 review-follow-through，并继续把 non-commitment 说清楚。",
      ],
      customerSuccessDetailDecisionRequest: [
        "确认下一步是否应该继续停在 review-before-send。",
      ],
      customerSuccessDetailBoundarySummary: [
        "customer success detail 可以提高接手清晰度，但它仍然不等于客户承诺。",
      ],
      customerSuccessDetailEvidenceSummary: [
        "evidence drawer 已收住 replay / audit / handoff trace。",
      ],
      customerSuccessDetailWorkerSummary: [
        "customer success worker 已整理下一轮 follow-through cue。",
      ],
      customerSuccessDetailNextAction: [
        { label: "打开 success check 页面", href: "/success-checks/test" },
      ],
      customerSuccessDetailRiskSignal: "caution",
      customerSuccessDetailAudienceMode: "success-owner",
      customerSuccessDetailStage: "review-follow-through",
      customerSuccessDetailSendabilityMode: "review-before-send",
      customerSuccessDetailFallbackMode: "review-hold",
      customerSuccessDetailEvidenceGroups: baseEvidenceGroups,
      pageWhyItMatters: ["当前接手窗口已经出现。", "non-commitment 必须继续可见。"],
    });

    const surfaceProtocol = toCustomerSuccessHandoffPageReportingProtocol(
      surfaceContract,
    );
    const detailProtocol = toCustomerSuccessDetailPageReportingProtocol(
      detailContract,
    );

    expect(surfaceProtocol.pageJudgement).toContain("customer success handoff");
    expect(detailProtocol.pageBoundarySummary[0]).toContain("承诺");
    expect(detailProtocol.pageNextAction).toHaveLength(1);
    expect(detailContract.customerSuccessDetailDecision).not.toEqual(
      detailContract.customerSuccessDetailDecisionRequest,
    );
  });

  it("accepts supported fields as optional when the baseline-required fields remain present", () => {
    const surfaceContract = createCustomerSuccessHandoffSurfaceContract({
      customerSuccessHandoffJudgement:
        "当前仍应把 customer success handoff 当作 judgement-first surface。",
      customerSuccessHandoffReason: "当前 next owner 与 boundary 仍需显式可见。",
      customerSuccessHandoffSummary: ["Helm 已先把当前接手面收口。"],
      customerSuccessHandoffBoundary: ["当前仍不是 commitment。"],
      customerSuccessHandoffWorkerSummary: ["worker 已整理接手提示。"],
      customerSuccessHandoffEvidenceSummary: ["evidence summary 仍在首屏。"],
      customerSuccessHandoffDecisionRequest: ["确认谁先接手下一步。"],
      customerSuccessHandoffNextAction: [
        { label: "打开 customer success 页面", href: "/customer-success/test" },
      ],
      customerSuccessHandoffRiskSignal: "watch",
      customerSuccessHandoffStage: "success-follow-through",
      pageWhyItMatters: ["当前接手已出现。", "边界仍需显式可见。"],
    });

    const detailContract = createCustomerSuccessDetailReportingContract({
      customerSuccessDetailJudgement:
        "当前仍应把 customer success detail 停在 success-follow-through。",
      customerSuccessDetailReason: "当前仍要先守住 judgement 与 boundary。",
      customerSuccessDetailActionSummary: ["Helm 已先把 success chain 收在一页。"],
      customerSuccessDetailDecision: [
        "当前 decision posture 仍停在 success-follow-through。",
      ],
      customerSuccessDetailDecisionRequest: ["确认是否继续由 customer success 先接手。"],
      customerSuccessDetailBoundarySummary: ["当前仍不是外部承诺。"],
      customerSuccessDetailEvidenceSummary: ["evidence summary 仍然前置可见。"],
      customerSuccessDetailWorkerSummary: ["worker 已整理 follow-through cue。"],
      customerSuccessDetailNextAction: [
        { label: "打开 success check 页面", href: "/success-checks/test" },
      ],
      customerSuccessDetailRiskSignal: "watch",
      customerSuccessDetailStage: "success-follow-through",
      pageWhyItMatters: ["当前 follow-through 已经形成。", "不应滑成 commitment。"],
    });

    expect(surfaceContract.customerSuccessHandoffAudienceMode).toBeUndefined();
    expect(surfaceContract.customerSuccessHandoffOwnership).toBeUndefined();
    expect(surfaceContract.customerSuccessHandoffEvidenceGroups).toBeUndefined();
    expect(detailContract.customerSuccessDetailAudienceMode).toBeUndefined();
    expect(detailContract.customerSuccessDetailSendabilityMode).toBeUndefined();
    expect(detailContract.customerSuccessDetailFallbackMode).toBeUndefined();
    expect(detailContract.customerSuccessDetailEvidenceGroups).toBeUndefined();
  });

  it("rejects customer success next actions that overflow the shared reporting density", () => {
    expect(() =>
      createCustomerSuccessDetailReportingContract({
        customerSuccessDetailJudgement:
          "当前仍应把 customer success detail 停在 judgement-first surface。",
        customerSuccessDetailReason: "当前仍要把边界与下一步保持可见。",
        customerSuccessDetailActionSummary: ["Helm 已先把 follow-through 收住。"],
        customerSuccessDetailDecision: ["当前 decision framing 仍需人工确认。"],
        customerSuccessDetailDecisionRequest: ["确认谁来接下一步。"],
        customerSuccessDetailBoundarySummary: ["当前仍不是外部承诺。"],
        customerSuccessDetailEvidenceSummary: ["evidence summary 仍然存在。"],
        customerSuccessDetailWorkerSummary: ["worker cue 仍然可见。"],
        customerSuccessDetailNextAction: [
          { label: "Open success check", href: "/success-checks/test" },
          {
            label: "Open inbox",
            href: "/inbox/test",
            variant: "secondary",
          },
          {
            label: "Open expansion review",
            href: "/expansion-reviews/test",
            variant: "ghost",
          },
          {
            label: "Open review request",
            href: "/review-requests/test",
            variant: "ghost",
          },
        ],
        customerSuccessDetailRiskSignal: "caution",
        customerSuccessDetailStage: "review-follow-through",
        pageWhyItMatters: ["当前接手窗口已经出现。", "non-commitment 必须继续可见。"],
      }),
    ).toThrow("customer success next action cannot exceed 3 items");
  });

  it("rejects customer success boundary summaries that overflow the shared reporting density", () => {
    expect(() =>
      createCustomerSuccessDetailReportingContract({
        customerSuccessDetailJudgement:
          "当前仍应把 customer success detail 停在 judgement-first surface。",
        customerSuccessDetailReason: "当前仍要把边界与下一步保持可见。",
        customerSuccessDetailActionSummary: ["Helm 已先把 follow-through 收住。"],
        customerSuccessDetailDecision: ["当前 decision framing 仍需人工确认。"],
        customerSuccessDetailDecisionRequest: ["确认谁来接下一步。"],
        customerSuccessDetailBoundarySummary: [
          "当前仍不是外部承诺。",
          "pending review 必须继续显式可见。",
          "issue wording 不能写成 commitment。",
          "fallback 仍需保持可见。",
        ],
        customerSuccessDetailEvidenceSummary: ["evidence summary 仍然存在。"],
        customerSuccessDetailWorkerSummary: ["worker cue 仍然可见。"],
        customerSuccessDetailNextAction: [
          { label: "Open success check", href: "/success-checks/test" },
        ],
        customerSuccessDetailRiskSignal: "caution",
        customerSuccessDetailStage: "review-follow-through",
        pageWhyItMatters: ["当前接手窗口已经出现。", "non-commitment 必须继续可见。"],
      }),
    ).toThrow("customer success boundary summary cannot exceed 3 items");
  });

  it("keeps customer-success detail and queue runtime next actions inside the reporting protocol", () => {
    const detail = createCustomerSuccessDetailFixture();
    const company = createCustomerSuccessCompanyFixture();
    const reviewTasks = [createCustomerSuccessReviewTaskFixture()];

    const detailModel = buildCustomerSuccessHandoffPageModel({
      detail,
      company,
      reviewTasks,
      stageLabel: "Review follow-through",
      english: true,
    });

    expect(detailModel.protocol.pageNextAction).toHaveLength(3);
    expect(detailModel.protocol.pageBoundarySummary.length).toBeLessThanOrEqual(3);
    expect(detailModel.protocol.pageNextAction[0]?.label).toBe(
      "Open success check",
    );
    expect(
      detailModel.protocol.pageNextAction.filter(
        (action) => action.variant === undefined || action.variant === "default",
      ),
    ).toHaveLength(1);

    const queueModel = buildCustomerSuccessQueueSurfaceModel({
      queueDetails: [
        {
          detail,
          company,
          reviewTasks,
          stageLabel: "Review follow-through",
        },
      ],
      successInboxThreads: [],
      english: true,
    });

    expect(queueModel.protocol.pageNextAction).toHaveLength(2);
    expect(queueModel.queueItems[0]?.nextActionLabel).toBe(
      detailModel.protocol.pageNextAction[0]?.label,
    );
    expect(queueModel.queueItems[0]?.inboxHref).toBeNull();
    expect(queueModel.protocol.pageNextAction).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Open top success inbox thread",
        }),
      ]),
    );
    expect(queueModel.immediateActions).toHaveLength(1);
    expect(queueModel.decisionsWaiting).toHaveLength(1);
    expect(queueModel.blockersToClear.length).toBeGreaterThanOrEqual(0);
    expect(queueModel.actionTemplates.length).toBeGreaterThan(0);
    expect(queueModel.retroFeedback).toHaveLength(1);
  });
});
