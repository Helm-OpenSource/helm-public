import { describe, expect, it } from "vitest";

import { formatInboxDateLabel } from "./inbox-date-labels";

function formatChineseDateLabel(value: Date | string | null | undefined) {
  if (!value) return "未设置";
  const date = typeof value === "string" ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hours}:${minutes}`;
}

describe("formatInboxDateLabel", () => {
  it("keeps Chinese date labels on zh-CN inbox surfaces", () => {
    const sample = new Date(2026, 6, 8, 15, 40);

    expect(formatInboxDateLabel(sample, false, formatChineseDateLabel)).toBe("07月08日 15:40");
  });

  it("formats inbox date labels in English on en-US surfaces", () => {
    const sample = new Date(2026, 6, 8, 15, 40);

    expect(formatInboxDateLabel(sample, true, formatChineseDateLabel)).toBe("Jul 8 15:40");
  });

  it("localizes empty inbox date labels", () => {
    expect(formatInboxDateLabel(null, false, formatChineseDateLabel)).toBe("未设置");
    expect(formatInboxDateLabel(null, true, formatChineseDateLabel)).toBe("Not set");
  });
});
