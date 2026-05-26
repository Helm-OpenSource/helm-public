import { describe, expect, it } from "vitest";
import { formatInboxMessageBody } from "@/features/inbox/message-formatting";

describe("formatInboxMessageBody", () => {
  it("normalizes html-heavy content into readable plain text", () => {
    const formatted = formatInboxMessageBody(
      "<div>您好&nbsp;，请看下方内容：</div><p>第一行<br/>第二行</p><blockquote>历史引用</blockquote>",
    );

    expect(formatted).toContain("您好");
    expect(formatted).toContain("第一行");
    expect(formatted).toContain("第二行");
    expect(formatted).not.toContain("<div>");
  });

  it("keeps line breaks for full-detail reading", () => {
    const formatted = formatInboxMessageBody("第1行\r\n\r\n第2行\n\n\n第3行");

    expect(formatted).toBe("第1行\n\n第2行\n\n第3行");
  });

  it("formats seeded business terms on Chinese inbox detail surfaces", () => {
    const formatted = formatInboxMessageBody(
      "今天聊得很好，等你们的合作 brief，我们下周可以继续推进。",
      false,
    );

    expect(formatted).toContain("合作摘要");
    expect(formatted).not.toMatch(/\bbrief\b/i);
  });
});
