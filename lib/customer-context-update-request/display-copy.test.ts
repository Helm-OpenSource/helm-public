import { describe, expect, it } from "vitest";
import {
  formatCustomerContextUpdateRequestMaterialityBadgeVariant,
  formatCustomerContextUpdateRequestMaterialityLabel,
  formatCustomerContextUpdateRequestOriginLabel,
  formatCustomerContextUpdateRequestReviewStatusBadgeVariant,
  formatCustomerContextUpdateRequestReviewStatusLabel,
  formatCustomerContextUpdateRequestScopeLabel,
} from "./display-copy";

describe("origin labels", () => {
  it("is bilingual", () => {
    expect(formatCustomerContextUpdateRequestOriginLabel("CUSTOMER", false)).toBe(
      "客户发起",
    );
    expect(formatCustomerContextUpdateRequestOriginLabel("INTERNAL", true)).toBe(
      "Internal-initiated",
    );
  });
});

describe("scope labels", () => {
  it("is bilingual for all scopes", () => {
    expect(formatCustomerContextUpdateRequestScopeLabel("ROLES", false)).toBe(
      "角色 / 参与人",
    );
    expect(formatCustomerContextUpdateRequestScopeLabel("CONTROL_LINE", true)).toBe(
      "Control line",
    );
    expect(formatCustomerContextUpdateRequestScopeLabel("TRIAL_PAYLOAD", false)).toBe(
      "试用初始化载荷",
    );
  });
});

describe("materiality labels + badge variants", () => {
  it("MATERIAL label warns the reader review is required", () => {
    expect(formatCustomerContextUpdateRequestMaterialityLabel("MATERIAL", false)).toContain(
      "需复核",
    );
    expect(formatCustomerContextUpdateRequestMaterialityLabel("MATERIAL", true)).toContain(
      "review required",
    );
  });

  it("MINOR is neutral, MATERIAL is warning", () => {
    expect(
      formatCustomerContextUpdateRequestMaterialityBadgeVariant("MINOR"),
    ).toBe("neutral");
    expect(
      formatCustomerContextUpdateRequestMaterialityBadgeVariant("MATERIAL"),
    ).toBe("warning");
  });
});

describe("review status labels + badge variants", () => {
  it("returns bilingual labels for all 5 statuses", () => {
    expect(
      formatCustomerContextUpdateRequestReviewStatusLabel("DIRECT_APPLY", false),
    ).toBe("已直接生效");
    expect(
      formatCustomerContextUpdateRequestReviewStatusLabel("ACCEPTED", true),
    ).toBe("Accepted");
    expect(
      formatCustomerContextUpdateRequestReviewStatusLabel("SUPERSEDED", false),
    ).toContain("替代");
  });

  it("DIRECT_APPLY is info, REVIEW_REQUIRED is warning, ACCEPTED is success, REJECTED is danger, SUPERSEDED is neutral", () => {
    expect(
      formatCustomerContextUpdateRequestReviewStatusBadgeVariant("DIRECT_APPLY"),
    ).toBe("info");
    expect(
      formatCustomerContextUpdateRequestReviewStatusBadgeVariant("REVIEW_REQUIRED"),
    ).toBe("warning");
    expect(
      formatCustomerContextUpdateRequestReviewStatusBadgeVariant("ACCEPTED"),
    ).toBe("success");
    expect(
      formatCustomerContextUpdateRequestReviewStatusBadgeVariant("REJECTED"),
    ).toBe("danger");
    expect(
      formatCustomerContextUpdateRequestReviewStatusBadgeVariant("SUPERSEDED"),
    ).toBe("neutral");
  });
});
