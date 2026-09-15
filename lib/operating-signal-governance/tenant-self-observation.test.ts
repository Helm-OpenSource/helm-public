import { describe, expect, it } from "vitest";

import {
  buildTenantSelfObservationEnvelope,
  OPERATING_SIGNAL_SOURCE_CLASSES,
  TENANT_SELF_OBSERVATION_ALLOWED_USES,
  validateOperatingSignalImprovementGate,
  validateOperatingSignalSourceEnvelope,
  type OperatingSignalSourceEnvelope,
} from "./source-governance";

const envelope = (): OperatingSignalSourceEnvelope => buildTenantSelfObservationEnvelope({
  signalId: "caio-signal:abcdefabcdefabcdefabcdef",
  allowedUses: ["operator_triage"],
  auditRefs: ["caio-quick-check:abcdefabcdefabcdefabcdef"],
  boundaryNote: "Deterministic quick-check detector hit; advice only, no action authority.",
});

describe("tenant_self_observation source class", () => {
  it("is a registered class allowed only for triage and advice", () => {
    expect(OPERATING_SIGNAL_SOURCE_CLASSES).toContain("tenant_self_observation");
    expect([...TENANT_SELF_OBSERVATION_ALLOWED_USES]).toEqual(["operator_triage", "advice_only_risk_review"]);
  });

  it("builds an envelope that passes source governance", () => {
    expect(validateOperatingSignalSourceEnvelope(envelope())).toEqual({ ok: true, errors: [] });
    expect(validateOperatingSignalSourceEnvelope({ ...envelope(), allowedUses: ["operator_triage", "advice_only_risk_review"] }).ok).toBe(true);
  });

  it.each([
    [{ allowedUses: ["operator_triage", "public_eval"] }, "tenant_self_observation_invalid_allowed_use:public_eval"],
    [{ allowedUses: ["operator_triage", "support_readiness"] }, "tenant_self_observation_invalid_allowed_use:support_readiness"],
    [{ improvementLoopEligible: true }, "tenant_self_observation_never_improvement_eligible"],
    [{ promotionState: "candidate" }, "tenant_self_observation_requires_blocked_state"],
    [{ aliasMode: "synthetic_alias" }, "tenant_self_observation_requires_no_alias"],
    [{ personAttributionMode: "role_only" }, "tenant_self_observation_cannot_carry_person_attribution"],
  ] as const)("rejects %j with %s", (patch, error) => {
    expect(validateOperatingSignalSourceEnvelope({ ...envelope(), ...patch }).errors).toContain(error);
  });

  it("never enters the improvement loop", () => {
    expect(validateOperatingSignalImprovementGate({ source: envelope(), promotion: null }).errors)
      .toContain("source_class_forbidden_from_improvement_loop:tenant_self_observation");
  });
});
