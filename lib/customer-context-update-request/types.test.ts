import { describe, expect, it } from "vitest";
import {
  CUSTOMER_CONTEXT_UPDATE_REQUEST_MATERIALITIES,
  CUSTOMER_CONTEXT_UPDATE_REQUEST_ORIGINS,
  CUSTOMER_CONTEXT_UPDATE_REQUEST_REVIEW_STATUSES,
  CUSTOMER_CONTEXT_UPDATE_REQUEST_SCOPES,
  REVIEW_STATUS_TRANSITIONS,
  inferAcceptanceCascade,
  inferMateriality,
  isValidReviewStatusTransition,
  proposedChangesHaveForbiddenKeys,
} from "./types";

describe("const sets", () => {
  it("origins are CUSTOMER and INTERNAL", () => {
    expect(CUSTOMER_CONTEXT_UPDATE_REQUEST_ORIGINS).toEqual([
      "CUSTOMER",
      "INTERNAL",
    ]);
  });

  it("scopes cover V2.3 §7.3 list + OTHER", () => {
    expect(CUSTOMER_CONTEXT_UPDATE_REQUEST_SCOPES).toEqual([
      "ROLES",
      "GOALS",
      "RESOURCES",
      "CONTROL_LINE",
      "TRIAL_PAYLOAD",
      "OTHER",
    ]);
  });

  it("materialities are exactly MINOR + MATERIAL", () => {
    expect(CUSTOMER_CONTEXT_UPDATE_REQUEST_MATERIALITIES).toEqual([
      "MINOR",
      "MATERIAL",
    ]);
  });

  it("review statuses cover the 5-state lifecycle", () => {
    expect(CUSTOMER_CONTEXT_UPDATE_REQUEST_REVIEW_STATUSES).toEqual([
      "DIRECT_APPLY",
      "REVIEW_REQUIRED",
      "ACCEPTED",
      "REJECTED",
      "SUPERSEDED",
    ]);
  });
});

describe("inferMateriality", () => {
  it("ROLES and GOALS default to MINOR", () => {
    expect(inferMateriality("ROLES")).toBe("MINOR");
    expect(inferMateriality("GOALS")).toBe("MINOR");
  });

  it("RESOURCES / CONTROL_LINE / TRIAL_PAYLOAD / OTHER default to MATERIAL", () => {
    expect(inferMateriality("RESOURCES")).toBe("MATERIAL");
    expect(inferMateriality("CONTROL_LINE")).toBe("MATERIAL");
    expect(inferMateriality("TRIAL_PAYLOAD")).toBe("MATERIAL");
    expect(inferMateriality("OTHER")).toBe("MATERIAL");
  });
});

describe("proposedChangesHaveForbiddenKeys", () => {
  it("returns empty when changes are clean", () => {
    expect(
      proposedChangesHaveForbiddenKeys({
        roles: { decisionMakers: ["X"] },
        goals: { businessGoal: "Y" },
      }),
    ).toEqual([]);
  });

  it("flags internal-note / sales-note / reviewer-decision keys", () => {
    const v = proposedChangesHaveForbiddenKeys({
      internalNote: "x",
      salesNote: "y",
      reviewerDecision: "z",
      reviewer_judgement: "w",
    });
    expect(v).toEqual(
      expect.arrayContaining([
        "internalNote",
        "salesNote",
        "reviewerDecision",
        "reviewer_judgement",
      ]),
    );
  });

  it("flags contribution / accrual / settlement / commission / payout / equity / scoring", () => {
    const v = proposedChangesHaveForbiddenKeys({
      contribution: 1,
      accrualCandidate: 1,
      settlement: 1,
      commission: 1,
      payoutDate: 1,
      equityGrant: 1,
      internal_scoring: 1,
    });
    expect(v.length).toBeGreaterThanOrEqual(7);
  });

  it("handles null / undefined safely", () => {
    expect(proposedChangesHaveForbiddenKeys(null)).toEqual([]);
    expect(proposedChangesHaveForbiddenKeys(undefined)).toEqual([]);
  });
});

describe("isValidReviewStatusTransition", () => {
  it("REVIEW_REQUIRED can go ACCEPTED / REJECTED / SUPERSEDED", () => {
    expect(isValidReviewStatusTransition("REVIEW_REQUIRED", "ACCEPTED")).toBe(true);
    expect(isValidReviewStatusTransition("REVIEW_REQUIRED", "REJECTED")).toBe(true);
    expect(isValidReviewStatusTransition("REVIEW_REQUIRED", "SUPERSEDED")).toBe(true);
  });

  it("DIRECT_APPLY only transitions to SUPERSEDED", () => {
    expect(REVIEW_STATUS_TRANSITIONS.DIRECT_APPLY).toEqual(["SUPERSEDED"]);
    expect(isValidReviewStatusTransition("DIRECT_APPLY", "ACCEPTED")).toBe(false);
  });

  it("ACCEPTED / REJECTED can only go SUPERSEDED", () => {
    expect(isValidReviewStatusTransition("ACCEPTED", "REJECTED")).toBe(false);
    expect(isValidReviewStatusTransition("REJECTED", "ACCEPTED")).toBe(false);
    expect(isValidReviewStatusTransition("ACCEPTED", "SUPERSEDED")).toBe(true);
    expect(isValidReviewStatusTransition("REJECTED", "SUPERSEDED")).toBe(true);
  });

  it("SUPERSEDED is terminal", () => {
    expect(REVIEW_STATUS_TRANSITIONS.SUPERSEDED).toEqual([]);
  });

  it("self-transition is allowed", () => {
    expect(isValidReviewStatusTransition("REVIEW_REQUIRED", "REVIEW_REQUIRED")).toBe(true);
  });
});

describe("inferAcceptanceCascade", () => {
  it("MINOR change triggers no cascade", () => {
    const c = inferAcceptanceCascade({
      scope: "ROLES",
      materiality: "MINOR",
      hasBriefRef: true,
      hasControlLineRef: true,
    });
    expect(c).toEqual({
      shouldDowngradeBrief: false,
      shouldDowngradeControlLine: false,
    });
  });

  it("MATERIAL CONTROL_LINE change downgrades both brief and control line when refs exist", () => {
    const c = inferAcceptanceCascade({
      scope: "CONTROL_LINE",
      materiality: "MATERIAL",
      hasBriefRef: true,
      hasControlLineRef: true,
    });
    expect(c.shouldDowngradeBrief).toBe(true);
    expect(c.shouldDowngradeControlLine).toBe(true);
  });

  it("MATERIAL RESOURCES change downgrades both", () => {
    const c = inferAcceptanceCascade({
      scope: "RESOURCES",
      materiality: "MATERIAL",
      hasBriefRef: true,
      hasControlLineRef: true,
    });
    expect(c.shouldDowngradeBrief).toBe(true);
    expect(c.shouldDowngradeControlLine).toBe(true);
  });

  it("MATERIAL TRIAL_PAYLOAD downgrades brief but not control line", () => {
    const c = inferAcceptanceCascade({
      scope: "TRIAL_PAYLOAD",
      materiality: "MATERIAL",
      hasBriefRef: true,
      hasControlLineRef: true,
    });
    expect(c.shouldDowngradeBrief).toBe(true);
    expect(c.shouldDowngradeControlLine).toBe(false);
  });

  it("does not downgrade objects without refs", () => {
    const c = inferAcceptanceCascade({
      scope: "RESOURCES",
      materiality: "MATERIAL",
      hasBriefRef: false,
      hasControlLineRef: false,
    });
    expect(c).toEqual({
      shouldDowngradeBrief: false,
      shouldDowngradeControlLine: false,
    });
  });
});
