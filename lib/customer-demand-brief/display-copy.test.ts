import { describe, expect, it } from "vitest";
import {
  formatCustomerDemandBriefCustomerConfirmationBadgeVariant,
  formatCustomerDemandBriefCustomerConfirmationStatusLabel,
  formatCustomerDemandBriefEntryModeLabel,
  formatCustomerDemandBriefReviewStatusBadgeVariant,
  formatCustomerDemandBriefReviewStatusLabel,
} from "./display-copy";

describe("entry mode labels", () => {
  it("is bilingual", () => {
    expect(formatCustomerDemandBriefEntryModeLabel("SALES_LED", false)).toBe(
      "销售预填",
    );
    expect(formatCustomerDemandBriefEntryModeLabel("SELF_SERVE", true)).toBe(
      "Self-serve",
    );
  });
});

describe("review status labels + badge variants", () => {
  it("DRAFT is info / 草稿", () => {
    expect(formatCustomerDemandBriefReviewStatusLabel("DRAFT", false)).toBe(
      "草稿",
    );
    expect(formatCustomerDemandBriefReviewStatusBadgeVariant("DRAFT")).toBe(
      "info",
    );
  });

  it("REVIEW_REQUIRED is warning", () => {
    expect(
      formatCustomerDemandBriefReviewStatusBadgeVariant("REVIEW_REQUIRED"),
    ).toBe("warning");
  });

  it("APPROVED_FOR_TRIAL_INIT is success", () => {
    expect(
      formatCustomerDemandBriefReviewStatusBadgeVariant("APPROVED_FOR_TRIAL_INIT"),
    ).toBe("success");
    expect(
      formatCustomerDemandBriefReviewStatusLabel("APPROVED_FOR_TRIAL_INIT", true),
    ).toContain("Approved");
  });

  it("REJECTED is danger and SUPERSEDED is neutral", () => {
    expect(formatCustomerDemandBriefReviewStatusBadgeVariant("REJECTED")).toBe(
      "danger",
    );
    expect(formatCustomerDemandBriefReviewStatusBadgeVariant("SUPERSEDED")).toBe(
      "neutral",
    );
  });
});

describe("customer confirmation labels + badge variants", () => {
  it("NOT_INVITED is neutral", () => {
    expect(
      formatCustomerDemandBriefCustomerConfirmationBadgeVariant("NOT_INVITED"),
    ).toBe("neutral");
  });

  it("PENDING_CUSTOMER is info", () => {
    expect(
      formatCustomerDemandBriefCustomerConfirmationBadgeVariant("PENDING_CUSTOMER"),
    ).toBe("info");
  });

  it("FULLY_CONFIRMED is success and CHANGE_REQUESTED is warning", () => {
    expect(
      formatCustomerDemandBriefCustomerConfirmationBadgeVariant("FULLY_CONFIRMED"),
    ).toBe("success");
    expect(
      formatCustomerDemandBriefCustomerConfirmationBadgeVariant("CHANGE_REQUESTED"),
    ).toBe("warning");
  });

  it("emits bilingual labels", () => {
    expect(
      formatCustomerDemandBriefCustomerConfirmationStatusLabel(
        "CHANGE_REQUESTED",
        false,
      ),
    ).toContain("变更");
    expect(
      formatCustomerDemandBriefCustomerConfirmationStatusLabel(
        "CHANGE_REQUESTED",
        true,
      ),
    ).toContain("Change");
  });
});
