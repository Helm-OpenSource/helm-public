import { describe, expect, it } from "vitest";

import {
  projectCaioAdviceDecision,
  validateCaioAdvice,
  validateCaioAdviceAgainstMandate,
  type CaioAdvice,
} from "@/lib/caio-governance/advice";
import type { CaioMandate } from "@/lib/caio-governance/types";

function baseAdvice(overrides: Partial<CaioAdvice> = {}): CaioAdvice {
  return {
    adviceId: "advice-1",
    workspaceRef: "workspace:ws-1",
    mandateRef: "mandate-1",
    caioRef: "caio-instance-1",
    adviceKey: "advice-key-1",
    subjectRef: "subject:churn-risk-q3",
    title: "Reduce churn in the Q3 cohort",
    recommendation: "Prioritize win-back outreach for the top decile.",
    observationRefs: ["observation:churn-2026-07"],
    proposedAt: "2026-07-22T01:00:00Z",
    validUntil: "2026-07-25T01:00:00Z",
    status: "proposed",
    decidedByRef: null,
    decisionOutcome: null,
    decisionReason: null,
    decidedAt: null,
    withdrawnAt: null,
    auditRefs: [],
    authorityEffect: "none",
    executionRef: null,
    ...overrides,
  };
}

function baseMandate(overrides: Partial<CaioMandate> = {}): CaioMandate {
  return {
    mandateId: "mandate-1",
    workspaceRef: "workspace:ws-1",
    caioRef: "caio-instance-1",
    ceoRef: "ceo-principal-1",
    reportsTo: "CEO",
    objectiveRefs: ["objective:retention"],
    scopeRefs: ["scope:collections"],
    grantBasisRefs: ["caio-mandate-grant:ceo-principal-1:evidence-1"],
    reservedMatterRefs: ["reserved:hiring"],
    stage: "advise",
    stageDecisionRef: "stage-decision:2026-07",
    policyEnvelopeRefs: [],
    dispatchTargetCategories: [],
    humanResponsePolicyRef: "policy:human-response-v1",
    conflictResolution: "pause_and_escalate_ceo",
    accountabilityAnchorRefs: ["anchor:ceo"],
    guardianStopRefs: ["guardian-principal-1"],
    emergencyStopRef: null,
    validFrom: "2026-07-01T00:00:00Z",
    validUntil: "2026-12-31T00:00:00Z",
    status: "active",
    supersedesRef: null,
    auditRefs: ["audit:mandate-1"],
    revocationPolicy: "envelopes_invalid_immediately",
    inFlightDisposition: "freeze",
    authorityEffect: "none",
    runtimeAuthorityRef: null,
    ...overrides,
  };
}

describe("validateCaioAdvice", () => {
  it("accepts a well-formed proposed advice", () => {
    expect(validateCaioAdvice(baseAdvice())).toEqual({ valid: true, errors: [] });
  });

  it("refuses ungrounded advice (no observation refs)", () => {
    const result = validateCaioAdvice(baseAdvice({ observationRefs: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("ungrounded advice is invalid");
  });

  it("refuses authority-firewall forgeries", () => {
    const forged = baseAdvice({
      authorityEffect: "execute" as unknown as "none",
      executionRef: "work-order-1" as unknown as null,
    });
    const result = validateCaioAdvice(forged);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain('authorityEffect must be the literal "none"');
    expect(result.errors.join(" ")).toContain("executionRef must be the literal null");
  });

  it("refuses pre-filled decision fields on an undecided advice", () => {
    const result = validateCaioAdvice(
      baseAdvice({ decidedByRef: "ceo-principal-1" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("no pre-filled decisions");
  });

  it("requires complete, consistent decision fields on a decided advice", () => {
    const accepted = baseAdvice({
      status: "accepted",
      decidedByRef: "ceo-principal-1",
      decisionOutcome: "accepted",
      decisionReason: "Aligned with the retention objective.",
      decidedAt: "2026-07-23T01:00:00Z",
    });
    expect(validateCaioAdvice(accepted).valid).toBe(true);

    const relabeled = { ...accepted, decisionOutcome: "rejected" as const };
    const result = validateCaioAdvice(relabeled);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("cannot be relabeled");

    const timeTravel = { ...accepted, decidedAt: "2026-07-21T00:00:00Z" };
    expect(validateCaioAdvice(timeTravel).valid).toBe(false);

    // a decision after the advice window is not a decision — it is expiry
    const late = { ...accepted, decidedAt: "2026-07-25T02:00:00Z" };
    const lateResult = validateCaioAdvice(late);
    expect(lateResult.valid).toBe(false);
    expect(lateResult.errors.join(" ")).toContain(
      "a late decision records expiry, never a decision",
    );
  });

  it("requires withdrawnAt exactly on withdrawn records", () => {
    const missing = validateCaioAdvice(baseAdvice({ status: "withdrawn" }));
    expect(missing.valid).toBe(false);
    expect(missing.errors.join(" ")).toContain("must record withdrawnAt");

    const good = validateCaioAdvice(
      baseAdvice({ status: "withdrawn", withdrawnAt: "2026-07-23T00:00:00Z" }),
    );
    expect(good.valid).toBe(true);

    const early = validateCaioAdvice(
      baseAdvice({ status: "withdrawn", withdrawnAt: "2026-07-21T00:00:00Z" }),
    );
    expect(early.valid).toBe(false);

    const leaked = validateCaioAdvice(
      baseAdvice({ withdrawnAt: "2026-07-23T00:00:00Z" }),
    );
    expect(leaked.valid).toBe(false);
    expect(leaked.errors.join(" ")).toContain(
      "only a withdrawn advice may carry withdrawnAt",
    );
  });

  it("refuses an inverted validity window", () => {
    const result = validateCaioAdvice(
      baseAdvice({ validUntil: "2026-07-22T00:59:59Z" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("validUntil must be after proposedAt");
  });
});

describe("validateCaioAdviceAgainstMandate", () => {
  it("accepts advice under a matching advise-stage mandate", () => {
    expect(
      validateCaioAdviceAgainstMandate(baseAdvice(), baseMandate()).valid,
    ).toBe(true);
  });

  it("refuses advice under a non-advise stage (no stage implies another)", () => {
    for (const stage of ["observe", "supervise"] as const) {
      const result = validateCaioAdviceAgainstMandate(
        baseAdvice(),
        baseMandate({ stage }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.join(" ")).toContain('requires a mandate at stage "advise"');
    }
  });

  it("refuses mismatched mandate / workspace / caio refs", () => {
    expect(
      validateCaioAdviceAgainstMandate(
        baseAdvice({ mandateRef: "mandate-2" }),
        baseMandate(),
      ).valid,
    ).toBe(false);
    expect(
      validateCaioAdviceAgainstMandate(
        baseAdvice({ workspaceRef: "workspace:ws-2" }),
        baseMandate(),
      ).valid,
    ).toBe(false);
    expect(
      validateCaioAdviceAgainstMandate(
        baseAdvice({ caioRef: "caio-other" }),
        baseMandate(),
      ).valid,
    ).toBe(false);
  });

  it("refuses an advice window escaping the mandate window", () => {
    const result = validateCaioAdviceAgainstMandate(
      baseAdvice({ validUntil: "2027-01-01T00:00:00Z" }),
      baseMandate(),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "must lie within the mandate validity window",
    );
  });

  it("refuses a decision instant outside the mandate window", () => {
    const advice = baseAdvice({
      status: "accepted",
      decidedByRef: "ceo-principal-1",
      decisionOutcome: "accepted",
      decisionReason: "fine",
      decidedAt: "2026-07-23T01:00:00Z",
    });
    // shrink the mandate window so the decision instant escapes it
    const result = validateCaioAdviceAgainstMandate(
      { ...advice, proposedAt: "2026-07-02T00:00:00Z", validUntil: "2026-07-04T00:00:00Z", decidedAt: "2026-07-03T00:00:00Z" },
      baseMandate({ validFrom: "2026-07-03T12:00:00Z", validUntil: "2026-07-05T00:00:00Z" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "decision instant must lie within the mandate validity window",
    );
    // right-open endpoint: a decision AT mandate.validUntil is outside
    const atEndpoint = validateCaioAdviceAgainstMandate(
      { ...advice, decidedAt: "2026-12-31T00:00:00Z" },
      baseMandate(),
    );
    expect(atEndpoint.valid).toBe(false);
    expect(atEndpoint.errors.join(" ")).toContain(
      "decision instant must lie within the mandate validity window",
    );
  });

  it("refuses a decision made by anyone but the mandate's CEO", () => {
    const advice = baseAdvice({
      status: "rejected",
      decidedByRef: "guardian-principal-1",
      decisionOutcome: "rejected",
      decisionReason: "no",
      decidedAt: "2026-07-23T01:00:00Z",
    });
    const result = validateCaioAdviceAgainstMandate(advice, baseMandate());
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "only the mandate's CEO can decide advice",
    );
  });
});

describe("projectCaioAdviceDecision", () => {
  it("projects awaiting_decision before expiry and expired after (single clock)", () => {
    const advice = baseAdvice();
    expect(projectCaioAdviceDecision(advice, "2026-07-24T00:00:00Z")).toEqual({
      state: "awaiting_decision",
      expiresAt: "2026-07-25T01:00:00Z",
    });
    expect(projectCaioAdviceDecision(advice, "2026-07-25T01:00:00Z")).toEqual({
      state: "expired",
      expiredAt: "2026-07-25T01:00:00Z",
    });
  });

  it("projects a decision receipt with the authority firewall intact", () => {
    const advice = baseAdvice({
      status: "accepted",
      decidedByRef: "ceo-principal-1",
      decisionOutcome: "accepted",
      decisionReason: "Aligned with the retention objective.",
      decidedAt: "2026-07-23T01:00:00Z",
    });
    const projection = projectCaioAdviceDecision(advice, "2026-08-01T00:00:00Z");
    expect(projection).toEqual({
      state: "decided",
      receipt: {
        adviceRef: "advice-1",
        mandateRef: "mandate-1",
        subjectRef: "subject:churn-risk-q3",
        outcome: "accepted",
        decidedByRef: "ceo-principal-1",
        decidedAt: "2026-07-23T01:00:00Z",
        decisionReason: "Aligned with the retention objective.",
        authorityEffect: "none",
      },
    });
  });

  it("projects withdrawn and persisted-expired states", () => {
    expect(
      projectCaioAdviceDecision(
        baseAdvice({ status: "withdrawn", withdrawnAt: "2026-07-22T12:00:00Z" }),
        "2026-07-23T00:00:00Z",
      ),
    ).toEqual({ state: "withdrawn", withdrawnAt: "2026-07-22T12:00:00Z" });
    expect(
      projectCaioAdviceDecision(
        baseAdvice({ status: "expired" }),
        "2026-07-26T00:00:00Z",
      ),
    ).toEqual({ state: "expired", expiredAt: "2026-07-25T01:00:00Z" });
  });

  it("is a genuine historical clock: no state leaks from the future", () => {
    const decided = baseAdvice({
      status: "accepted",
      decidedByRef: "ceo-principal-1",
      decisionOutcome: "accepted",
      decisionReason: "fine",
      decidedAt: "2026-07-23T01:00:00Z",
    });
    // before the proposal existed
    expect(
      projectCaioAdviceDecision(decided, "2026-07-22T00:00:00Z"),
    ).toEqual({ state: "not_yet_proposed", proposedAt: "2026-07-22T01:00:00Z" });
    // after proposal, before the decision: still awaiting
    expect(
      projectCaioAdviceDecision(decided, "2026-07-22T12:00:00Z"),
    ).toEqual({
      state: "awaiting_decision",
      expiresAt: "2026-07-25T01:00:00Z",
    });
    // at/after the decision instant: decided
    expect(
      projectCaioAdviceDecision(decided, "2026-07-23T01:00:00Z").state,
    ).toBe("decided");
    // a withdrawn record was still awaiting before its withdrawal
    const withdrawn = baseAdvice({
      status: "withdrawn",
      withdrawnAt: "2026-07-23T00:00:00Z",
    });
    expect(
      projectCaioAdviceDecision(withdrawn, "2026-07-22T12:00:00Z").state,
    ).toBe("awaiting_decision");
    expect(
      projectCaioAdviceDecision(withdrawn, "2026-07-23T00:00:00Z").state,
    ).toBe("withdrawn");
    // a persisted-expired record was awaiting before its validUntil
    expect(
      projectCaioAdviceDecision(
        baseAdvice({ status: "expired" }),
        "2026-07-23T00:00:00Z",
      ).state,
    ).toBe("awaiting_decision");
  });

  it("fails closed on invalid records and invalid clocks", () => {
    expect(() =>
      projectCaioAdviceDecision(
        baseAdvice({ observationRefs: [] }),
        "2026-07-23T00:00:00Z",
      ),
    ).toThrow(/refusing to project/);
    expect(() =>
      projectCaioAdviceDecision(baseAdvice(), "not-a-time"),
    ).toThrow(/strict RFC 3339/);
  });
});
