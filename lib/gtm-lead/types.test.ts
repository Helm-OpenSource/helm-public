import { describe, expect, it } from "vitest";
import {
  GTM_LEAD_ICP_FITS,
  GTM_LEAD_READINESS_STAGES,
  GTM_LEAD_SOURCE_TYPES,
  GTM_LEAD_STAGES,
  GTM_LEAD_STAGE_TRANSITIONS,
  isValidGtmLeadStageTransition,
} from "./types";

describe("GTMLead value sets stay in sync with Prisma enums", () => {
  it("source types cover the V2.3 §7.1 source taxonomy", () => {
    expect(GTM_LEAD_SOURCE_TYPES).toContain("REFERRAL");
    expect(GTM_LEAD_SOURCE_TYPES).toContain("PARTNER");
    expect(GTM_LEAD_SOURCE_TYPES).toContain("INBOUND_FORM");
    expect(GTM_LEAD_SOURCE_TYPES).toContain("OTHER");
    expect(new Set(GTM_LEAD_SOURCE_TYPES).size).toBe(GTM_LEAD_SOURCE_TYPES.length);
  });

  it("icp fits and readiness stages remain a small explicit set", () => {
    expect(GTM_LEAD_ICP_FITS).toEqual([
      "STRONG",
      "MEDIUM",
      "WEAK",
      "UNKNOWN",
    ]);
    expect(GTM_LEAD_READINESS_STAGES).toEqual([
      "UNKNOWN",
      "EXPLORING",
      "PILOT_READY",
      "TRIAL_IN_PROGRESS",
      "POST_TRIAL",
    ]);
  });

  it("stage list matches the V2.3 §8.1 flow", () => {
    expect(GTM_LEAD_STAGES[0]).toBe("CAPTURED");
    expect(GTM_LEAD_STAGES).toContain("DEMAND_BRIEF_READY");
    expect(GTM_LEAD_STAGES).toContain("CUSTOMER_CONFIRMATION_PENDING");
    expect(GTM_LEAD_STAGES).toContain("CONVERTED");
    expect(GTM_LEAD_STAGES).toContain("DISQUALIFIED");
  });
});

describe("isValidGtmLeadStageTransition", () => {
  it("allows the happy path CAPTURED → QUALIFIED → GUIDED_INTAKE → ... → CONVERTED", () => {
    expect(isValidGtmLeadStageTransition("CAPTURED", "QUALIFIED")).toBe(true);
    expect(isValidGtmLeadStageTransition("QUALIFIED", "GUIDED_INTAKE")).toBe(true);
    expect(isValidGtmLeadStageTransition("GUIDED_INTAKE", "DEMAND_BRIEF_READY")).toBe(true);
    expect(
      isValidGtmLeadStageTransition("DEMAND_BRIEF_READY", "CUSTOMER_CONFIRMATION_PENDING"),
    ).toBe(true);
    expect(
      isValidGtmLeadStageTransition(
        "CUSTOMER_CONFIRMATION_PENDING",
        "TRIAL_INITIALIZATION_READY",
      ),
    ).toBe(true);
    expect(
      isValidGtmLeadStageTransition("TRIAL_INITIALIZATION_READY", "FIRST_LOOP_PROPOSED"),
    ).toBe(true);
    expect(
      isValidGtmLeadStageTransition("FIRST_LOOP_PROPOSED", "FIRST_LOOP_ACTIVE"),
    ).toBe(true);
    expect(isValidGtmLeadStageTransition("FIRST_LOOP_ACTIVE", "PROOF_READY")).toBe(true);
    expect(isValidGtmLeadStageTransition("PROOF_READY", "CONVERTED")).toBe(true);
  });

  it("allows customer-confirmation downgrade back to DEMAND_BRIEF_READY (material rewrite path)", () => {
    expect(
      isValidGtmLeadStageTransition(
        "CUSTOMER_CONFIRMATION_PENDING",
        "DEMAND_BRIEF_READY",
      ),
    ).toBe(true);
  });

  it("allows trial-readiness downgrade back when customer changes premise", () => {
    expect(
      isValidGtmLeadStageTransition(
        "TRIAL_INITIALIZATION_READY",
        "CUSTOMER_CONFIRMATION_PENDING",
      ),
    ).toBe(true);
  });

  it("rejects forbidden jumps (CAPTURED → CONVERTED, FIRST_LOOP_ACTIVE → CAPTURED, etc.)", () => {
    expect(isValidGtmLeadStageTransition("CAPTURED", "CONVERTED")).toBe(false);
    expect(isValidGtmLeadStageTransition("CAPTURED", "FIRST_LOOP_ACTIVE")).toBe(false);
    expect(isValidGtmLeadStageTransition("FIRST_LOOP_ACTIVE", "CAPTURED")).toBe(false);
    expect(isValidGtmLeadStageTransition("CONVERTED", "FIRST_LOOP_ACTIVE")).toBe(false);
  });

  it("treats CONVERTED and DISQUALIFIED as terminal", () => {
    expect(GTM_LEAD_STAGE_TRANSITIONS.CONVERTED).toHaveLength(0);
    expect(GTM_LEAD_STAGE_TRANSITIONS.DISQUALIFIED).toHaveLength(0);
  });

  it("self-transitions are permitted (idempotent update)", () => {
    expect(isValidGtmLeadStageTransition("CAPTURED", "CAPTURED")).toBe(true);
    expect(isValidGtmLeadStageTransition("CONVERTED", "CONVERTED")).toBe(true);
  });

  it("LOST can be re-engaged into NURTURED", () => {
    expect(isValidGtmLeadStageTransition("LOST", "NURTURED")).toBe(true);
  });

  it("NURTURED can rejoin QUALIFIED for re-activation", () => {
    expect(isValidGtmLeadStageTransition("NURTURED", "QUALIFIED")).toBe(true);
  });
});
