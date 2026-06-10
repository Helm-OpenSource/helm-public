import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { EvalCasePromotion } from "../expert-capability/validators";
import {
  validateOperatingSignalImprovementGate,
  validateOperatingSignalSourceEnvelope,
  type OperatingSignalSourceEnvelope,
} from "./source-governance";

const samplePath = path.resolve(
  __dirname,
  "..",
  "..",
  "templates",
  "operating-signal-governance",
  "source-governance.sample.json",
);

function baseEnvelope(
  overrides: Partial<OperatingSignalSourceEnvelope> = {},
): OperatingSignalSourceEnvelope {
  return {
    schemaVersion: "helm.operating-signal-source-governance.v1",
    signalId: "sig.synthetic.001",
    sourceClass: "synthetic_public",
    allowedUses: ["public_eval", "fixture_validation"],
    forbiddenUses: [
      "automatic_customer_action",
      "external_send",
      "writeback",
      "memory_promotion",
      "performance_evaluation",
    ],
    improvementLoopEligible: true,
    promotionState: "public_eligible",
    aliasMode: "synthetic_alias",
    personAttributionMode: "none",
    auditRefs: ["audit:fixture"],
    boundaryNote: "Synthetic public fixture; advice-only and review-first.",
    ...overrides,
  };
}

const cleanPromotion: EvalCasePromotion = {
  promotionId: "promo.self-dogfood.001",
  sourceCaseId: "sig.self-dogfood.001",
  sourceSensitivityClass: "operational",
  scannerResult: { hits: 0 },
  humanSignOffBy: "reviewer-alias",
  humanSignOffAt: "2026-06-04T08:00:00Z",
  publicEligible: true,
  walledFromPerformanceEval: true,
  quarantineReason: null,
};

function promotionFor(
  sourceCaseId: string,
  overrides: Partial<EvalCasePromotion> = {},
): EvalCasePromotion {
  return {
    ...cleanPromotion,
    sourceCaseId,
    ...overrides,
  };
}

describe("operating signal source governance", () => {
  it("blocks customer fleet health from every improvement-loop path", () => {
    const fleet = baseEnvelope({
      signalId: "sig.fleet.001",
      sourceClass: "fleet_customer_health",
      allowedUses: ["operator_triage", "advice_only_risk_review", "support_readiness"],
      improvementLoopEligible: true,
      promotionState: "candidate",
      aliasMode: "reversible_operator_alias",
      aliasSaltRef: "salt:fleet:2026-06",
      aliasSaltRotatesAt: "2026-07-01T00:00:00Z",
      aliasAccessRoles: ["operator_admin"],
      aliasDecodeAuditRequired: true,
      customerConsentScopeRef: "consent-scope:fleet-demo:operator-health:2026-06",
    });

    const result = validateOperatingSignalSourceEnvelope(fleet);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "fleet_customer_health_never_improvement_eligible",
        "fleet_customer_health_cannot_be_promotion_candidate",
      ]),
    );
    expect(validateOperatingSignalImprovementGate({ source: fleet }).errors).toContain(
      "source_class_forbidden_from_improvement_loop:fleet_customer_health",
    );
  });

  it("requires reversible fleet aliases to carry salt lifecycle and decode audit", () => {
    const fleet = baseEnvelope({
      signalId: "sig.fleet.002",
      sourceClass: "fleet_customer_health",
      allowedUses: ["operator_triage"],
      improvementLoopEligible: false,
      promotionState: "blocked",
      aliasMode: "reversible_operator_alias",
      aliasAccessRoles: [],
      aliasDecodeAuditRequired: false,
      customerConsentScopeRef: "consent-scope:fleet-demo:operator-health:2026-06",
    });

    expect(validateOperatingSignalSourceEnvelope(fleet).errors).toEqual(
      expect.arrayContaining([
        "reversible_alias_missing_salt_lifecycle",
        "reversible_alias_missing_access_roles",
        "reversible_alias_missing_decode_audit",
      ]),
    );
  });

  it("requires customer fleet health to carry a consent scope reference", () => {
    const fleet = baseEnvelope({
      signalId: "sig.fleet.missing-consent.001",
      sourceClass: "fleet_customer_health",
      allowedUses: ["operator_triage"],
      improvementLoopEligible: false,
      promotionState: "blocked",
      aliasMode: "reversible_operator_alias",
      aliasSaltRef: "salt:fleet:2026-06",
      aliasSaltRotatesAt: "2026-07-01T00:00:00Z",
      aliasAccessRoles: ["operator_admin"],
      aliasDecodeAuditRequired: true,
    });

    expect(validateOperatingSignalSourceEnvelope(fleet).errors).toContain(
      "fleet_customer_health_missing_customer_consent_scope_ref",
    );
  });

  it("quarantines self-dogfood signals that still carry person-level attribution", () => {
    const selfDogfood = baseEnvelope({
      signalId: "sig.self.001",
      sourceClass: "self_dogfood_health",
      allowedUses: ["dogfood_improvement"],
      improvementLoopEligible: true,
      promotionState: "candidate",
      aliasMode: "irreversible_deidentified",
      personAttributionMode: "person_level",
    });

    const result = validateOperatingSignalSourceEnvelope(selfDogfood);
    expect(result.errors).toContain("self_dogfood_person_level_attribution_not_removed");
    expect(validateOperatingSignalImprovementGate({ source: selfDogfood }).errors).toContain(
      "source_not_public_eligible",
    );
  });

  it("allows de-identified self-dogfood only after the existing promotion gate passes", () => {
    const selfDogfood = baseEnvelope({
      signalId: "sig.self.002",
      sourceClass: "self_dogfood_health",
      allowedUses: ["dogfood_improvement"],
      improvementLoopEligible: true,
      promotionState: "public_eligible",
      aliasMode: "irreversible_deidentified",
      personAttributionMode: "deidentified_cohort",
    });

    expect(validateOperatingSignalSourceEnvelope(selfDogfood).ok).toBe(true);
    expect(
      validateOperatingSignalImprovementGate({
        source: selfDogfood,
        promotion: promotionFor("sig.self.002"),
      }).ok,
    ).toBe(true);
  });

  it("rejects self-dogfood promotion records that are not bound to the current source", () => {
    const selfDogfood = baseEnvelope({
      signalId: "sig.self.mismatch.001",
      sourceClass: "self_dogfood_health",
      allowedUses: ["dogfood_improvement"],
      improvementLoopEligible: true,
      promotionState: "public_eligible",
      aliasMode: "irreversible_deidentified",
      personAttributionMode: "deidentified_cohort",
    });

    expect(
      validateOperatingSignalImprovementGate({
        source: selfDogfood,
        promotion: promotionFor("sig.self.other-case.001"),
      }).errors,
    ).toContain("promotion_source_case_mismatch");
  });

  it("rejects private promotion records that are not public eligible", () => {
    const selfDogfood = baseEnvelope({
      signalId: "sig.self.private-promotion.001",
      sourceClass: "self_dogfood_health",
      allowedUses: ["dogfood_improvement"],
      improvementLoopEligible: true,
      promotionState: "public_eligible",
      aliasMode: "irreversible_deidentified",
      personAttributionMode: "deidentified_cohort",
    });

    expect(
      validateOperatingSignalImprovementGate({
        source: selfDogfood,
        promotion: promotionFor("sig.self.private-promotion.001", {
          publicEligible: false,
          quarantineReason: "not public eligible",
        }),
      }).errors,
    ).toContain("promotion_not_public_eligible");
  });

  it("rejects self-dogfood person-level fields even when the declaration claims de-identification", () => {
    const selfDogfood = {
      ...baseEnvelope({
        signalId: "sig.self.person-field.001",
        sourceClass: "self_dogfood_health",
        allowedUses: ["dogfood_improvement"],
        improvementLoopEligible: true,
        promotionState: "public_eligible",
        aliasMode: "irreversible_deidentified",
        personAttributionMode: "deidentified_cohort",
      }),
      ownerId: "owner-123",
      reviewerName: "Reviewer Person",
      personId: "person-456",
    };

    expect(validateOperatingSignalSourceEnvelope(selfDogfood).errors).toEqual(
      expect.arrayContaining([
        "forbidden_key_present:ownerId",
        "forbidden_key_present:reviewerName",
        "forbidden_key_present:personId",
      ]),
    );
    expect(
      validateOperatingSignalImprovementGate({
        source: selfDogfood,
        promotion: promotionFor("sig.self.person-field.001"),
      }).ok,
    ).toBe(false);
  });

  it("allows synthetic public fixtures without a private promotion record", () => {
    const synthetic = baseEnvelope();

    expect(validateOperatingSignalSourceEnvelope(synthetic).ok).toBe(true);
    expect(validateOperatingSignalImprovementGate({ source: synthetic }).ok).toBe(true);
  });

  it("rejects source-class allowed-use drift for synthetic, self-dogfood, and promoted cases", () => {
    expect(
      validateOperatingSignalSourceEnvelope(
        baseEnvelope({
          signalId: "sig.synthetic.bad-use.001",
          sourceClass: "synthetic_public",
          allowedUses: ["tenant_ingestion"],
        }),
      ).errors,
    ).toContain("synthetic_public_invalid_allowed_use:tenant_ingestion");

    expect(
      validateOperatingSignalSourceEnvelope(
        baseEnvelope({
          signalId: "sig.self.bad-use.001",
          sourceClass: "self_dogfood_health",
          allowedUses: ["operator_triage"],
          aliasMode: "irreversible_deidentified",
          personAttributionMode: "deidentified_cohort",
        }),
      ).errors,
    ).toContain("self_dogfood_health_invalid_allowed_use:operator_triage");

    expect(
      validateOperatingSignalSourceEnvelope(
        baseEnvelope({
          signalId: "sig.promoted.bad-use.001",
          sourceClass: "deidentified_promoted_case",
          allowedUses: ["fixture_validation"],
          aliasMode: "irreversible_deidentified",
          personAttributionMode: "none",
        }),
      ).errors,
    ).toContain("deidentified_promoted_case_invalid_allowed_use:fixture_validation");
  });

  it("allows deidentified promoted cases only through EvalCasePromotion", () => {
    const promoted = baseEnvelope({
      signalId: "sig.promoted.001",
      sourceClass: "deidentified_promoted_case",
      allowedUses: ["public_eval", "heldout_eval"],
      improvementLoopEligible: true,
      promotionState: "public_eligible",
      aliasMode: "irreversible_deidentified",
      personAttributionMode: "none",
    });

    expect(validateOperatingSignalImprovementGate({ source: promoted }).errors).toContain(
      "missing_eval_case_promotion",
    );
    expect(
      validateOperatingSignalImprovementGate({
        source: promoted,
        promotion: promotionFor("sig.promoted.001"),
      }).ok,
    ).toBe(true);
  });

  it("keeps OSS governance out of tenant ingestion and improvement loops", () => {
    const oss = baseEnvelope({
      signalId: "sig.oss.001",
      sourceClass: "oss_governance",
      allowedUses: ["tenant_ingestion", "oss_governance_review"],
      improvementLoopEligible: false,
      promotionState: "non_goal",
      aliasMode: "public_handle",
      personAttributionMode: "none",
    });

    const result = validateOperatingSignalSourceEnvelope(oss);
    expect(result.errors).toContain("oss_governance_cannot_enter_tenant_ingestion");
    expect(validateOperatingSignalImprovementGate({ source: oss }).errors).toContain(
      "source_class_forbidden_from_improvement_loop:oss_governance",
    );
  });

  it("fails closed when raw/private/customer-identifying fields appear", () => {
    const unsafe = {
      ...baseEnvelope({
        signalId: "sig.unsafe.001",
        sourceClass: "self_dogfood_health",
        allowedUses: ["dogfood_improvement"],
        improvementLoopEligible: true,
        promotionState: "candidate",
        aliasMode: "irreversible_deidentified",
      }),
      rawPayload: "customer@example.com",
      customerName: "Real Customer",
      privateDomain: "tenant.internal.local",
    };

    expect(validateOperatingSignalSourceEnvelope(unsafe).errors).toEqual(
      expect.arrayContaining([
        "forbidden_key_present:rawPayload",
        "forbidden_key_present:customerName",
        "forbidden_key_present:privateDomain",
        "private_or_contact_pattern_present",
      ]),
    );
  });

  it("fails closed instead of throwing on malformed envelopes", () => {
    const result = validateOperatingSignalSourceEnvelope({
      schemaVersion: "helm.operating-signal-source-governance.v1",
      signalId: "sig.malformed.001",
      sourceClass: "self_dogfood_health",
      improvementLoopEligible: true,
      promotionState: "candidate",
      aliasMode: "irreversible_deidentified",
      personAttributionMode: "deidentified_cohort",
      boundaryNote: "Malformed fixture should be rejected.",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "missing_or_invalid_allowedUses",
        "missing_or_invalid_forbiddenUses",
        "missing_or_invalid_auditRefs",
      ]),
    );
  });

  it("keeps the public sample fixture aligned with the governance validator", () => {
    const sample = JSON.parse(readFileSync(samplePath, "utf8")) as {
      sourceEnvelopes: OperatingSignalSourceEnvelope[];
      promotions: Record<string, EvalCasePromotion>;
    };

    const byId = new Map(sample.sourceEnvelopes.map((source) => [source.signalId, source]));
    expect(
      validateOperatingSignalImprovementGate({
        source: byId.get("sig.fleet.customer-health.watch"),
      }).errors,
    ).toContain("source_class_forbidden_from_improvement_loop:fleet_customer_health");
    expect(
      validateOperatingSignalImprovementGate({
        source: byId.get("sig.self-dogfood.deidentified"),
        promotion: sample.promotions["sig.self-dogfood.deidentified"],
      }).ok,
    ).toBe(true);
    expect(
      validateOperatingSignalImprovementGate({
        source: byId.get("sig.synthetic.public"),
      }).ok,
    ).toBe(true);
    expect(
      validateOperatingSignalImprovementGate({
        source: byId.get("sig.oss.governance"),
      }).errors,
    ).toContain("source_class_forbidden_from_improvement_loop:oss_governance");
  });
});
