import type { FeedbackRecord } from "../expert-capability/contracts";
import { sha256 } from "../expert-capability/hashing";
import type { EvalCasePromotion } from "../expert-capability/validators";
import {
  BUSINESS_OBJECT_ALIAS_SCHEMA_VERSION,
  EVIDENCE_REF_SCHEMA_VERSION,
  JUDGEMENT_PACKET_SCHEMA_VERSION,
  SIGNAL_EVENT_SCHEMA_VERSION,
  computeBusinessObjectAliasContentHash,
  computeJudgementPacketContentHash,
  computeSignalEventContentHash,
  type BusinessObjectAlias,
  type EvidenceRef,
  type JudgementPacket,
  type SignalEvent,
} from "./contracts";

export const OPERATING_HARNESS_SYNTHETIC_NOW = "2026-07-12T00:00:00.000Z";

export function syntheticEvidenceRef(overrides: Partial<EvidenceRef> = {}): EvidenceRef {
  return {
    schemaVersion: EVIDENCE_REF_SCHEMA_VERSION,
    evidenceRef: "evidence:crm-row-17",
    tenantScopeRef: "tenant:synthetic-1",
    sourceType: "synthetic_fixture",
    sourceSnapshotHash: sha256("synthetic crm row 17"),
    capturedAt: OPERATING_HARNESS_SYNTHETIC_NOW,
    expiresAt: null,
    sensitivity: "public",
    redactionStatus: "synthetic",
    consentScopeRef: null,
    contentIncluded: false,
    ...overrides,
  };
}

export function syntheticBusinessObjectAlias(
  overrides: Partial<Omit<BusinessObjectAlias, "contentHash">> = {},
): BusinessObjectAlias {
  const content = {
    schemaVersion: BUSINESS_OBJECT_ALIAS_SCHEMA_VERSION,
    aliasRef: "object:deal-alias-17",
    tenantScopeRef: "tenant:synthetic-1",
    objectKind: "deal",
    sourceObjectAliasRefs: ["source-object:crm-deal-17"],
    resolutionMethod: "synthetic_fixture" as const,
    crossTenantProjection: false as const,
    personAttributionMode: "none" as const,
    createdAt: OPERATING_HARNESS_SYNTHETIC_NOW,
    ...overrides,
  };
  return { ...content, contentHash: computeBusinessObjectAliasContentHash(content) };
}

export function syntheticSignalEvent(
  overrides: Partial<Omit<SignalEvent, "contentHash">> = {},
): SignalEvent {
  const content = {
    schemaVersion: SIGNAL_EVENT_SCHEMA_VERSION,
    signalId: "signal:event-17",
    signalKey: "risk:deal-alias-17",
    tenantScopeRef: "tenant:synthetic-1",
    sourceEnvelopeRef: "source-envelope:synthetic-17",
    sourceRef: "source:fixture-17",
    signalFamily: "risk",
    observedAt: OPERATING_HARNESS_SYNTHETIC_NOW,
    capturedAt: OPERATING_HARNESS_SYNTHETIC_NOW,
    evidenceRefs: ["evidence:crm-row-17"],
    businessObjectAliasRef: "object:deal-alias-17",
    redactionStatus: "synthetic" as const,
    boundaryNote: "Synthetic, advice-only operating signal input.",
    ...overrides,
  };
  return { ...content, contentHash: computeSignalEventContentHash(content) };
}

export function syntheticJudgementPacket(
  overrides: Partial<Omit<JudgementPacket, "contentHash">> = {},
): JudgementPacket {
  const content = {
    schemaVersion: JUDGEMENT_PACKET_SCHEMA_VERSION,
    packetId: "packet:deal-alias-17",
    inputSnapshotRef: sha256("synthetic input snapshot 17"),
    expertRevisionId: "org-health-expert-v1",
    signalEventRefs: ["signal:event-17"],
    businessObjectAliasRef: "object:deal-alias-17",
    disposition: "prepare_review_packet",
    evidenceRefs: ["evidence:crm-row-17"],
    commitmentClass: "advice" as const,
    boundaryNote: "Advice only; human review required; no write, send, execute, or promotion.",
    humanReviewerRequired: true as const,
    forbiddenActionRefs: [],
    confidence: {
      band: "medium" as const,
      score: 0.65,
      method: "deterministic" as const,
      calibrationRef: "calibration:synthetic-v1",
    },
    createdAt: OPERATING_HARNESS_SYNTHETIC_NOW,
    ...overrides,
  };
  return { ...content, contentHash: computeJudgementPacketContentHash(content) };
}

export function syntheticFeedbackRecord(
  overrides: Partial<FeedbackRecord> = {},
): FeedbackRecord {
  return {
    feedbackId: "feedback:17",
    caseId: "signal:event-17",
    targetPacketHash: syntheticJudgementPacket().contentHash,
    correctionType: "edit",
    correctionReasonCode: "evidence_missing",
    correctionNote: "Add the independently required CRM row evidence alias.",
    authorId: "reviewer:synthetic-1",
    createdAt: OPERATING_HARNESS_SYNTHETIC_NOW,
    ...overrides,
  };
}

export function syntheticEvalCasePromotion(
  overrides: Partial<EvalCasePromotion> = {},
): EvalCasePromotion {
  return {
    promotionId: "promotion:17",
    sourceCaseId: "signal:event-17",
    sourceSensitivityClass: "operational",
    scannerResult: { hits: 0 },
    humanSignOffBy: "reviewer:synthetic-2",
    humanSignOffAt: OPERATING_HARNESS_SYNTHETIC_NOW,
    publicEligible: true,
    walledFromPerformanceEval: true,
    quarantineReason: null,
    ...overrides,
  };
}
