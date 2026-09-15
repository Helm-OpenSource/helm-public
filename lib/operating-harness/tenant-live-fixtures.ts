import { canonicalJson, sha256 } from "../expert-capability/hashing";
import { buildTenantSelfObservationEnvelope } from "../operating-signal-governance/source-governance";
import {
  computeBusinessObjectAliasContentHash,
  computeEvidenceBindingRootHash,
  computeEvidenceRefContentHash,
  computeSignalEventContentHash,
  BUSINESS_OBJECT_ALIAS_SCHEMA_VERSION,
  EVIDENCE_REF_SCHEMA_VERSION,
  SIGNAL_EVENT_SCHEMA_VERSION,
  type BusinessObjectAlias,
  type EvidenceRef,
  type SignalEvent,
} from "./contracts";
import {
  TEMPORAL_OPERATING_CONTEXT_INPUT_SCHEMA_VERSION,
  type TemporalOperatingContextProjectionInput,
} from "./context-contracts";
import {
  computeHarnessManifestContentHash,
  computeHarnessRevisionContentHash,
  HARNESS_COMPONENT_KINDS,
  HARNESS_MANIFEST_SCHEMA_VERSION,
  HARNESS_REVISION_SCHEMA_VERSION,
  type HarnessRevision,
} from "./harness-contracts";
import {
  computeTenantObservationReceiptContentHash,
  TENANT_LIVE_HARNESS_SCOPE,
  TENANT_OBSERVATION_RECEIPT_SCHEMA_VERSION,
  type TenantLiveHarnessManifest,
  type TenantObservationReceipt,
} from "./tenant-live-contracts";

/** Synthetic, customer-neutral tenant live shadow input: one evidence ref, one object, one signal. */

const TENANT = "tenant-scope:synthetic-tenant";
const AS_OF = "2026-09-16T02:00:30.000Z";

export function syntheticTenantLiveHarness(): { manifest: TenantLiveHarnessManifest; revision: HarnessRevision } {
  const manifestContent = {
    schemaVersion: HARNESS_MANIFEST_SCHEMA_VERSION,
    manifestId: "manifest:synthetic-tenant-live",
    scope: TENANT_LIVE_HARNESS_SCOPE,
    canonicalChainRef: "chain:operating-harness",
    components: HARNESS_COMPONENT_KINDS.map((kind) => ({
      componentKind: kind,
      componentRef: `synthetic-tenant/${kind}`,
      revisionRef: `synthetic-tenant/${kind}/v1`,
      contentHash: sha256(canonicalJson({ kind, version: 1 })),
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
    createdAt: "2026-09-16T00:00:00.000Z",
  };
  const manifest = { ...manifestContent, contentHash: computeHarnessManifestContentHash(manifestContent as never) };
  const revisionContent = {
    schemaVersion: HARNESS_REVISION_SCHEMA_VERSION,
    revisionId: "revision:synthetic-tenant-live-seed",
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
    createdAt: "2026-09-16T00:00:00.000Z",
  };
  return { manifest, revision: { ...revisionContent, contentHash: computeHarnessRevisionContentHash(revisionContent) } };
}

export function syntheticTenantObservationReceipt(evidenceRefs: string[]): TenantObservationReceipt {
  const content = {
    schemaVersion: TENANT_OBSERVATION_RECEIPT_SCHEMA_VERSION,
    observationRunRef: "observation-run:synthetic-run",
    runStatus: "SUCCEEDED" as const,
    windowStart: "2026-09-16T01:50:00.000Z",
    windowEnd: "2026-09-16T02:00:00.000Z",
    observedAt: AS_OF,
    summaryHash: sha256("synthetic-summary"),
    catalogEntryRef: "catalog-entry:synthetic-asset",
    authorizationReceiptRef: "stage-receipt:synthetic-authorization",
    connectionReceiptRef: "stage-receipt:synthetic-connection",
    evidenceRefs,
  };
  return { ...content, contentHash: computeTenantObservationReceiptContentHash(content) };
}

export function syntheticTenantLiveContextInput(): TemporalOperatingContextProjectionInput {
  const { manifest, revision } = syntheticTenantLiveHarness();
  const evidenceContent = {
    schemaVersion: EVIDENCE_REF_SCHEMA_VERSION,
    evidenceRef: "caio-evidence:synthetic-dead-letters",
    tenantScopeRef: TENANT,
    sourceType: "caio_metric_observation",
    sourceSnapshotHash: sha256("synthetic-metric-body"),
    capturedAt: AS_OF,
    expiresAt: "2026-09-17T02:00:30.000Z",
    sensitivity: "confidential" as const,
    redactionStatus: "alias_only" as const,
    consentScopeRef: null,
    contentIncluded: false as const,
  };
  const evidence: EvidenceRef = { ...evidenceContent, contentHash: computeEvidenceRefContentHash(evidenceContent) };
  const aliasContent = {
    schemaVersion: BUSINESS_OBJECT_ALIAS_SCHEMA_VERSION,
    aliasRef: "caio-object:synthetic-closure-job",
    tenantScopeRef: TENANT,
    objectKind: "job",
    sourceObjectAliasRefs: ["job:closure"],
    resolutionMethod: "deterministic_key" as const,
    crossTenantProjection: false as const,
    personAttributionMode: "none" as const,
    createdAt: AS_OF,
  };
  const alias: BusinessObjectAlias = { ...aliasContent, contentHash: computeBusinessObjectAliasContentHash(aliasContent) };
  const signalContent = {
    schemaVersion: SIGNAL_EVENT_SCHEMA_VERSION,
    signalId: "caio-signal:synthetic-dead-letter-surge",
    signalKey: "dead-letter-surge:closure",
    tenantScopeRef: TENANT,
    sourceEnvelopeRef: "caio-signal:synthetic-dead-letter-surge",
    sourceRef: "caio-quick-check:synthetic-bucket",
    signalFamily: "caio.dead-letter-surge",
    observedAt: AS_OF,
    capturedAt: AS_OF,
    evidenceRefs: [evidence.evidenceRef],
    evidenceRootHash: computeEvidenceBindingRootHash([evidence]),
    businessObjectAliasRef: alias.aliasRef,
    redactionStatus: "alias_only" as const,
    boundaryNote: "Deterministic quick-check detector hit; advice only, no action authority.",
  };
  const signal: SignalEvent = { ...signalContent, contentHash: computeSignalEventContentHash(signalContent) };
  return {
    schemaVersion: TEMPORAL_OPERATING_CONTEXT_INPUT_SCHEMA_VERSION,
    workspaceAlias: "workspace-alias:synthetic-tenant",
    tenantScopeRef: TENANT,
    windowStart: "2026-09-16T01:50:00.000Z",
    windowEnd: AS_OF,
    asOf: AS_OF,
    manifest,
    revision,
    signalEvents: [signal],
    evidenceRefs: [evidence],
    businessObjectAliases: [alias],
    judgementPackets: [],
    sourceBindings: [{
      source: buildTenantSelfObservationEnvelope({
        signalId: signal.signalId, allowedUses: ["operator_triage"], auditRefs: [signal.sourceRef], boundaryNote: signal.boundaryNote,
      }),
      promotion: null,
      observationReceipts: [syntheticTenantObservationReceipt([evidence.evidenceRef])],
    }],
  } as TemporalOperatingContextProjectionInput;
}
