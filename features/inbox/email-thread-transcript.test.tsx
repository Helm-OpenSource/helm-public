import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CustomerEmailThreadsCard,
  EmailThreadTranscript,
  orderEmailThreadsNewestFirst,
  summarizeEmailThreadLatest,
  type EmailTranscriptThread,
} from "@/features/inbox/email-thread-transcript";

const longBody = `${"我在官网看到可以呼入体验，但一直无法接通。".repeat(30)}最后一句。`;

function message(
  id: string,
  sentAt: string,
  isInbound: boolean,
  body = `正文 ${id}`,
) {
  return {
    id,
    sender: isInbound ? "赵雪" : "车栋",
    senderEmail: isInbound ? "zhao@example.com" : "che@example.com",
    body,
    isInbound,
    sentAt: new Date(sentAt),
  };
}

function thread(
  id: string,
  messages: EmailTranscriptThread["messages"],
  overrides: Partial<EmailTranscriptThread> = {},
): EmailTranscriptThread {
  return {
    id,
    subject: `主题 ${id}`,
    counterpart: "赵雪",
    status: "OPEN",
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    messages,
    ...overrides,
  };
}

describe("summarizeEmailThreadLatest", () => {
  it("reads the latest message by send time, not by array position", () => {
    const summary = summarizeEmailThreadLatest([
      message("b", "2026-10-14T02:43:00Z", true),
      message("a", "2026-10-13T02:00:00Z", false),
    ]);

    expect(summary.latest?.id).toBe("b");
    expect(summary.awaitingOurReply).toBe(true);
    expect(summary.ordered.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("treats a thread whose last message is ours as waiting on them", () => {
    const summary = summarizeEmailThreadLatest([
      message("a", "2026-10-13T02:00:00Z", true),
      message("b", "2026-10-14T02:43:00Z", false),
    ]);

    expect(summary.awaitingOurReply).toBe(false);
  });

  it("returns no latest message for an empty thread", () => {
    expect(summarizeEmailThreadLatest([]).latest).toBeNull();
  });
});

describe("orderEmailThreadsNewestFirst", () => {
  it("orders threads by their latest message", () => {
    const ordered = orderEmailThreadsNewestFirst([
      thread("old", [message("o", "2026-10-01T00:00:00Z", true)], {
        updatedAt: new Date("2026-10-15T00:00:00Z"),
      }),
      thread("new", [message("n", "2026-10-14T00:00:00Z", true)]),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["new", "old"]);
  });
});

describe("EmailThreadTranscript", () => {
  it("renders full message bodies without truncation", () => {
    const html = renderToStaticMarkup(
      <EmailThreadTranscript
        thread={thread("t", [message("m", "2026-10-14T02:43:00Z", true, longBody)])}
        english={false}
      />,
    );

    expect(html).toContain("最后一句。");
    expect(html).not.toContain("data-email-thread-truncated");
  });

  it("states how many earlier messages were cut and links to the full thread", () => {
    const html = renderToStaticMarkup(
      <EmailThreadTranscript
        thread={thread("t", [
          message("1", "2026-10-10T00:00:00Z", true),
          message("2", "2026-10-11T00:00:00Z", false),
          message("3", "2026-10-12T00:00:00Z", true),
        ])}
        english={false}
        maxMessages={2}
      />,
    );

    expect(html).toContain('data-email-thread-truncated="1"');
    expect(html).toContain("更早的 1 封邮件未显示");
    expect(html).toContain('href="/inbox/t"');
    expect(html).not.toContain("正文 1");
    expect(html).toContain("正文 3");
  });
});

describe("CustomerEmailThreadsCard", () => {
  it("renders nothing when there are no threads", () => {
    expect(
      renderToStaticMarkup(<CustomerEmailThreadsCard threads={[]} english={false} />),
    ).toBe("");
  });

  it("derives the unanswered state from the full thread even when messages are capped", () => {
    const html = renderToStaticMarkup(
      <CustomerEmailThreadsCard
        threads={[
          thread("t", [
            message("1", "2026-10-10T00:00:00Z", false),
            message("2", "2026-10-11T00:00:00Z", false),
            message("3", "2026-10-12T00:00:00Z", true),
          ]),
        ]}
        english
        maxMessagesPerThread={1}
      />,
    );

    expect(html).toContain("Customer&#x27;s words");
    expect(html).toContain("not answered yet");
    expect(html).toContain("2 earlier messages not shown");
  });

  it("states how many threads were left out", () => {
    const html = renderToStaticMarkup(
      <CustomerEmailThreadsCard
        threads={[
          thread("a", [message("a1", "2026-10-10T00:00:00Z", true)]),
          thread("b", [message("b1", "2026-10-11T00:00:00Z", true)]),
        ]}
        english={false}
        maxThreads={1}
      />,
    );

    expect(html).toContain('data-email-threads-truncated="1"');
    expect(html).toContain("主题 b");
    expect(html).not.toContain("主题 a");
  });
});
