import { describe, expect, it } from "vitest";
import {
  CONTROL_LINE_STATUS_TRANSITIONS,
  CONTROL_LINE_TEMPLATE_META,
  EVIDENCE_READINESS_TRANSITIONS,
  OPERATING_CONTROL_LINE_EVIDENCE_READINESS_LEVELS,
  OPERATING_CONTROL_LINE_STATUSES,
  OPERATING_CONTROL_LINE_TEMPLATES,
  canEnterTrialPremise,
  isValidControlLineStatusTransition,
  isValidEvidenceReadinessTransition,
} from "./types";

describe("const sets", () => {
  it("templates cover all V2.3 §6.4 plus OTHER", () => {
    expect(OPERATING_CONTROL_LINE_TEMPLATES).toEqual([
      "LEAD_FOLLOW_UP",
      "CUSTOMER_REVIEW",
      "DELIVERY_RISK",
      "OPPORTUNITY_JUDGEMENT",
      "RENEWAL_EXPANSION",
      "OTHER",
    ]);
  });

  it("readiness levels are ordered DECLARED → VERIFIED", () => {
    expect(OPERATING_CONTROL_LINE_EVIDENCE_READINESS_LEVELS).toEqual([
      "DECLARED",
      "PARTIAL",
      "READY",
      "VERIFIED",
    ]);
  });

  it("statuses include all five lifecycle states", () => {
    expect(OPERATING_CONTROL_LINE_STATUSES).toEqual([
      "DRAFT",
      "EVIDENCE_NEEDED",
      "REVIEW_REQUIRED",
      "TRIAL_PREMISE",
      "REJECTED",
    ]);
  });

  it("template meta has bilingual pain summaries and resource hints", () => {
    expect(CONTROL_LINE_TEMPLATE_META.LEAD_FOLLOW_UP.typicalResourcesZh).toContain(
      "CRM",
    );
    expect(CONTROL_LINE_TEMPLATE_META.RENEWAL_EXPANSION.successCriteriaHintZh).toContain(
      "复核结论",
    );
  });
});

describe("isValidEvidenceReadinessTransition", () => {
  it("allows monotonic ascent DECLARED → PARTIAL → READY → VERIFIED", () => {
    expect(isValidEvidenceReadinessTransition("DECLARED", "PARTIAL")).toBe(true);
    expect(isValidEvidenceReadinessTransition("PARTIAL", "READY")).toBe(true);
    expect(isValidEvidenceReadinessTransition("READY", "VERIFIED")).toBe(true);
  });

  it("allows safe downgrades when sample turns out insufficient", () => {
    expect(isValidEvidenceReadinessTransition("PARTIAL", "DECLARED")).toBe(true);
    expect(isValidEvidenceReadinessTransition("READY", "PARTIAL")).toBe(true);
    expect(isValidEvidenceReadinessTransition("VERIFIED", "READY")).toBe(true);
  });

  it("forbids deep downgrade from VERIFIED back to DECLARED/PARTIAL", () => {
    expect(isValidEvidenceReadinessTransition("VERIFIED", "DECLARED")).toBe(false);
    expect(isValidEvidenceReadinessTransition("VERIFIED", "PARTIAL")).toBe(false);
  });

  it("self-transition is permitted (idempotent)", () => {
    expect(isValidEvidenceReadinessTransition("DECLARED", "DECLARED")).toBe(true);
    expect(isValidEvidenceReadinessTransition("VERIFIED", "VERIFIED")).toBe(true);
  });

  it("DECLARED is reachable from PARTIAL only; not from READY/VERIFIED", () => {
    expect(isValidEvidenceReadinessTransition("READY", "DECLARED")).toBe(false);
    expect(EVIDENCE_READINESS_TRANSITIONS.READY).not.toContain("DECLARED");
  });
});

describe("isValidControlLineStatusTransition", () => {
  it("allows DRAFT → EVIDENCE_NEEDED → REVIEW_REQUIRED → TRIAL_PREMISE", () => {
    expect(isValidControlLineStatusTransition("DRAFT", "EVIDENCE_NEEDED")).toBe(true);
    expect(
      isValidControlLineStatusTransition("EVIDENCE_NEEDED", "REVIEW_REQUIRED"),
    ).toBe(true);
    expect(
      isValidControlLineStatusTransition("REVIEW_REQUIRED", "TRIAL_PREMISE"),
    ).toBe(true);
  });

  it("forbids jumping directly to TRIAL_PREMISE from DRAFT or EVIDENCE_NEEDED", () => {
    expect(isValidControlLineStatusTransition("DRAFT", "TRIAL_PREMISE")).toBe(false);
    expect(
      isValidControlLineStatusTransition("EVIDENCE_NEEDED", "TRIAL_PREMISE"),
    ).toBe(false);
  });

  it("allows trial premise to revert to REVIEW_REQUIRED when premise changes", () => {
    expect(
      isValidControlLineStatusTransition("TRIAL_PREMISE", "REVIEW_REQUIRED"),
    ).toBe(true);
  });

  it("REJECTED can rejoin DRAFT for re-attempt", () => {
    expect(isValidControlLineStatusTransition("REJECTED", "DRAFT")).toBe(true);
  });

  it("self-transition is permitted", () => {
    expect(isValidControlLineStatusTransition("DRAFT", "DRAFT")).toBe(true);
  });
});

describe("canEnterTrialPremise", () => {
  it("only permits TRIAL_PREMISE when evidence is VERIFIED", () => {
    expect(canEnterTrialPremise("VERIFIED", "TRIAL_PREMISE")).toBe(true);
    expect(canEnterTrialPremise("READY", "TRIAL_PREMISE")).toBe(false);
    expect(canEnterTrialPremise("PARTIAL", "TRIAL_PREMISE")).toBe(false);
    expect(canEnterTrialPremise("DECLARED", "TRIAL_PREMISE")).toBe(false);
  });

  it("does not gate non-TRIAL_PREMISE transitions", () => {
    expect(canEnterTrialPremise("DECLARED", "DRAFT")).toBe(true);
    expect(canEnterTrialPremise("PARTIAL", "REVIEW_REQUIRED")).toBe(true);
    expect(canEnterTrialPremise("DECLARED", "REJECTED")).toBe(true);
  });
});

describe("CONTROL_LINE_STATUS_TRANSITIONS", () => {
  it("TRIAL_PREMISE can only transition to REVIEW_REQUIRED or REJECTED", () => {
    expect(CONTROL_LINE_STATUS_TRANSITIONS.TRIAL_PREMISE).toEqual([
      "REVIEW_REQUIRED",
      "REJECTED",
    ]);
  });

  it("REJECTED is recoverable to DRAFT only", () => {
    expect(CONTROL_LINE_STATUS_TRANSITIONS.REJECTED).toEqual(["DRAFT"]);
  });
});
