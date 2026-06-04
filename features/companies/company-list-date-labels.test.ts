import { describe, expect, it } from "vitest";
import { formatCompanyListDateLabel } from "./company-list-date-labels";

describe("formatCompanyListDateLabel", () => {
  it("keeps Chinese date labels on the existing formatter path", () => {
    const label = formatCompanyListDateLabel("2026-07-06T03:30:00.000Z", false);

    expect(label).toMatch(/^07月06日 \d{2}:30$/u);
    expect(label).toMatch(/[\u3400-\u9fff]/u);
  });

  it("formats English dates without Chinese date tokens", () => {
    const label = formatCompanyListDateLabel("2026-07-06T03:30:00.000Z", true);

    expect(label).toMatch(/^Jul 6 \d{2}:30$/u);
    expect(label).not.toMatch(/[\u3400-\u9fff]/u);
  });

  it("uses an English missing-value fallback", () => {
    expect(formatCompanyListDateLabel(null, true)).toBe("Not set");
  });
});
