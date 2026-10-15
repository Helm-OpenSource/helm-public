import { describe, expect, it } from "vitest";
import {
  buildOriginalDemandThreads,
  buildSystemJudgementLines,
  describeDueChip,
  extractInboundFullText,
  getOpportunitySourceLabel,
  hasUnansweredInbound,
  resolveOpportunitySourceKind,
  resolveReplyTarget,
  selectOriginalDemandText,
  summarizeOpportunityCounts,
  type CustomerFirstContact,
  type CustomerFirstEmailThread,
} from "@/features/opportunities/customer-first";

const FULL_TEXT_BODY =
  "Hello team,\n\nThe demo line in the product page does not connect during service hours. Could you confirm whether it is available and share another way to try the voice flow?\n\nThanks,\nAlex";

function contact(overrides: Partial<CustomerFirstContact> = {}): CustomerFirstContact {
  return {
    id: "contact_1",
    name: "Alex Doe",
    email: "alex@example.com",
    phone: null,
    channel: null,
    tags: null,
    ...overrides,
  };
}

function thread(overrides: Partial<CustomerFirstEmailThread> = {}): CustomerFirstEmailThread {
  return {
    id: "thread_1",
    subject: "Cannot try the product",
    counterpart: "Alex Doe",
    source: "IMPORT",
    createdAt: new Date("2026-10-14T02:43:00Z"),
    messages: [
      {
        id: "message_1",
        sender: "Alex Doe",
        senderEmail: "alex@example.com",
        body: FULL_TEXT_BODY.slice(0, 60),
        snippet: FULL_TEXT_BODY.slice(0, 60),
        isInbound: true,
        sentAt: new Date("2026-10-14T02:43:13Z"),
      },
    ],
    ...overrides,
  };
}

describe("extractInboundFullText", () => {
  it("strips the 来信全文 prefix with sender and time in full-width parentheses", () => {
    expect(
      extractInboundFullText(`来信全文（alex@example.com，2026-10-14 02:43 UTC）：\n${FULL_TEXT_BODY}`),
    ).toBe(FULL_TEXT_BODY);
  });

  it("accepts the prefix without parentheses and with an ASCII colon", () => {
    expect(extractInboundFullText(`来信全文: ${FULL_TEXT_BODY}`)).toBe(FULL_TEXT_BODY);
  });

  it("ignores summaries that are not mailbox full text", () => {
    expect(extractInboundFullText("Follow up on pricing next week")).toBeNull();
    expect(extractInboundFullText("说明：来信全文（x）：正文")).toBeNull();
    expect(extractInboundFullText(null)).toBeNull();
    expect(extractInboundFullText("来信全文（x）：   ")).toBeNull();
  });
});

describe("selectOriginalDemandText", () => {
  it("prefers the 来信全文 text when the thread body is a truncated copy", () => {
    const result = selectOriginalDemandText({
      nextStepSummary: `来信全文（alex@example.com，2026-10-14 02:43 UTC）：\n${FULL_TEXT_BODY}`,
      description: FULL_TEXT_BODY.slice(0, 60),
      emailThreads: [thread()],
    });

    expect(result).toEqual({ text: FULL_TEXT_BODY, source: "full-text" });
  });

  it("keeps the thread body when it is at least as long as the stored full text", () => {
    const longBody = `${FULL_TEXT_BODY}\n\nP.S. one more detail.`;
    const result = selectOriginalDemandText({
      nextStepSummary: `来信全文（alex@example.com）：${FULL_TEXT_BODY}`,
      description: null,
      emailThreads: [
        thread({
          messages: [{ ...thread().messages[0], body: longBody }],
        }),
      ],
    });

    expect(result).toEqual({ text: longBody, source: "thread" });
  });

  it("never treats an ordinary next-step summary as customer words", () => {
    const result = selectOriginalDemandText({
      nextStepSummary: "Send the revised proposal and confirm the pilot scope.",
      description: null,
      emailThreads: [thread()],
    });

    expect(result).toEqual({ text: FULL_TEXT_BODY.slice(0, 60), source: "thread" });
  });

  it("uses the full text when there is no linked thread", () => {
    expect(
      selectOriginalDemandText({
        nextStepSummary: `来信全文（alex@example.com）：${FULL_TEXT_BODY}`,
        description: "short snippet",
        emailThreads: [],
      }),
    ).toEqual({ text: FULL_TEXT_BODY, source: "full-text" });
  });

  it("falls back to the description, then to nothing", () => {
    expect(
      selectOriginalDemandText({
        nextStepSummary: null,
        description: "  short snippet  ",
        emailThreads: [],
      }),
    ).toEqual({ text: "short snippet", source: "description" });
    expect(
      selectOriginalDemandText({
        nextStepSummary: null,
        description: null,
        emailThreads: [],
      }),
    ).toEqual({ text: null, source: "none" });
  });

  it("only considers inbound messages as the customer's words", () => {
    const result = selectOriginalDemandText({
      nextStepSummary: null,
      description: "fallback",
      emailThreads: [
        thread({
          messages: [{ ...thread().messages[0], isInbound: false, body: "Our reply" }],
        }),
      ],
    });

    expect(result).toEqual({ text: "fallback", source: "description" });
  });
});

describe("buildOriginalDemandThreads", () => {
  it("replaces only the first inbound message with the full text and appends later messages in order", () => {
    const base = thread();
    const threads = buildOriginalDemandThreads({
      nextStepSummary: `来信全文（alex@example.com）：${FULL_TEXT_BODY}`,
      description: null,
      emailThreads: [
        {
          ...base,
          messages: [
            {
              id: "message_3",
              sender: "Alex Doe",
              senderEmail: "alex@example.com",
              body: "Any update?",
              snippet: null,
              isInbound: true,
              sentAt: new Date("2026-10-16T01:00:00Z"),
            },
            {
              id: "message_2",
              sender: "Support",
              senderEmail: "support@example.com",
              body: "We are checking the line.",
              snippet: null,
              isInbound: false,
              sentAt: new Date("2026-10-15T01:00:00Z"),
            },
            base.messages[0],
          ],
        },
      ],
    });

    expect(threads).toHaveLength(1);
    expect(threads[0].entries.map((entry) => entry.id)).toEqual([
      "message_1",
      "message_2",
      "message_3",
    ]);
    expect(threads[0].entries[0]).toMatchObject({ body: FULL_TEXT_BODY, fromFullText: true });
    expect(threads[0].entries[1]).toMatchObject({
      body: "We are checking the line.",
      isInbound: false,
      fromFullText: false,
    });
    expect(threads[0].entries[2]).toMatchObject({ body: "Any update?", fromFullText: false });
  });

  it("keeps thread bodies untouched when the full text is not longer", () => {
    const threads = buildOriginalDemandThreads({
      nextStepSummary: null,
      description: null,
      emailThreads: [thread()],
    });

    expect(threads[0].entries[0]).toMatchObject({
      body: FULL_TEXT_BODY.slice(0, 60),
      fromFullText: false,
    });
  });
});

describe("resolveOpportunitySourceKind / getOpportunitySourceLabel", () => {
  it("labels mailbox-imported website inquiries", () => {
    const byTag = resolveOpportunitySourceKind({
      externalSource: null,
      contacts: [contact({ tags: JSON.stringify(["官网咨询"]) })],
      emailThreads: [],
    });
    const byImportedThreadAndChannel = resolveOpportunitySourceKind({
      externalSource: null,
      contacts: [contact({ channel: "邮箱" })],
      emailThreads: [thread()],
    });

    expect(byTag).toBe("website-inquiry");
    expect(byImportedThreadAndChannel).toBe("website-inquiry");
    expect(getOpportunitySourceLabel("website-inquiry", false)).toBe("官网咨询邮件");
    expect(getOpportunitySourceLabel("website-inquiry", true)).toBe("Website inquiry email");
  });

  it("does not call every imported thread a website inquiry", () => {
    expect(
      resolveOpportunitySourceKind({
        externalSource: null,
        contacts: [contact()],
        emailThreads: [thread()],
      }),
    ).toBe("email");
  });

  it("keeps recording, CRM import and manual labels", () => {
    expect(
      resolveOpportunitySourceKind({
        externalSource: "TRANSCRIPT_INGEST",
        contacts: [],
        emailThreads: [],
      }),
    ).toBe("recording");
    expect(
      resolveOpportunitySourceKind({
        externalSource: "HUBSPOT",
        contacts: [],
        emailThreads: [],
      }),
    ).toBe("imported");
    expect(
      resolveOpportunitySourceKind({
        externalSource: null,
        contacts: [contact()],
        emailThreads: [],
      }),
    ).toBe("manual");
    expect(getOpportunitySourceLabel("recording", false)).toBe("录制");
    expect(getOpportunitySourceLabel("manual", false)).toBe("手工");
    expect(getOpportunitySourceLabel("manual", true)).toBe("Manual");
  });
});

describe("resolveReplyTarget", () => {
  it("routes to the inbox thread page when a thread exists", () => {
    expect(resolveReplyTarget({ contacts: [contact()], emailThreads: [thread()] })).toEqual({
      kind: "thread",
      threadId: "thread_1",
      href: "/inbox/thread_1",
    });
  });

  it("falls back to the contact address, then to nothing", () => {
    expect(resolveReplyTarget({ contacts: [contact()], emailThreads: [] })).toEqual({
      kind: "mailto",
      address: "alex@example.com",
    });
    expect(
      resolveReplyTarget({ contacts: [contact({ email: null })], emailThreads: [] }),
    ).toBeNull();
  });
});

describe("hasUnansweredInbound", () => {
  it("is true when the latest message is inbound", () => {
    expect(hasUnansweredInbound([thread()])).toBe(true);
    expect(
      hasUnansweredInbound([
        thread({
          messages: [
            thread().messages[0],
            {
              id: "reply",
              sender: "Support",
              senderEmail: "support@example.com",
              body: "Reply",
              snippet: null,
              isInbound: false,
              sentAt: new Date("2026-10-15T00:00:00Z"),
            },
          ],
        }),
      ]),
    ).toBe(false);
    expect(hasUnansweredInbound([])).toBe(false);
  });
});

describe("summarizeOpportunityCounts", () => {
  it("counts pending, open overdue, won this week and mine", () => {
    const now = new Date("2026-10-15T12:00:00");
    const counts = summarizeOpportunityCounts(
      [
        { stage: "NEW", dueDate: new Date("2026-10-17T00:00:00"), updatedAt: now, owner: { id: "me" } },
        { stage: "ADVANCING", dueDate: new Date("2026-10-10T00:00:00"), updatedAt: now, owner: null },
        { stage: "DONE", dueDate: new Date("2026-10-01T00:00:00"), updatedAt: new Date("2026-10-13T09:00:00"), owner: { id: "me" } },
        { stage: "DONE", dueDate: null, updatedAt: new Date("2026-10-05T09:00:00"), owner: { id: "other" } },
        { stage: "LOST", dueDate: new Date("2026-10-01T00:00:00"), updatedAt: now, owner: null },
      ],
      { currentUserId: "me", now },
    );

    expect(counts).toEqual({ pending: 2, overdue: 1, wonThisWeek: 1, mine: 2 });
  });
});

describe("describeDueChip / buildSystemJudgementLines", () => {
  const now = new Date("2026-10-15T12:00:00");

  it("labels due and overdue chips in both languages", () => {
    expect(
      describeDueChip(new Date("2026-10-17T05:14:00"), { stage: "NEW", now, english: false }),
    ).toEqual({ label: "10-17 前处理", overdue: false });
    expect(
      describeDueChip(new Date("2026-10-12T05:14:00"), { stage: "NEW", now, english: true }),
    ).toEqual({ label: "Overdue · 10-12", overdue: true });
    expect(
      describeDueChip(new Date("2026-10-12T05:14:00"), { stage: "DONE", now, english: false }),
    ).toEqual({ label: "10-12 前处理", overdue: false });
    expect(describeDueChip(null, { stage: "NEW", now, english: false })).toBeNull();
  });

  it("collapses ranking, risk and the KPI note into short lines", () => {
    const lines = buildSystemJudgementLines({
      english: false,
      rank: 1,
      total: 3,
      priorityLabel: "P2",
      priorityScore: 72,
      dueChip: { label: "10-17 前处理", overdue: false },
      riskLabel: "中",
      riskReasons: ["未关联公司", "未回复"],
      kpiNote: "缺当前 KPI 或周报基线，暂时不能判断结果变化。",
      recommendationTitle: null,
    });

    expect(lines).toEqual([
      "排序依据：优先级 P2（72），10-17 前处理；当前列表第 1 / 3 位。",
      "风险：中。未关联公司、未回复。",
      "缺口径：缺当前 KPI 或周报基线，暂时不能判断结果变化。",
    ]);

    const english = buildSystemJudgementLines({
      english: true,
      rank: null,
      total: 3,
      priorityLabel: "P3",
      priorityScore: 50,
      dueChip: null,
      riskLabel: "High",
      riskReasons: [],
      kpiNote: null,
      recommendationTitle: "Reply to the inquiry",
    });

    expect(english).toEqual([
      "Ranking: priority P3 (50), no due date; outside the current filter.",
      "Risk: High.",
      "System suggestion: Reply to the inquiry",
    ]);
  });
});
