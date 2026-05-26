import { describe, expect, it } from "vitest";
import {
  CUSTOMER_DEMAND_BRIEF_CUSTOMER_CONFIRMATION_STATUSES,
  CUSTOMER_DEMAND_BRIEF_ENTRY_MODES,
  CUSTOMER_DEMAND_BRIEF_REVIEW_STATUSES,
  CUSTOMER_DEMAND_BRIEF_REVIEW_TRANSITIONS,
  emptyRoleMap,
  isValidCustomerDemandBriefCustomerConfirmationTransition,
  isValidCustomerDemandBriefReviewTransition,
  trialInitializationPayloadHasForbiddenKeys,
} from "./types";

describe("constants", () => {
  it("entry modes are exactly SALES_LED and SELF_SERVE", () => {
    expect(CUSTOMER_DEMAND_BRIEF_ENTRY_MODES).toEqual([
      "SALES_LED",
      "SELF_SERVE",
    ]);
  });

  it("review statuses cover the full V2.3 lifecycle", () => {
    expect(CUSTOMER_DEMAND_BRIEF_REVIEW_STATUSES).toContain("DRAFT");
    expect(CUSTOMER_DEMAND_BRIEF_REVIEW_STATUSES).toContain(
      "APPROVED_FOR_TRIAL_INIT",
    );
    expect(CUSTOMER_DEMAND_BRIEF_REVIEW_STATUSES).toContain("REJECTED");
    expect(CUSTOMER_DEMAND_BRIEF_REVIEW_STATUSES).toContain("SUPERSEDED");
  });

  it("customer confirmation statuses cover V2.3 §6.3 surface", () => {
    expect(CUSTOMER_DEMAND_BRIEF_CUSTOMER_CONFIRMATION_STATUSES).toContain(
      "NOT_INVITED",
    );
    expect(CUSTOMER_DEMAND_BRIEF_CUSTOMER_CONFIRMATION_STATUSES).toContain(
      "CHANGE_REQUESTED",
    );
  });
});

describe("isValidCustomerDemandBriefReviewTransition", () => {
  it("allows the happy path DRAFT → REVIEW_REQUIRED → APPROVED_FOR_TRIAL_INIT", () => {
    expect(isValidCustomerDemandBriefReviewTransition("DRAFT", "REVIEW_REQUIRED")).toBe(
      true,
    );
    expect(
      isValidCustomerDemandBriefReviewTransition(
        "REVIEW_REQUIRED",
        "APPROVED_FOR_TRIAL_INIT",
      ),
    ).toBe(true);
  });

  it("allows reviewer to send a brief back to DRAFT", () => {
    expect(isValidCustomerDemandBriefReviewTransition("REVIEW_REQUIRED", "DRAFT")).toBe(
      true,
    );
    expect(isValidCustomerDemandBriefReviewTransition("REJECTED", "DRAFT")).toBe(true);
  });

  it("allows downgrade from APPROVED_FOR_TRIAL_INIT back to REVIEW_REQUIRED when customer changes premise", () => {
    expect(
      isValidCustomerDemandBriefReviewTransition(
        "APPROVED_FOR_TRIAL_INIT",
        "REVIEW_REQUIRED",
      ),
    ).toBe(true);
  });

  it("treats SUPERSEDED as terminal", () => {
    expect(CUSTOMER_DEMAND_BRIEF_REVIEW_TRANSITIONS.SUPERSEDED).toHaveLength(0);
  });

  it("rejects forbidden jumps", () => {
    expect(
      isValidCustomerDemandBriefReviewTransition("DRAFT", "APPROVED_FOR_TRIAL_INIT"),
    ).toBe(false);
    expect(
      isValidCustomerDemandBriefReviewTransition("SUPERSEDED", "DRAFT"),
    ).toBe(false);
    expect(
      isValidCustomerDemandBriefReviewTransition(
        "APPROVED_FOR_TRIAL_INIT",
        "DRAFT",
      ),
    ).toBe(false);
  });

  it("self-transition is allowed (idempotent)", () => {
    expect(isValidCustomerDemandBriefReviewTransition("DRAFT", "DRAFT")).toBe(true);
  });
});

describe("isValidCustomerDemandBriefCustomerConfirmationTransition", () => {
  it("walks NOT_INVITED → PENDING_CUSTOMER → PARTIAL → FULLY", () => {
    expect(
      isValidCustomerDemandBriefCustomerConfirmationTransition(
        "NOT_INVITED",
        "PENDING_CUSTOMER",
      ),
    ).toBe(true);
    expect(
      isValidCustomerDemandBriefCustomerConfirmationTransition(
        "PENDING_CUSTOMER",
        "PARTIAL_CONFIRMED",
      ),
    ).toBe(true);
    expect(
      isValidCustomerDemandBriefCustomerConfirmationTransition(
        "PARTIAL_CONFIRMED",
        "FULLY_CONFIRMED",
      ),
    ).toBe(true);
  });

  it("allows CHANGE_REQUESTED from any confirmed state", () => {
    expect(
      isValidCustomerDemandBriefCustomerConfirmationTransition(
        "FULLY_CONFIRMED",
        "CHANGE_REQUESTED",
      ),
    ).toBe(true);
    expect(
      isValidCustomerDemandBriefCustomerConfirmationTransition(
        "PARTIAL_CONFIRMED",
        "CHANGE_REQUESTED",
      ),
    ).toBe(true);
  });

  it("rejects forbidden jumps", () => {
    expect(
      isValidCustomerDemandBriefCustomerConfirmationTransition(
        "NOT_INVITED",
        "FULLY_CONFIRMED",
      ),
    ).toBe(false);
  });
});

describe("trialInitializationPayloadHasForbiddenKeys", () => {
  it("returns empty when payload is clean", () => {
    const v = trialInitializationPayloadHasForbiddenKeys({
      acceptedBusinessGoals: ["x"],
      riskBoundaryNotes: [],
    });
    expect(v).toEqual([]);
  });

  it("flags referral / settlement / contribution / commission / payout / equity / internalNotes", () => {
    const v = trialInitializationPayloadHasForbiddenKeys({
      acceptedBusinessGoals: ["x"],
      referralId: "r1",
      settlementProposal: "s1",
      contribution_log: 1,
      commission: 0,
      payoutDate: "2026-05-12",
      equityGrant: 0.1,
      internalNote: "x",
      "sales-note": "x",
    });
    expect(v).toEqual(
      expect.arrayContaining([
        "referralId",
        "settlementProposal",
        "contribution_log",
        "commission",
        "payoutDate",
        "equityGrant",
        "internalNote",
        "sales-note",
      ]),
    );
  });

  it("handles null / undefined safely", () => {
    expect(trialInitializationPayloadHasForbiddenKeys(null)).toEqual([]);
    expect(trialInitializationPayloadHasForbiddenKeys(undefined)).toEqual([]);
  });
});

describe("emptyRoleMap", () => {
  it("returns the canonical four-bucket role map structure", () => {
    expect(emptyRoleMap()).toEqual({
      decisionMakers: [],
      endUsers: [],
      executors: [],
      reviewers: [],
    });
  });
});
