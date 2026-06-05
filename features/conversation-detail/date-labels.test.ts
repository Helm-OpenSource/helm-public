import { describe, expect, it } from "vitest";
import {
  formatConversationDateLabel,
  formatConversationRelativeLabel,
} from "./date-labels";

const chineseDateFragments = /[年月日今天明天昨天未设置前后]/;

describe("conversation detail date labels", () => {
  it("formats English date labels without Chinese fragments", () => {
    const label = formatConversationDateLabel(
      new Date(2026, 0, 15, 9, 30),
      true,
    );

    expect(label).toContain("Jan");
    expect(label).not.toMatch(chineseDateFragments);
  });

  it("formats English relative labels without Chinese fragments", () => {
    const label = formatConversationRelativeLabel(
      new Date(Date.now() - 30 * 60 * 1000),
      true,
    );

    expect(label).toContain("ago");
    expect(label).not.toMatch(chineseDateFragments);
  });

  it("preserves Chinese date and relative labels", () => {
    expect(
      formatConversationDateLabel(new Date(2026, 0, 15, 9, 30), false),
    ).toMatch(chineseDateFragments);
    expect(
      formatConversationRelativeLabel(
        new Date(Date.now() - 30 * 60 * 1000),
        false,
      ),
    ).toMatch(chineseDateFragments);
  });
});
