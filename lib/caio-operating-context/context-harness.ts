import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import { OPERATING_CONTEXT_PROJECTOR_REVISION } from "@/lib/operating-harness/context-contracts";
import {
  computeHarnessManifestContentHash,
  computeHarnessRevisionContentHash,
  HARNESS_COMPONENT_KINDS,
  HARNESS_MANIFEST_SCHEMA_VERSION,
  HARNESS_REVISION_SCHEMA_VERSION,
  type HarnessRevision,
} from "@/lib/operating-harness/harness-contracts";
import { TENANT_LIVE_HARNESS_SCOPE, type TenantLiveHarnessManifest } from "@/lib/operating-harness/tenant-live-contracts";

/**
 * The fixed tenant live shadow harness for the CAIO quick check. It is Core code reviewed by people,
 * hence a human-authored seed revision; a change to any component bumps its version here.
 */

export const CAIO_QUICK_CHECK_HARNESS_CREATED_AT = "2026-09-16T00:00:00.000Z";

let cached: { manifest: TenantLiveHarnessManifest; revision: HarnessRevision } | null = null;

// Returns a fresh copy each time so a caller mutating its projection input cannot alter the harness.
export function getCaioQuickCheckHarness(): { manifest: TenantLiveHarnessManifest; revision: HarnessRevision } {
  if (cached) return structuredClone(cached);
  const manifestContent = {
    schemaVersion: HARNESS_MANIFEST_SCHEMA_VERSION,
    manifestId: "manifest:caio-quick-check",
    scope: TENANT_LIVE_HARNESS_SCOPE,
    canonicalChainRef: "chain:operating-harness",
    components: HARNESS_COMPONENT_KINDS.map((kind) => ({
      componentKind: kind,
      componentRef: `caio-quick-check/${kind}`,
      revisionRef: `caio-quick-check/${kind}/v1`,
      contentHash: sha256(canonicalJson({ kind, projector: OPERATING_CONTEXT_PROJECTOR_REVISION, version: 1 })),
    })),
    allowedSourceClasses: ["tenant_self_observation"] as ["tenant_self_observation"],
    intendedUses: ["operator_triage" as const],
    commitmentClass: "advice" as const,
    actionAuthority: "none" as const,
    humanReviewRequired: true as const,
    automaticPromotionAllowed: false as const,
    externalSendAllowed: false as const,
    writebackAllowed: false as const,
    memoryPromotionAllowed: false as const,
    createdAt: CAIO_QUICK_CHECK_HARNESS_CREATED_AT,
  };
  const manifest: TenantLiveHarnessManifest = {
    ...manifestContent,
    contentHash: computeHarnessManifestContentHash(manifestContent as never),
  };
  const revisionContent = {
    schemaVersion: HARNESS_REVISION_SCHEMA_VERSION,
    revisionId: "revision:caio-quick-check-seed",
    manifestId: manifest.manifestId,
    manifestHash: manifest.contentHash,
    parentRevisionId: null,
    parentManifestHash: null,
    status: "seed" as const,
    changes: [],
    derivedFromFeedbackIds: [],
    createdBy: "human" as const,
    fallbackRevisionId: null,
    rollbackManifestHash: null,
    ownerReviewRequired: true as const,
    promotionTriggered: false as const,
    createdAt: CAIO_QUICK_CHECK_HARNESS_CREATED_AT,
  };
  cached = { manifest, revision: { ...revisionContent, contentHash: computeHarnessRevisionContentHash(revisionContent) } };
  return structuredClone(cached);
}
