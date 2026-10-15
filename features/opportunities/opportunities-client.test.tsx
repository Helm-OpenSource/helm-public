/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/opportunities",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/providers/workspace-ui-provider", () => ({
  useWorkspaceUi: () => ({ locale: "zh-CN", demoMode: null }),
}));
vi.mock("@/features/conversation-capture/start-recording-button", () => ({
  StartRecordingButton: () => <button type="button">开始录制</button>,
}));
vi.mock("@/features/opportunities/actions", () => ({
  bulkUpdateOpportunitiesAction: vi.fn(),
  createActionFromDingTalkSignalAction: vi.fn(),
  loadEarlierOpportunityThreadMessagesAction: vi.fn(async () => ({
    ok: true,
    messages: [
      {
        id: "m0",
        sender: "Alex Doe",
        senderEmail: "alex@example.com",
        body: "The very first message in the thread",
        snippet: null,
        isInbound: true,
        sentAt: new Date(Date.now() - 5 * 86_400_000),
      },
    ],
  })),
  loadMoreOpportunityEmailThreadsAction: vi.fn(async () => ({ ok: true, threads: [], total: 0 })),
  moveOpportunityStageAction: vi.fn(),
  saveOpportunityAction: vi.fn(async () => ({ ok: true, id: "opp_inquiry" })),
}));
vi.mock("@/features/contacts/actions", () => ({
  addWorkingMemoryAction: vi.fn(async () => ({ ok: true })),
  createMeetingForContactAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/features/inbox/actions", () => ({
  scheduleMeetingFromThreadAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

import { OpportunitiesClient } from "@/features/opportunities/opportunities-client";
import {
  loadEarlierOpportunityThreadMessagesAction,
  saveOpportunityAction,
} from "@/features/opportunities/actions";
import { addWorkingMemoryAction } from "@/features/contacts/actions";
import { scheduleMeetingFromThreadAction } from "@/features/inbox/actions";
import { useConsoleStore } from "@/hooks/use-console-store";

const FULL_TEXT =
  "Hello team, the demo line on the product page does not connect during service hours. Could you confirm whether it works and share another way to try the voice flow? Thanks, Alex";

const now = new Date();
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000);

function opportunity(overrides: Record<string, unknown>) {
  return {
    id: "opp",
    title: "Opportunity",
    description: null,
    nextStepSummary: null,
    externalSource: null,
    type: "CLIENT" as const,
    stage: "NEW" as const,
    riskLevel: "MEDIUM" as const,
    nextAction: null,
    dueDate: null,
    lossReason: null,
    priorityScore: 50,
    createdAt: inDays(-1),
    updatedAt: inDays(-1),
    company: null,
    contacts: [],
    owner: null,
    actionItems: [],
    emailThreads: [],
    emailThreadCount: 0,
    emailActivity: {
      firstInboundAt: null,
      latestInboundAt: null,
      latestOutboundAt: null,
      latestInboundThreadId: null,
    },
    openBlockerCount: 0,
    overdueCommitmentCount: 0,
    attachments: [],
    ...overrides,
  };
}

const inquiry = opportunity({
  id: "opp_inquiry",
  title: "Website inquiry: cannot try the product",
  description: FULL_TEXT.slice(0, 40),
  nextStepSummary: `来信全文（alex@example.com，2026-10-14 02:43 UTC）：\n${FULL_TEXT}`,
  nextAction: "Reply and check the demo line",
  dueDate: inDays(2),
  priorityScore: 72,
  owner: { id: "user_1", name: "Owner One" },
  contacts: [
    {
      id: "contact_1",
      name: "Alex Doe",
      email: "alex@example.com",
      phone: null,
      channel: "邮箱",
      tags: JSON.stringify(["官网咨询"]),
    },
  ],
  emailThreads: [
    {
      id: "thread_1",
      subject: "Cannot try the product",
      counterpart: "inbox@example.com",
      source: "IMPORT",
      createdAt: inDays(-1),
      messageCount: 1,
      lastActivityAt: inDays(-1),
      messages: [
        {
          id: "m1",
          sender: "Alex Doe",
          senderEmail: "alex@example.com",
          body: FULL_TEXT.slice(0, 40),
          snippet: FULL_TEXT.slice(0, 40),
          isInbound: true,
          sentAt: inDays(-1),
        },
      ],
    },
  ],
  emailThreadCount: 1,
  emailActivity: {
    firstInboundAt: inDays(-1),
    latestInboundAt: inDays(-1),
    latestOutboundAt: null,
    latestInboundThreadId: "thread_1",
  },
});

const manual = opportunity({
  id: "opp_manual",
  title: "Pilot renewal",
  stage: "ADVANCING",
  priorityScore: 40,
  dueDate: inDays(-3),
  company: { id: "company_1", name: "Example Co" },
});

const won = opportunity({
  id: "opp_won",
  title: "Signed expansion",
  stage: "DONE",
  priorityScore: 30,
  updatedAt: now,
  owner: { id: "user_1", name: "Owner One" },
});

function renderClient(
  initialOpportunityId: string | null = null,
  opportunities: unknown[] = [manual, inquiry, won],
) {
  return render(
    <OpportunitiesClient
      opportunities={opportunities as never}
      workspaceDingTalkWorkProgress={[]}
      companies={[{ id: "company_1", name: "Example Co" }]}
      memberships={[{ user: { id: "user_1", name: "Owner One" } }]}
      currentUserId="user_1"
      businessLoopGapSummary={{ primaryGap: null } as never}
      initialOpportunityId={initialOpportunityId}
    />,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ json: async () => ({ success: false }) })),
  );
  useConsoleStore.setState({ opportunityView: "board" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("OpportunitiesClient (customer-first)", () => {
  it("shows the inline count row and customer-first cards without the old judgement panels", () => {
    renderClient();

    const counts = document.querySelector("[data-opportunity-counts]");
    expect(counts).toHaveTextContent("2待处理");
    expect(counts).toHaveTextContent("1已逾期");
    expect(counts).toHaveTextContent("1本周成交");
    expect(counts).toHaveTextContent("2我负责的");

    expect(screen.getByText("Alex Doe")).toBeInTheDocument();
    expect(screen.getAllByText("官网咨询邮件").length).toBeGreaterThan(0);
    expect(screen.getAllByText("手工").length).toBeGreaterThan(0);
    expect(screen.getByText(FULL_TEXT)).toHaveClass("line-clamp-2");
    expect(screen.getByRole("link", { name: "去回复" })).toHaveAttribute(
      "href",
      "/inbox/thread_1",
    );

    for (const removed of ["建议推进顺序", "当前压力", "下一步判断", "主动抬出的机会协作"]) {
      expect(screen.queryByText(removed)).not.toBeInTheDocument();
    }
  });

  it("keeps the existing priority order in the list view", () => {
    useConsoleStore.setState({ opportunityView: "list" });
    renderClient();

    const cards = Array.from(
      document.querySelectorAll("[data-opportunity-list] [data-opportunity-list-card]"),
    );
    expect(cards.map((card) => card.textContent ?? "")).toEqual([
      expect.stringContaining("Alex Doe"),
      expect.stringContaining("Pilot renewal"),
      expect.stringContaining("Signed expansion"),
    ]);
  });

  it("opens the detail with 客户 / 客户原话 / 处理 and a collapsed 系统判断", async () => {
    const user = userEvent.setup();
    renderClient();

    await user.click(
      screen.getByRole("button", { name: "打开机会：Website inquiry: cannot try the product" }),
    );

    const dialog = await screen.findByRole("dialog");
    const headings = within(dialog)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["客户", "客户原话", "处理"]);
    expect(within(dialog).getByText(FULL_TEXT)).toBeInTheDocument();
    expect(within(dialog).getByText("官网咨询邮件 · inbox@example.com")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "去回复邮件" })).toHaveAttribute(
      "href",
      "/inbox/thread_1",
    );

    const judgement = within(dialog).getByText("系统判断").closest("details");
    expect(judgement).not.toHaveAttribute("open");
    expect(judgement).toHaveTextContent("排序依据：优先级 P2（72）");
    expect(judgement).toHaveTextContent("客户来信未回复");
    expect(within(dialog).getAllByText("待回复").length).toBeGreaterThan(0);

    for (const removed of ["机会摘要", "推进快照", "现在先改什么", "可健康推进的窗口"]) {
      expect(within(dialog).queryByText(removed)).not.toBeInTheDocument();
    }
  });

  it("saves through the existing opportunity action and writes the note to contact memory", async () => {
    const user = userEvent.setup();
    renderClient("opp_inquiry");

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText(/例如/), "Called back");
    await user.click(within(dialog).getByRole("button", { name: "保存" }));

    await waitFor(() => expect(saveOpportunityAction).toHaveBeenCalledTimes(1));
    expect(saveOpportunityAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "opp_inquiry",
        title: "Website inquiry: cannot try the product",
        nextAction: "Reply and check the demo line",
        stage: "NEW",
        ownerId: "user_1",
      }),
    );
    await waitFor(() =>
      expect(addWorkingMemoryAction).toHaveBeenCalledWith("contact_1", "Called back"),
    );
  });

  it("schedules the meeting through the governed thread action", async () => {
    const user = userEvent.setup();
    renderClient("opp_inquiry");

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "安排会议" }));

    await waitFor(() =>
      expect(scheduleMeetingFromThreadAction).toHaveBeenCalledWith("thread_1"),
    );
    expect(router.push).toHaveBeenCalledWith("/approvals");
  });

  it("marks a truncated thread and loads the earlier page on demand", async () => {
    const user = userEvent.setup();
    const truncated = {
      ...inquiry,
      nextStepSummary: null,
      emailThreads: [{ ...inquiry.emailThreads[0], messageCount: 2 }],
    };
    renderClient("opp_inquiry", [manual, truncated, won]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("已截断，共 2 封，显示最近 1 封")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "加载更早" }));

    await waitFor(() =>
      expect(loadEarlierOpportunityThreadMessagesAction).toHaveBeenCalledWith({
        threadId: "thread_1",
        beforeMessageId: "m1",
      }),
    );
    expect(await within(dialog).findByText("The very first message in the thread")).toBeInTheDocument();
    expect(within(dialog).queryByText(/已截断/)).not.toBeInTheDocument();
  });
});
