import { describe, expect, it } from "vitest";

import { formatDashboardEvidenceDateLabel } from "./evidence-date-labels";

function formatChineseDateLabel(value: Date | string | null | undefined) {
  if (!value) return "未设置";
  const date = typeof value === "string" ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hours}:${minutes}`;
}

describe("formatDashboardEvidenceDateLabel", () => {
  it("keeps Chinese date labels on zh-CN dashboard evidence", () => {
    const sample = new Date(2026, 4, 21, 16, 8);

    expect(formatDashboardEvidenceDateLabel(sample, false, formatChineseDateLabel)).toBe("05月21日 16:08");
  });

  it("formats dashboard evidence dates in English on en-US surfaces", () => {
    const sample = new Date(2026, 4, 21, 16, 8);

    expect(formatDashboardEvidenceDateLabel(sample, true, formatChineseDateLabel)).toBe("May 21 16:08");
  });

  it("localizes empty dashboard evidence dates", () => {
    expect(formatDashboardEvidenceDateLabel(null, false, formatChineseDateLabel)).toBe("未设置");
    expect(formatDashboardEvidenceDateLabel(null, true, formatChineseDateLabel)).toBe("Not set");
  });
});
