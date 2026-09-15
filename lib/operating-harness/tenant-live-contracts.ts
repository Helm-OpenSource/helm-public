import { canonicalJson, sha256 } from "../expert-capability/hashing";
import type { TENANT_SELF_OBSERVATION_ALLOWED_USES } from "../operating-signal-governance/source-governance";
import type { HarnessManifest } from "./harness-contracts";

/**
 * Tenant live shadow: a tenant observing its own operations inside its own deployment.
 * It sits beside the public offline shadow manifest and never replaces it; evaluation,
 * evolution and readiness keep accepting only the public manifest.
 */

export const TENANT_LIVE_HARNESS_SCOPE = "tenant_live_shadow" as const;
export const TENANT_OBSERVATION_RECEIPT_SCHEMA_VERSION =
  "helm.operating-harness.tenant-observation-receipt.v1" as const;

export type TenantSelfObservationUse = (typeof TENANT_SELF_OBSERVATION_ALLOWED_USES)[number];

export type TenantLiveHarnessManifest = Omit<
  HarnessManifest,
  "scope" | "allowedSourceClasses" | "intendedUses"
> & {
  scope: typeof TENANT_LIVE_HARNESS_SCOPE;
  allowedSourceClasses: ["tenant_self_observation"];
  intendedUses: TenantSelfObservationUse[];
};

export type TenantLiveHarnessManifestContent = Omit<TenantLiveHarnessManifest, "contentHash">;

/** Stands in for EvalCasePromotion: a terminal observation run bound to its catalog receipts. */
export type TenantObservationReceipt = {
  schemaVersion: typeof TENANT_OBSERVATION_RECEIPT_SCHEMA_VERSION;
  observationRunRef: string;
  runStatus: "SUCCEEDED" | "PARTIAL";
  windowStart: string;
  windowEnd: string;
  observedAt: string;
  summaryHash: string;
  catalogEntryRef: string;
  authorizationReceiptRef: string;
  connectionReceiptRef: string;
  evidenceRefs: string[];
  contentHash: string;
};

export type TenantObservationReceiptContent = Omit<TenantObservationReceipt, "contentHash">;

export function computeTenantObservationReceiptContentHash(
  content: TenantObservationReceiptContent,
): string {
  return sha256(canonicalJson(content));
}
