import { sha256 } from "../expert-capability/hashing";
import type { OperatingSignalSourceEnvelope } from "../operating-signal-governance/source-governance";
import {
  HARNESS_COMPONENT_KINDS,
  HARNESS_MANIFEST_SCHEMA_VERSION,
  HARNESS_REVISION_SCHEMA_VERSION,
  computeHarnessManifestContentHash,
  computeHarnessRevisionContentHash,
  type HarnessComponentBinding,
  type HarnessManifest,
  type HarnessRevision,
} from "./harness-contracts";
import type { OperatingHarnessQualityMetricInput } from "./metrics";

const BASELINE_CREATED_AT = "2026-06-04T02:00:00.000Z";
const CANDIDATE_CREATED_AT = "2026-06-04T03:00:00.000Z";

function componentBinding(
  componentKind: (typeof HARNESS_COMPONENT_KINDS)[number],
  revisionRef = `${componentKind}:v1`,
): HarnessComponentBinding {
  return {
    componentKind,
    componentRef: `component:${componentKind}`,
    revisionRef,
    contentHash: sha256(`${componentKind}:${revisionRef}`),
  };
}

function manifest(
  components: HarnessComponentBinding[],
  createdAt: string,
): HarnessManifest {
  const content = {
    schemaVersion: HARNESS_MANIFEST_SCHEMA_VERSION,
    manifestId: "harness:operating-core",
    scope: "public_offline_shadow" as const,
    canonicalChainRef: "helm.operating-harness.canonical-chain.v1",
    components,
    allowedSourceClasses: [
      "synthetic_public",
      "self_dogfood_health",
      "deidentified_promoted_case",
    ] as HarnessManifest["allowedSourceClasses"],
    intendedUses: ["fixture_validation", "public_eval", "heldout_eval"] as HarnessManifest["intendedUses"],
    commitmentClass: "advice" as const,
    actionAuthority: "none" as const,
    humanReviewRequired: true as const,
    automaticPromotionAllowed: false as const,
    externalSendAllowed: false as const,
    writebackAllowed: false as const,
    memoryPromotionAllowed: false as const,
    createdAt,
  };
  return { ...content, contentHash: computeHarnessManifestContentHash(content) };
}

export function syntheticHarnessPair(): {
  baselineManifest: HarnessManifest;
  candidateManifest: HarnessManifest;
  baselineRevision: HarnessRevision;
  candidateRevision: HarnessRevision;
} {
  const baselineComponents = HARNESS_COMPONENT_KINDS.map((kind) => componentBinding(kind));
  const candidateComponents = baselineComponents.map((component) =>
    component.componentKind === "judgement_fusion"
      ? componentBinding("judgement_fusion", "judgement_fusion:v2")
      : { ...component },
  );
  const baselineManifest = manifest(baselineComponents, BASELINE_CREATED_AT);
  const candidateManifest = manifest(candidateComponents, CANDIDATE_CREATED_AT);

  const baselineContent = {
    schemaVersion: HARNESS_REVISION_SCHEMA_VERSION,
    revisionId: "oh-expert-v0",
    manifestId: baselineManifest.manifestId,
    manifestHash: baselineManifest.contentHash,
    parentRevisionId: null,
    parentManifestHash: null,
    status: "seed" as const,
    changes: [],
    derivedFromFeedbackIds: [],
    derivedFromWeaknessIds: [],
    createdBy: "human" as const,
    fallbackRevisionId: null,
    rollbackManifestHash: null,
    ownerReviewRequired: true as const,
    promotionTriggered: false as const,
    createdAt: BASELINE_CREATED_AT,
  };
  const baselineRevision: HarnessRevision = {
    ...baselineContent,
    contentHash: computeHarnessRevisionContentHash(baselineContent),
  };

  const candidateContent = {
    schemaVersion: HARNESS_REVISION_SCHEMA_VERSION,
    revisionId: "oh-expert-v1",
    manifestId: candidateManifest.manifestId,
    manifestHash: candidateManifest.contentHash,
    parentRevisionId: baselineRevision.revisionId,
    parentManifestHash: baselineManifest.contentHash,
    status: "shadow_candidate" as const,
    changes: [
      {
        componentKind: "judgement_fusion" as const,
        fromRevisionRef: "judgement_fusion:v1",
        toRevisionRef: "judgement_fusion:v2",
        rationaleCode: "feedback_correction" as const,
        evidenceRefs: ["feedback:a-case-001"],
      },
    ],
    derivedFromFeedbackIds: ["feedback:a-case-001"],
    derivedFromWeaknessIds: [],
    createdBy: "agent_proposal" as const,
    fallbackRevisionId: baselineRevision.revisionId,
    rollbackManifestHash: baselineManifest.contentHash,
    ownerReviewRequired: true as const,
    promotionTriggered: false as const,
    createdAt: CANDIDATE_CREATED_AT,
  };
  const candidateRevision: HarnessRevision = {
    ...candidateContent,
    contentHash: computeHarnessRevisionContentHash(candidateContent),
  };

  return { baselineManifest, candidateManifest, baselineRevision, candidateRevision };
}

const HIGH_RISK_FORBIDDEN = [
  "automatic_customer_action",
  "external_send",
  "writeback",
  "memory_promotion",
  "performance_evaluation",
] as const;

export function syntheticHarnessSource(): OperatingSignalSourceEnvelope {
  return {
    schemaVersion: "helm.operating-signal-source-governance.v1",
    signalId: "signal:harness-shadow-001",
    sourceClass: "synthetic_public",
    allowedUses: ["public_eval", "heldout_eval", "fixture_validation"],
    forbiddenUses: [...HIGH_RISK_FORBIDDEN],
    improvementLoopEligible: true,
    promotionState: "public_eligible",
    aliasMode: "synthetic_alias",
    personAttributionMode: "none",
    auditRefs: ["audit:harness-shadow-001"],
    boundaryNote: "Synthetic public shadow-evaluation source; no production authority.",
  };
}

export function syntheticFleetHarnessSource(): OperatingSignalSourceEnvelope {
  return {
    schemaVersion: "helm.operating-signal-source-governance.v1",
    signalId: "signal:fleet-shadow-blocked-001",
    sourceClass: "fleet_customer_health",
    allowedUses: ["operator_triage", "advice_only_risk_review", "support_readiness"],
    forbiddenUses: [...HIGH_RISK_FORBIDDEN, "public_eval", "heldout_eval", "training"],
    improvementLoopEligible: false,
    promotionState: "blocked",
    aliasMode: "reversible_operator_alias",
    personAttributionMode: "role_only",
    aliasSaltRef: "salt:fleet-shadow-001",
    aliasSaltRotatesAt: "2026-07-01T00:00:00.000Z",
    aliasAccessRoles: ["operator"],
    aliasDecodeAuditRequired: true,
    customerConsentScopeRef: "consent:fleet-shadow-001",
    auditRefs: ["audit:fleet-shadow-001"],
    boundaryNote: "Fleet health is operator triage only and cannot enter improvement.",
  };
}

export function syntheticBaselineQualityInput(): OperatingHarnessQualityMetricInput {
  return {
    expectedRelevantSignalCount: 10,
    matchedRelevantSignalCount: 8,
    acceptedSignalCount: 9,
    requiredEvidenceCount: 20,
    independentlySupportedEvidenceCount: 18,
    requiredReviewCount: 8,
    completedReviewCount: 8,
    boundaryOutcomes: ["none"],
    candidateHeldoutScore: 0.575,
    baselineHeldoutScore: 0.515,
    eligibleEditRejectFeedbackCount: 10,
    promotedEvalCaseCount: 2,
  };
}

export function syntheticImprovedQualityInput(): OperatingHarnessQualityMetricInput {
  return {
    expectedRelevantSignalCount: 10,
    matchedRelevantSignalCount: 10,
    acceptedSignalCount: 10,
    requiredEvidenceCount: 20,
    independentlySupportedEvidenceCount: 20,
    requiredReviewCount: 10,
    completedReviewCount: 10,
    boundaryOutcomes: ["none", "blocked_attempt"],
    candidateHeldoutScore: 1,
    baselineHeldoutScore: 0.575,
    eligibleEditRejectFeedbackCount: 10,
    promotedEvalCaseCount: 4,
  };
}
