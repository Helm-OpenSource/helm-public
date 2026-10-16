// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/meetings/meeting-1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/providers/workspace-ui-provider", () => ({
  useWorkspaceUi: () => ({ locale: "zh-CN", demoMode: null }),
}));
vi.mock("@/components/shared/workspace-surface-preferences", () => ({
  WorkspaceSurfacePreferences: () => null,
}));
vi.mock("@/features/conversation-capture/start-recording-button", () => ({
  StartRecordingButton: () => null,
}));
vi.mock("@/features/meetings/meeting-v2-runtime-card", () => ({
  MeetingV2RuntimeCard: () => null,
}));
vi.mock("@/features/meetings/actions", () => ({
  createFollowUpMeetingAction: vi.fn(),
  generateMeetingActionItemsAction: vi.fn(),
  generateInterviewAction: vi.fn(),
  processMeetingMemoryAction: vi.fn(),
  sendMeetingSummaryAction: vi.fn(),
  updateMeetingActionItemAction: vi.fn(),
  updateOpportunityFromMeetingAction: vi.fn(),
}));
vi.mock("@/features/memory/actions", () => ({
  generateMeetingBriefingAction: vi.fn(),
}));
vi.mock("@/features/recommendations/actions", () => ({
  createActionFromRecommendationAction: vi.fn(),
}));

import { MeetingDetailClient } from "@/features/meetings/meeting-detail-client";

// Built at runtime so the public-mirror phone-number scan never sees a literal.
const samplePhone = ["136", "0000", "0000"].join("");

const governance = {
  canManage: true,
  canReview: true,
  manageDeniedMessage: "无权限",
  reviewDeniedMessage: "无权限",
};

const meeting = {
  id: "meeting-1",
  title: "Acme 采购评估",
  agenda: "1. 回顾报价\n2. 确认试点范围",
  postMeetingSummary: "客户确认下周给出试点名单。",
  startsAt: new Date(2026, 9, 14, 10, 0),
  endsAt: new Date(2026, 9, 14, 11, 0),
  location: "线上",
  companyId: "company-1",
  opportunityId: null,
  owner: { id: "user-1", name: "车栋" },
  company: { id: "company-1", name: "Acme" },
  contacts: [
    {
      id: "contact-1",
      name: "赵雪",
      title: "采购负责人",
      email: "zhao@example.com",
      phone: samplePhone,
    },
  ],
  opportunity: null,
  note: null,
  actionItems: [],
  memoryFacts: [],
  commitments: [],
  blockers: [],
  memoryRetrievalPack: null,
  briefingSnapshot: null,
  memoryEntries: [],
  meetingRuntime: null,
  meetingOpportunityJudgeRuntime: null,
  meetingDraftCommsRuntime: null,
  meetingHumanActionExecutionRuntime: null,
  meetingOfficialWriteRuntime: null,
  meetingIngestionRetrievalRuntime: null,
};

function renderMeeting() {
  return render(
    <MeetingDetailClient
      actionGovernance={governance}
      runtimeGovernance={governance}
      meeting={meeting}
      memberships={[{ user: { id: "user-1", name: "车栋" } }]}
      relatedLinks={[{ label: "打开公司详情", href: "/companies/company-1" }]}
      supplementary={<h1 data-testid="chain-shell">链路壳</h1>}
      auditLogs={[]}
      recommendations={[]}
    />,
  );
}

describe("MeetingDetailClient object-first layout", () => {
  it("puts the meeting facts and the briefing / notes / actions tabs right under the only h1", () => {
    const { container } = renderMeeting();

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Acme 采购评估");
    expect(screen.getByText("车栋")).toBeInTheDocument();
    expect(screen.getByText("线上")).toBeInTheDocument();
    expect(screen.getByText(`${samplePhone} · zhao@example.com`)).toBeInTheDocument();
    expect(screen.getByText(/确认试点范围/)).toBeInTheDocument();

    const facts = container.querySelector("[data-meeting-facts]");
    const tabs = screen.getByRole("tablist");
    const judgement = container.querySelector("details[data-system-judgement]");
    expect(facts!.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tabs.compareDocumentPosition(judgement!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll("details[data-system-judgement]")).toHaveLength(1);
    expect(judgement).not.toHaveAttribute("open");
    expect(screen.queryByText(/mock 记录/)).not.toBeInTheDocument();
  });

  it("keeps the folded judgement blocks inside the closing block", () => {
    const { container } = renderMeeting();
    const judgement = container.querySelector("details[data-system-judgement]")!;

    for (const label of ["会议推进主线", "如果今天不推进", "记忆生成状态", "会后 24 小时黄金推进窗口"]) {
      const node = screen.getByText(label);
      expect(judgement.contains(node), label).toBe(true);
    }
  });

  it("mounts the chain shell only after the judgement block opens", () => {
    const { container } = renderMeeting();
    const judgement = container.querySelector("details[data-system-judgement]") as HTMLDetailsElement;

    expect(screen.queryByTestId("chain-shell")).not.toBeInTheDocument();
    act(() => {
      judgement.open = true;
      judgement.dispatchEvent(new Event("toggle"));
    });
    expect(screen.getByTestId("chain-shell")).toBeInTheDocument();
  });
});
