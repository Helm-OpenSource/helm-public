import { describe, expect, it } from "vitest";
import { getProgramCatalogCopy } from "@/lib/billing/program-catalog";

const programKeys = [
  "worker_publisher_program",
  "custom_partner_program",
  "sales_referral_program",
];

const defaultChineseBlockedTerms = [
  "worker",
  "marketplace",
  "review",
  "manual settlement",
  "off-platform",
  "payable-later",
  "portal access",
  "accepted",
  "rejected",
  "waitlisted",
  "invited",
  "scope",
  "active",
  "partner application",
  "referral 的",
  "reversal",
  "line",
  "邀请d",
  "finance-console",
];

describe("program catalog display copy", () => {
  it("keeps Chinese public catalog copy free of raw participation-system terms", () => {
    const copyText = programKeys
      .map((programKey) => {
        const copy = getProgramCatalogCopy(programKey, "zh-CN");
        expect(copy).not.toBeNull();
        return Object.values(copy ?? {}).join("\n");
      })
      .join("\n");

    for (const term of defaultChineseBlockedTerms) {
      expect(copyText.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("keeps English public catalog copy unchanged for partner-facing specificity", () => {
    expect(getProgramCatalogCopy("worker_publisher_program", "en-US")?.title).toBe(
      "Worker Publisher Program",
    );
  });
});
