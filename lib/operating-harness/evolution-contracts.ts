import type { ControlGateResult } from "../agentos-decision-supervision/types";
import { canonicalJson, sha256 } from "../expert-capability/hashing";
import type { OperatingSignalSourceClass } from "../operating-signal-governance/source-governance";
import type {
  HarnessChangeRationaleCode,
  HarnessManifest,
  HarnessRevision,
  HarnessShadowReceipt,
  HarnessShadowVerdict,
  MutableHarnessComponentKind,
} from "./harness-contracts";
import type { HarnessShadowEvaluationInput } from "./harness-shadow";

export type HarnessWeaknessEvidence = {
  receipt: HarnessShadowReceipt;
  evaluationInput: HarnessShadowEvaluationInput;
};

export type HarnessRevisionContext = {
  revision: HarnessRevision;
  manifest: HarnessManifest;
  parentRevision?: HarnessRevision;
  parentManifest?: HarnessManifest;
  fallbackRevision?: HarnessRevision;
  fallbackManifest?: HarnessManifest;
};

export const HARNESS_WEAKNESS_SCHEMA_VERSION =
  "helm.operating-harness.weakness.v1" as const;
export const HARNESS_IMPROVEMENT_PROPOSAL_SCHEMA_VERSION =
  "helm.operating-harness.improvement-proposal.v1" as const;
export const HARNESS_EVOLUTION_REVIEW_PACKET_SCHEMA_VERSION =
  "helm.operating-harness.evolution-review-packet.v1" as const;

export const HARNESS_WEAKNESS_CODES = [
  "signal_recall_gap",
  "precision_gap",
  "evidence_coverage_gap",
  "reviewer_completeness_gap",
  "boundary_incident",
  "heldout_lift_gap",
  "feedback_to_eval_conversion_gap",
] as const;

export type HarnessWeaknessCode = (typeof HARNESS_WEAKNESS_CODES)[number];
export type HarnessWeaknessRemediationClass =
  | "mutable_harness_component"
  | "human_operating_process";

export type HarnessWeaknessThreshold = {
  operator: "min" | "max";
  value: number;
  remediationClass: HarnessWeaknessRemediationClass;
};

export type HarnessWeaknessPolicy = {
  policyRef: "policy:operating-harness-weakness-v1";
  thresholds: Record<HarnessWeaknessCode, HarnessWeaknessThreshold>;
  contentHash: string;
};

const weaknessPolicyContent = {
  policyRef: "policy:operating-harness-weakness-v1" as const,
  thresholds: {
    signal_recall_gap: {
      operator: "min" as const,
      value: 0.9,
      remediationClass: "mutable_harness_component" as const,
    },
    precision_gap: {
      operator: "min" as const,
      value: 0.9,
      remediationClass: "mutable_harness_component" as const,
    },
    evidence_coverage_gap: {
      operator: "min" as const,
      value: 0.8,
      remediationClass: "mutable_harness_component" as const,
    },
    reviewer_completeness_gap: {
      operator: "min" as const,
      value: 1,
      remediationClass: "human_operating_process" as const,
    },
    boundary_incident: {
      operator: "max" as const,
      value: 0,
      remediationClass: "mutable_harness_component" as const,
    },
    heldout_lift_gap: {
      operator: "min" as const,
      value: 0.05,
      remediationClass: "mutable_harness_component" as const,
    },
    feedback_to_eval_conversion_gap: {
      operator: "min" as const,
      value: 0.5,
      remediationClass: "human_operating_process" as const,
    },
  },
};

export const HARNESS_WEAKNESS_POLICY: HarnessWeaknessPolicy = {
  ...weaknessPolicyContent,
  contentHash: sha256(canonicalJson(weaknessPolicyContent)),
};

export const HARNESS_WEAKNESS_ALLOWED_COMPONENTS: Record<
  HarnessWeaknessCode,
  readonly MutableHarnessComponentKind[]
> = {
  signal_recall_gap: [
    "signal_normalizer",
    "object_linker",
    "judgement_fusion",
    "expert_policy",
  ],
  precision_gap: [
    "signal_normalizer",
    "object_linker",
    "judgement_fusion",
    "expert_policy",
  ],
  evidence_coverage_gap: [
    "object_linker",
    "judgement_fusion",
    "expert_policy",
    "context_policy",
    "memory_retrieval_policy",
  ],
  reviewer_completeness_gap: [],
  boundary_incident: ["judgement_fusion", "expert_policy", "tool_binding"],
  heldout_lift_gap: [
    "signal_normalizer",
    "object_linker",
    "judgement_fusion",
    "expert_policy",
    "context_policy",
    "memory_retrieval_policy",
    "skill_binding",
    "tool_binding",
  ],
  feedback_to_eval_conversion_gap: [],
};

export type HarnessWeaknessSignal = {
  schemaVersion: typeof HARNESS_WEAKNESS_SCHEMA_VERSION;
  weaknessId: string;
  weaknessCode: HarnessWeaknessCode;
  remediationClass: HarnessWeaknessRemediationClass;
  targetRevisionId: string;
  targetRevisionHash: string;
  sourceReceiptId: string;
  sourceReceiptHash: string;
  sourceBindingHashes: string[];
  sourceBindingRootHash: string;
  sourceClasses: OperatingSignalSourceClass[];
  developmentSetRef: string;
  developmentSetHash: string;
  observedValue: number;
  thresholdOperator: "min" | "max";
  thresholdValue: number;
  policyRef: typeof HARNESS_WEAKNESS_POLICY.policyRef;
  policyHash: string;
  evidenceRefs: string[];
  detectedAt: string;
  contentHash: string;
};

export type HarnessWeaknessSignalContent = Omit<HarnessWeaknessSignal, "contentHash">;

export type HarnessProposedComponentChange = {
  componentKind: MutableHarnessComponentKind;
  fromRevisionRef: string;
  toRevisionRef: string;
  toContentHash: string;
  rationaleCode: HarnessChangeRationaleCode;
  evidenceRefs: string[];
};

export type HarnessWeaknessBinding = {
  weaknessId: string;
  weaknessHash: string;
};

export type HarnessDevelopmentSetBinding = {
  setRef: string;
  setHash: string;
};

export type HarnessImprovementProposal = {
  schemaVersion: typeof HARNESS_IMPROVEMENT_PROPOSAL_SCHEMA_VERSION;
  proposalId: string;
  parentRevisionId: string;
  parentRevisionHash: string;
  parentManifestHash: string;
  lastSafeFallbackRevisionId: string;
  lastSafeFallbackRevisionHash: string;
  rollbackManifestHash: string;
  weaknessBindings: HarnessWeaknessBinding[];
  developmentSets: HarnessDevelopmentSetBinding[];
  componentChanges: HarnessProposedComponentChange[];
  createdBy: "agent_proposal";
  requiredControlGates: ["shadow_gate", "rollback_gate", "owner_gate"];
  ownerReviewRequired: true;
  ownerApprovalRecorded: false;
  automaticAdoptionAllowed: false;
  promotionTriggered: false;
  productionAuthorityGranted: false;
  createdAt: string;
  contentHash: string;
};

export type HarnessImprovementProposalContent = Omit<
  HarnessImprovementProposal,
  "contentHash"
>;

export type HarnessEvolutionDecision =
  | "owner_review_candidate"
  | "inconclusive"
  | "rejected";

export type HarnessControlGateResult = Omit<ControlGateResult, "approverRefs"> & {
  gateType: "shadow_gate" | "rollback_gate" | "owner_gate";
  approverRefs: string[];
};

export type HarnessEvolutionReviewPacket = {
  schemaVersion: typeof HARNESS_EVOLUTION_REVIEW_PACKET_SCHEMA_VERSION;
  packetId: string;
  proposalId: string;
  proposalHash: string;
  weaknessBindings: HarnessWeaknessBinding[];
  candidateRevisionId: string;
  candidateRevisionHash: string;
  candidateManifestHash: string;
  lastSafeFallbackRevisionId: string;
  lastSafeFallbackRevisionHash: string;
  rollbackManifestHash: string;
  shadowReceiptId: string;
  shadowReceiptHash: string;
  shadowVerdict: HarnessShadowVerdict;
  developmentSets: HarnessDevelopmentSetBinding[];
  heldoutSetRef: string;
  heldoutSetHash: string;
  freshHeldoutConfirmed: boolean;
  decision: HarnessEvolutionDecision;
  hardGateFailures: string[];
  controlGateResults: HarnessControlGateResult[];
  ownerReviewRequired: true;
  ownerApprovalRecorded: false;
  automaticAdoptionAllowed: false;
  promotionTriggered: false;
  productionAuthorityGranted: false;
  createdAt: string;
  contentHash: string;
};

export type HarnessEvolutionReviewPacketContent = Omit<
  HarnessEvolutionReviewPacket,
  "contentHash"
>;

export function computeHarnessWeaknessContentHash(
  content: HarnessWeaknessSignalContent,
): string {
  return sha256(canonicalJson(content));
}

export function computeHarnessImprovementProposalContentHash(
  content: HarnessImprovementProposalContent,
): string {
  return sha256(canonicalJson(content));
}

export function computeHarnessEvolutionReviewPacketContentHash(
  content: HarnessEvolutionReviewPacketContent,
): string {
  return sha256(canonicalJson(content));
}
