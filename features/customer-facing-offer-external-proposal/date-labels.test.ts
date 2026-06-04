import { describe, expect, it } from "vitest";
import {
  formatOfferExternalDateLabel,
  formatOfferExternalRelativeLabel,
} from "./date-labels";

const chineseDateFragments = /[年月日今天明天昨天未设置前后]/;

describe("customer-facing offer external proposal date labels", () => {
  it("formats English date labels without Chinese fragments", () => {
    const label = formatOfferExternalDateLabel(
      new Date(2026, 0, 15, 9, 30),
      true,
    );

    expect(label).toContain("Jan");
    expect(label).not.toMatch(chineseDateFragments);
  });

  it("formats English relative labels without Chinese fragments", () => {
    const label = formatOfferExternalRelativeLabel(
      new Date(Date.now() - 30 * 60 * 1000),
      true,
    );

    expect(label).toContain("ago");
    expect(label).not.toMatch(chineseDateFragments);
  });

  it("preserves Chinese date and relative labels", () => {
    expect(
      formatOfferExternalDateLabel(new Date(2026, 0, 15, 9, 30), false),
    ).toMatch(chineseDateFragments);
    expect(
      formatOfferExternalRelativeLabel(
        new Date(Date.now() - 30 * 60 * 1000),
        false,
      ),
    ).toMatch(chineseDateFragments);
  });
});
