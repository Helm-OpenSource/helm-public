import type {
  OperatingSignalSourceClass,
  OperatingSignalUse,
} from "../operating-signal-governance/source-governance";
import { canonicalJson, sha256 } from "../expert-capability/hashing";
import type { OperatingHarnessQualityMetrics } from "./metrics";

export const HARNESS_MANIFEST_SCHEMA_VERSION =
  "helm.operating-harness.manifest.v1" as const;
export const HARNESS_REVISION_SCHEMA_VERSION =
  "helm.operating-harness.revision.v1" as const;
export const HARNESS_SHADOW_RECEIPT_SCHEMA_VERSION =
  "helm.operating-harness.shadow-receipt.v1" as const;

export const PROTECTED_HARNESS_COMPONENT_KINDS = [
  "canonical_schema",
  "privacy_policy",
  "source_governance_policy",
  "permission_policy",
  "evaluator",
  "heldout_registry",
  "owner_promotion_gate",
  "kill_switch",
  "memory_governance_policy",
] as const;

export const MUTABLE_HARNESS_COMPONENT_KINDS = [
  "signal_normalizer",
  "object_linker",
  "judgement_fusion",
  "expert_policy",
  "context_policy",
  "memory_retrieval_policy",
  "skill_binding",
  "tool_binding",
] as const;

export const HARNESS_COMPONENT_KINDS = [
  ...PROTECTED_HARNESS_COMPONENT_KINDS,
  ...MUTABLE_HARNESS_COMPONENT_KINDS,
] as const;

export type ProtectedHarnessComponentKind =
  (typeof PROTECTED_HARNESS_COMPONENT_KINDS)[number];
export type MutableHarnessComponentKind =
  (typeof MUTABLE_HARNESS_COMPONENT_KINDS)[number];
export type HarnessComponentKind = (typeof HARNESS_COMPONENT_KINDS)[number];

export const HARNESS_MANIFEST_ALLOWED_SOURCE_CLASSES = [
  "synthetic_public",
  "self_dogfood_health",
  "deidentified_promoted_case",
] as const satisfies readonly OperatingSignalSourceClass[];

export const HARNESS_MANIFEST_ALLOWED_USES = [
  "fixture_validation",
  "public_eval",
  "heldout_eval",
] as const satisfies readonly OperatingSignalUse[];

export type HarnessComponentBinding = {
  componentKind: HarnessComponentKind;
  componentRef: string;
  revisionRef: string;
  contentHash: string;
};

export type HarnessManifest = {
  schemaVersion: typeof HARNESS_MANIFEST_SCHEMA_VERSION;
  manifestId: string;
  scope: "public_offline_shadow";
  canonicalChainRef: string;
  components: HarnessComponentBinding[];
  allowedSourceClasses: Array<(typeof HARNESS_MANIFEST_ALLOWED_SOURCE_CLASSES)[number]>;
  intendedUses: Array<(typeof HARNESS_MANIFEST_ALLOWED_USES)[number]>;
  commitmentClass: "advice";
  actionAuthority: "none";
  humanReviewRequired: true;
  automaticPromotionAllowed: false;
  externalSendAllowed: false;
  writebackAllowed: false;
  memoryPromotionAllowed: false;
  createdAt: string;
  contentHash: string;
};

export type HarnessManifestContent = Omit<HarnessManifest, "contentHash">;

export const HARNESS_CHANGE_RATIONALE_CODES = [
  "feedback_correction",
  "heldout_failure",
  "calibration_gap",
  "boundary_hardening",
  "operator_observation",
] as const;
export type HarnessChangeRationaleCode =
  (typeof HARNESS_CHANGE_RATIONALE_CODES)[number];

export type HarnessComponentChange = {
  componentKind: MutableHarnessComponentKind;
  fromRevisionRef: string;
  toRevisionRef: string;
  rationaleCode: HarnessChangeRationaleCode;
  evidenceRefs: string[];
};

export type HarnessRevisionStatus = "seed" | "shadow_candidate" | "killed";

export type HarnessRevision = {
  schemaVersion: typeof HARNESS_REVISION_SCHEMA_VERSION;
  revisionId: string;
  manifestId: string;
  manifestHash: string;
  parentRevisionId: string | null;
  parentManifestHash: string | null;
  status: HarnessRevisionStatus;
  changes: HarnessComponentChange[];
  derivedFromFeedbackIds: string[];
  createdBy: "human" | "agent_proposal";
  fallbackRevisionId: string | null;
  rollbackManifestHash: string | null;
  ownerReviewRequired: true;
  promotionTriggered: false;
  createdAt: string;
  contentHash: string;
};

export type HarnessRevisionContent = Omit<HarnessRevision, "contentHash">;

export type HarnessShadowVerdict = "shadow_pass" | "inconclusive" | "fail";

export type HarnessShadowReceipt = {
  schemaVersion: typeof HARNESS_SHADOW_RECEIPT_SCHEMA_VERSION;
  shadowRunId: string;
  candidateRevisionId: string;
  candidateRevisionHash: string;
  baselineRevisionId: string;
  baselineRevisionHash: string;
  preRegistrationId: string;
  preRegistrationContentHash: string;
  developmentSetRef: string;
  developmentSetHash: string;
  heldoutSetRef: string;
  heldoutSetHash: string;
  replaySnapshotRootHash: string;
  qualityDerivation: "expert_pre_registered_a_b";
  qualityScope: "heldout_corpus_projection";
  expertEvaluation: {
    loopCompoundingDecision: "success" | "inconclusive" | "fail";
    expertJustifiedDecision: "pass" | "inconclusive(expert_vs_rules)" | "fail";
    candidateWeighted: number;
    previousWeighted: number;
    ruleBaselineWeighted: number;
    candidateBoundaryCorrectness: number;
  };
  candidateQuality: OperatingHarnessQualityMetrics;
  baselineQuality: OperatingHarnessQualityMetrics;
  sourceGateCount: number;
  verdict: HarnessShadowVerdict;
  hardGateFailures: string[];
  eligibleForOwnerReview: boolean;
  ownerReviewRequired: true;
  promotionTriggered: false;
  productionAuthorityGranted: false;
  createdAt: string;
  contentHash: string;
};

export type HarnessShadowReceiptContent = Omit<HarnessShadowReceipt, "contentHash">;

export function computeHarnessManifestContentHash(
  content: HarnessManifestContent,
): string {
  return sha256(canonicalJson(content));
}

export function computeHarnessRevisionContentHash(
  content: HarnessRevisionContent,
): string {
  return sha256(canonicalJson(content));
}

export function computeHarnessShadowReceiptContentHash(
  content: HarnessShadowReceiptContent,
): string {
  return sha256(canonicalJson(content));
}
