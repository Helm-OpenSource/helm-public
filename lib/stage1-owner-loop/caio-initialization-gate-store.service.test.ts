import {
  ActorType,
  MembershipStatus,
  WorkspaceRole,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, auditMock, policyAccessMock } = vi.hoisted(() => {
  const client = {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    membership: { findUnique: vi.fn() },
    dataAssetCatalogEntry: { findMany: vi.fn() },
    dataAssetStageReceipt: { findMany: vi.fn() },
    observationSource: { findMany: vi.fn() },
    observationSourceRun: { findMany: vi.fn() },
    memoryFact: { findMany: vi.fn() },
    artifactBundle: { findMany: vi.fn() },
    caioActiveMandateClaim: { findFirst: vi.fn() },
    caioGuardianStopRecord: { count: vi.fn() },
    caioPrincipalBinding: { findFirst: vi.fn() },
    caioInitializationAssessment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    caioInitializationGateReceipt: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    caioInitializationGateHead: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return {
    dbMock: client,
    auditMock: { writeAuditLog: vi.fn() },
    policyAccessMock: { assertWorkspacePolicyServiceAccess: vi.fn() },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));
vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspacePolicyServiceAccess:
    policyAccessMock.assertWorkspacePolicyServiceAccess,
}));

import {
  acceptCaioInitializationGate,
  CaioInitializationGateStoreError,
  getCaioInitializationGateStatus,
  recordCaioInitializationAssessment,
  revokeCaioInitializationGate,
} from "./caio-initialization-gate-store.service";
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
  CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION,
  computeCaioInitializationAssessment,
  type CaioInitializationAssessment,
  type CaioInitializationAssessmentInput,
} from "./caio-initialization-gate";
import {
  createCaioInitializationAcceptanceReceipt,
  createCaioInitializationRevocationReceipt,
  type CaioInitializationGateReceipt,
} from "./caio-initialization-gate-receipt";

const NOW = new Date("2026-07-23T08:00:00.000Z");
const SHA_A = `sha256:${"a".repeat(64)}`;
const SHA_B = `sha256:${"b".repeat(64)}`;
const SHA_C = `sha256:${"c".repeat(64)}`;

function readyAssessmentInput(): CaioInitializationAssessmentInput {
  return {
    schemaVersion: CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION,
    workspaceRef: "workspace:workspace-1",
    mandateRef: "mandate-1",
    evaluatedAt: NOW.toISOString(),
    assets: [
      {
        assetRef: "asset-1",
        inventoryStatus: "inventoried",
        classificationStatus: "classified",
        sensitivity: "confidential",
        processingDisposition: "local_only",
        technicalFeasibility: "feasible",
        authorizationStatus: "authorized",
        authorizationReceiptRef: "authorization-1",
        connectionStatus: "connected",
        connectionReceiptRef: "connection-1",
        initializationStatus: "initialized",
        initializationReceiptRef: "initialization-1",
        observationRunRefs: ["run-1"],
        schemaMappingRefs: ["artifact-bundle:schema-1"],
        companyMemoryBindings: [
          { ref: "memory-fact:memory-1", contentHash: SHA_A },
        ],
        temporalContextSnapshotRef: "artifact-bundle:context-1",
        exception: null,
      },
    ],
    sources: [
      {
        sourceRef: "source-1",
        assetRef: "asset-1",
        compatibilityMode: false,
        sourceStatus: "active",
        accessMode: "read_only_api",
        latestRunRef: "run-1",
        latestRunStatus: "succeeded",
        latestRunOutcome: "success",
        freshness: "fresh",
        exception: null,
      },
    ],
    evidenceTraces: [
      {
        evidenceRef: "evidence-1",
        sourceRef: "source-1",
        assetRef: "asset-1",
        observationRunRef: "run-1",
        authorizationReceiptRef: "authorization-1",
        connectionReceiptRef: "connection-1",
        initializationReceiptRef: "initialization-1",
        sensitivity: "confidential",
        outputType: "owner_answer",
        capturedAt: NOW.toISOString(),
        resolved: true,
        traceHash: SHA_A,
      },
    ],
    knowledge: {
      memoryRebuildReceiptRef: "receipt:memory-rebuild:1",
      memoryRootHash: SHA_A,
      temporalContextArtifactRef: "artifact-bundle:context-1",
      temporalContextInputHash: SHA_B,
      temporalContextSnapshotHash: SHA_C,
      temporalContextReplayRootHash: SHA_A,
      temporalContextReplayValid: true,
    },
    registeredWritePathCount: 0,
  };
}

function readyAssessment(): CaioInitializationAssessment {
  const input = readyAssessmentInput();
  return computeCaioInitializationAssessment(input);
}

function assessmentRow(
  assessment = readyAssessment(),
  input = readyAssessmentInput(),
) {
  return {
    id: assessment.assessmentId,
    workspaceId: "workspace-1",
    mandateRecordId: "mandate-1",
    evaluationKey: "g0-evaluation-1",
    schemaVersion: assessment.schemaVersion,
    evaluatorRevision: assessment.evaluatorRevision,
    policyRef: assessment.policyRef,
    policyHash: assessment.policyHash,
    basisHash: assessment.basisHash,
    decision: assessment.decision.toUpperCase(),
    inputJson: JSON.stringify({ input, diagnostics: [] }),
    assessmentJson: JSON.stringify(assessment),
    contentHash: assessment.contentHash,
    authorityEffect: assessment.authorityEffect,
    evaluatedAt: NOW,
    createdAt: NOW,
  };
}

function acceptedReceipt(
  assessment = readyAssessment(),
): CaioInitializationGateReceipt {
  return createCaioInitializationAcceptanceReceipt({
    workspaceRef: "workspace:workspace-1",
    assessment,
    mandateRef: "mandate-1",
    ceoPrincipalBindingRef: "binding-1",
    ceoPrincipalRef: "ceo-1",
    actorUserRef: "owner-1",
    idempotencyKey: "accept-1",
    evidenceRefs: ["evidence:acceptance:1"],
    previousReceipt: null,
    recordedAt: NOW.toISOString(),
    inventoryConfirmationRef: "confirmation:inventory:1",
    customerAcceptanceRef: "acceptance:customer:1",
    acceptedExceptionRefs: [],
    reasonCodes: ["initialization_reviewed"],
  });
}

function revokedReceipt(
  assessment = readyAssessment(),
): CaioInitializationGateReceipt {
  const accepted = acceptedReceipt(assessment);
  return createCaioInitializationRevocationReceipt({
    workspaceRef: "workspace:workspace-1",
    assessment,
    mandateRef: "mandate-1",
    ceoPrincipalBindingRef: "binding-1",
    ceoPrincipalRef: "ceo-1",
    actorUserRef: "owner-1",
    idempotencyKey: "revoke-1",
    evidenceRefs: ["evidence:revocation:1"],
    previousReceipt: {
      receiptId: accepted.receiptId,
      contentHash: accepted.contentHash,
      sequence: accepted.sequence,
      resultingStatus: accepted.resultingStatus,
      assessmentRef: accepted.assessmentRef,
      recordedAt: accepted.recordedAt,
    },
    recordedAt: new Date(NOW.getTime() + 1_000).toISOString(),
    acceptedExceptionRefs: accepted.acceptedExceptionRefs,
    reasonCodes: ["owner_revoked_initialization_acceptance"],
  });
}

function receiptRow(receipt: CaioInitializationGateReceipt) {
  return {
    id: receipt.receiptId,
    workspaceId: "workspace-1",
    assessmentId: receipt.assessmentRef,
    mandateRecordId: "mandate-1",
    ceoPrincipalBindingId: receipt.ceoPrincipalBindingRef,
    previousReceiptId: receipt.previousReceiptRef,
    previousReceiptHash: receipt.previousReceiptHash,
    sequence: receipt.sequence,
    idempotencyKey: receipt.idempotencyKey,
    action: receipt.action.toUpperCase(),
    resultingStatus: receipt.resultingStatus.toUpperCase(),
    actorType: ActorType.USER,
    actorUserId: receipt.actorUserRef,
    ceoPrincipalRef: receipt.ceoPrincipalRef,
    inventoryConfirmationRef: receipt.inventoryConfirmationRef,
    customerAcceptanceRef: receipt.customerAcceptanceRef,
    acceptedExceptionRefs: JSON.stringify(receipt.acceptedExceptionRefs),
    reasonCodes: JSON.stringify(receipt.reasonCodes),
    evidenceRefs: JSON.stringify(receipt.evidenceRefs),
    basisHash: receipt.basisHash,
    receiptJson: JSON.stringify(receipt),
    contentHash: receipt.contentHash,
    authorityEffect: receipt.authorityEffect,
    recordedAt: new Date(receipt.recordedAt),
    createdAt: NOW,
  };
}

function activeMandate() {
  return {
    id: "mandate-1",
    workspaceId: "workspace-1",
    ceoRef: "ceo-1",
    status: "active",
    validFrom: new Date(NOW.getTime() - 60_000),
    validUntil: new Date(NOW.getTime() + 60_000),
    emergencyStopRef: null,
  };
}

function withContentHash<T extends Record<string, unknown>>(
  content: T,
): T & { contentHash: string } {
  return {
    ...content,
    contentHash: sha256(canonicalJson(content)),
  };
}

function configureReadyProjectionMocks() {
  const projectionFact = {
    id: "memory-1",
    objectType: "COMPANY",
    objectId: "company-1",
    factType: "BUSINESS_FACT",
    title: "Synthetic operating fact",
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
    contentHash: sha256(canonicalJson(projectionFact)),
  };
  const authorizationReceipt = {
    receiptType: "authorization" as const,
    receiptId: "authorization-1",
    workspaceRef: "workspace:workspace-1",
    assetRef: "asset-1",
    idempotencyKey: "authorization:1",
    expectedVersion: 2,
    resultingVersion: 3,
    recordedAt: "2026-07-23T01:30:00.000Z",
    actorRef: "owner-1",
    evidenceRefs: ["evidence:authorization:1"],
    authorizationStatus: "authorized" as const,
    authorizationRef: "authorization:readonly:1",
    scopeRefs: ["scope:synthetic"],
    consentRefs: [],
    validFrom: "2026-07-23T00:00:00.000Z",
    validUntil: "2026-08-23T00:00:00.000Z",
    reasonCodes: [],
  };
  const connectionReceipt = {
    receiptType: "connection" as const,
    receiptId: "connection-1",
    workspaceRef: "workspace:workspace-1",
    assetRef: "asset-1",
    idempotencyKey: "connection:1",
    expectedVersion: 3,
    resultingVersion: 4,
    recordedAt: "2026-07-23T02:30:00.000Z",
    actorRef: "owner-1",
    evidenceRefs: ["evidence:connection:1"],
    connectionStatus: "connected" as const,
    connectorRef: "connector:synthetic-crm",
    accessMode: "read_only_api" as const,
    secretRef: "secret-manager:synthetic/crm",
    authorizationReceiptRef: "authorization-1",
    observationSourceRef: "source-1",
    reasonCodes: [],
  };
  const initializationReceipt = {
    receiptType: "initialization" as const,
    receiptId: "initialization-1",
    workspaceRef: "workspace:workspace-1",
    assetRef: "asset-1",
    idempotencyKey: "initialization:1",
    expectedVersion: 4,
    resultingVersion: 5,
    recordedAt: "2026-07-23T04:00:00.000Z",
    actorRef: "owner-1",
    evidenceRefs: ["evidence:initialization:1"],
    initializationStatus: "initialized" as const,
    connectionReceiptRef: "connection-1",
    observationRunRefs: ["run-1"],
    schemaMappingRefs: ["artifact-bundle:schema-1"],
    companyMemoryRefs: ["memory-fact:memory-1"],
    temporalContextSnapshotRef: "artifact-bundle:context-1",
    reasonCodes: [],
  };
  dbMock.dataAssetCatalogEntry.findMany.mockResolvedValue([
    {
      id: "asset-1",
      workspaceId: "workspace-1",
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
      nextReviewAt: new Date("2026-08-23T00:00:00.000Z"),
      blockerCodes: JSON.stringify([]),
      evidenceRefs: JSON.stringify(["evidence:inventory:1"]),
      version: 5,
    },
  ]);
  const stageReceiptRows = [
    {
      id: "authorization-1",
      workspaceId: "workspace-1",
      assetId: "asset-1",
      receiptType: "AUTHORIZATION",
      idempotencyKey: "authorization:1",
      expectedVersion: 2,
      resultingVersion: 3,
      status: "AUTHORIZED",
      actorRef: "owner-1",
      evidenceRefs: JSON.stringify(["evidence:authorization:1"]),
      payloadJson: JSON.stringify(authorizationReceipt),
      recordedAt: new Date(authorizationReceipt.recordedAt),
    },
    {
      id: "connection-1",
      workspaceId: "workspace-1",
      assetId: "asset-1",
      receiptType: "CONNECTION",
      idempotencyKey: "connection:1",
      expectedVersion: 3,
      resultingVersion: 4,
      status: "CONNECTED",
      actorRef: "owner-1",
      evidenceRefs: JSON.stringify(["evidence:connection:1"]),
      payloadJson: JSON.stringify(connectionReceipt),
      recordedAt: new Date(connectionReceipt.recordedAt),
    },
    {
      id: "initialization-1",
      workspaceId: "workspace-1",
      assetId: "asset-1",
      receiptType: "INITIALIZATION",
      idempotencyKey: "initialization:1",
      expectedVersion: 4,
      resultingVersion: 5,
      status: "INITIALIZED",
      actorRef: "owner-1",
      evidenceRefs: JSON.stringify(["evidence:initialization:1"]),
      payloadJson: JSON.stringify(initializationReceipt),
      recordedAt: new Date(initializationReceipt.recordedAt),
    },
  ];
  dbMock.dataAssetStageReceipt.findMany.mockResolvedValue(stageReceiptRows);
  dbMock.observationSource.findMany.mockResolvedValue([
    {
      id: "source-1",
      catalogEntryId: "asset-1",
      status: "ACTIVE",
      accessMode: "READ_ONLY_API",
      sensitivity: "CONFIDENTIAL",
      freshnessSlaMinutes: 60,
      compatibilityReceipt: null,
      runs: [
        {
          id: "run-1",
          status: "SUCCEEDED",
          outcome: "SUCCESS",
          freshness: "FRESH",
          windowStart: new Date("2026-07-23T07:00:00.000Z"),
          windowEnd: NOW,
          observedAt: NOW,
          evidenceRefs: JSON.stringify([
            "evidence:run:1",
            "evidence:owner-answer:1",
          ]),
          errorCodes: JSON.stringify([]),
        },
      ],
    },
  ]);
  dbMock.observationSourceRun.findMany.mockResolvedValue([
    {
      id: "run-1",
      sourceId: "source-1",
      status: "SUCCEEDED",
      outcome: "SUCCESS",
      freshness: "FRESH",
      windowStart: new Date("2026-07-23T07:00:00.000Z"),
      windowEnd: NOW,
      observedAt: NOW,
      evidenceRefs: JSON.stringify([
        "evidence:run:1",
        "evidence:owner-answer:1",
      ]),
      errorCodes: JSON.stringify([]),
    },
  ]);
  dbMock.memoryFact.findMany.mockResolvedValue([
    {
      ...projectionFact,
      createdAt: new Date(projectionFact.createdAt),
      updatedAt: new Date(projectionFact.updatedAt),
    },
  ]);
  const schemaMapping = withContentHash({
    schemaVersion: CAIO_SCHEMA_MAPPING_SCHEMA_VERSION,
    artifactRef: "artifact-bundle:schema-1",
    assetRef: "asset-1",
    sourceSchemaHash: `sha256:${"1".repeat(64)}`,
    targetSchemaHash: `sha256:${"2".repeat(64)}`,
    mappingHash: `sha256:${"3".repeat(64)}`,
    generatedAt: "2026-07-23T02:00:00.000Z",
  });
  const memoryReceipt = withContentHash({
    schemaVersion: CAIO_MEMORY_REBUILD_RECEIPT_SCHEMA_VERSION,
    artifactRef: "artifact-bundle:memory-rebuild-1",
    receiptRef: "receipt:memory-rebuild:1",
    workspaceRef: "workspace:workspace-1",
    memoryFactBindings: [memoryBinding],
    memoryRootHash: computeCaioMemoryRootHash([memoryBinding]),
    rebuiltAt: "2026-07-23T03:00:00.000Z",
  });
  const contextInput = syntheticTemporalOperatingContextInput();
  const contextProjection = projectTemporalOperatingContext(contextInput);
  if (!contextProjection.snapshot) {
    throw new Error("synthetic temporal context projection failed");
  }
  const context = withContentHash({
    schemaVersion: CAIO_TEMPORAL_CONTEXT_ARTIFACT_SCHEMA_VERSION,
    artifactRef: "artifact-bundle:context-1",
    workspaceRef: "workspace:workspace-1",
    projectionInput: contextInput,
    snapshot: contextProjection.snapshot,
    projectionInputHash: sha256(canonicalJson(contextInput)),
    snapshotHash: contextProjection.snapshot.contentHash,
    replayRootHash: contextProjection.snapshot.replayRootHash,
  });
  const traceSeed = {
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
    capturedAt: NOW.toISOString(),
    resolved: true,
  };
  dbMock.artifactBundle.findMany.mockResolvedValue([
    {
      id: "schema-1",
      artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.schemaMapping,
      status: "CONFIRMED",
      artifactsJson: JSON.stringify(schemaMapping),
      createdAt: new Date("2026-07-23T02:00:00.000Z"),
    },
    {
      id: "memory-rebuild-1",
      artifactType:
        CAIO_INITIALIZATION_ARTIFACT_TYPES.memoryRebuildReceipt,
      status: "CONFIRMED",
      artifactsJson: JSON.stringify(memoryReceipt),
      createdAt: new Date("2026-07-23T03:00:00.000Z"),
    },
    {
      id: "context-1",
      artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.temporalContext,
      status: "CONFIRMED",
      artifactsJson: JSON.stringify(context),
      createdAt: new Date("2026-07-23T03:00:00.000Z"),
    },
    {
      id: "trace-1",
      artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.evidenceTrace,
      status: "CONFIRMED",
      artifactsJson: JSON.stringify({
        ...traceSeed,
        traceHash: computeCaioEvidenceTraceHash(traceSeed),
      }),
      createdAt: NOW,
    },
  ]);
  return { stageReceiptRows };
}

describe("CAIO initialization gate store", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dbMock.$transaction.mockImplementation(
      (callback: (tx: typeof dbMock) => unknown) => callback(dbMock),
    );
    dbMock.$queryRaw.mockResolvedValue([{ id: "workspace-1" }]);
    policyAccessMock.assertWorkspacePolicyServiceAccess.mockResolvedValue(
      undefined,
    );
    dbMock.membership.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    });
    auditMock.writeAuditLog.mockResolvedValue({ id: "audit-1" });
    dbMock.caioActiveMandateClaim.findFirst.mockResolvedValue({
      mandateRecord: activeMandate(),
    });
    dbMock.caioGuardianStopRecord.count.mockResolvedValue(0);
    dbMock.caioPrincipalBinding.findFirst.mockResolvedValue({
      id: "binding-1",
      workspaceId: "workspace-1",
      userId: "owner-1",
      principalRef: "ceo-1",
      principalKind: "ceo",
      revokedAt: null,
    });
    dbMock.caioInitializationAssessment.findUnique.mockResolvedValue(null);
    dbMock.caioInitializationGateReceipt.findUnique.mockResolvedValue(null);
    dbMock.caioInitializationGateHead.findUnique.mockResolvedValue(null);
    dbMock.dataAssetCatalogEntry.findMany.mockResolvedValue([]);
    dbMock.observationSource.findMany.mockResolvedValue([]);
    dbMock.artifactBundle.findMany.mockResolvedValue([]);
  });

  it("persists a deterministic not-ready assessment and its audit in one transaction", async () => {
    dbMock.caioInitializationAssessment.create.mockResolvedValue({});

    const result = await recordCaioInitializationAssessment({
      workspaceId: "workspace-1",
      mandateRecordId: "mandate-1",
      evaluationKey: "evaluation-empty-1",
      actorUserId: "owner-1",
      now: NOW,
    });

    expect(result.assessment.decision).toBe("not_ready");
    expect(result.assessment.failures).toEqual(
      expect.arrayContaining([
        "asset_catalog_empty",
        "connected_source_missing",
      ]),
    );
    expect(dbMock.caioInitializationAssessment.create).toHaveBeenCalledTimes(
      1,
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: ActorType.USER,
        actionType: "CAIO_INITIALIZATION_ASSESSED",
        targetId: result.assessment.assessmentId,
      }),
      { client: dbMock },
    );
  });

  it("does not report assessment success when the transactional audit write fails", async () => {
    dbMock.caioInitializationAssessment.create.mockResolvedValue({});
    auditMock.writeAuditLog.mockRejectedValue(new Error("audit unavailable"));

    await expect(
      recordCaioInitializationAssessment({
        workspaceId: "workspace-1",
        mandateRecordId: "mandate-1",
        evaluationKey: "evaluation-audit-failure",
        actorUserId: "owner-1",
        now: NOW,
      }),
    ).rejects.toThrow("audit unavailable");
  });

  it("rejects a stored assessment when indexed columns diverge from the hashed JSON", async () => {
    dbMock.caioInitializationAssessment.findUnique.mockResolvedValue({
      ...assessmentRow(),
      decision: "NOT_READY",
    });

    await expect(
      recordCaioInitializationAssessment({
        workspaceId: "workspace-1",
        mandateRecordId: "mandate-1",
        evaluationKey: "g0-evaluation-1",
        actorUserId: "owner-1",
        now: NOW,
      }),
    ).rejects.toThrow("stored_assessment_binding_invalid");
  });

  it("rejects an assessment evaluation-key replay across mandates", async () => {
    dbMock.caioInitializationAssessment.findUnique.mockResolvedValue(
      assessmentRow(),
    );

    await expect(
      recordCaioInitializationAssessment({
        workspaceId: "workspace-1",
        mandateRecordId: "mandate-2",
        evaluationKey: "g0-evaluation-1",
        actorUserId: "owner-1",
        now: NOW,
      }),
    ).rejects.toThrow("idempotency_key_payload_conflict");
  });

  it("fails closed when a replayed assessment input envelope is malformed", async () => {
    dbMock.caioInitializationAssessment.findUnique.mockResolvedValue({
      ...assessmentRow(),
      inputJson: "{not-json",
    });

    await expect(
      recordCaioInitializationAssessment({
        workspaceId: "workspace-1",
        mandateRecordId: "mandate-1",
        evaluationKey: "g0-evaluation-1",
        actorUserId: "owner-1",
        now: NOW,
      }),
    ).rejects.toThrow("stored_assessment_input_invalid");
  });

  it("fails closed when a replayed assessment input no longer reproduces the stored assessment", async () => {
    const input = readyAssessmentInput();
    input.registeredWritePathCount = 1;
    dbMock.caioInitializationAssessment.findUnique.mockResolvedValue(
      assessmentRow(readyAssessment(), input),
    );

    await expect(
      recordCaioInitializationAssessment({
        workspaceId: "workspace-1",
        mandateRecordId: "mandate-1",
        evaluationKey: "g0-evaluation-1",
        actorUserId: "owner-1",
        now: NOW,
      }),
    ).rejects.toThrow("stored_assessment_input_binding_invalid");
  });

  it("rechecks policy authority inside the write transaction", async () => {
    dbMock.membership.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.INACTIVE,
    });
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(),
    );

    await expect(
      acceptCaioInitializationGate({
        workspaceId: "workspace-1",
        assessmentId: readyAssessment().assessmentId,
        actorUserId: "owner-1",
        ceoPrincipalRef: "ceo-1",
        idempotencyKey: "accept-after-authority-loss",
        inventoryConfirmationRef: "confirmation:inventory:1",
        customerAcceptanceRef: "acceptance:customer:1",
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: ["evidence:acceptance:1"],
        now: NOW,
      }),
    ).rejects.toThrow("workspace_policy_access_lost");

    expect(
      dbMock.caioInitializationGateReceipt.create,
    ).not.toHaveBeenCalled();
  });

  it("fails closed before acceptance when no live CEO identity binding exists", async () => {
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(),
    );
    dbMock.caioPrincipalBinding.findFirst.mockResolvedValue(null);

    await expect(
      acceptCaioInitializationGate({
        workspaceId: "workspace-1",
        assessmentId: readyAssessment().assessmentId,
        actorUserId: "owner-1",
        ceoPrincipalRef: "ceo-1",
        idempotencyKey: "accept-without-binding",
        inventoryConfirmationRef: "confirmation:inventory:1",
        customerAcceptanceRef: "acceptance:customer:1",
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: ["evidence:acceptance:1"],
        now: NOW,
      }),
    ).rejects.toThrow(CaioInitializationGateStoreError);

    expect(
      dbMock.caioInitializationGateReceipt.create,
    ).not.toHaveBeenCalled();
  });

  it("returns an exact acceptance replay without appending another receipt", async () => {
    const assessment = readyAssessment();
    const receipt = acceptedReceipt(assessment);
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );
    dbMock.caioInitializationGateReceipt.findUnique.mockResolvedValue(
      receiptRow(receipt),
    );
    dbMock.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ id: "workspace-1" }])
      .mockResolvedValueOnce([
        {
          workspaceId: "workspace-1",
          currentAssessmentId: assessment.assessmentId,
          currentReceiptId: receipt.receiptId,
          sequence: receipt.sequence,
          version: 1,
        },
      ]);

    const result = await acceptCaioInitializationGate({
      workspaceId: "workspace-1",
      assessmentId: assessment.assessmentId,
      actorUserId: "owner-1",
      ceoPrincipalRef: "ceo-1",
      idempotencyKey: "accept-1",
      inventoryConfirmationRef: "confirmation:inventory:1",
      customerAcceptanceRef: "acceptance:customer:1",
      acceptedExceptionRefs: [],
      reasonCodes: ["initialization_reviewed"],
      evidenceRefs: ["evidence:acceptance:1"],
      now: NOW,
    });

    expect(result).toEqual({ receipt, replayed: true });
    expect(
      dbMock.caioInitializationGateReceipt.create,
    ).not.toHaveBeenCalled();
    expect(dbMock.caioInitializationGateHead.create).not.toHaveBeenCalled();
  });

  it("rejects a stored receipt when indexed columns diverge from the hashed JSON", async () => {
    const assessment = readyAssessment();
    const receipt = acceptedReceipt(assessment);
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );
    dbMock.caioInitializationGateReceipt.findUnique.mockResolvedValue({
      ...receiptRow(receipt),
      resultingStatus: "REVOKED",
    });

    await expect(
      acceptCaioInitializationGate({
        workspaceId: "workspace-1",
        assessmentId: assessment.assessmentId,
        actorUserId: "owner-1",
        ceoPrincipalRef: "ceo-1",
        idempotencyKey: "accept-1",
        inventoryConfirmationRef: "confirmation:inventory:1",
        customerAcceptanceRef: "acceptance:customer:1",
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: ["evidence:acceptance:1"],
        now: NOW,
      }),
    ).rejects.toThrow("stored_gate_receipt_binding_invalid");
  });

  it("rejects malformed receipt array columns even when the hashed receipt contains an empty array", async () => {
    const assessment = readyAssessment();
    const receipt = acceptedReceipt(assessment);
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );
    dbMock.caioInitializationGateReceipt.findUnique.mockResolvedValue({
      ...receiptRow(receipt),
      acceptedExceptionRefs: "{not-json",
    });

    await expect(
      acceptCaioInitializationGate({
        workspaceId: "workspace-1",
        assessmentId: assessment.assessmentId,
        actorUserId: "owner-1",
        ceoPrincipalRef: "ceo-1",
        idempotencyKey: "accept-1",
        inventoryConfirmationRef: "confirmation:inventory:1",
        customerAcceptanceRef: "acceptance:customer:1",
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: ["evidence:acceptance:1"],
        now: NOW,
      }),
    ).rejects.toThrow("stored_gate_receipt_binding_invalid");
  });

  it("rejects a self-consistent receipt that is rebound to the wrong assessment hash", async () => {
    const assessment = readyAssessment();
    const receipt = acceptedReceipt(assessment);
    const { contentHash: _contentHash, ...receiptSeed } = receipt;
    const reboundSeed = {
      ...receiptSeed,
      assessmentHash: SHA_B,
    };
    const reboundReceipt: CaioInitializationGateReceipt = {
      ...reboundSeed,
      contentHash: sha256(canonicalJson(reboundSeed)),
    };
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );
    dbMock.caioInitializationGateReceipt.findUnique.mockResolvedValue(
      receiptRow(reboundReceipt),
    );
    dbMock.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ id: "workspace-1" }])
      .mockResolvedValueOnce([
        {
          workspaceId: "workspace-1",
          currentAssessmentId: assessment.assessmentId,
          currentReceiptId: reboundReceipt.receiptId,
          sequence: reboundReceipt.sequence,
          version: 1,
        },
      ]);

    await expect(
      acceptCaioInitializationGate({
        workspaceId: "workspace-1",
        assessmentId: assessment.assessmentId,
        actorUserId: "owner-1",
        ceoPrincipalRef: "ceo-1",
        idempotencyKey: "accept-1",
        inventoryConfirmationRef: "confirmation:inventory:1",
        customerAcceptanceRef: "acceptance:customer:1",
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: ["evidence:acceptance:1"],
        now: NOW,
      }),
    ).rejects.toThrow("gate_receipt_assessment_binding_invalid");
  });

  it("does not replay a historical acceptance after the gate has been revoked", async () => {
    const assessment = readyAssessment();
    const accepted = acceptedReceipt(assessment);
    const revoked = revokedReceipt(assessment);
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );
    dbMock.caioInitializationGateReceipt.findUnique.mockResolvedValue(
      receiptRow(accepted),
    );
    dbMock.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ id: "workspace-1" }])
      .mockResolvedValueOnce([
        {
          workspaceId: "workspace-1",
          currentAssessmentId: assessment.assessmentId,
          currentReceiptId: revoked.receiptId,
          sequence: revoked.sequence,
          version: 2,
        },
      ]);

    await expect(
      acceptCaioInitializationGate({
        workspaceId: "workspace-1",
        assessmentId: assessment.assessmentId,
        actorUserId: "owner-1",
        ceoPrincipalRef: "ceo-1",
        idempotencyKey: "accept-1",
        inventoryConfirmationRef: "confirmation:inventory:1",
        customerAcceptanceRef: "acceptance:customer:1",
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: ["evidence:acceptance:1"],
        now: new Date(NOW.getTime() + 2_000),
      }),
    ).rejects.toThrow("idempotency_receipt_no_longer_current");
  });

  it("rederives current evidence and appends the first CEO acceptance atomically", async () => {
    configureReadyProjectionMocks();
    dbMock.caioInitializationAssessment.create.mockResolvedValue({});
    const evaluated = await recordCaioInitializationAssessment({
      workspaceId: "workspace-1",
      mandateRecordId: "mandate-1",
      evaluationKey: "evaluation-ready-1",
      actorUserId: "owner-1",
      now: NOW,
    });
    expect(evaluated.assessment.decision).toBe(
      "ready_for_owner_acceptance",
    );

    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(evaluated.assessment),
    );
    dbMock.caioInitializationGateReceipt.create.mockResolvedValue({});
    dbMock.caioInitializationGateHead.create.mockResolvedValue({});
    dbMock.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ id: "workspace-1" }])
      .mockResolvedValueOnce([]);

    const accepted = await acceptCaioInitializationGate({
      workspaceId: "workspace-1",
      assessmentId: evaluated.assessment.assessmentId,
      actorUserId: "owner-1",
      ceoPrincipalRef: "ceo-1",
      idempotencyKey: "accept-ready-1",
      inventoryConfirmationRef: "confirmation:inventory:ready-1",
      customerAcceptanceRef: "acceptance:customer:ready-1",
      acceptedExceptionRefs: [],
      reasonCodes: ["initialization_reviewed"],
      evidenceRefs: ["evidence:acceptance:ready-1"],
      now: NOW,
    });

    expect(accepted.replayed).toBe(false);
    expect(accepted.receipt.resultingStatus).toBe("accepted");
    expect(accepted.receipt.authorityEffect).toBe("none");
    expect(dbMock.caioInitializationGateReceipt.create).toHaveBeenCalledTimes(
      1,
    );
    expect(dbMock.caioInitializationGateHead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        currentAssessmentId: evaluated.assessment.assessmentId,
        currentReceiptId: accepted.receipt.receiptId,
        sequence: 1,
      }),
    });
    expect(auditMock.writeAuditLog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionType: "CAIO_INITIALIZATION_GATE_ACCEPTED",
        targetId: accepted.receipt.receiptId,
      }),
      { client: dbMock },
    );
  });

  it("fails closed when a stage receipt payload diverges from its database envelope", async () => {
    const { stageReceiptRows } = configureReadyProjectionMocks();
    stageReceiptRows[1].assetId = "asset-other";
    dbMock.caioInitializationAssessment.create.mockResolvedValue({});

    const evaluated = await recordCaioInitializationAssessment({
      workspaceId: "workspace-1",
      mandateRecordId: "mandate-1",
      evaluationKey: "evaluation-envelope-drift",
      actorUserId: "owner-1",
      now: NOW,
    });

    expect(evaluated.assessment.decision).toBe("not_ready");
    expect(evaluated.diagnostics).toContain(
      "connection_receipt_unresolved:asset-1",
    );
  });

  it("refuses acceptance when the assessed evidence basis has changed", async () => {
    const assessment = readyAssessment();
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );

    await expect(
      acceptCaioInitializationGate({
        workspaceId: "workspace-1",
        assessmentId: assessment.assessmentId,
        actorUserId: "owner-1",
        ceoPrincipalRef: "ceo-1",
        idempotencyKey: "accept-stale-1",
        inventoryConfirmationRef: "confirmation:inventory:1",
        customerAcceptanceRef: "acceptance:customer:1",
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: ["evidence:acceptance:1"],
        now: NOW,
      }),
    ).rejects.toThrow("assessment_stale_reassessment_required");

    expect(
      dbMock.caioInitializationGateReceipt.create,
    ).not.toHaveBeenCalled();
  });

  it("rejects a reused acceptance idempotency key with a different CEO scope", async () => {
    const assessment = readyAssessment();
    const receipt = acceptedReceipt(assessment);
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );
    dbMock.caioPrincipalBinding.findFirst.mockResolvedValue({
      id: "binding-2",
    });
    dbMock.caioInitializationGateReceipt.findUnique.mockResolvedValue(
      receiptRow(receipt),
    );

    await expect(
      acceptCaioInitializationGate({
        workspaceId: "workspace-1",
        assessmentId: assessment.assessmentId,
        actorUserId: "owner-1",
        ceoPrincipalRef: "ceo-2",
        idempotencyKey: "accept-1",
        inventoryConfirmationRef: "confirmation:inventory:1",
        customerAcceptanceRef: "acceptance:customer:1",
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: ["evidence:acceptance:1"],
        now: NOW,
      }),
    ).rejects.toThrow("idempotency_key_payload_conflict");
  });

  it("requires a newer reassessment after revocation instead of reaccepting the same assessment", async () => {
    configureReadyProjectionMocks();
    dbMock.caioInitializationAssessment.create.mockResolvedValue({});
    const evaluated = await recordCaioInitializationAssessment({
      workspaceId: "workspace-1",
      mandateRecordId: "mandate-1",
      evaluationKey: "evaluation-before-revocation",
      actorUserId: "owner-1",
      now: NOW,
    });
    const assessment = evaluated.assessment;
    const revoked = revokedReceipt(assessment);
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );
    dbMock.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ id: "workspace-1" }])
      .mockResolvedValueOnce([
        {
          workspaceId: "workspace-1",
          currentAssessmentId: assessment.assessmentId,
          currentReceiptId: revoked.receiptId,
          sequence: revoked.sequence,
          version: 2,
        },
      ]);
    dbMock.caioInitializationGateReceipt.findFirst
      .mockResolvedValueOnce(receiptRow(revoked))
      .mockResolvedValueOnce(receiptRow(acceptedReceipt(assessment)));

    await expect(
      acceptCaioInitializationGate({
        workspaceId: "workspace-1",
        assessmentId: assessment.assessmentId,
        actorUserId: "owner-1",
        ceoPrincipalRef: "ceo-1",
        idempotencyKey: "accept-after-revoke-1",
        inventoryConfirmationRef: "confirmation:inventory:2",
        customerAcceptanceRef: "acceptance:customer:2",
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: ["evidence:acceptance:2"],
        now: new Date(NOW.getTime() + 2_000),
      }),
    ).rejects.toThrow(
      "caio_initialization_revoked_assessment_requires_newer_reassessment",
    );

    expect(
      dbMock.caioInitializationGateReceipt.create,
    ).not.toHaveBeenCalled();
    expect(dbMock.caioInitializationGateHead.updateMany).not.toHaveBeenCalled();
  });

  it("allows a live successor CEO to revoke an accepted gate without requiring an active mandate", async () => {
    const assessment = readyAssessment();
    const accepted = acceptedReceipt(assessment);
    dbMock.caioActiveMandateClaim.findFirst.mockResolvedValue(null);
    dbMock.caioPrincipalBinding.findFirst.mockResolvedValue({
      id: "binding-2",
      workspaceId: "workspace-1",
      userId: "owner-2",
      principalRef: "ceo-2",
      principalKind: "ceo",
      revokedAt: null,
    });
    dbMock.$queryRaw
      .mockResolvedValueOnce([{ id: "workspace-1" }])
      .mockResolvedValueOnce([
        {
          workspaceId: "workspace-1",
          currentAssessmentId: assessment.assessmentId,
          currentReceiptId: accepted.receiptId,
          sequence: 1,
          version: 1,
        },
      ]);
    dbMock.caioInitializationGateReceipt.findFirst.mockResolvedValue(
      receiptRow(accepted),
    );
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );
    dbMock.caioInitializationGateReceipt.create.mockResolvedValue({});
    dbMock.caioInitializationGateHead.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await revokeCaioInitializationGate({
      workspaceId: "workspace-1",
      actorUserId: "owner-2",
      ceoPrincipalRef: "ceo-2",
      idempotencyKey: "revoke-1",
      reasonCodes: ["source_authorization_changed"],
      evidenceRefs: ["evidence:revocation:1"],
      now: NOW,
    });

    expect(result.replayed).toBe(false);
    expect(result.receipt.action).toBe("revoke");
    expect(result.receipt.previousReceiptRef).toBe(accepted.receiptId);
    expect(result.receipt.previousReceiptHash).toBe(accepted.contentHash);
    expect(result.receipt.authorityEffect).toBe("none");
    expect(dbMock.caioActiveMandateClaim.findFirst).not.toHaveBeenCalled();
    expect(dbMock.caioInitializationGateHead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          currentReceiptId: accepted.receiptId,
          version: 1,
        }),
        data: expect.objectContaining({
          currentReceiptId: result.receipt.receiptId,
          version: { increment: 1 },
        }),
      }),
    );
  });

  it("rejects revocation when the gate head sequence diverges from its receipt", async () => {
    const assessment = readyAssessment();
    const accepted = acceptedReceipt(assessment);
    dbMock.$queryRaw
      .mockResolvedValueOnce([{ id: "workspace-1" }])
      .mockResolvedValueOnce([
        {
          workspaceId: "workspace-1",
          currentAssessmentId: assessment.assessmentId,
          currentReceiptId: accepted.receiptId,
          sequence: 2,
          version: 1,
        },
      ]);
    dbMock.caioInitializationGateReceipt.findFirst.mockResolvedValue(
      receiptRow(accepted),
    );

    await expect(
      revokeCaioInitializationGate({
        workspaceId: "workspace-1",
        actorUserId: "owner-1",
        ceoPrincipalRef: "ceo-1",
        idempotencyKey: "revoke-head-drift-1",
        reasonCodes: ["head_drift_detected"],
        evidenceRefs: ["evidence:head-drift:1"],
        now: NOW,
      }),
    ).rejects.toThrow("gate_head_binding_invalid");
  });

  it("fails closed when the persisted gate receipt hash chain is broken", async () => {
    const assessment = readyAssessment();
    const accepted = acceptedReceipt(assessment);
    const revoked = revokedReceipt(assessment);
    const { contentHash: _acceptedHash, ...acceptedSeed } = accepted;
    const tamperedSeed = {
      ...acceptedSeed,
      evidenceRefs: ["evidence:acceptance:tampered"],
    };
    const tamperedAccepted: CaioInitializationGateReceipt = {
      ...tamperedSeed,
      contentHash: sha256(canonicalJson(tamperedSeed)),
    };
    dbMock.caioInitializationGateHead.findUnique.mockResolvedValue({
      workspaceId: "workspace-1",
      currentAssessmentId: assessment.assessmentId,
      currentReceiptId: revoked.receiptId,
      sequence: revoked.sequence,
      version: 2,
    });
    dbMock.caioInitializationGateReceipt.findFirst
      .mockResolvedValueOnce(receiptRow(revoked))
      .mockResolvedValueOnce(receiptRow(tamperedAccepted));
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );

    await expect(
      getCaioInitializationGateStatus({
        workspaceId: "workspace-1",
        actorUserId: "owner-1",
        now: new Date(NOW.getTime() + 2_000),
      }),
    ).rejects.toThrow("gate_receipt_chain_hash_mismatch");
  });

  it("projects an accepted head as stale when the current evidence basis changes", async () => {
    const assessment = readyAssessment();
    const receipt = acceptedReceipt(assessment);
    dbMock.caioInitializationGateHead.findUnique.mockResolvedValue({
      workspaceId: "workspace-1",
      currentAssessmentId: assessment.assessmentId,
      currentReceiptId: receipt.receiptId,
      sequence: 1,
      version: 1,
    });
    dbMock.caioInitializationGateReceipt.findFirst.mockResolvedValue(
      receiptRow(receipt),
    );
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );

    const status = await getCaioInitializationGateStatus({
      workspaceId: "workspace-1",
      actorUserId: "owner-1",
      now: NOW,
    });

    expect(status.status).toBe("stale");
    expect(status.staleReasons).toEqual(
      expect.arrayContaining([
        "assessment_basis_changed",
        "asset_catalog_empty",
      ]),
    );
  });

  it("projects an accepted head as stale when its CEO binding is revoked", async () => {
    const assessment = readyAssessment();
    const receipt = acceptedReceipt(assessment);
    dbMock.caioInitializationGateHead.findUnique.mockResolvedValue({
      workspaceId: "workspace-1",
      currentAssessmentId: assessment.assessmentId,
      currentReceiptId: receipt.receiptId,
      sequence: 1,
      version: 1,
    });
    dbMock.caioInitializationGateReceipt.findFirst.mockResolvedValue(
      receiptRow(receipt),
    );
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );
    dbMock.caioPrincipalBinding.findFirst.mockResolvedValue(null);

    const status = await getCaioInitializationGateStatus({
      workspaceId: "workspace-1",
      actorUserId: "owner-1",
      now: NOW,
    });

    expect(status).toMatchObject({
      status: "stale",
      staleReasons: ["ceo_principal_binding_not_live"],
    });
  });

  it("projects an accepted head as stale when the active mandate belongs to another CEO", async () => {
    const assessment = readyAssessment();
    const receipt = acceptedReceipt(assessment);
    dbMock.caioInitializationGateHead.findUnique.mockResolvedValue({
      workspaceId: "workspace-1",
      currentAssessmentId: assessment.assessmentId,
      currentReceiptId: receipt.receiptId,
      sequence: 1,
      version: 1,
    });
    dbMock.caioInitializationGateReceipt.findFirst.mockResolvedValue(
      receiptRow(receipt),
    );
    dbMock.caioInitializationAssessment.findFirst.mockResolvedValue(
      assessmentRow(assessment),
    );
    dbMock.caioActiveMandateClaim.findFirst.mockResolvedValue({
      mandateRecord: {
        ...activeMandate(),
        ceoRef: "ceo-2",
      },
    });

    const status = await getCaioInitializationGateStatus({
      workspaceId: "workspace-1",
      actorUserId: "owner-1",
      now: NOW,
    });

    expect(status).toMatchObject({
      status: "stale",
      staleReasons: ["issuing_ceo_changed"],
    });
    expect(dbMock.caioPrincipalBinding.findFirst).not.toHaveBeenCalled();
  });
});
