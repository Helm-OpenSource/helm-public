import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateLabel } from "@/lib/utils";
import { formatConversationChainDateLabel } from "@/features/conversation-chain-extension/conversation-chain-date-labels";

describe("formatConversationChainDateLabel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the existing Chinese conversation-chain date format", () => {
    // formatDateLabel 对今天/明天/昨天返回相对文案，夹具是写死的绝对日期，
    // 所以时钟也要一起冻住：否则真实日期落到 08-13/14/15 这三天，断言必红。
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 0));

    const date = new Date(2026, 7, 14, 11, 45);

    expect(formatConversationChainDateLabel(date, false, formatDateLabel)).toBe(
      "08月14日 11:45",
    );
  });

  it("formats English conversation-chain dates without Chinese date tokens", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    const label = formatConversationChainDateLabel(
      date,
      true,
      formatDateLabel,
    );

    expect(label).toBe("Aug 14 11:45");
    expect(label).not.toMatch(/[年月日]|今天|明天|昨天/);
  });

  it("uses an English fallback for empty values", () => {
    expect(formatConversationChainDateLabel(null, true, formatDateLabel)).toBe(
      "Not set",
    );
  });
});
