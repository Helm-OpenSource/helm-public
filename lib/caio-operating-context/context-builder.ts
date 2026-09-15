import { sha256 } from "@/lib/expert-capability/hashing";
import {
  TEMPORAL_OPERATING_CONTEXT_INPUT_SCHEMA_VERSION,
  type TemporalOperatingContextProjectionInput,
} from "@/lib/operating-harness/context-contracts";
import {
  BUSINESS_OBJECT_ALIAS_SCHEMA_VERSION,
  computeBusinessObjectAliasContentHash,
  computeEvidenceBindingRootHash,
  computeEvidenceRefContentHash,
  computeSignalEventContentHash,
  EVIDENCE_REF_SCHEMA_VERSION,
  SIGNAL_EVENT_SCHEMA_VERSION,
  type BusinessObjectAlias,
  type EvidenceRef,
  type SignalEvent,
} from "@/lib/operating-harness/contracts";
import {
  computeTenantObservationReceiptContentHash,
  TENANT_OBSERVATION_RECEIPT_SCHEMA_VERSION,
  type TenantObservationReceipt,
} from "@/lib/operating-harness/tenant-live-contracts";
import { buildTenantSelfObservationEnvelope } from "@/lib/operating-signal-governance/source-governance";

import { getCaioQuickCheckHarness } from "./context-harness";

/**
 * Deterministic mapping from one quick-check tick to a tenant live shadow projection input
 * (Core spec section 5.1):
 * - each known metric observation cited by a kept hit becomes an EvidenceRef whose sourceSnapshotHash
 *   is the observation content hash (template, window and values); contentHash is the record's own hash;
 * - each distinct objectKey becomes a BusinessObjectAlias (deterministic key, no person attribution);
 * - each hit becomes a SignalEvent bound by a tenant self-observation envelope and the receipts of the
 *   observation runs that produced its evidence.
 * Generated refs encode digests as letters so they cannot resemble contact numbers, and no raw
 * workspace, run, catalog or receipt id is carried.
 */

const MAX_SIGNALS = 1_000;
const MAX_EVIDENCE = 1_000;
const MAX_OBJECTS = 100;
const SAFE_TOKEN_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/iu;
const SAFE_REF_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,255}$/iu;
const BOUNDARY_NOTE = "Deterministic quick-check detector hit; advice only, no action authority.";
const EVIDENCE_TTL_MS = 24 * 3_600_000;

export function lettersFromDigest(digest: string, length = 24): string {
  return digest.replace(/^sha256:/u, "").slice(0, length).replace(/[0-9a-f]/gu, (c) => "abcdefghijklmnop"[Number.parseInt(c, 16)]);
}

const letters = (value: string, length?: number) => lettersFromDigest(sha256(value), length);

export type CaioContextObservationRow = Readonly<{
  templateId: string; sourceKey: string; observationRunId: string;
  windowStart: Date; windowEnd: Date; observedAt: Date; contentHash: string;
}>;
export type CaioContextHitRow = Readonly<{
  detectorId: string; mergeKey: string; objectKey: string; evidenceTemplateIds: readonly string[];
}>;
export type CaioContextRunRow = Readonly<{
  id: string; status: string; windowStart: Date; windowEnd: Date; observedAt: Date; summaryHash: string;
  catalogEntryId: string; authorizationReceiptId: string; connectionReceiptId: string;
}>;

export type CaioContextBuildResult =
  | { ok: true; input: TemporalOperatingContextProjectionInput }
  | { ok: false; reason: "no_signals" | "context_limit_exceeded" | "evidence_run_missing" | "token_unmappable" };

export function buildCaioTenantContextProjectionInput(input: {
  workspaceId: string;
  tickBucketStart: Date;
  windowStart: Date;
  asOf: Date;
  observations: readonly CaioContextObservationRow[];
  hits: readonly CaioContextHitRow[];
  runs: readonly CaioContextRunRow[];
}): CaioContextBuildResult {
  const workspaceToken = letters(input.workspaceId);
  const tenantScopeRef = `tenant-scope:${workspaceToken}`;
  const asOf = input.asOf.toISOString();
  const observationsByTemplate = new Map(input.observations.map((row) => [row.templateId, row]));
  const runsById = new Map(input.runs.map((row) => [row.id, row]));

  // Only hits whose every cited reading is known this tick become signals.
  const keptHits = [...input.hits]
    .filter((hit) => hit.evidenceTemplateIds.length > 0 && hit.evidenceTemplateIds.every((id) => observationsByTemplate.has(id)))
    .sort((a, b) => `${a.detectorId}|${a.mergeKey}`.localeCompare(`${b.detectorId}|${b.mergeKey}`));
  if (keptHits.length === 0) return { ok: false, reason: "no_signals" };

  const objectKeys = [...new Set(keptHits.map((hit) => hit.objectKey))].sort();
  const templateIds = [...new Set(keptHits.flatMap((hit) => hit.evidenceTemplateIds))].sort();
  if (keptHits.length > MAX_SIGNALS || objectKeys.length > MAX_OBJECTS || templateIds.length > MAX_EVIDENCE) {
    return { ok: false, reason: "context_limit_exceeded" };
  }
  for (const templateId of templateIds) {
    if (!runsById.has(observationsByTemplate.get(templateId)!.observationRunId)) return { ok: false, reason: "evidence_run_missing" };
  }

  const evidenceByTemplate = new Map<string, EvidenceRef>();
  for (const templateId of templateIds) {
    const row = observationsByTemplate.get(templateId)!;
    const content = {
      schemaVersion: EVIDENCE_REF_SCHEMA_VERSION,
      evidenceRef: `caio-evidence:${lettersFromDigest(row.contentHash)}`,
      tenantScopeRef,
      sourceType: "caio_metric_observation",
      sourceSnapshotHash: row.contentHash,
      capturedAt: row.observedAt.toISOString(),
      expiresAt: new Date(row.observedAt.getTime() + EVIDENCE_TTL_MS).toISOString(),
      sensitivity: "confidential" as const,
      redactionStatus: "alias_only" as const,
      consentScopeRef: null,
      contentIncluded: false as const,
    };
    evidenceByTemplate.set(templateId, { ...content, contentHash: computeEvidenceRefContentHash(content) });
  }

  const aliasByObjectKey = new Map<string, BusinessObjectAlias>();
  for (const objectKey of objectKeys) {
    if (!SAFE_REF_PATTERN.test(objectKey)) return { ok: false, reason: "token_unmappable" };
    const prefix = objectKey.split(":")[0] ?? "";
    const content = {
      schemaVersion: BUSINESS_OBJECT_ALIAS_SCHEMA_VERSION,
      aliasRef: `caio-object:${letters(objectKey)}`,
      tenantScopeRef,
      objectKind: SAFE_TOKEN_PATTERN.test(prefix) && prefix !== objectKey ? prefix : "operating_object",
      sourceObjectAliasRefs: [objectKey],
      resolutionMethod: "deterministic_key" as const,
      crossTenantProjection: false as const,
      personAttributionMode: "none" as const,
      createdAt: asOf,
    };
    aliasByObjectKey.set(objectKey, { ...content, contentHash: computeBusinessObjectAliasContentHash(content) });
  }

  const bucketIso = input.tickBucketStart.toISOString();
  const sourceRef = `caio-quick-check:${letters(bucketIso)}`;
  const signalEvents: SignalEvent[] = [];
  const sourceBindings: TemporalOperatingContextProjectionInput["sourceBindings"] = [];
  for (const hit of keptHits) {
    const signalFamily = `caio.${hit.detectorId.replace(/[^a-z0-9._-]/giu, "_")}`;
    const signalKey = `${hit.detectorId}:${hit.mergeKey}`;
    if (!SAFE_TOKEN_PATTERN.test(signalFamily) || !SAFE_REF_PATTERN.test(signalKey)) return { ok: false, reason: "token_unmappable" };
    const evidence = [...new Set(hit.evidenceTemplateIds)].sort().map((id) => evidenceByTemplate.get(id)!);
    const signalId = `caio-signal:${letters(`${bucketIso}|${hit.detectorId}|${hit.mergeKey}`)}`;
    const content = {
      schemaVersion: SIGNAL_EVENT_SCHEMA_VERSION,
      signalId,
      signalKey,
      tenantScopeRef,
      sourceEnvelopeRef: signalId,
      sourceRef,
      signalFamily,
      observedAt: asOf,
      capturedAt: asOf,
      evidenceRefs: evidence.map((item) => item.evidenceRef),
      evidenceRootHash: computeEvidenceBindingRootHash(evidence),
      businessObjectAliasRef: aliasByObjectKey.get(hit.objectKey)!.aliasRef,
      redactionStatus: "alias_only" as const,
      boundaryNote: BOUNDARY_NOTE,
    };
    signalEvents.push({ ...content, contentHash: computeSignalEventContentHash(content) });

    const evidenceByRun = new Map<string, string[]>();
    for (const templateId of [...new Set(hit.evidenceTemplateIds)].sort()) {
      const runId = observationsByTemplate.get(templateId)!.observationRunId;
      evidenceByRun.set(runId, [...(evidenceByRun.get(runId) ?? []), evidenceByTemplate.get(templateId)!.evidenceRef]);
    }
    const observationReceipts: TenantObservationReceipt[] = [...evidenceByRun.entries()]
      .map(([runId, evidenceRefs]) => {
        const run = runsById.get(runId)!;
        const receipt = {
          schemaVersion: TENANT_OBSERVATION_RECEIPT_SCHEMA_VERSION,
          observationRunRef: `observation-run:${letters(run.id)}`,
          runStatus: run.status === "PARTIAL" ? ("PARTIAL" as const) : ("SUCCEEDED" as const),
          windowStart: run.windowStart.toISOString(),
          windowEnd: run.windowEnd.toISOString(),
          observedAt: run.observedAt.toISOString(),
          summaryHash: run.summaryHash,
          catalogEntryRef: `catalog-entry:${letters(run.catalogEntryId)}`,
          authorizationReceiptRef: `stage-receipt:${letters(run.authorizationReceiptId)}`,
          connectionReceiptRef: `stage-receipt:${letters(run.connectionReceiptId)}`,
          evidenceRefs: evidenceRefs.sort(),
        };
        return { ...receipt, contentHash: computeTenantObservationReceiptContentHash(receipt) };
      })
      .sort((a, b) => a.observationRunRef.localeCompare(b.observationRunRef));
    sourceBindings.push({
      source: buildTenantSelfObservationEnvelope({ signalId, allowedUses: ["operator_triage"], auditRefs: [sourceRef], boundaryNote: BOUNDARY_NOTE }),
      promotion: null,
      observationReceipts,
    });
  }

  const { manifest, revision } = getCaioQuickCheckHarness();
  return {
    ok: true,
    input: {
      schemaVersion: TEMPORAL_OPERATING_CONTEXT_INPUT_SCHEMA_VERSION,
      workspaceAlias: `workspace-alias:${workspaceToken}`,
      tenantScopeRef,
      windowStart: input.windowStart.toISOString(),
      windowEnd: asOf,
      asOf,
      manifest,
      revision,
      signalEvents,
      evidenceRefs: templateIds.map((id) => evidenceByTemplate.get(id)!),
      businessObjectAliases: objectKeys.map((key) => aliasByObjectKey.get(key)!),
      judgementPackets: [],
      sourceBindings,
    },
  };
}
