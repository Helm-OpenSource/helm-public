import type { EvalCasePromotion } from "../expert-capability/validators";
import { canonicalJson, sha256 } from "../expert-capability/hashing";
import type { OperatingSignalSourceEnvelope } from "../operating-signal-governance/source-governance";
import type {
  BusinessObjectAlias,
  EvidenceRef,
  JudgementPacket,
  SignalEvent,
} from "./contracts";
import type {
  HarnessComponentBinding,
  HarnessManifest,
  HarnessRevision,
} from "./harness-contracts";

export const TEMPORAL_OPERATING_CONTEXT_INPUT_SCHEMA_VERSION =
  "helm.operating-harness.context-input.v1" as const;
export const TEMPORAL_OPERATING_CONTEXT_SNAPSHOT_SCHEMA_VERSION =
  "helm.operating-harness.context-snapshot.v1" as const;
export const OPERATING_RELATION_EDGE_SCHEMA_VERSION =
  "helm.operating-harness.relation-edge.v1" as const;

export const OPERATING_CONTEXT_PROJECTOR_REVISION =
  "operating-context-projector:v1" as const;
export const OPERATING_CONTEXT_STALENESS_DAYS = 30 as const;

export const OPERATING_RELATION_KINDS = [
  "shared_evidence",
  "shared_source_object",
  "source_temporal_sequence",
] as const;
export type OperatingRelationKind = (typeof OPERATING_RELATION_KINDS)[number];

export const OPERATING_CONTEXT_JUDGEMENT_STATES = [
  "unreviewed",
  "single_disposition",
  "conflicting_dispositions",
] as const;
export type OperatingContextJudgementState =
  (typeof OPERATING_CONTEXT_JUDGEMENT_STATES)[number];

export type TemporalOperatingContextSourceBinding = {
  source: OperatingSignalSourceEnvelope;
  promotion: EvalCasePromotion | null;
};

export type TemporalOperatingContextProjectionInput = {
  schemaVersion: typeof TEMPORAL_OPERATING_CONTEXT_INPUT_SCHEMA_VERSION;
  workspaceAlias: string;
  tenantScopeRef: string;
  windowStart: string;
  windowEnd: string;
  asOf: string;
  manifest: HarnessManifest;
  revision: HarnessRevision;
  signalEvents: SignalEvent[];
  evidenceRefs: EvidenceRef[];
  businessObjectAliases: BusinessObjectAlias[];
  judgementPackets: JudgementPacket[];
  sourceBindings: TemporalOperatingContextSourceBinding[];
};

export type OperatingContextRecordBinding = {
  ref: string;
  contentHash: string;
};

export type OperatingContextSourceReceipt = {
  signalId: string;
  sourceClass: OperatingSignalSourceEnvelope["sourceClass"];
  sourceBindingHash: string;
  promotionId: string | null;
};

export type OperatingContextPolicyBindings = {
  contextPolicy: HarnessComponentBinding;
  sourceGovernancePolicy: HarnessComponentBinding;
  permissionPolicy: HarnessComponentBinding;
};

export type OperatingContextObjectSummary = {
  businessObjectAliasRef: string;
  objectKind: string;
  signalEventRefs: string[];
  evidenceRefs: string[];
  judgementPacketRefs: string[];
  signalFamilies: string[];
  dispositions: string[];
  firstObservedAt: string;
  latestObservedAt: string;
  staleness: "current" | "stale";
  expiredEvidenceCount: number;
  judgementState: OperatingContextJudgementState;
};

export type OperatingRelationEdge = {
  schemaVersion: typeof OPERATING_RELATION_EDGE_SCHEMA_VERSION;
  relationId: string;
  relationKind: OperatingRelationKind;
  fromBusinessObjectAliasRef: string;
  toBusinessObjectAliasRef: string;
  supportingSignalEventRefs: string[];
  supportingEvidenceRefs: string[];
  contradictingEvidenceRefs: string[];
  validFrom: string;
  validTo: string;
  provenance: {
    method: "deterministic_rule";
    ruleRef: string;
    confidenceScore: null;
    calibrationRef: null;
  };
  contentHash: string;
};

export type OperatingRelationEdgeContent = Omit<
  OperatingRelationEdge,
  "relationId" | "contentHash"
>;

export type TemporalOperatingContextSnapshot = {
  schemaVersion: typeof TEMPORAL_OPERATING_CONTEXT_SNAPSHOT_SCHEMA_VERSION;
  snapshotId: string;
  workspaceAlias: string;
  tenantScopeRef: string;
  windowStart: string;
  windowEnd: string;
  asOf: string;
  projector: {
    revisionRef: typeof OPERATING_CONTEXT_PROJECTOR_REVISION;
    stalenessDays: typeof OPERATING_CONTEXT_STALENESS_DAYS;
  };
  harnessBinding: {
    manifestId: string;
    manifestHash: string;
    revisionId: string;
    revisionHash: string;
  };
  policyBindings: OperatingContextPolicyBindings;
  canonicalBindings: {
    signalEvents: OperatingContextRecordBinding[];
    evidenceRefs: OperatingContextRecordBinding[];
    businessObjectAliases: OperatingContextRecordBinding[];
    judgementPackets: OperatingContextRecordBinding[];
  };
  sourceReceipts: OperatingContextSourceReceipt[];
  objectSummaries: OperatingContextObjectSummary[];
  relations: OperatingRelationEdge[];
  derivedOnly: true;
  canonicalStateAuthority: false;
  writebackAllowed: false;
  actionAuthority: "none";
  modelCallsUsed: false;
  replayRootHash: string;
  contentHash: string;
};

export type TemporalOperatingContextSnapshotContent = Omit<
  TemporalOperatingContextSnapshot,
  "contentHash"
>;

export function computeOperatingContextSourceBindingHash(
  binding: TemporalOperatingContextSourceBinding,
): string {
  return sha256(canonicalJson(binding));
}

export function computeOperatingRelationEdgeContentHash(
  content: OperatingRelationEdgeContent,
): string {
  return sha256(canonicalJson(content));
}

export function operatingRelationIdFromContentHash(
  contentHash: string,
): string {
  return `relation:${contentHash.replace(/^sha256:/, "")}`;
}

export function contextSnapshotIdFromReplayRootHash(
  replayRootHash: string,
): string {
  return `context:${replayRootHash.replace(/^sha256:/, "")}`;
}

export function computeTemporalOperatingContextSnapshotContentHash(
  content: TemporalOperatingContextSnapshotContent,
): string {
  return sha256(canonicalJson(content));
}
