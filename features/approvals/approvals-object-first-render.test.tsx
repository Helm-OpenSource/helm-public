// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/approvals",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/providers/workspace-ui-provider", () => ({
  useWorkspaceUi: () => ({ locale: "zh-CN", demoMode: null }),
}));
vi.mock("@/features/approvals/actions", () => ({
  approveTaskAction: vi.fn(),
  blockApprovedTaskAction: vi.fn(),
  convertTaskToManualAction: vi.fn(),
  executeApprovedTaskAction: vi.fn(),
  enableAutoExecutionForTaskTypeAction: vi.fn(),
  rejectTaskAction: vi.fn(),
  verifyExecutedTaskReceiptAction: vi.fn(),
}));
vi.mock("@/features/governed-candidates/governed-candidate-review-panel", () => ({
  GovernedCandidateReviewPanel: () => null,
}));
vi.mock("@/features/member-signal-candidates/member-signal-candidate-review-panel", () => ({
  MemberSignalCandidateReviewPanel: () => null,
}));

import { ApprovalsClient } from "@/features/approvals/approvals-client";
import { buildWorkspaceFirstLoopModel } from "@/lib/operating-system/first-loop";

type Props = ComponentProps<typeof ApprovalsClient>;
type Task = Props["tasks"][number];

const now = new Date(2026, 9, 15, 9, 30);

function makeTask(overrides: Partial<Task> & { actionItem?: Partial<Task["actionItem"]> }): Task {
  const { actionItem, ...rest } = overrides;
  return {
    id: "task-1",
    status: "PENDING",
    channel: "外发动作",
    isHighRisk: false,
    autoExecute: false,
    contextSnapshot: null,
    reasoning: "系统认为客户三天没有回音，需要现在跟进。",
    editableContent: "王总您好：\n附上试点范围的修改稿，请在周五前确认。",
    resultPreview: null,
    decisionReason: null,
    rejectionReasonCode: null,
    createdAt: now,
    updatedAt: now,
    reviewedAt: null,
    reviewedBy: null,
    originThread: { id: "thread-1", subject: "试点范围确认" },
    biSource: null,
    dingtalkSource: null,
    recommendationFacts: [],
    recommendationBlockers: [],
    recommendationCommitments: [],
    ...rest,
    actionItem: {
      id: "action-1",
      status: "PENDING_APPROVAL",
      executionStatus: "pending",
      statusReason: null,
      title: "回复草稿：试点范围确认",
      actionType: "GENERATE_REPLY_DRAFT",
      description: null,
      draftContent: null,
      riskLevel: "MEDIUM",
      suggestedExecutionAt: null,
      executionMode: "REQUIRES_APPROVAL",
      recommendationLog: null,
      opportunity: {
        id: "opp-1",
        title: "Acme 试点",
        company: { id: "company-1", name: "Acme" },
      },
      contact: { id: "contact-1", name: "王总" },
      meeting: null,
      createdBy: { id: "user-1", name: "车栋", email: "che@example.test" },
      decisionWorkPacketClaim: null,
      executionReceipt: null,
      ...actionItem,
    },
  };
}

function renderApprovals(tasks: Task[]) {
  const props: Props = {
    actionGovernance: {
      canReview: true,
      canChangePolicy: true,
      canFinalizeStage1Result: true,
      reviewDeniedMessage: "无权限",
      policyDeniedMessage: "无权限",
      stage1ResultDeniedMessage: "无权限",
    },
    candidateGovernance: {
      canReview: false,
      canPromote: false,
      reviewDeniedMessage: "无权限",
      promotionDeniedMessage: "无权限",
    },
    governedCandidates: [],
    memberSignalCandidates: [],
    tasks,
    learningPanels: {},
    businessLoopGapSummary: {
      totalOpen: 0,
      reviewRequired: 0,
      kindCounts: [],
      primaryGap: null,
    },
    firstLoopModel: buildWorkspaceFirstLoopModel({
      english: false,
      roleGoal: {
        label: "工作区角色已确认",
        summary: "复核队列可用",
        href: "/dashboard",
        status: "done",
      },
      firstSignal: null,
      firstSuggestion: null,
      reviewCheckpoint: {
        label: "打开复核队列",
        summary: "先复核待处理动作",
        href: "/approvals#approval-queue",
        status: "ready",
      },
      followThrough: null,
      memoryWriteBack: null,
      nextAnchor: null,
      hasExplicitAnchor: false,
    }),
    biBoardContribution: null,
    initialApprovalId: null,
    initialEvidencePanelOpen: false,
  };
  return render(<ApprovalsClient {...props} />);
}

describe("approvals page object-first render", () => {
  it("shows the draft, its initiator and origin thread before the folded system judgement", () => {
    const { container } = renderApprovals([makeTask({})]);

    const focus = container.querySelector('[data-approval-draft-focus="true"]');
    expect(focus).not.toBeNull();
    expect(focus).toHaveTextContent("王总 · Acme 试点 · Acme");
    expect(focus).toHaveTextContent("王总您好：");
    expect(focus).not.toHaveTextContent("请在周五前确认");

    const body = container.querySelector('[data-approval-draft-body="task-1"]');
    expect(body).toHaveTextContent("附上试点范围的修改稿，请在周五前确认。");
    expect(screen.getAllByText("发起人：车栋").length).toBeGreaterThan(0);
    const threadLink = screen.getAllByRole("link", { name: "来自邮件：试点范围确认" })[0];
    expect(threadLink).toHaveAttribute("href", "/inbox/thread-1");

    const queueCard = body?.closest("article");
    expect(queueCard).not.toBeNull();
    expect(queueCard).not.toHaveTextContent("系统认为客户三天没有回音");

    const judgement = container.querySelectorAll("details[data-system-judgement]");
    expect(judgement).toHaveLength(1);
    expect(judgement[0]).not.toHaveAttribute("open");
    expect(within(judgement[0] as HTMLElement).getByText("当前压力")).toBeInTheDocument();
    expect(
      container.querySelector('[data-customer-asset-focus="true"]'),
    ).toBeNull();

    const html = container.innerHTML;
    expect(html.indexOf("data-approval-draft-body")).toBeLessThan(
      html.indexOf("data-system-judgement"),
    );
  });

  it("hides the focus strip when the queue is empty and shows the decision reason in history", () => {
    const { container } = renderApprovals([
      makeTask({
        id: "task-2",
        status: "REJECTED",
        decisionReason: "报价口径要先和财务对齐",
        rejectionReasonCode: null,
        reviewedAt: now,
        reviewedBy: { name: "车栋" },
        originThread: null,
        actionItem: { status: "REJECTED", createdBy: null },
      }),
    ]);

    expect(container.querySelector('[data-approval-draft-focus="true"]')).toBeNull();

    act(() => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "已审批历史" }));
      fireEvent.click(screen.getByRole("tab", { name: "已审批历史" }));
    });

    const note = container.querySelector('[data-approval-decision-reason="true"]');
    expect(note).toHaveTextContent("处理说明：报价口径要先和财务对齐");
    expect(container.querySelector('[data-approval-initiator="true"]')).toBeNull();
  });

  it("cuts long drafts on the card with the remaining length stated", () => {
    const longDraft = "试".repeat(650);
    const { container } = renderApprovals([
      makeTask({ editableContent: longDraft }),
    ]);

    const body = container.querySelector('[data-approval-draft-body="task-1"]');
    expect(body).toHaveTextContent("还有 50 字 · 打开看全文");
  });
});
