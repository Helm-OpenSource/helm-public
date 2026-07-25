import { describe, expect, it } from "vitest";
import {
  compareFallbackRouteSafety,
  computeGovernedModelAdapterRegistrationHash,
  computeModelRoutePolicyApprovalReceiptHash,
  computeModelRoutePolicyApprovalReceiptRef,
  computeProjectedPromptHash,
  computeProviderAdapterReadinessHash,
  computeTenantModelRoutePolicyHash,
  deriveEffectiveModelDataClassification,
  readinessReceiptMatchesRoute,
  routeAllowsClassification,
  validateGovernedModelAdapterRegistration,
  validateModelRoutePolicyApprovalReceipt,
  validateProviderAdapterReadinessReceipt,
  validateTenantModelRoutePolicy,
  type GovernedModelAdapterRegistration,
  type ModelRoutePolicyApprovalReceipt,
  type ProviderAdapterReadinessReceipt,
  type TenantModelRoute,
  type TenantModelRoutePolicy,
} from "@/lib/llm/model-route-contracts";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;

function route(
  overrides: Partial<TenantModelRoute> = {},
): TenantModelRoute {
  return {
    routeId: "qwen-cn-primary",
    provider: "qwen",
    modelId: "qwen3.6-plus",
    modelVersion: "qwen3.6-plus-20260701",
    adapterKey: "qwen",
    readinessReceiptRef: "readiness:qwen-cn-primary",
    readinessReceiptHash: HASH_A,
    credentialRef: "secret:tenant/qwen-primary",
    governanceProfileRef: "governance:model-egress-cn-standard",
    governanceProfileHash: HASH_B,
    projectorRegistrationRef: "projector:model-egress-cn-standard",
    projectorRegistrationHash: HASH_A,
    projectorVersion: "projector-v1",
    scannerRegistrationRef: "scanner:model-egress-cn-standard",
    scannerRegistrationHash: HASH_B,
    scannerVersion: "scanner-v1",
    deploymentForm: "domestic_cloud",
    jurisdiction: "domestic",
    region: "cn-hangzhou",
    allowedTaskClasses: [
      "summary_briefing",
      "reasoning_counterfactual",
    ],
    maximumSensitivity: "confidential",
    allowedProcessingDispositions: ["remote_projected"],
    retentionDays: 0,
    trainingUse: "prohibited",
    termsAssurance: "contractual_no_retention",
    providerTermsRef: "terms:qwen-enterprise-202607",
    providerTermsHash: HASH_B,
    deletionTermsRef: "terms:qwen-delete-202607",
    deletionTermsHash: HASH_A,
    pricingTermsRef: "pricing:qwen-enterprise-202607",
    pricingTermsHash: HASH_B,
    pricingVersion: "qwen-pricing-202607",
    maxInputTokens: 16_000,
    maxOutputTokens: 4_000,
    maxCostUsdMicros: 500_000,
    maxLatencyMs: 15_000,
    maxConcurrency: 8,
    fallbackRouteIds: [],
    ...overrides,
  };
}

function policy(
  routes: TenantModelRoute[],
  overrides: Partial<TenantModelRoutePolicy> = {},
): TenantModelRoutePolicy {
  const candidate: TenantModelRoutePolicy = {
    schemaVersion: "helm.tenant-model-route-policy/v1",
    policyId: "policy:caio-pro-default-v1",
    workspaceRef: "workspace:synthetic-caio",
    policyKey: "caio-pro-default",
    revision: 1,
    routes,
    primaryRoutes: [
      {
        taskClass: "summary_briefing",
        routeRef: routes[0]?.routeId ?? "missing",
      },
    ],
    validFrom: "2026-07-23T00:00:00.000Z",
    validUntil: "2026-08-23T00:00:00.000Z",
    approvalRef: "approval:pending",
    approvedByRef: "user:synthetic-owner",
    createdAt: "2026-07-23T00:00:00.000Z",
    policyHash: HASH_A,
    status: "draft",
    authorityEffect: "model_egress_only",
    ...overrides,
  };
  const boundCandidate = {
    ...candidate,
    approvalRef:
      overrides.approvalRef ??
      computeModelRoutePolicyApprovalReceiptRef({
        workspaceRef: candidate.workspaceRef,
        policyId: candidate.policyId,
        policyKey: candidate.policyKey,
        revision: candidate.revision,
        approvedByRef: candidate.approvedByRef,
      }),
  };
  return {
    ...boundCandidate,
    policyHash:
      computeTenantModelRoutePolicyHash(boundCandidate),
  };
}

function registration(
  overrides: Partial<GovernedModelAdapterRegistration> = {},
): GovernedModelAdapterRegistration {
  const candidate: GovernedModelAdapterRegistration = {
    schemaVersion:
      "helm.governed-model-adapter-registration/v1",
    registrationRef: "adapter-registration:qwen-v1",
    adapterKey: "qwen",
    adapterVersion: "qwen-adapter-v1",
    provider: "qwen",
    implementationHash: HASH_A,
    supportedDeploymentForms: ["domestic_cloud"],
    authorityEffect: "adapter_registry_only",
    contentHash: HASH_A,
    ...overrides,
  };
  return {
    ...candidate,
    contentHash:
      computeGovernedModelAdapterRegistrationHash(candidate),
  };
}

function readiness(
  target: TenantModelRoute,
  overrides: Partial<ProviderAdapterReadinessReceipt> = {},
): ProviderAdapterReadinessReceipt {
  const adapterRegistration = registration();
  const candidate: ProviderAdapterReadinessReceipt = {
    schemaVersion: "helm.provider-adapter-readiness-receipt/v1",
    receiptId: target.readinessReceiptRef,
    workspaceRef: "workspace:synthetic-caio",
    provider: target.provider,
    modelId: target.modelId,
    modelVersion: target.modelVersion,
    adapterKey: target.adapterKey,
    adapterVersion: "qwen-adapter-v1",
    adapterRegistrationRef:
      adapterRegistration.registrationRef,
    adapterRegistrationHash:
      adapterRegistration.contentHash,
    deploymentForm: target.deploymentForm,
    jurisdiction: target.jurisdiction,
    region: target.region,
    endpointFingerprint: HASH_B,
    credentialRef: target.credentialRef,
    adapterRegistered: true,
    credentialConfigured: true,
    modelProbeStatus: "ready",
    capabilityRefs: ["capability:structured-output"],
    checkedAt: "2026-07-23T00:00:00.000Z",
    expiresAt: "2026-07-24T00:00:00.000Z",
    evidenceRefs: ["evidence:model-probe:synthetic"],
    rawCredentialIncluded: false,
    contentHash: HASH_A,
    ...overrides,
  };
  return {
    ...candidate,
    contentHash: computeProviderAdapterReadinessHash(candidate),
  };
}

function approvalReceipt(
  target: TenantModelRoutePolicy,
): ModelRoutePolicyApprovalReceipt {
  const candidate: ModelRoutePolicyApprovalReceipt = {
    schemaVersion:
      "helm.model-route-policy-approval-receipt/v1",
    receiptId: target.approvalRef,
    workspaceRef: target.workspaceRef,
    policyRef: target.policyId,
    policyHash: target.policyHash,
    policyKey: target.policyKey,
    policyRevision: target.revision,
    approvedByUserRef: target.approvedByRef,
    expectedHeadVersion: null,
    approvedAt: "2026-07-23T12:00:00.000Z",
    authorityEffect:
      "model_route_policy_activation_only",
    contentHash: HASH_A,
  };
  return {
    ...candidate,
    contentHash:
      computeModelRoutePolicyApprovalReceiptHash(candidate),
  };
}

describe("tenant model route policy contract", () => {
  it("normalizes set-like route fields before hashing", () => {
    const firstRoute = route({
      allowedTaskClasses: [
        "summary_briefing",
        "reasoning_counterfactual",
      ],
    });
    const secondRoute = route({
      allowedTaskClasses: [
        "reasoning_counterfactual",
        "summary_briefing",
      ],
    });
    const first = policy([firstRoute]);
    const second = policy([secondRoute]);
    expect(first.policyHash).toBe(second.policyHash);
  });

  it("changes the policy hash when a semantic limit changes", () => {
    const original = policy([route()]);
    const changed = policy([route({ maxConcurrency: 9 })]);
    expect(changed.policyHash).not.toBe(original.policyHash);
  });

  it("rejects route limits outside the signed MySQL integer range", () => {
    const candidate = policy([
      route({
        maxCostUsdMicros: 2_147_483_648,
        maxInputTokens: 2_147_483_648,
      }),
    ]);
    expect(validateTenantModelRoutePolicy(candidate).errors).toEqual(
      expect.arrayContaining([
        "route:qwen-cn-primary:max_input_tokens_invalid",
        "route:qwen-cn-primary:max_cost_invalid",
      ]),
    );
  });

  it("rejects unknown model versions and regions", () => {
    const candidate = policy([
      route({ modelVersion: "latest", region: "unknown" }),
    ]);
    expect(validateTenantModelRoutePolicy(candidate).errors).toEqual(
      expect.arrayContaining([
        "route:qwen-cn-primary:exact_model_version_required",
        "route:qwen-cn-primary:known_region_required",
      ]),
    );
  });

  it("requires exact projection and deletion trust roots", () => {
    const candidate = policy([
      route({
        projectorRegistrationRef: "",
        projectorRegistrationHash: "not-a-hash",
        projectorVersion: "latest",
        scannerRegistrationRef: "",
        scannerRegistrationHash: "not-a-hash",
        scannerVersion: "*",
        deletionTermsHash: "not-a-hash",
        pricingTermsRef: "",
        pricingTermsHash: "not-a-hash",
        pricingVersion: "latest",
      }),
    ]);

    expect(validateTenantModelRoutePolicy(candidate).errors).toEqual(
      expect.arrayContaining([
        "route:qwen-cn-primary:projector_registration_ref_invalid",
        "route:qwen-cn-primary:projector_registration_hash_invalid",
        "route:qwen-cn-primary:exact_projector_version_required",
        "route:qwen-cn-primary:scanner_registration_ref_invalid",
        "route:qwen-cn-primary:scanner_registration_hash_invalid",
        "route:qwen-cn-primary:exact_scanner_version_required",
        "route:qwen-cn-primary:deletion_terms_hash_invalid",
        "route:qwen-cn-primary:pricing_terms_ref_required",
        "route:qwen-cn-primary:pricing_terms_hash_invalid",
        "route:qwen-cn-primary:exact_pricing_version_required",
      ]),
    );
  });

  it("rejects a domestic route that falls back to a foreign route", () => {
    const foreign = route({
      routeId: "foreign-fallback",
      provider: "openai",
      modelId: "gpt-5.4",
      modelVersion: "gpt-5.4-20260701",
      adapterKey: "openai",
      readinessReceiptRef: "readiness:foreign-fallback",
      readinessReceiptHash: HASH_B,
      credentialRef: "secret:tenant/openai-foreign",
      deploymentForm: "foreign_cloud",
      jurisdiction: "foreign",
      region: "us-east-1",
    });
    const primary = route({ fallbackRouteIds: [foreign.routeId] });
    const candidate = policy([primary, foreign]);
    expect(validateTenantModelRoutePolicy(candidate).errors).toContain(
      "fallback_weaker:qwen-cn-primary:foreign-fallback:jurisdiction",
    );
  });

  it("accepts a fallback only when every dimension is equal or stricter", () => {
    const fallback = route({
      routeId: "qwen-cn-restricted-fallback",
      readinessReceiptRef: "readiness:qwen-cn-restricted-fallback",
      readinessReceiptHash: HASH_B,
      allowedTaskClasses: ["summary_briefing"],
      maximumSensitivity: "internal",
      retentionDays: 0,
      termsAssurance: "dedicated_no_retention",
      maxInputTokens: 8_000,
      maxOutputTokens: 2_000,
      maxCostUsdMicros: 250_000,
      maxLatencyMs: 10_000,
      maxConcurrency: 4,
    });
    const primary = route({ fallbackRouteIds: [fallback.routeId] });
    expect(compareFallbackRouteSafety(primary, fallback)).toEqual({
      safe: true,
      weakerDimensions: [],
      incomparableDimensions: [],
    });
    expect(validateTenantModelRoutePolicy(policy([primary, fallback]))).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects a fallback whose owner-approved governance profile differs", () => {
    const fallback = route({
      routeId: "qwen-cn-other-profile",
      readinessReceiptRef: "readiness:qwen-cn-other-profile",
      readinessReceiptHash: HASH_B,
      governanceProfileRef: "governance:model-egress-cn-exception",
      governanceProfileHash: HASH_A,
    });
    const primary = route({ fallbackRouteIds: [fallback.routeId] });
    expect(compareFallbackRouteSafety(primary, fallback)).toEqual({
      safe: false,
      weakerDimensions: [],
      incomparableDimensions: ["governance_profile"],
    });
    expect(validateTenantModelRoutePolicy(policy([primary, fallback])).errors)
      .toContain(
        "fallback_incomparable:qwen-cn-primary:qwen-cn-other-profile:governance_profile",
      );
  });

  it("rejects a fallback whose projection trust root differs", () => {
    const fallback = route({
      routeId: "qwen-cn-other-projector",
      readinessReceiptRef: "readiness:qwen-cn-other-projector",
      readinessReceiptHash: HASH_B,
      projectorRegistrationHash: HASH_B,
    });
    const primary = route({ fallbackRouteIds: [fallback.routeId] });
    expect(compareFallbackRouteSafety(primary, fallback)).toEqual({
      safe: false,
      weakerDimensions: [],
      incomparableDimensions: ["projection_trust_root"],
    });
    expect(validateTenantModelRoutePolicy(policy([primary, fallback])).errors)
      .toContain(
        "fallback_incomparable:qwen-cn-primary:qwen-cn-other-projector:projection_trust_root",
      );
  });

  it("rejects a fallback whose provider terms evidence differs", () => {
    const fallback = route({
      routeId: "qwen-cn-other-terms",
      readinessReceiptRef: "readiness:qwen-cn-other-terms",
      readinessReceiptHash: HASH_B,
      providerTermsHash: HASH_A,
    });
    const primary = route({ fallbackRouteIds: [fallback.routeId] });
    expect(compareFallbackRouteSafety(primary, fallback)).toEqual({
      safe: false,
      weakerDimensions: [],
      incomparableDimensions: ["provider_terms_contract"],
    });
    expect(validateTenantModelRoutePolicy(policy([primary, fallback])).errors)
      .toContain(
        "fallback_incomparable:qwen-cn-primary:qwen-cn-other-terms:provider_terms_contract",
      );
  });

  it("rejects a fallback whose deletion-terms evidence differs", () => {
    const fallback = route({
      routeId: "qwen-cn-other-deletion-terms",
      readinessReceiptRef:
        "readiness:qwen-cn-other-deletion-terms",
      readinessReceiptHash: HASH_B,
      deletionTermsHash: HASH_B,
    });
    const primary = route({ fallbackRouteIds: [fallback.routeId] });
    expect(compareFallbackRouteSafety(primary, fallback)).toEqual({
      safe: false,
      weakerDimensions: [],
      incomparableDimensions: ["provider_terms_contract"],
    });
    expect(validateTenantModelRoutePolicy(policy([primary, fallback])).errors)
      .toContain(
        "fallback_incomparable:qwen-cn-primary:qwen-cn-other-deletion-terms:provider_terms_contract",
      );
  });

  it("rejects a fallback whose owner-approved pricing contract differs", () => {
    const fallback = route({
      routeId: "qwen-cn-other-pricing",
      readinessReceiptRef: "readiness:qwen-cn-other-pricing",
      readinessReceiptHash: HASH_B,
      pricingVersion: "qwen-pricing-202608",
    });
    const primary = route({ fallbackRouteIds: [fallback.routeId] });
    expect(compareFallbackRouteSafety(primary, fallback)).toEqual({
      safe: false,
      weakerDimensions: [],
      incomparableDimensions: ["pricing_terms_contract"],
    });
    expect(validateTenantModelRoutePolicy(policy([primary, fallback])).errors)
      .toContain(
        "fallback_incomparable:qwen-cn-primary:qwen-cn-other-pricing:pricing_terms_contract",
      );
  });

  it("rejects an otherwise similar fallback in an incomparable region", () => {
    const fallback = route({
      routeId: "qwen-cn-shanghai",
      readinessReceiptRef: "readiness:qwen-cn-shanghai",
      readinessReceiptHash: HASH_B,
      region: "cn-shanghai",
    });
    const primary = route({ fallbackRouteIds: [fallback.routeId] });
    expect(compareFallbackRouteSafety(primary, fallback)).toEqual({
      safe: false,
      weakerDimensions: [],
      incomparableDimensions: ["region"],
    });
  });

  it("rejects fallback cycles", () => {
    const first = route({
      routeId: "first",
      readinessReceiptRef: "readiness:first",
      fallbackRouteIds: ["second"],
    });
    const second = route({
      routeId: "second",
      readinessReceiptRef: "readiness:second",
      readinessReceiptHash: HASH_B,
      fallbackRouteIds: ["first"],
    });
    expect(validateTenantModelRoutePolicy(policy([first, second])).errors).toEqual(
      expect.arrayContaining(["fallback_cycle:first"]),
    );
  });

  it("rejects unknown runtime enum values even when TypeScript is bypassed", () => {
    const invalid = policy([
      route({
        deploymentForm: "teleport" as TenantModelRoute["deploymentForm"],
        jurisdiction: "moon" as TenantModelRoute["jurisdiction"],
        maximumSensitivity:
          "top_secret" as TenantModelRoute["maximumSensitivity"],
        trainingUse:
          "share_all" as TenantModelRoute["trainingUse"],
        termsAssurance:
          "trust_me" as TenantModelRoute["termsAssurance"],
      }),
    ], {
      status: "activate_everything" as TenantModelRoutePolicy["status"],
    });
    expect(validateTenantModelRoutePolicy(invalid).errors).toEqual(
      expect.arrayContaining([
        "route:qwen-cn-primary:deployment_form_invalid",
        "route:qwen-cn-primary:jurisdiction_invalid",
        "route:qwen-cn-primary:maximum_sensitivity_invalid",
        "route:qwen-cn-primary:training_use_invalid",
        "route:qwen-cn-primary:terms_assurance_invalid",
        "policy_status_invalid",
      ]),
    );
  });
});

describe("provider readiness receipt", () => {
  it("keeps catalog visibility independent from adapter readiness", () => {
    const target = route();
    const receipt = readiness(target);
    expect(validateProviderAdapterReadinessReceipt(receipt)).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      readinessReceiptMatchesRoute({
        receipt,
        route: {
          ...target,
          readinessReceiptHash: receipt.contentHash,
        },
        now: new Date("2026-07-23T12:00:00.000Z"),
      }),
    ).toEqual({ valid: true, errors: [] });
  });

  it("blocks expired or mismatched readiness evidence", () => {
    const target = route();
    const receipt = readiness(target, {
      modelVersion: "qwen3.6-plus-20260702",
    });
    const result = readinessReceiptMatchesRoute({
      receipt,
      route: {
        ...target,
        readinessReceiptHash: receipt.contentHash,
      },
      now: new Date("2026-07-25T00:00:00.000Z"),
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "readiness_model_version_mismatch",
        "readiness_expired",
      ]),
    );
  });

  it("does not accept a readiness receipt checked in the future", () => {
    const target = route();
    const receipt = readiness(target, {
      checkedAt: "2026-07-24T01:00:00.000Z",
      expiresAt: "2026-07-25T01:00:00.000Z",
    });
    expect(
      readinessReceiptMatchesRoute({
        receipt,
        route: {
          ...target,
          readinessReceiptHash: receipt.contentHash,
        },
        now: new Date("2026-07-24T00:00:00.000Z"),
      }).errors,
    ).toContain("readiness_not_yet_checked");
  });

  it("rejects an unknown probe state at runtime", () => {
    const target = route();
    const receipt = readiness(target, {
      modelProbeStatus:
        "maybe" as ProviderAdapterReadinessReceipt["modelProbeStatus"],
    });
    expect(validateProviderAdapterReadinessReceipt(receipt).errors).toContain(
      "model_probe_status_invalid",
    );
  });
});

describe("adapter and owner approval trust roots", () => {
  it("hashes immutable adapter registration metadata", () => {
    const target = registration();
    expect(
      validateGovernedModelAdapterRegistration(target),
    ).toEqual({ valid: true, errors: [] });
    expect(
      validateGovernedModelAdapterRegistration({
        ...target,
        adapterVersion: "tampered-adapter",
      }).errors,
    ).toContain("adapter_registration_hash_mismatch");
  });

  it("binds the owner approval receipt to one exact policy", () => {
    const target = policy([route()]);
    const receipt = approvalReceipt(target);
    expect(
      validateModelRoutePolicyApprovalReceipt(receipt),
    ).toEqual({ valid: true, errors: [] });
    expect(
      validateModelRoutePolicyApprovalReceipt({
        ...receipt,
        policyHash: HASH_B,
      }).errors,
    ).toContain("policy_approval_receipt_hash_mismatch");
  });
});

describe("effective data classification", () => {
  it("defaults missing or pending classification to restricted local-only", () => {
    expect(deriveEffectiveModelDataClassification([])).toEqual({
      sensitivity: "restricted",
      processingDisposition: "local_only",
      reasonCodes: [
        "classification_missing_defaulted_restricted_local_only",
      ],
    });
    expect(
      deriveEffectiveModelDataClassification([
        {
          sensitivity: "public",
          processingDisposition: "remote_projected",
          classificationStatus: "pending",
        },
      ]),
    ).toEqual({
      sensitivity: "restricted",
      processingDisposition: "local_only",
      reasonCodes: [
        "classification_pending_defaulted_restricted_local_only",
      ],
    });
  });

  it("uses the strictest sensitivity and disposition across all sources", () => {
    expect(
      deriveEffectiveModelDataClassification([
        {
          sensitivity: "internal",
          processingDisposition: "remote_projected",
          classificationStatus: "classified",
        },
        {
          sensitivity: "confidential",
          processingDisposition: "local_only",
          classificationStatus: "classified",
        },
      ]),
    ).toEqual({
      sensitivity: "confidential",
      processingDisposition: "local_only",
      reasonCodes: [],
    });
  });

  it("never permits local-only data on a remote route", () => {
    const result = routeAllowsClassification({
      route: route(),
      taskClass: "summary_briefing",
      classification: {
        sensitivity: "internal",
        processingDisposition: "local_only",
        reasonCodes: [],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "processing_disposition_not_allowed",
        "local_only_remote_egress_forbidden",
      ]),
    );
  });
});

describe("projected prompt binding", () => {
  it("changes the hash when either projected prompt changes", () => {
    const original = computeProjectedPromptHash({
      systemPrompt: "Only use projected evidence.",
      userPrompt: "Summarize evidence ref e:1.",
    });
    const changed = computeProjectedPromptHash({
      systemPrompt: "Only use projected evidence.",
      userPrompt: "Summarize evidence ref e:2.",
    });
    expect(original).not.toBe(changed);
  });
});
