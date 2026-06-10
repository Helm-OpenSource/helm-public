import { describe, expect, it } from "vitest";
import {
  formatCommercialNarrativeDateLabel,
  formatCommercialNarrativeRelativeLabel,
} from "./date-labels";

const chineseDateFragments = /[年月日今天明天昨天未设置前后]/;

describe("commercial narrative date labels", () => {
  it("formats English date labels without Chinese fragments", () => {
    const label = formatCommercialNarrativeDateLabel(
      new Date(2026, 0, 15, 9, 30),
      true,
    );

    expect(label).toContain("Jan");
    expect(label).not.toMatch(chineseDateFragments);
  });

  it("formats English relative labels without Chinese fragments", () => {
    const label = formatCommercialNarrativeRelativeLabel(
      new Date(Date.now() - 30 * 60 * 1000),
      true,
    );

    expect(label).toContain("ago");
    expect(label).not.toMatch(chineseDateFragments);
  });

  it("preserves Chinese date and relative labels", () => {
    expect(
      formatCommercialNarrativeDateLabel(new Date(2026, 0, 15, 9, 30), false),
    ).toMatch(chineseDateFragments);
    expect(
      formatCommercialNarrativeRelativeLabel(
        new Date(Date.now() - 30 * 60 * 1000),
        false,
      ),
    ).toMatch(chineseDateFragments);
  });
});
