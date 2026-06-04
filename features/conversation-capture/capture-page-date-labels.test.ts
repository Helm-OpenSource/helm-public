import { describe, expect, it } from "vitest";

import { formatCapturePageDateLabel } from "./capture-page-date-labels";

function formatChineseDateLabel(value: Date | string | null | undefined) {
  if (!value) return "未设置";
  const date = typeof value === "string" ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hours}:${minutes}`;
}

describe("formatCapturePageDateLabel", () => {
  it("keeps Chinese date labels on zh-CN capture surfaces", () => {
    const sample = new Date(2026, 8, 12, 9, 5);

    expect(formatCapturePageDateLabel(sample, false, formatChineseDateLabel)).toBe("09月12日 09:05");
  });

  it("formats capture page dates in English on en-US surfaces", () => {
    const sample = new Date(2026, 8, 12, 9, 5);

    expect(formatCapturePageDateLabel(sample, true, formatChineseDateLabel)).toBe("Sep 12 09:05");
  });

  it("localizes empty capture page dates", () => {
    expect(formatCapturePageDateLabel(null, false, formatChineseDateLabel)).toBe("未设置");
    expect(formatCapturePageDateLabel(null, true, formatChineseDateLabel)).toBe("Not set");
  });
});
