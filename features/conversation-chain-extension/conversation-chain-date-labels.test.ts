import { describe, expect, it } from "vitest";
import { formatDateLabel } from "@/lib/utils";
import { formatConversationChainDateLabel } from "@/features/conversation-chain-extension/conversation-chain-date-labels";

describe("formatConversationChainDateLabel", () => {
  it("keeps the existing Chinese conversation-chain date format", () => {
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
