import { describe, expect, it } from "vitest";
import { formatImportDateLabel } from "@/features/imports/import-date-labels";
import { formatDateLabel } from "@/lib/utils";

describe("formatImportDateLabel", () => {
  const sampleDate = new Date(2026, 3, 15, 10, 30);

  it("formats import dates with English month labels", () => {
    expect(formatImportDateLabel(sampleDate, true, formatDateLabel)).toBe("Apr 15 10:30");
  });

  it("delegates Chinese import dates to the existing formatter", () => {
    expect(formatImportDateLabel(sampleDate, false, formatDateLabel)).toBe("04月15日 10:30");
  });

  it("keeps empty import dates localized", () => {
    expect(formatImportDateLabel(null, true, formatDateLabel)).toBe("Not set");
    expect(formatImportDateLabel(null, false, formatDateLabel)).toBe("未设置");
  });
});
