import { z } from "zod";

import { publicSafeRedactionStatusSchema } from "@/lib/llm/intelligence-contracts-v3";
import { runtimePermissionProfileSchema } from "@/lib/llm/runtime-permission";

const safeRefSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[a-z0-9][a-z0-9._:/-]*$/i);
const timestampSchema = z.string().datetime({ offset: true });

export const PRIVATE_CONTEXT_SOURCE_CLASSES = [
  "temporal_operating_context",
  "confirmed_artifact",
  "verified_memory_reference",
  "source_profiler_derived",
] as const;
export const privateContextSourceClassSchema = z.enum(
  PRIVATE_CONTEXT_SOURCE_CLASSES,
);

export const privateContextAdapterManifestSchema = z
  .object({
    contractVersion: z.literal("helm.private-context-adapter/v1"),
    adapterKey: safeRefSchema,
    adapterVersion: z.string().min(1).max(64),
    sourceClasses: z.array(privateContextSourceClassSchema).min(1),
    readPosture: z.literal("derived_read_only"),
    isolationProfileRef: safeRefSchema,
    outputContract: z.literal("RichLocalContextBundle"),
    policyVersion: safeRefSchema,
    projectionRequired: z.literal(true),
    rawEgressAllowed: z.literal(false),
    sideEffectAllowed: z.literal(false),
    providerCallAllowed: z.literal(false),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    if (new Set(manifest.sourceClasses).size !== manifest.sourceClasses.length) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceClasses"],
        message: "private context source classes must be unique",
      });
    }
  });
export type PrivateContextAdapterManifest = z.infer<
  typeof privateContextAdapterManifestSchema
>;

const privateContextSourceSnapshotRefSchema = z
  .object({
    refId: safeRefSchema,
    sourceHash: safeRefSchema,
  })
  .strict();

export const privateContextBuildReceiptSchema = z
  .object({
    receiptId: safeRefSchema,
    bundleId: safeRefSchema,
    adapterKey: safeRefSchema,
    adapterVersion: z.string().min(1).max(64),
    sourceSnapshotRefs: z.array(privateContextSourceSnapshotRefSchema).min(1),
    redactionStatus: publicSafeRedactionStatusSchema,
    promptInjectionScanStatus: z.enum(["passed", "failed"]),
    derivedSummaryCount: z.number().int().nonnegative(),
    rawContentIncluded: z.literal(false),
    credentialIncluded: z.literal(false),
    tenantUrlIncluded: z.literal(false),
    providerCalled: z.literal(false),
    sideEffectAttempted: z.literal(false),
    createdAt: timestampSchema,
  })
  .strict()
  .superRefine((receipt, ctx) => {
    const refs = receipt.sourceSnapshotRefs.map((item) => item.refId);
    if (new Set(refs).size !== refs.length) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceSnapshotRefs"],
        message: "private context source snapshot refs must be unique",
      });
    }
  });
export type PrivateContextBuildReceipt = z.infer<
  typeof privateContextBuildReceiptSchema
>;

export const CONTEXT_EGRESS_FAILURE_REASONS = [
  "local_only",
  "profile_blocked",
  "consent_missing",
  "prompt_preview_missing",
  "audit_missing",
  "redaction_failed",
  "injection_scan_failed",
  "projection_not_remote_safe",
] as const;

export const contextEgressDecisionReceiptSchema = z
  .object({
    receiptId: safeRefSchema,
    sourceBundleId: safeRefSchema,
    contextProjectionReceiptId: safeRefSchema,
    modelProfileKey: safeRefSchema,
    consentGranted: z.boolean(),
    promptPreviewHash: safeRefSchema.nullable(),
    auditRef: safeRefSchema.nullable(),
    redactionStatus: publicSafeRedactionStatusSchema,
    decision: z.enum(["allow_projected", "block"]),
    reason: z.enum(["allowed_projected", ...CONTEXT_EGRESS_FAILURE_REASONS]),
    rawContentIncluded: z.literal(false),
    credentialIncluded: z.literal(false),
    tenantUrlIncluded: z.literal(false),
  })
  .strict()
  .superRefine((receipt, ctx) => {
    if (receipt.decision === "allow_projected") {
      if (
        receipt.reason !== "allowed_projected" ||
        !receipt.consentGranted ||
        !receipt.promptPreviewHash ||
        !receipt.auditRef
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "projected egress requires consent, prompt preview, audit, and an allowed decision reason",
        });
      }
      return;
    }

    if (receipt.reason === "allowed_projected") {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "blocked egress must carry a blocking reason",
      });
    }
  });
export type ContextEgressDecisionReceipt = z.infer<
  typeof contextEgressDecisionReceiptSchema
>;

export type PrivateContextAdapterConformanceResult = Readonly<{
  ok: boolean;
  errors: readonly string[];
}>;

export function validatePrivateContextAdapterConformance(input: {
  manifest: unknown;
  buildReceipt: unknown;
}): PrivateContextAdapterConformanceResult {
  const manifest = privateContextAdapterManifestSchema.safeParse(input.manifest);
  const receipt = privateContextBuildReceiptSchema.safeParse(input.buildReceipt);
  const errors: string[] = [];

  if (!manifest.success) errors.push("manifest_schema_invalid");
  if (!receipt.success) errors.push("build_receipt_schema_invalid");
  if (!manifest.success || !receipt.success) {
    return { ok: false, errors };
  }

  if (manifest.data.adapterKey !== receipt.data.adapterKey) {
    errors.push("adapter_key_mismatch");
  }
  if (manifest.data.adapterVersion !== receipt.data.adapterVersion) {
    errors.push("adapter_version_mismatch");
  }
  if (receipt.data.promptInjectionScanStatus !== "passed") {
    errors.push("prompt_injection_scan_not_passed");
  }

  return { ok: errors.length === 0, errors };
}

export const runtimeIsolationProfileSchema = z
  .object({
    profileKey: safeRefSchema,
    kind: z.enum(["read_adapter", "review_worker", "side_effect_executor"]),
    nonRoot: z.literal(true),
    readOnlyRootFs: z.literal(true),
    networkPolicy: z.enum(["none", "egress_proxy_only", "target_allowlist"]),
    credentialAccess: z.enum([
      "none",
      "read_source_only",
      "target_executor_only",
    ]),
    modelSdkAllowed: z.boolean(),
    sideEffectAllowed: z.boolean(),
    resourceLimits: z
      .object({
        maxCpuMillicores: z.number().int().positive(),
        maxMemoryMb: z.number().int().positive(),
        maxPids: z.number().int().positive(),
        maxWallClockSeconds: z.number().int().positive(),
      })
      .strict(),
  })
  .strict()
  .superRefine((profile, ctx) => {
    if (
      profile.kind === "review_worker" &&
      (profile.sideEffectAllowed ||
        profile.credentialAccess !== "none" ||
        profile.networkPolicy === "target_allowlist")
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "review workers must have no side effects, no credentials, and no target-system network access",
      });
    }

    if (
      profile.kind === "read_adapter" &&
      (profile.modelSdkAllowed ||
        profile.sideEffectAllowed ||
        profile.credentialAccess === "target_executor_only" ||
        profile.networkPolicy === "egress_proxy_only")
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "read adapters cannot use model SDKs, side effects, executor credentials, or model egress",
      });
    }

    if (
      profile.kind === "side_effect_executor" &&
      (profile.modelSdkAllowed ||
        !profile.sideEffectAllowed ||
        profile.credentialAccess !== "target_executor_only" ||
        profile.networkPolicy !== "target_allowlist")
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "side-effect executors require target-only credentials and network access and must not link a model SDK",
      });
    }
  });
export type RuntimeIsolationProfile = z.infer<
  typeof runtimeIsolationProfileSchema
>;

export const capabilityGrantSchema = z
  .object({
    grantRef: safeRefSchema,
    principalRef: safeRefSchema,
    capabilityRef: safeRefSchema,
    scopeRef: safeRefSchema,
    effectMode: runtimePermissionProfileSchema,
    policyVersion: safeRefSchema,
    isolationProfileRef: safeRefSchema,
    entitlementRef: safeRefSchema.nullable(),
    killSwitchRef: safeRefSchema.nullable(),
    issuedAt: timestampSchema,
    expiresAt: timestampSchema,
    // Effective revocation time. A future value schedules revocation; it must
    // still fall inside the grant's own validity window.
    revokedAt: timestampSchema.nullable(),
  })
  .strict()
  .superRefine((grant, ctx) => {
    if (Date.parse(grant.expiresAt) <= Date.parse(grant.issuedAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "capability grant expiry must be after issuance",
      });
    }
    if (
      grant.revokedAt &&
      (Date.parse(grant.revokedAt) < Date.parse(grant.issuedAt) ||
        Date.parse(grant.revokedAt) > Date.parse(grant.expiresAt))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["revokedAt"],
        message: "capability grant revocation must fall inside the grant lifecycle",
      });
    }
  });
export type CapabilityGrant = z.infer<typeof capabilityGrantSchema>;

export const CAPABILITY_GRANT_DECISIONS = [
  "allow_read",
  "allow_draft",
  "allow_review",
  "deny",
] as const;
export const capabilityGrantDecisionSchema = z.enum(CAPABILITY_GRANT_DECISIONS);

export const CAPABILITY_GRANT_DECISION_REASONS = [
  "allowed",
  "invalid_grant",
  "invalid_request",
  "not_yet_valid",
  "expired",
  "revoked",
  "principal_mismatch",
  "capability_mismatch",
  "scope_mismatch",
  "blocked_side_effect",
] as const;
export const capabilityGrantDecisionReasonSchema = z.enum(
  CAPABILITY_GRANT_DECISION_REASONS,
);

export type CapabilityGrantDecision = Readonly<{
  decision: z.infer<typeof capabilityGrantDecisionSchema>;
  reason: z.infer<typeof capabilityGrantDecisionReasonSchema>;
  grantRef: string | null;
  effectMode: z.infer<typeof runtimePermissionProfileSchema>;
}>;

function denyGrant(
  reason: CapabilityGrantDecision["reason"],
  grant: CapabilityGrant | null,
): CapabilityGrantDecision {
  return {
    decision: "deny",
    reason,
    grantRef: grant?.grantRef ?? null,
    effectMode: "blocked_side_effect",
  };
}

export function evaluateCapabilityGrant(input: {
  grant: unknown;
  principalRef: string;
  capabilityRef: string;
  scopeRef: string;
  at: string;
}): CapabilityGrantDecision {
  const parsedGrant = capabilityGrantSchema.safeParse(input.grant);
  if (!parsedGrant.success) return denyGrant("invalid_grant", null);
  const grant = parsedGrant.data;
  const parsedAt = timestampSchema.safeParse(input.at);
  if (!parsedAt.success) return denyGrant("invalid_request", grant);

  const at = Date.parse(parsedAt.data);
  if (at < Date.parse(grant.issuedAt)) return denyGrant("not_yet_valid", grant);
  if (at >= Date.parse(grant.expiresAt)) return denyGrant("expired", grant);
  if (grant.revokedAt && at >= Date.parse(grant.revokedAt)) {
    return denyGrant("revoked", grant);
  }
  if (input.principalRef !== grant.principalRef) {
    return denyGrant("principal_mismatch", grant);
  }
  if (input.capabilityRef !== grant.capabilityRef) {
    return denyGrant("capability_mismatch", grant);
  }
  if (input.scopeRef !== grant.scopeRef) {
    return denyGrant("scope_mismatch", grant);
  }
  if (grant.effectMode === "blocked_side_effect") {
    return denyGrant("blocked_side_effect", grant);
  }

  switch (grant.effectMode) {
    case "read_only":
      return {
        decision: "allow_read",
        reason: "allowed",
        grantRef: grant.grantRef,
        effectMode: grant.effectMode,
      };
    case "draft_only":
      return {
        decision: "allow_draft",
        reason: "allowed",
        grantRef: grant.grantRef,
        effectMode: grant.effectMode,
      };
    case "review_required":
      return {
        decision: "allow_review",
        reason: "allowed",
        grantRef: grant.grantRef,
        effectMode: grant.effectMode,
      };
    default:
      return denyGrant("blocked_side_effect", grant);
  }
}
