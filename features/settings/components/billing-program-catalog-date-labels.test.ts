import { describe, expect, it } from "vitest";
import { formatProgramCatalogDateLabel } from "@/features/settings/components/billing-program-catalog-date-labels";

const sampleDate = new Date(2026, 3, 15, 10, 30);

describe("billing program catalog date labels", () => {
  it("renders program catalog dates in English without Chinese fragments", () => {
    const rendered = formatProgramCatalogDateLabel(sampleDate, true, () => "04月15日 10:30");

    expect(rendered).toBe("Apr 15 10:30");
    expect(rendered).not.toMatch(/[月日]|未设置/);
  });

  it("delegates Chinese formatting to the existing date formatter", () => {
    expect(formatProgramCatalogDateLabel(sampleDate, false, () => "04月15日 10:30")).toBe(
      "04月15日 10:30",
    );
  });

  it("uses localized empty labels", () => {
    expect(formatProgramCatalogDateLabel(null, true, () => "未设置")).toBe("Not set");
    expect(formatProgramCatalogDateLabel(null, false, () => "未设置")).toBe("未设置");
  });
});
