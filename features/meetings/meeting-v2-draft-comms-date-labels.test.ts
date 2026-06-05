import { describe, expect, it } from "vitest";

import { formatMeetingDraftCommsDateLabel } from "./meeting-v2-draft-comms-date-labels";

function formatChineseDateLabel(value: Date | string | null | undefined) {
  if (!value) return "未设置";
  const date = typeof value === "string" ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hours}:${minutes}`;
}

describe("formatMeetingDraftCommsDateLabel", () => {
  it("keeps Chinese date labels on zh-CN draft comms surfaces", () => {
    const sample = new Date(2026, 9, 6, 14, 12);

    expect(formatMeetingDraftCommsDateLabel(sample, false, formatChineseDateLabel)).toBe("10月06日 14:12");
  });

  it("formats draft comms dates in English on en-US surfaces", () => {
    const sample = new Date(2026, 9, 6, 14, 12);

    expect(formatMeetingDraftCommsDateLabel(sample, true, formatChineseDateLabel)).toBe("Oct 6 14:12");
  });

  it("localizes empty draft comms dates", () => {
    expect(formatMeetingDraftCommsDateLabel(null, false, formatChineseDateLabel)).toBe("未设置");
    expect(formatMeetingDraftCommsDateLabel(null, true, formatChineseDateLabel)).toBe("Not set");
  });
});
