import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildOriginalDemandThreads } from "@/features/opportunities/customer-first";
import { OpportunityCustomerCard } from "@/features/opportunities/opportunity-customer-card";
import { OpportunityHandlingCard } from "@/features/opportunities/opportunity-handling-card";
import { OpportunityListCard } from "@/features/opportunities/opportunity-list-card";
import { OpportunityOriginalDemand } from "@/features/opportunities/opportunity-original-demand";

const contact = {
  id: "contact_1",
  name: "Alex Doe",
  email: "alex@example.com",
  phone: null,
  channel: "邮箱",
  tags: null,
};

const FULL_TEXT =
  "Hello team, the demo line does not connect. Could you share another way to try the voice flow? Thanks, Alex";

function handlingProps(overrides: Partial<Parameters<typeof OpportunityHandlingCard>[0]> = {}) {
  return {
    english: false,
    anchorId: "opportunity-action-workspace",
    ownerSelectId: "owner",
    draft: {
      nextAction: "Reply to the inquiry",
      dueDate: "2026-10-17T13:14",
      stage: "NEW",
      ownerId: "user_1",
      lossReason: "",
    },
    onDraftChange: () => undefined,
    stageOptions: [["NEW", "新机会"]] as Array<[string, string]>,
    ownerOptions: [["user_1", "Owner One"]] as Array<[string, string]>,
    note: "",
    onNoteChange: () => undefined,
    noteContactName: "Alex Doe",
    pending: false,
    onSave: () => undefined,
    saveLabel: "保存",
    replyTarget: { kind: "thread" as const, threadId: "thread_1", href: "/inbox/thread_1" },
    onScheduleMeeting: () => undefined,
    judgementAnchorId: "opportunity-judgement-workspace",
    judgementLines: ["排序依据：优先级 P2（72）", "风险：中。未关联公司。"],
    ...overrides,
  };
}

describe("OpportunityListCard", () => {
  it("shows customer, demand excerpt, next step and the two actions only", () => {
    const html = renderToStaticMarkup(
      <OpportunityListCard
        english={false}
        title="Website inquiry: cannot try the product"
        stageLabel="新机会"
        sourceLabel="官网咨询邮件"
        dueChip={{ label: "10-17 前处理", overdue: false }}
        replyStatus="awaiting"
        receivedAt="10-14 10:43"
        contact={contact}
        companyName={null}
        demandExcerpt={FULL_TEXT}
        nextAction="Reply to the inquiry"
        ownerName="Owner One"
        replyTarget={{ kind: "thread", threadId: "thread_1", href: "/inbox/thread_1" }}
        onOpen={() => undefined}
      />,
    );

    expect(html).toContain("官网咨询邮件");
    expect(html).toContain("10-17 前处理");
    expect(html).toContain("收到于 10-14 10:43");
    expect(html).toContain("待回复");
    expect(html).toContain("Alex Doe");
    expect(html).toContain("alex@example.com");
    expect(html).toContain("未关联公司");
    expect(html).toContain("line-clamp-2");
    expect(html).toContain("下一步");
    expect(html).toContain("负责人");
    expect(html).toContain("打开");
    expect(html).toContain('href="/inbox/thread_1"');
    expect(html).toContain("去回复");
  });

  it("renders English copy and a mailto reply when no thread exists", () => {
    const html = renderToStaticMarkup(
      <OpportunityListCard
        english
        title="Pilot renewal"
        stageLabel="New"
        sourceLabel="Manual"
        dueChip={null}
        replyStatus="replied"
        receivedAt={null}
        contact={contact}
        companyName="Example Co"
        demandExcerpt={null}
        nextAction={null}
        ownerName={null}
        replyTarget={{ kind: "mailto", address: "alex@example.com" }}
        onOpen={() => undefined}
      />,
    );

    expect(html).toContain("Example Co");
    expect(html).toContain("Pilot renewal");
    expect(html).toContain("Not set");
    expect(html).toContain("Unassigned");
    expect(html).toContain("Replied");
    expect(html).toContain('href="mailto:alex@example.com"');
    expect(html).toContain("Reply");
  });
});

describe("OpportunityOriginalDemand", () => {
  it("renders the 来信全文 text in place of the truncated thread body, then later messages", () => {
    const threads = buildOriginalDemandThreads({
      nextStepSummary: `来信全文（alex@example.com，2026-10-14 02:43 UTC）：\n${FULL_TEXT}`,
      description: null,
      emailThreads: [
        {
          id: "thread_1",
          subject: "Cannot try the product",
          counterpart: "inbox@example.com",
          source: "IMPORT",
          createdAt: new Date("2026-10-14T02:43:00Z"),
          messages: [
            {
              id: "m1",
              sender: "Alex Doe",
              senderEmail: "alex@example.com",
              body: FULL_TEXT.slice(0, 30),
              snippet: null,
              isInbound: true,
              sentAt: new Date("2026-10-14T02:43:13Z"),
            },
            {
              id: "m2",
              sender: "Support",
              senderEmail: "support@example.com",
              body: "We are checking the line.",
              snippet: null,
              isInbound: false,
              sentAt: new Date("2026-10-15T02:00:00Z"),
            },
          ],
        },
      ],
    });
    const html = renderToStaticMarkup(
      <OpportunityOriginalDemand
        english={false}
        threads={threads}
        threadTotal={1}
        fallback={{ text: null, source: "none" }}
        replyStatus="replied"
      />,
    );

    expect(html).toContain("客户原话");
    expect(html).toContain("Cannot try the product");
    expect(html).toContain(FULL_TEXT);
    expect(html).toContain("我方回复");
    expect(html).toContain("已回复");
    expect(html).not.toContain("已截断");
    expect(html).toContain("We are checking the line.");
    expect(html.indexOf(FULL_TEXT)).toBeLessThan(html.indexOf("We are checking the line."));
  });

  it("falls back to the description and to an empty state", () => {
    const withDescription = renderToStaticMarkup(
      <OpportunityOriginalDemand
        english
        threads={[]}
        threadTotal={0}
        fallback={{ text: "Short snippet", source: "description" }}
        replyStatus={null}
      />,
    );
    const empty = renderToStaticMarkup(
      <OpportunityOriginalDemand
        english={false}
        threads={[]}
        threadTotal={0}
        fallback={{ text: null, source: "none" }}
        replyStatus={null}
      />,
    );

    expect(withDescription).toContain("From the opportunity description");
    expect(withDescription).toContain("Short snippet");
    expect(empty).toContain("还没有记录客户原话");
  });
});

describe("OpportunityHandlingCard", () => {
  it("keeps 系统判断 collapsed as the last block of the card", () => {
    const html = renderToStaticMarkup(<OpportunityHandlingCard {...handlingProps()} />);

    expect(html).toContain("下一步动作");
    expect(html).toContain("截止");
    expect(html).toContain("阶段");
    expect(html).toContain("负责人");
    expect(html).toContain("备注");
    expect(html).toContain("保存");
    expect(html).toContain('href="/inbox/thread_1"');
    expect(html).toContain("去回复邮件");
    expect(html).toContain("安排会议");
    expect(html).toMatch(/<details id="opportunity-judgement-workspace"[^>]*>/);
    expect(html).not.toMatch(/<details[^>]*open/);
    expect(html).toContain("<summary");
    expect(html).toContain("系统判断");
    expect(html.lastIndexOf("</details>")).toBeGreaterThan(html.indexOf("安排会议"));
  });

  it("renders the reply address as plain text when there is no thread", () => {
    const html = renderToStaticMarkup(
      <OpportunityHandlingCard
        {...handlingProps({
          english: true,
          replyTarget: { kind: "mailto", address: "alex@example.com" },
          noteContactName: null,
        })}
      />,
    );

    expect(html).toContain('href="mailto:alex@example.com"');
    expect(html).toContain(">alex@example.com</a>");
    expect(html).not.toContain("Reply by email");
    expect(html).toContain("Link a contact to keep notes");
    expect(html).toContain("System judgement");
  });

  it("hides reply and meeting actions in create mode", () => {
    const html = renderToStaticMarkup(
      <OpportunityHandlingCard
        {...handlingProps({
          replyTarget: undefined,
          onScheduleMeeting: undefined,
          judgementLines: undefined,
          saveLabel: "创建机会",
        })}
      />,
    );

    expect(html).toContain("创建机会");
    expect(html).not.toContain("去回复邮件");
    expect(html).not.toContain("安排会议");
    expect(html).not.toContain("系统判断");
  });
});

describe("OpportunityCustomerCard", () => {
  it("shows contact, source, first contact and owner with the link/change buttons", () => {
    const html = renderToStaticMarkup(
      <OpportunityCustomerCard
        english={false}
        anchorId="opportunity-briefing"
        contacts={[contact]}
        companies={[{ id: "company_1", name: "Example Co" }]}
        companyId=""
        onCompanyChange={() => undefined}
        sourceLabel="官网咨询邮件"
        sourceDetail="inbox@example.com"
        firstContactAt="2026-10-14 10:43"
        ownerName="Owner One"
        onEditOwner={() => undefined}
      />,
    );

    expect(html).toContain('id="opportunity-briefing"');
    expect(html).toContain('href="/contacts/contact_1"');
    expect(html).toContain("alex@example.com");
    expect(html).toContain("未记录");
    expect(html).toContain("未关联");
    expect(html).toContain("关联");
    expect(html).toContain("官网咨询邮件 · inbox@example.com");
    expect(html).toContain("2026-10-14 10:43");
    expect(html).toContain("Owner One");
    expect(html).toContain("改");
  });
});

describe("opportunities page source", () => {
  const root = path.resolve(__dirname, "..", "..");
  const client = readFileSync(
    path.join(root, "features/opportunities/opportunities-client.tsx"),
    "utf8",
  );

  it("no longer renders the removed judgement prose in the main flow", () => {
    for (const removed of [
      "CustomerAssetFocusStrip",
      "ReportingProtocolPanel",
      "ProactiveMechanismPanel",
      "HomeSurfaceArrivalBanner",
      "建议推进顺序",
      "仍处在可推进窗口",
      "推进快照",
      "现在先改什么",
      "动作处理工作区",
      "机会摘要",
      "可健康推进的窗口",
      "SummaryStat",
    ]) {
      expect(client, removed).not.toContain(removed);
    }
  });

  it("wires the three detail cards and the count row", () => {
    for (const marker of [
      "<OpportunityCustomerCard",
      "<OpportunityOriginalDemand",
      "<OpportunityHandlingCard",
      "<OpportunityListCard",
      "saveOpportunityAction",
      "scheduleMeetingFromThreadAction",
      "createMeetingForContactAction",
      "addWorkingMemoryAction",
      "本周成交",
      "我负责的",
      "const businessLoopGapReadout = buildBusinessLoopGapReadout",
    ]) {
      expect(client, marker).toContain(marker);
    }
  });
});
