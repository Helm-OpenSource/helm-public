import { describe, expect, it } from "vitest";

import { canonicalJson, sha256 } from "../expert-capability/hashing";
import { syntheticTemporalOperatingContextInput } from "../operating-harness/context-fixtures";
import { projectTemporalOperatingContext } from "../operating-harness/context-projector";
import {
  CAIO_EVIDENCE_TRACE_SCHEMA_VERSION,
  CAIO_INITIALIZATION_ARTIFACT_TYPES,
  CAIO_MEMORY_REBUILD_RECEIPT_SCHEMA_VERSION,
  CAIO_SCHEMA_MAPPING_SCHEMA_VERSION,
  CAIO_TEMPORAL_CONTEXT_ARTIFACT_SCHEMA_VERSION,
  computeCaioEvidenceTraceHash,
  computeCaioMemoryRootHash,
} from "./caio-initialization-artifacts";
import {
  projectCaioInitializationAssessmentInput,
  type CaioInitializationProjectionArtifact,
  type CaioInitializationProjectionSnapshot,
} from "./caio-initialization-assessment-projector";
import { computeCaioInitializationAssessment } from "./caio-initialization-gate";

function withContentHash<T extends Record<string, unknown>>(
  content: T,
): T & { contentHash: string } {
  return {
    ...content,
    contentHash: sha256(canonicalJson(content)),
  };
}

function readySnapshot(): CaioInitializationProjectionSnapshot {
  const fact = {
    id: "memory-1",
    objectType: "COMPANY",
    objectId: "company-1",
    factType: "BUSINESS_FACT",
    title: "Synthetic pipeline fact",
    content: "Synthetic content",
    normalizedValue: null,
    sourceType: "SYSTEM",
    sourceId: "source-1",
    confidence: 90,
    importance: 90,
    freshnessScore: 100,
    status: "ACTIVE",
    confirmedByUser: true,
    createdBySystem: true,
    createdAt: "2026-07-23T01:00:00.000Z",
    updatedAt: "2026-07-23T01:00:00.000Z",
  };
  const memoryBinding = {
    ref: "memory-fact:memory-1",
    contentHash: sha256(canonicalJson(fact)),
  };
  const schemaMappingContent = {
    schemaVersion: CAIO_SCHEMA_MAPPING_SCHEMA_VERSION,
    artifactRef: "artifact-bundle:schema-1",
    assetRef: "asset-1",
    sourceSchemaHash: `sha256:${"1".repeat(64)}`,
    targetSchemaHash: `sha256:${"2".repeat(64)}`,
    mappingHash: `sha256:${"3".repeat(64)}`,
    generatedAt: "2026-07-23T02:00:00.000Z",
  };
  const memoryReceiptContent = {
    schemaVersion: CAIO_MEMORY_REBUILD_RECEIPT_SCHEMA_VERSION,
    artifactRef: "artifact-bundle:memory-rebuild-1",
    receiptRef: "receipt:memory-rebuild:1",
    workspaceRef: "workspace:workspace-1",
    memoryFactBindings: [memoryBinding],
    memoryRootHash: computeCaioMemoryRootHash([memoryBinding]),
    rebuiltAt: "2026-07-23T03:00:00.000Z",
  };
  const contextInput = syntheticTemporalOperatingContextInput();
  const contextProjection = projectTemporalOperatingContext(contextInput);
  if (!contextProjection.snapshot) {
    throw new Error("synthetic temporal context projection must succeed");
  }
  const contextContent = {
    schemaVersion: CAIO_TEMPORAL_CONTEXT_ARTIFACT_SCHEMA_VERSION,
    artifactRef: "artifact-bundle:context-1",
    workspaceRef: "workspace:workspace-1",
    projectionInput: contextInput,
    snapshot: contextProjection.snapshot,
    projectionInputHash: sha256(canonicalJson(contextInput)),
    snapshotHash: contextProjection.snapshot.contentHash,
    replayRootHash: contextProjection.snapshot.replayRootHash,
  };
  const traceContent = {
    schemaVersion: CAIO_EVIDENCE_TRACE_SCHEMA_VERSION,
    evidenceRef: "evidence:owner-answer:1",
    sourceRef: "source-1",
    assetRef: "asset-1",
    observationRunRef: "run-1",
    authorizationReceiptRef: "authorization-1",
    connectionReceiptRef: "connection-1",
    initializationReceiptRef: "initialization-1",
    sensitivity: "confidential" as const,
    outputType: "owner_answer" as const,
    capturedAt: "2026-07-23T04:00:00.000Z",
    resolved: true,
  };
  const artifacts: CaioInitializationProjectionArtifact[] = [
    {
      id: "schema-1",
      artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.schemaMapping,
      status: "CONFIRMED",
      artifactsJson: JSON.stringify(withContentHash(schemaMappingContent)),
      createdAt: "2026-07-23T02:00:00.000Z",
    },
    {
      id: "memory-rebuild-1",
      artifactType:
        CAIO_INITIALIZATION_ARTIFACT_TYPES.memoryRebuildReceipt,
      status: "CONFIRMED",
      artifactsJson: JSON.stringify(withContentHash(memoryReceiptContent)),
      createdAt: "2026-07-23T03:00:00.000Z",
    },
    {
      id: "context-1",
      artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.temporalContext,
      status: "CONFIRMED",
      artifactsJson: JSON.stringify(withContentHash(contextContent)),
      createdAt: "2026-07-23T03:00:00.000Z",
    },
    {
      id: "trace-1",
      artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.evidenceTrace,
      status: "CONFIRMED",
      artifactsJson: JSON.stringify({
        ...traceContent,
        traceHash: computeCaioEvidenceTraceHash(traceContent),
      }),
      createdAt: "2026-07-23T04:00:00.000Z",
    },
  ];

  return {
    workspaceId: "workspace-1",
    mandateRecordId: "mandate-1",
    evaluatedAt: "2026-07-23T05:00:00.000Z",
    assets: [
      {
        id: "asset-1",
        inventoryStatus: "INVENTORIED",
        classificationStatus: "CLASSIFIED",
        sensitivity: "CONFIDENTIAL",
        processingDisposition: "LOCAL_ONLY",
        technicalFeasibility: "FEASIBLE",
        authorizationStatus: "AUTHORIZED",
        authorizationReceiptRef: "authorization-1",
        connectionStatus: "CONNECTED",
        connectionReceiptRef: "connection-1",
        initializationStatus: "INITIALIZED",
        initializationReceiptRef: "initialization-1",
        riskOwnerRef: "role:data-owner",
        nextReviewAt: "2026-08-23T00:00:00.000Z",
        blockerCodes: [],
        evidenceRefs: ["evidence:inventory:1"],
        version: 5,
        authorizationReceipt: {
          receiptType: "authorization",
          receiptId: "authorization-1",
          workspaceRef: "workspace:workspace-1",
          assetRef: "asset-1",
          idempotencyKey: "authorization:1",
          expectedVersion: 2,
          resultingVersion: 3,
          recordedAt: "2026-07-23T01:30:00.000Z",
          actorRef: "user:owner",
          evidenceRefs: ["evidence:authorization:1"],
          authorizationStatus: "authorized",
          authorizationRef: "authorization:readonly:1",
          scopeRefs: ["scope:synthetic"],
          consentRefs: [],
          validFrom: "2026-07-23T00:00:00.000Z",
          validUntil: "2026-08-23T00:00:00.000Z",
          reasonCodes: [],
        },
        connectionReceipt: {
          receiptType: "connection",
          receiptId: "connection-1",
          workspaceRef: "workspace:workspace-1",
          assetRef: "asset-1",
          idempotencyKey: "connection:1",
          expectedVersion: 3,
          resultingVersion: 4,
          recordedAt: "2026-07-23T02:30:00.000Z",
          actorRef: "user:owner",
          evidenceRefs: ["evidence:connection:1"],
          connectionStatus: "connected",
          connectorRef: "connector:synthetic-crm",
          accessMode: "read_only_api",
          secretRef: "secret-manager:synthetic/crm",
          authorizationReceiptRef: "authorization-1",
          observationSourceRef: "source-1",
          reasonCodes: [],
        },
        initializationReceipt: {
          receiptType: "initialization",
          receiptId: "initialization-1",
          workspaceRef: "workspace:workspace-1",
          assetRef: "asset-1",
          idempotencyKey: "initialization:1",
          expectedVersion: 4,
          resultingVersion: 5,
          recordedAt: "2026-07-23T04:00:00.000Z",
          actorRef: "user:owner",
          evidenceRefs: ["evidence:initialization:1"],
          initializationStatus: "initialized",
          connectionReceiptRef: "connection-1",
          observationRunRefs: ["run-1"],
          schemaMappingRefs: ["artifact-bundle:schema-1"],
          companyMemoryRefs: ["memory-fact:memory-1"],
          temporalContextSnapshotRef: "artifact-bundle:context-1",
          reasonCodes: [],
        },
      },
    ],
    sources: [
      {
        id: "source-1",
        catalogEntryId: "asset-1",
        status: "ACTIVE",
        accessMode: "READ_ONLY_API",
        sensitivity: "CONFIDENTIAL",
        freshnessSlaMinutes: 60,
        compatibilityMode: false,
        runRefs: ["run-1"],
        runs: [
          {
            id: "run-1",
            status: "SUCCEEDED",
            outcome: "SUCCESS",
            freshness: "FRESH",
            windowStart: "2026-07-23T03:00:00.000Z",
            windowEnd: "2026-07-23T04:00:00.000Z",
            observedAt: "2026-07-23T04:00:00.000Z",
            evidenceRefs: [
              "evidence:run:1",
              "evidence:owner-answer:1",
            ],
            errorCodes: [],
          },
        ],
        latestRun: {
          id: "run-1",
          status: "SUCCEEDED",
          outcome: "SUCCESS",
          freshness: "FRESH",
          windowStart: "2026-07-23T03:00:00.000Z",
          windowEnd: "2026-07-23T04:00:00.000Z",
          observedAt: "2026-07-23T04:00:00.000Z",
          evidenceRefs: [
            "evidence:run:1",
            "evidence:owner-answer:1",
          ],
          errorCodes: [],
        },
      },
    ],
    memoryFacts: [fact],
    artifacts,
  };
}

describe("CAIO initialization assessment projector", () => {
  it("resolves catalog, source, Memory and Context truth into a ready assessment", () => {
    const projection = projectCaioInitializationAssessmentInput(
      readySnapshot(),
    );
    const assessment = computeCaioInitializationAssessment(projection.input);

    expect(projection.diagnostics).toEqual([]);
    expect(assessment.decision).toBe("ready_for_owner_acceptance");
    expect(assessment.failures).toEqual([]);
    expect(assessment.authorityEffect).toBe("none");
  });

  it("fails closed when a referenced mapping artifact is missing", () => {
    const snapshot = readySnapshot();
    snapshot.artifacts = snapshot.artifacts.filter(
      (artifact) => artifact.id !== "schema-1",
    );

    const projection = projectCaioInitializationAssessmentInput(snapshot);
    const assessment = computeCaioInitializationAssessment(projection.input);

    expect(projection.diagnostics).toContain(
      "schema_mapping_unresolved:asset-1:artifact-bundle:schema-1",
    );
    expect(assessment.failures).toContain(
      "initialized_asset_missing_schema_mapping",
    );
  });

  it("fails closed when a connected asset has no resolvable connection receipt", () => {
    const snapshot = readySnapshot();
    snapshot.assets[0].connectionReceipt = null;

    const projection = projectCaioInitializationAssessmentInput(snapshot);
    const assessment = computeCaioInitializationAssessment(projection.input);

    expect(projection.diagnostics).toContain(
      "connection_receipt_unresolved:asset-1",
    );
    expect(assessment.decision).toBe("not_ready");
  });

  it("fails closed when the connection receipt access mode differs from the source", () => {
    const snapshot = readySnapshot();
    snapshot.assets[0].connectionReceipt = {
      ...snapshot.assets[0].connectionReceipt!,
      accessMode: "file_snapshot",
    };

    const projection = projectCaioInitializationAssessmentInput(snapshot);
    const assessment = computeCaioInitializationAssessment(projection.input);

    expect(projection.diagnostics).toContain(
      "connection_receipt_unresolved:asset-1",
    );
    expect(assessment.decision).toBe("not_ready");
  });

  it("fails closed when stage receipts do not form a continuous version chain", () => {
    const snapshot = readySnapshot();
    snapshot.assets[0].connectionReceipt = {
      ...snapshot.assets[0].connectionReceipt!,
      expectedVersion: 4,
      resultingVersion: 5,
    };

    const projection = projectCaioInitializationAssessmentInput(snapshot);
    const assessment = computeCaioInitializationAssessment(projection.input);

    expect(projection.diagnostics).toContain(
      "connection_receipt_unresolved:asset-1",
    );
    expect(assessment.decision).toBe("not_ready");
  });

  it("treats unassessed feasibility and unrecognized access as blockers", () => {
    const snapshot = readySnapshot();
    snapshot.assets[0].technicalFeasibility = "UNASSESSED";
    snapshot.sources[0].accessMode = "READ_WRITE_API";

    const projection = projectCaioInitializationAssessmentInput(snapshot);
    const assessment = computeCaioInitializationAssessment(projection.input);

    expect(assessment.failures).toEqual(
      expect.arrayContaining([
        "asset_state_incomplete",
        "registered_write_path_present",
      ]),
    );
    expect(assessment.metrics.registeredWritePathCount).toBe(1);
  });

  it("rejects a replay-valid temporal context bound to another workspace", () => {
    const snapshot = readySnapshot();
    const artifact = snapshot.artifacts.find(
      (candidate) => candidate.id === "context-1",
    );
    if (!artifact) throw new Error("context artifact missing");
    const content = JSON.parse(artifact.artifactsJson) as Record<
      string,
      unknown
    >;
    const { contentHash: _contentHash, ...seed } = content;
    artifact.artifactsJson = JSON.stringify(
      withContentHash({
        ...seed,
        workspaceRef: "workspace:another-enterprise",
      }),
    );

    const projection = projectCaioInitializationAssessmentInput(snapshot);
    const assessment = computeCaioInitializationAssessment(projection.input);

    expect(projection.diagnostics).toContain(
      "temporal_context_unresolved:artifact-bundle:context-1",
    );
    expect(assessment.failures).toContain(
      "temporal_context_not_rebuildable",
    );
  });

  it("rejects expired authorization and initialization runs absent from current source truth", () => {
    const expired = readySnapshot();
    if (!expired.assets[0].authorizationReceipt) {
      throw new Error("authorization receipt missing");
    }
    expired.assets[0].authorizationReceipt.validUntil =
      "2026-07-23T04:59:59.000Z";

    const expiredProjection =
      projectCaioInitializationAssessmentInput(expired);
    expect(expiredProjection.diagnostics).toContain(
      "authorization_receipt_unresolved:asset-1",
    );
    expect(
      computeCaioInitializationAssessment(expiredProjection.input).decision,
    ).toBe("not_ready");

    const missingRun = readySnapshot();
    missingRun.sources[0].runRefs = [];
    missingRun.sources[0].runs = [];
    missingRun.sources[0].latestRun = null;
    const runProjection =
      projectCaioInitializationAssessmentInput(missingRun);
    expect(runProjection.diagnostics).toContain(
      "observation_run_unresolved:asset-1:run-1",
    );
    expect(
      computeCaioInitializationAssessment(runProjection.input).failures,
    ).toContain("initialized_asset_missing_observation_run");
  });

  it("recomputes freshness from observed time and source SLA", () => {
    const snapshot = readySnapshot();
    snapshot.evaluatedAt = "2026-07-23T05:00:00.001Z";

    const projection = projectCaioInitializationAssessmentInput(snapshot);
    const assessment = computeCaioInitializationAssessment(projection.input);

    expect(projection.diagnostics).toContain(
      "source_freshness_stale:source-1",
    );
    expect(assessment.failures).toContain(
      "connected_source_health_below_threshold",
    );
    expect(assessment.failures).toContain("source_exception_incomplete");
  });

  it("rejects an evidence trace absent from the referenced run receipt", () => {
    const snapshot = readySnapshot();
    snapshot.sources[0].runs[0].evidenceRefs = ["evidence:another-output"];
    snapshot.sources[0].latestRun = snapshot.sources[0].runs[0];

    const projection = projectCaioInitializationAssessmentInput(snapshot);
    const assessment = computeCaioInitializationAssessment(projection.input);

    expect(projection.diagnostics).toContain(
      "evidence_trace_run_binding_invalid:evidence:owner-answer:1",
    );
    expect(assessment.failures).toContain("evidence_trace_sample_empty");
  });
});
