import type { FeedbackRecord } from "../expert-capability/contracts";
import { canonicalJson, sha256 } from "../expert-capability/hashing";
import type { EvalCasePromotion } from "../expert-capability/validators";

export const SIGNAL_EVENT_SCHEMA_VERSION = "helm.operating-harness.signal-event.v1" as const;
export const EVIDENCE_REF_SCHEMA_VERSION = "helm.operating-harness.evidence-ref.v1" as const;
export const BUSINESS_OBJECT_ALIAS_SCHEMA_VERSION =
  "helm.operating-harness.business-object-alias.v1" as const;
export const JUDGEMENT_PACKET_SCHEMA_VERSION =
  "helm.operating-harness.judgement-packet.v1" as const;

export const PUBLIC_SAFE_REDACTION_STATUSES = ["synthetic", "redacted", "alias_only"] as const;
export type PublicSafeRedactionStatus = (typeof PUBLIC_SAFE_REDACTION_STATUSES)[number];

export const EVIDENCE_SENSITIVITY_LEVELS = [
  "public",
  "internal",
  "confidential",
  "restricted",
] as const;
export type EvidenceSensitivity = (typeof EVIDENCE_SENSITIVITY_LEVELS)[number];

export type EvidenceRef = {
  schemaVersion: typeof EVIDENCE_REF_SCHEMA_VERSION;
  evidenceRef: string;
  tenantScopeRef: string;
  sourceType: string;
  sourceSnapshotHash: string;
  capturedAt: string;
  expiresAt: string | null;
  sensitivity: EvidenceSensitivity;
  redactionStatus: PublicSafeRedactionStatus;
  consentScopeRef: string | null;
  contentIncluded: false;
  contentHash: string;
};

export type EvidenceRefContent = Omit<EvidenceRef, "contentHash">;
export type EvidenceBinding = Pick<EvidenceRef, "evidenceRef" | "contentHash">;

export const BUSINESS_OBJECT_RESOLUTION_METHODS = [
  "deterministic_key",
  "human_confirmed",
  "synthetic_fixture",
] as const;
export type BusinessObjectResolutionMethod =
  (typeof BUSINESS_OBJECT_RESOLUTION_METHODS)[number];

export const BUSINESS_OBJECT_PERSON_ATTRIBUTION_MODES = [
  "none",
  "role_only",
  "deidentified_cohort",
] as const;
export type BusinessObjectPersonAttributionMode =
  (typeof BUSINESS_OBJECT_PERSON_ATTRIBUTION_MODES)[number];

export type BusinessObjectAlias = {
  schemaVersion: typeof BUSINESS_OBJECT_ALIAS_SCHEMA_VERSION;
  aliasRef: string;
  tenantScopeRef: string;
  objectKind: string;
  sourceObjectAliasRefs: string[];
  resolutionMethod: BusinessObjectResolutionMethod;
  crossTenantProjection: false;
  personAttributionMode: BusinessObjectPersonAttributionMode;
  createdAt: string;
  contentHash: string;
};

export type BusinessObjectAliasContent = Omit<BusinessObjectAlias, "contentHash">;

export type SignalEvent = {
  schemaVersion: typeof SIGNAL_EVENT_SCHEMA_VERSION;
  signalId: string;
  signalKey: string;
  tenantScopeRef: string;
  sourceEnvelopeRef: string;
  sourceRef: string;
  signalFamily: string;
  observedAt: string;
  capturedAt: string;
  evidenceRefs: string[];
  evidenceRootHash: string;
  businessObjectAliasRef: string | null;
  redactionStatus: PublicSafeRedactionStatus;
  boundaryNote: string;
  contentHash: string;
};

export type SignalEventContent = Omit<SignalEvent, "contentHash">;

export const JUDGEMENT_CONFIDENCE_BANDS = [
  "high",
  "medium",
  "low",
  "mixed",
  "unknown",
] as const;
export type JudgementConfidenceBand = (typeof JUDGEMENT_CONFIDENCE_BANDS)[number];

export type JudgementPacket = {
  schemaVersion: typeof JUDGEMENT_PACKET_SCHEMA_VERSION;
  packetId: string;
  inputSnapshotRef: string;
  expertRevisionId: string;
  signalEventRefs: string[];
  businessObjectAliasRef: string;
  disposition: string;
  evidenceRefs: string[];
  commitmentClass: "advice";
  boundaryNote: string;
  humanReviewerRequired: true;
  forbiddenActionRefs: string[];
  confidence: {
    band: JudgementConfidenceBand;
    score: number | null;
    method: "deterministic" | "model_assisted";
    calibrationRef: string | null;
  };
  createdAt: string;
  contentHash: string;
};

export type JudgementPacketContent = Omit<JudgementPacket, "contentHash">;

export function computeEvidenceRefContentHash(content: EvidenceRefContent): string {
  return sha256(canonicalJson(content));
}

export function computeEvidenceBindingRootHash(
  evidenceBindings: readonly EvidenceBinding[],
): string {
  const canonicalBindings = evidenceBindings
    .map(({ evidenceRef, contentHash }) => ({ evidenceRef, contentHash }))
    .sort((left, right) => left.evidenceRef.localeCompare(right.evidenceRef));
  return sha256(canonicalJson(canonicalBindings));
}

export function computeBusinessObjectAliasContentHash(
  content: BusinessObjectAliasContent,
): string {
  return sha256(canonicalJson(content));
}

export function computeSignalEventContentHash(content: SignalEventContent): string {
  return sha256(canonicalJson(content));
}

export function computeJudgementPacketContentHash(content: JudgementPacketContent): string {
  return sha256(canonicalJson(content));
}

// Canonical feedback and promotion deliberately remain owned by expert-capability.
// Re-exporting the types gives consumers one chain without creating competing schemas.
export type { FeedbackRecord, EvalCasePromotion };
