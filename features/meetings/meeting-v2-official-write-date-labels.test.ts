import { describe, expect, it } from "vitest";

import { formatMeetingOfficialWriteDateLabel } from "./meeting-v2-official-write-date-labels";

function formatChineseDateLabel(value: Date | string | null | undefined) {
  if (!value) return "未设置";
  const date = typeof value === "string" ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hours}:${minutes}`;
}

describe("formatMeetingOfficialWriteDateLabel", () => {
  it("keeps Chinese date labels on zh-CN surfaces", () => {
    const sample = new Date(2026, 11, 3, 10, 25);

    expect(formatMeetingOfficialWriteDateLabel(sample, false, formatChineseDateLabel)).toBe("12月03日 10:25");
  });

  it("formats date labels in English on en-US surfaces", () => {
    const sample = new Date(2026, 11, 3, 10, 25);

    expect(formatMeetingOfficialWriteDateLabel(sample, true, formatChineseDateLabel)).toBe("Dec 3 10:25");
  });

  it("localizes empty date labels", () => {
    expect(formatMeetingOfficialWriteDateLabel(null, false, formatChineseDateLabel)).toBe("未设置");
    expect(formatMeetingOfficialWriteDateLabel(null, true, formatChineseDateLabel)).toBe("Not set");
  });
});
