import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatOpportunityDateLabel,
  formatOpportunityRelativeLabel,
} from "./opportunity-date-labels";

describe("opportunity date labels", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T04:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps Chinese date labels delegated to the existing formatter", () => {
    expect(
      formatOpportunityDateLabel(
        "2026-06-06T03:30:00.000Z",
        false,
        () => "明天 11:30",
      ),
    ).toBe("明天 11:30");
  });

  it("formats English absolute dates without Chinese tokens", () => {
    const label = formatOpportunityDateLabel(
      "2026-06-06T03:30:00.000Z",
      true,
      () => "明天 11:30",
    );

    expect(label).toMatch(/^Jun 6 \d{2}:30$/u);
    expect(label).not.toMatch(/[\u3400-\u9fff]/u);
  });

  it("formats English relative dates without Chinese suffixes", () => {
    expect(
      formatOpportunityRelativeLabel(
        "2026-06-05T03:30:00.000Z",
        true,
        () => "30 分钟前",
      ),
    ).toBe("30 minutes ago");
  });

  it("keeps Chinese relative labels delegated to the existing formatter", () => {
    expect(
      formatOpportunityRelativeLabel(
        "2026-06-05T03:30:00.000Z",
        false,
        () => "30 分钟前",
      ),
    ).toBe("30 分钟前");
  });

  it("uses English fallbacks for missing values", () => {
    expect(formatOpportunityDateLabel(null, true, () => "未设置")).toBe(
      "Not set",
    );
    expect(formatOpportunityRelativeLabel(null, true, () => "暂无")).toBe(
      "No recent update",
    );
  });
});
