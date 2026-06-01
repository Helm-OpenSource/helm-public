import { describe, expect, it } from "vitest";
import {
  DIAGNOSTIC_SESSION_STATUSES,
  DIAGNOSTIC_SESSION_STATUS_TRANSITIONS,
  FIRST_LOOP_TYPES,
  canEnterFirstLoopSelected,
  emptyRoleReadiness,
  isValidDiagnosticSessionStatusTransition,
} from "./types";

describe("const sets", () => {
  it("first loop types cover V2.3 §6.6 + OTHER", () => {
    expect(FIRST_LOOP_TYPES).toEqual([
      "LEAD_FOLLOW_UP",
      "CUSTOMER_REVIEW",
      "DELIVERY_RISK",
      "OPPORTUNITY_JUDGEMENT",
      "RENEWAL_EXPANSION",
      "OTHER",
    ]);
  });

  it("statuses cover the V2.3 §8.5 lifecycle", () => {
    expect(DIAGNOSTIC_SESSION_STATUSES).toEqual([
      "DRAFT",
      "REVIEWED",
      "FIRST_LOOP_SELECTED",
      "BLOCKED",
      "SUPERSEDED",
    ]);
  });
});

describe("emptyRoleReadiness", () => {
  it("starts all 6 dimensions as false", () => {
    const r = emptyRoleReadiness();
    expect(r.businessGoalClear).toBe(false);
    expect(r.resourcesConnectable).toBe(false);
    expect(r.rolesEngaged).toBe(false);
    expect(r.firstLoopAvailable).toBe(false);
    expect(r.proofCollectionReady).toBe(false);
    expect(r.riskCommitmentsBoundedAsPrerequisites).toBe(false);
  });
});

describe("isValidDiagnosticSessionStatusTransition", () => {
  it("happy path DRAFT → REVIEWED → FIRST_LOOP_SELECTED", () => {
    expect(isValidDiagnosticSessionStatusTransition("DRAFT", "REVIEWED")).toBe(true);
    expect(
      isValidDiagnosticSessionStatusTransition("REVIEWED", "FIRST_LOOP_SELECTED"),
    ).toBe(true);
  });

  it("allows REVIEWED to roll back to DRAFT", () => {
    expect(isValidDiagnosticSessionStatusTransition("REVIEWED", "DRAFT")).toBe(true);
  });

  it("FIRST_LOOP_SELECTED can revert to REVIEWED when premise changes", () => {
    expect(
      isValidDiagnosticSessionStatusTransition("FIRST_LOOP_SELECTED", "REVIEWED"),
    ).toBe(true);
  });

  it("forbids skipping straight to FIRST_LOOP_SELECTED from DRAFT", () => {
    expect(
      isValidDiagnosticSessionStatusTransition("DRAFT", "FIRST_LOOP_SELECTED"),
    ).toBe(false);
  });

  it("BLOCKED can re-enter DRAFT", () => {
    expect(isValidDiagnosticSessionStatusTransition("BLOCKED", "DRAFT")).toBe(true);
  });

  it("SUPERSEDED is terminal", () => {
    expect(DIAGNOSTIC_SESSION_STATUS_TRANSITIONS.SUPERSEDED).toEqual([]);
  });

  it("self-transition is allowed", () => {
    expect(isValidDiagnosticSessionStatusTransition("DRAFT", "DRAFT")).toBe(true);
  });
});

describe("canEnterFirstLoopSelected", () => {
  it("permits when 4 required dimensions + firstLoopType are all set", () => {
    const r = emptyRoleReadiness();
    r.businessGoalClear = true;
    r.resourcesConnectable = true;
    r.firstLoopAvailable = true;
    r.proofCollectionReady = true;
    const gate = canEnterFirstLoopSelected(r, "LEAD_FOLLOW_UP");
    expect(gate.ok).toBe(true);
  });

  it("rejects when firstLoopCandidateType is null", () => {
    const r = emptyRoleReadiness();
    r.businessGoalClear = true;
    r.resourcesConnectable = true;
    r.firstLoopAvailable = true;
    r.proofCollectionReady = true;
    const gate = canEnterFirstLoopSelected(r, null);
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.missing).toContain("firstLoopCandidateType");
    }
  });

  it("collects all missing dimensions, not just the first", () => {
    const gate = canEnterFirstLoopSelected(emptyRoleReadiness(), null);
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.missing).toEqual(
        expect.arrayContaining([
          "businessGoalClear",
          "resourcesConnectable",
          "firstLoopAvailable",
          "proofCollectionReady",
          "firstLoopCandidateType",
        ]),
      );
    }
  });

  it("does not require rolesEngaged or riskCommitments at the gate (reviewer may use boundary notes)", () => {
    const r = emptyRoleReadiness();
    r.businessGoalClear = true;
    r.resourcesConnectable = true;
    r.firstLoopAvailable = true;
    r.proofCollectionReady = true;
    r.rolesEngaged = false;
    r.riskCommitmentsBoundedAsPrerequisites = false;
    const gate = canEnterFirstLoopSelected(r, "CUSTOMER_REVIEW");
    expect(gate.ok).toBe(true);
  });
});
