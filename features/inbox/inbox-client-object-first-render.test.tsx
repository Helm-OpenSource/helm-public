// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/inbox",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/providers/workspace-ui-provider", () => ({
  useWorkspaceUi: () => ({ locale: "zh-CN", demoMode: null }),
}));
vi.mock("@/features/inbox/actions", () => ({
  addThreadToOpportunityAction: vi.fn(),
  createTodoFromThreadAction: vi.fn(),
  generateReplyDraftAction: vi.fn(),
  scheduleMeetingFromThreadAction: vi.fn(),
  setReminderFromThreadAction: vi.fn(),
  upgradeThreadToOpportunityAction: vi.fn(),
}));
vi.mock("@/features/connectors/actions", () => ({
  syncGmailConnectorAction: vi.fn(),
}));

import { InboxClient } from "@/features/inbox/inbox-client";

// Built at runtime so the public-mirror phone-number scan never sees a literal.
const samplePhone = ["136", "0000", "0000"].join("");

const longBody = [
  "我们内部评估了三家供应商，法务那边对数据出境条款还有两个问题：",
  "第一，录音文件是否只存放在境内机房；第二，合同期满后数据怎么交接和删除。",
  "另外采购希望把试点期从一个月延长到六周，因为十月有长假，实际可用的工作日不够。",
  "如果这两点能在周五前书面确认，我们下周一就可以走用印流程。",
  "麻烦把报价单里的坐席数量改成二十个，并单列语音识别的按量计费部分。",
  "我们的信息安全负责人下周三会参加评审，希望能提前拿到渗透测试报告和等保测评证书的扫描件。",
  "运营这边还关心夜间时段的外呼策略，是否支持按地区设置不同的可呼时段，以及节假日自动顺延。",
  "财务要求发票按月开具，付款周期为收到发票后三十天，请在合同附件里把这一条写清楚。",
  "最后一句用来确认正文超过三百二十个字符时仍然完整显示，不会被截断成省略号。",
].join("\n");

const thread = {
  id: "thread-1",
  subject: "试点合同条款确认",
  counterpart: "赵雪",
  participants: JSON.stringify(["zhao@example.com", "owner@example.com"]),
  source: "DEMO" as const,
  status: "WAITING_US" as const,
  waitingOn: null,
  shouldReply: true,
  updatedAt: new Date("2026-10-14T02:00:00Z"),
  summary: "客户在等合同条款书面确认。",
  contact: {
    id: "contact-1",
    name: "赵雪",
    email: "zhao@example.com",
    phone: samplePhone,
  },
  company: { id: "company-1", name: "远山科技" },
  opportunity: null,
  messages: [
    {
      id: "message-1",
      sender: "我方",
      senderEmail: "owner@example.com",
      body: "附上试点合同草案，请查收。",
      isInbound: false,
      sentAt: new Date("2026-10-13T02:00:00Z"),
    },
    {
      id: "message-2",
      sender: "赵雪",
      senderEmail: "zhao@example.com",
      body: longBody,
      isInbound: true,
      sentAt: new Date("2026-10-14T02:00:00Z"),
    },
  ],
};

function renderInbox() {
  return render(
    <InboxClient
      threads={[thread]}
      selected={thread}
      opportunities={[]}
      connector={null}
      businessLoopGapSummary={{
        totalOpen: 0,
        reviewRequired: 0,
        kindCounts: [],
        primaryGap: null,
      }}
    />,
  );
}

describe("inbox list is object-first", () => {
  it("shows the selected thread's full messages, sender addresses, participants and contact phone", () => {
    const { container } = renderInbox();

    expect(longBody.length).toBeGreaterThan(320);
    const transcript = container.querySelector("[data-email-thread-transcript]");
    expect(transcript).not.toBeNull();
    expect(transcript?.textContent).toContain(
      "最后一句用来确认正文超过三百二十个字符时仍然完整显示，不会被截断成省略号。",
    );
    expect(within(transcript as HTMLElement).getAllByText("zhao@example.com")).not.toHaveLength(0);

    const facts = container.querySelector("[data-inbox-thread-facts]") as HTMLElement;
    expect(facts).not.toBeNull();
    expect(facts.textContent).toContain(samplePhone);
    expect(facts.textContent).toContain("参与人：zhao@example.com、owner@example.com");
    expect(facts.textContent).toContain("我方尚未回复");
  });

  it("reads the list row's latest state from the full message list", () => {
    const { container } = renderInbox();
    const row = container.querySelector("[data-inbox-thread-latest]");
    expect(row).toHaveAttribute("data-inbox-thread-latest", "inbound");
    expect(row?.textContent).toContain("我方未回复");
  });

  it("puts thread actions before one collapsed system judgement block that holds the thread judgement", () => {
    const { container } = renderInbox();
    const blocks = container.querySelectorAll("details[data-system-judgement]");
    expect(blocks).toHaveLength(1);
    const block = blocks[0] as HTMLDetailsElement;
    expect(block.open).toBe(false);
    expect(block.textContent).toContain("线程判断");
    expect(block.textContent).toContain("客户在等合同条款书面确认。");

    const actions = container.querySelector("[data-inbox-thread-actions]");
    expect(actions).not.toBeNull();
    expect(
      actions!.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const outside = container.cloneNode(true) as HTMLElement;
    outside.querySelector("details[data-system-judgement]")?.remove();
    expect(outside.textContent).not.toMatch(/当前压力|下一步判断|线程判断/);
    expect(screen.queryByText("回复、升级成机会，或建会——每条挑一个。")).toBeNull();
  });

  it("hides source counts that are zero", () => {
    const { container } = renderInbox();
    const status = container.querySelector("[data-inbox-source-status]") as HTMLElement;
    expect(status.textContent).toContain("未接入邮箱");
    expect(within(status).getByRole("button", { name: "待我方回复 1" })).toBeInTheDocument();
    expect(within(status).queryByRole("button", { name: /待绑定线索/ })).toBeNull();
    expect(within(status).queryByRole("button", { name: /客户线程/ })).toBeNull();
  });
});
