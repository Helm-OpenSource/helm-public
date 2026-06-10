import { describe, expect, it } from "vitest";

import { formatMeetingPageDateLabel } from "./meeting-page-date-labels";

function formatChineseDateLabel(value: Date | string | null | undefined) {
  if (!value) return "未设置";
  const date = typeof value === "string" ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hours}:${minutes}`;
}

describe("formatMeetingPageDateLabel", () => {
  it("keeps Chinese date labels on zh-CN meeting list surfaces", () => {
    const sample = new Date(2026, 10, 18, 8, 30);

    expect(formatMeetingPageDateLabel(sample, false, formatChineseDateLabel)).toBe("11月18日 08:30");
  });

  it("formats meeting list dates in English on en-US surfaces", () => {
    const sample = new Date(2026, 10, 18, 8, 30);

    expect(formatMeetingPageDateLabel(sample, true, formatChineseDateLabel)).toBe("Nov 18 08:30");
  });

  it("localizes empty meeting list dates", () => {
    expect(formatMeetingPageDateLabel(null, false, formatChineseDateLabel)).toBe("未设置");
    expect(formatMeetingPageDateLabel(null, true, formatChineseDateLabel)).toBe("Not set");
  });
});
