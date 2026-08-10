import {
  ArtifactBundleStatus,
  MembershipStatus,
  MemoryFactType,
  MemoryStatus,
  ObjectType,
  OpportunityStage,
  OpportunityType,
  RiskLevel,
  SourceType,
  WorkspaceRole,
} from "@prisma/client";

import {
  activateCaioMandate,
  createCaioMandateDraft,
  registerCaioPrincipalBinding,
} from "@/lib/caio-governance/mandate-store.service";
import { db } from "@/lib/db";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import { syntheticTemporalOperatingContextInput } from "@/lib/operating-harness/context-fixtures";
import { projectTemporalOperatingContext } from "@/lib/operating-harness/context-projector";
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
  acceptCaioInitializationGate,
  recordCaioInitializationAssessment,
} from "./caio-initialization-gate-store.service";
import {
  createDataAssetCatalogEntry,
  recordDataAssetAuthorizationReceipt,
  recordDataAssetClassificationReceipt,
  recordDataAssetConnectionReceipt,
  recordDataAssetInitializationReceipt,
} from "./data-asset-catalog.service";
import {
  beginObservationSourceRun,
  completeObservationSourceRun,
  createEnterpriseObservationProgram,
  registerObservationSource,
} from "./observation.service";
import type {
  ObservationSensitivity,
} from "./types";

const INTEGRATION_DATABASE_URL =
  process.env.CAIO_FDE_FULL_CHAIN_DATABASE_URL;
const CONFIRMED_INTEGRATION_DATABASE_NAME =
  process.env.CAIO_FDE_FULL_CHAIN_TEST_DATABASE_NAME;
const ISOLATED_DATABASE_PREFIX = "helm_caio_fde_full_chain_";
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const EVIDENCE_KIND_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;
const OUTPUT_TYPES = [
  "owner_answer",
  "operating_brief",
  "supervision_signal",
] as const;
const SENSITIVITIES = [
  "public",
  "internal",
  "confidential",
  "restricted",
] as const satisfies readonly ObservationSensitivity[];

let fixtureSequence = 0;

export type CaioFdeFullChainEvidence = Readonly<{
  evidenceRef: string;
  evidenceKind: string;
  observedAt: string;
  validUntil: string;
}>;

export type CaioFdeFullChainScenario = Readonly<{
  label: string;
  workspaceId: string;
  workspaceRef: string;
  ownerUserId: string;
  portfolioRef: string;
  authorizationRef: string;
  evidenceSnapshotRef: string;
  asOf: string;
  validUntil: string;
  evidence: readonly CaioFdeFullChainEvidence[];
}>;

export type CaioFdeFullChainRowCounts = Readonly<{
  portfolios: number;
  generationReceipts: number;
  selectionReceipts: number;
  decisions: number;
  actions: number;
  approvals: number;
  executions: number;
}>;

type PendingEvidence = {
  evidenceKind: string;
  evidenceRef: string;
  businessEvidenceRef: string;
  sourceId: string;
  runId: string;
  assetId: string;
  authorizationReceiptId: string;
  connectionReceiptId: string;
  initializationReceiptId: string;
  schemaArtifactRef: string;
  memoryFactRef: string;
  capturedAt: Date;
  observedAt: Date;
};

function withoutMilliseconds(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/u, "Z");
}

function withContentHash<T extends Record<string, unknown>>(
  content: T,
): T & { contentHash: string } {
  return {
    ...content,
    contentHash: sha256(canonicalJson(content)),
  };
}

function safeLabel(value: string): string {
  const label = value.trim().toLowerCase().replace(/[^a-z0-9-]+/gu, "-");
  if (!label || label.length > 48) {
    throw new Error("caio_fde_full_chain_label_invalid");
  }
  return label;
}

function assertEvidenceKinds(evidenceKinds: readonly string[]): void {
  if (
    evidenceKinds.length === 0 ||
    evidenceKinds.length > 64 ||
    new Set(evidenceKinds).size !== evidenceKinds.length ||
    evidenceKinds.some((kind) => !EVIDENCE_KIND_PATTERN.test(kind))
  ) {
    throw new Error("caio_fde_full_chain_evidence_kinds_invalid");
  }
}

export function assertCaioFdeFullChainIsolatedDatabaseTarget(): void {
  if (
    !INTEGRATION_DATABASE_URL ||
    process.env.DATABASE_URL !== INTEGRATION_DATABASE_URL
  ) {
    throw new Error(
      "DATABASE_URL must equal CAIO_FDE_FULL_CHAIN_DATABASE_URL for the isolated integration test.",
    );
  }
  let databaseName = "";
  try {
    const parsed = new URL(INTEGRATION_DATABASE_URL);
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ""));
  } catch {
    throw new Error(
      "CAIO_FDE_FULL_CHAIN_DATABASE_URL must be a valid isolated MySQL URL.",
    );
  }
  if (
    !databaseName.startsWith(ISOLATED_DATABASE_PREFIX) ||
    databaseName !== CONFIRMED_INTEGRATION_DATABASE_NAME
  ) {
    throw new Error(
      "Refusing CAIO FDE full-chain test: confirm the isolated database name and use the helm_caio_fde_full_chain_ prefix.",
    );
  }
}

export async function provisionAcceptedCaioFdeG0(input: {
  label: string;
  evidenceKinds: readonly string[];
  staleEvidenceKinds?: ReadonlySet<string>;
}): Promise<CaioFdeFullChainScenario> {
  assertCaioFdeFullChainIsolatedDatabaseTarget();
  assertEvidenceKinds(input.evidenceKinds);
  const staleEvidenceKinds = input.staleEvidenceKinds ?? new Set<string>();
  if (
    [...staleEvidenceKinds].some(
      (kind) => !input.evidenceKinds.includes(kind),
    )
  ) {
    throw new Error("caio_fde_full_chain_stale_kind_invalid");
  }

  const baseLabel = safeLabel(input.label);
  const suffix = `${baseLabel}-${process.pid}-${Date.now()}-${++fixtureSequence}`;
  const authorizationToken = sha256(`authorization:${suffix}`)
    .replace(/^sha256:/u, "")
    .slice(0, 24)
    .replace(/(.{4})(?=.)/gu, "$1-");
  const programAuthorizationRef =
    `authorization:fde-full-chain-${authorizationToken}`;
  const base = new Date(Math.floor(Date.now() / 1_000) * 1_000);
  const validFrom = new Date(base.getTime() - 4 * HOUR_MS);
  const validUntil = new Date(base.getTime() + 24 * HOUR_MS);
  const windowStart = new Date(base.getTime() - 3 * HOUR_MS);
  const windowEnd = new Date(base.getTime() - 15_000);
  const observedAt = new Date(base.getTime() - 20_000);
  const ownerEmail = `caio-fde-owner-${suffix}@example.test`;
  const ceoRef = `ceo-caio-fde-owner-${suffix}`;

  const workspace = await db.workspace.create({
    data: {
      name: `CAIO FDE full-chain ${suffix}`,
      slug: `caio-fde-full-chain-${suffix}`,
    },
  });
  const owner = await db.user.create({
    data: { name: "CAIO FDE Test Owner", email: ownerEmail },
  });
  await db.membership.create({
    data: {
      workspaceId: workspace.id,
      userId: owner.id,
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });
  const portfolio = await db.opportunity.create({
    data: {
      workspaceId: workspace.id,
      ownerId: owner.id,
      title: `CAIO FDE governed Portfolio ${suffix}`,
      type: OpportunityType.INTERNAL,
      stage: OpportunityStage.ADVANCING,
      riskLevel: RiskLevel.HIGH,
      nextAction: "Review the evidence-bound operating questions",
    },
  });
  const portfolioRef = `opportunity:${portfolio.id}`;

  await registerCaioPrincipalBinding({
    workspaceId: workspace.id,
    actorUserId: owner.id,
    userId: owner.id,
    principalRef: ceoRef,
    principalKind: "ceo",
    evidenceRef: `evidence:ceo-binding-${suffix}`,
  });
  const mandate = await createCaioMandateDraft({
    workspaceId: workspace.id,
    actorUserId: owner.id,
    caioRef: `caio:fde-full-chain-${suffix}`,
    ceoRef,
    stage: "observe",
    stageDecisionRef: `stage-decision:fde-full-chain-${suffix}`,
    objectiveRefs: ["objective:initialize-company-truth"],
    scopeRefs: [portfolioRef],
    grantBasisRefs: [`caio-mandate-grant:${ceoRef}:${suffix}`],
    reservedMatterRefs: ["reserved:external-side-effects"],
    humanResponsePolicyRef: "policy:human-response-v1",
    accountabilityAnchorRefs: ["anchor:ceo"],
    guardianStopRefs: [],
    validFrom: withoutMilliseconds(validFrom),
    validUntil: withoutMilliseconds(validUntil),
    inFlightDisposition: "freeze",
    auditRefs: [`audit:fde-full-chain-mandate-${suffix}`],
  });
  const activeMandate = await activateCaioMandate({
    workspaceId: workspace.id,
    actorUserId: owner.id,
    actorCeoRef: ceoRef,
    mandateRecordId: mandate.mandateId,
  });
  const program = await createEnterpriseObservationProgram({
    workspaceId: workspace.id,
    purpose: "Observe a public-safe synthetic FDE evidence inventory",
    scopeRefs: [portfolioRef],
    dataCategories: ["synthetic-operating-record"],
    startsAt: validFrom,
    expiresAt: validUntil,
    retentionDays: 30,
    authorizationRef: programAuthorizationRef,
    actorName: "CAIO FDE Test Owner",
    actorUserId: owner.id,
  });

  const contextInput = syntheticTemporalOperatingContextInput();
  const contextProjection = projectTemporalOperatingContext(contextInput);
  if (!contextProjection.snapshot) {
    throw new Error("caio_fde_full_chain_temporal_projection_failed");
  }
  const contextArtifactId = `context-${suffix}`;
  const contextArtifactRef = `artifact-bundle:${contextArtifactId}`;
  const contextArtifact = withContentHash({
    schemaVersion: CAIO_TEMPORAL_CONTEXT_ARTIFACT_SCHEMA_VERSION,
    artifactRef: contextArtifactRef,
    workspaceRef: `workspace:${workspace.id}`,
    projectionInput: contextInput,
    snapshot: contextProjection.snapshot,
    projectionInputHash: sha256(canonicalJson(contextInput)),
    snapshotHash: contextProjection.snapshot.contentHash,
    replayRootHash: contextProjection.snapshot.replayRootHash,
  });
  await db.artifactBundle.create({
    data: {
      id: contextArtifactId,
      workspaceId: workspace.id,
      artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.temporalContext,
      title: "Synthetic FDE temporal context",
      status: ArtifactBundleStatus.CONFIRMED,
      artifactsJson: JSON.stringify(contextArtifact),
      systemOfRecordWrite: false,
      createdAt: new Date(base.getTime() - 4 * MINUTE_MS),
    },
  });

  const pending: PendingEvidence[] = [];
  const memoryBindings: Array<{ ref: string; contentHash: string }> = [];
  for (const [index, evidenceKind] of input.evidenceKinds.entries()) {
    const asset = await createDataAssetCatalogEntry({
      workspaceId: workspace.id,
      assetKey: `asset-${index + 1}-${suffix}`,
      sourceSystemRef: `system:synthetic-${index + 1}-${suffix}`,
      displayName: `Synthetic ${evidenceKind}`,
      sourceKind: `caio_fde_${evidenceKind}`,
      businessDomain: index % 2 === 0 ? "operations" : "delivery",
      businessOwnerRef: owner.id,
      purpose: `Observe the ${evidenceKind} evidence dimension`,
      scopeRefs: [portfolioRef],
      recommendedAccessMode: "read_only_api",
      retentionDays: 30,
      freshnessSlaMinutes: 60,
      residencyRequirements: ["region:test"],
      blindSpots: [],
      blockerCodes: [],
      riskOwnerRef: owner.id,
      nextReviewAt: validUntil,
      evidenceRefs: [`evidence:inventory-${index + 1}-${suffix}`],
      actorName: "CAIO FDE Test Owner",
      actorUserId: owner.id,
      now: validFrom,
    });
    await recordDataAssetClassificationReceipt({
      workspaceId: workspace.id,
      assetId: asset.id,
      receiptId: `classification-${index + 1}-${suffix}`,
      idempotencyKey: `classification:${index + 1}:${suffix}`,
      expectedVersion: 1,
      dataShape: "structured",
      sensitivity: SENSITIVITIES[index % SENSITIVITIES.length],
      processingDisposition: "local_only",
      technicalFeasibility: "feasible",
      evidenceRefs: [`evidence:classification-${index + 1}-${suffix}`],
      actorName: "CAIO FDE Test Owner",
      actorUserId: owner.id,
      now: validFrom,
    });
    const authorizationReceiptId = `authorization-${index + 1}-${suffix}`;
    await recordDataAssetAuthorizationReceipt({
      workspaceId: workspace.id,
      assetId: asset.id,
      receiptId: authorizationReceiptId,
      idempotencyKey: `authorization:${index + 1}:${suffix}`,
      expectedVersion: 2,
      authorizationStatus: "authorized",
      authorizationRef: program.authorizationRef,
      scopeRefs: [portfolioRef],
      consentRefs: [],
      validFrom,
      validUntil,
      reasonCodes: [],
      evidenceRefs: [`evidence:authorization-${index + 1}-${suffix}`],
      actorName: "CAIO FDE Test Owner",
      actorUserId: owner.id,
      now: validFrom,
    });
    const source = await registerObservationSource({
      workspaceId: workspace.id,
      programId: program.id,
      catalogEntryId: asset.id,
      sourceKey: `source-${index + 1}-${suffix}`,
      sourceKind: `caio_fde_${evidenceKind}`,
      accessMode: "read_only_api",
      ownerRef: owner.id,
      freshnessSlaMinutes: 60,
      sensitivity: SENSITIVITIES[index % SENSITIVITIES.length],
      authorizationRef: program.authorizationRef,
      secretRef: `secret-manager:synthetic-${index + 1}-${suffix}`,
      retentionDays: 30,
      actorName: "CAIO FDE Test Owner",
      actorUserId: owner.id,
      now: validFrom,
    });
    const connectionReceiptId = `connection-${index + 1}-${suffix}`;
    await recordDataAssetConnectionReceipt({
      workspaceId: workspace.id,
      assetId: asset.id,
      receiptId: connectionReceiptId,
      idempotencyKey: `connection:${index + 1}:${suffix}`,
      expectedVersion: 3,
      connectionStatus: "connected",
      accessMode: "read_only_api",
      connectorRef: `connector:synthetic-${index + 1}-${suffix}`,
      secretRef: `secret-manager:synthetic-${index + 1}-${suffix}`,
      authorizationReceiptRef: authorizationReceiptId,
      observationSourceRef: source.id,
      reasonCodes: [],
      evidenceRefs: [`evidence:connection-${index + 1}-${suffix}`],
      actorName: "CAIO FDE Test Owner",
      actorUserId: owner.id,
      now: validFrom,
    });
    const run = await beginObservationSourceRun({
      workspaceId: workspace.id,
      sourceKey: source.sourceKey,
      executionKey: `window-${index + 1}-${suffix}`,
      windowStart,
      windowEnd,
      now: new Date(windowEnd.getTime() + 1_000),
    });
    const businessEvidenceRef = `evidence:fde-${index + 1}-${suffix}`;
    const evidenceRef = `observation-run:${run.id}`;
    const capturedAt = staleEvidenceKinds.has(evidenceKind)
      ? new Date(base.getTime() - 2 * HOUR_MS)
      : new Date(base.getTime() - 30_000);

    const memory = await db.memoryFact.create({
      data: {
        workspaceId: workspace.id,
        objectType: ObjectType.COMPANY,
        objectId: `company:fde-${index + 1}-${suffix}`,
        factType: MemoryFactType.SUMMARY,
        title: `Synthetic ${evidenceKind} fact`,
        content: `Synthetic governed fact for ${evidenceKind}`,
        sourceType: SourceType.SYSTEM_INFERENCE,
        sourceId: source.id,
        confidence: 90,
        importance: 80,
        freshnessScore: 100,
        status: MemoryStatus.ACTIVE,
        confirmedByUser: true,
        createdBySystem: true,
        createdAt: capturedAt,
        updatedAt: capturedAt,
      },
    });
    const memoryBinding = {
      ref: `memory-fact:${memory.id}`,
      contentHash: sha256(
        canonicalJson({
          id: memory.id,
          objectType: String(memory.objectType),
          objectId: memory.objectId,
          factType: String(memory.factType),
          title: memory.title,
          content: memory.content,
          normalizedValue: memory.normalizedValue,
          sourceType: String(memory.sourceType),
          sourceId: memory.sourceId,
          confidence: memory.confidence,
          importance: memory.importance,
          freshnessScore: memory.freshnessScore,
          status: String(memory.status),
          confirmedByUser: memory.confirmedByUser,
          createdBySystem: memory.createdBySystem,
          createdAt: memory.createdAt.toISOString(),
          updatedAt: memory.updatedAt.toISOString(),
        }),
      ),
    };
    memoryBindings.push(memoryBinding);

    const schemaArtifactId = `schema-${index + 1}-${suffix}`;
    const schemaArtifactRef = `artifact-bundle:${schemaArtifactId}`;
    const schemaMapping = withContentHash({
      schemaVersion: CAIO_SCHEMA_MAPPING_SCHEMA_VERSION,
      artifactRef: schemaArtifactRef,
      assetRef: asset.id,
      sourceSchemaHash: sha256(`source-schema:${index + 1}:${suffix}`),
      targetSchemaHash: sha256(`target-schema:${index + 1}:${suffix}`),
      mappingHash: sha256(`mapping:${index + 1}:${suffix}`),
      generatedAt: capturedAt.toISOString(),
    });
    await db.artifactBundle.create({
      data: {
        id: schemaArtifactId,
        workspaceId: workspace.id,
        artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.schemaMapping,
        title: `Synthetic schema mapping ${index + 1}`,
        status: ArtifactBundleStatus.CONFIRMED,
        artifactsJson: JSON.stringify(schemaMapping),
        systemOfRecordWrite: false,
        createdAt: capturedAt,
      },
    });

    const initializationReceiptId = `initialization-${index + 1}-${suffix}`;
    pending.push({
      evidenceKind,
      evidenceRef,
      businessEvidenceRef,
      sourceId: source.id,
      runId: run.id,
      assetId: asset.id,
      authorizationReceiptId,
      connectionReceiptId,
      initializationReceiptId,
      schemaArtifactRef,
      memoryFactRef: memoryBinding.ref,
      capturedAt,
      observedAt,
    });
  }

  const declaredEvidenceRefs = pending.map((item) => item.evidenceRef);
  const snapshotRunId = pending.at(-1)?.runId;
  if (!snapshotRunId) {
    throw new Error("caio_fde_full_chain_snapshot_missing");
  }
  for (const [index, item] of pending.entries()) {
    await completeObservationSourceRun({
      workspaceId: workspace.id,
      runId: item.runId,
      observedAt: item.observedAt,
      summaryHash: sha256(`synthetic-window:${item.runId}`),
      completenessPercent: 100,
      freshness: "fresh",
      outcome: "success",
      evidenceRefs: [
        portfolioRef,
        item.businessEvidenceRef,
        ...(item.runId === snapshotRunId ? declaredEvidenceRefs : []),
      ],
      errorCodes: [],
    });

    await recordDataAssetInitializationReceipt({
      workspaceId: workspace.id,
      assetId: item.assetId,
      receiptId: item.initializationReceiptId,
      idempotencyKey: `initialization:${index + 1}:${suffix}`,
      expectedVersion: 4,
      initializationStatus: "initialized",
      connectionReceiptRef: item.connectionReceiptId,
      observationRunRefs: [item.runId],
      schemaMappingRefs: [item.schemaArtifactRef],
      companyMemoryRefs: [item.memoryFactRef],
      temporalContextSnapshotRef: contextArtifactRef,
      reasonCodes: [],
      evidenceRefs: [`evidence:initialization-${index + 1}-${suffix}`],
      actorName: "CAIO FDE Test Owner",
      actorUserId: owner.id,
      now: new Date(base.getTime() - 2 * MINUTE_MS),
    });

    const traceSeed = {
      schemaVersion: CAIO_EVIDENCE_TRACE_SCHEMA_VERSION,
      evidenceRef: item.businessEvidenceRef,
      evidenceKind: item.evidenceKind,
      sourceRef: item.sourceId,
      assetRef: item.assetId,
      observationRunRef: item.runId,
      authorizationReceiptRef: item.authorizationReceiptId,
      connectionReceiptRef: item.connectionReceiptId,
      initializationReceiptRef: item.initializationReceiptId,
      sensitivity: SENSITIVITIES[index % SENSITIVITIES.length],
      outputType: OUTPUT_TYPES[index % OUTPUT_TYPES.length],
      capturedAt: item.capturedAt.toISOString(),
      resolved: true,
    };
    await db.artifactBundle.create({
      data: {
        id: `trace-${index + 1}-${suffix}`,
        workspaceId: workspace.id,
        artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.evidenceTrace,
        title: `Synthetic evidence trace ${index + 1}`,
        status: ArtifactBundleStatus.CONFIRMED,
        artifactsJson: JSON.stringify({
          ...traceSeed,
          traceHash: computeCaioEvidenceTraceHash(traceSeed),
        }),
        systemOfRecordWrite: false,
        createdAt: item.capturedAt,
      },
    });
  }

  const orderedMemoryBindings = [...memoryBindings].sort((left, right) =>
    left.ref.localeCompare(right.ref),
  );
  const memoryArtifactId = `memory-rebuild-${suffix}`;
  const memoryReceipt = withContentHash({
    schemaVersion: CAIO_MEMORY_REBUILD_RECEIPT_SCHEMA_VERSION,
    artifactRef: `artifact-bundle:${memoryArtifactId}`,
    receiptRef: `receipt:memory-rebuild-${suffix}`,
    workspaceRef: `workspace:${workspace.id}`,
    memoryFactBindings: orderedMemoryBindings,
    memoryRootHash: computeCaioMemoryRootHash(orderedMemoryBindings),
    rebuiltAt: new Date(base.getTime() - 3 * MINUTE_MS).toISOString(),
  });
  await db.artifactBundle.create({
    data: {
      id: memoryArtifactId,
      workspaceId: workspace.id,
      artifactType:
        CAIO_INITIALIZATION_ARTIFACT_TYPES.memoryRebuildReceipt,
      title: "Synthetic FDE memory rebuild receipt",
      status: ArtifactBundleStatus.CONFIRMED,
      artifactsJson: JSON.stringify(memoryReceipt),
      systemOfRecordWrite: false,
      createdAt: new Date(base.getTime() - 3 * MINUTE_MS),
    },
  });

  const assessment = await recordCaioInitializationAssessment({
    workspaceId: workspace.id,
    mandateRecordId: activeMandate.mandateId,
    evaluationKey: `fde-full-chain-evaluation-${suffix}`,
    actorUserId: owner.id,
    now: base,
  });
  if (
    assessment.assessment.decision !== "ready_for_owner_acceptance" ||
    assessment.assessment.failures.length > 0
  ) {
    throw new Error(
      `caio_fde_full_chain_g0_not_ready:${assessment.assessment.failures.join(",")}`,
    );
  }
  const accepted = await acceptCaioInitializationGate({
    workspaceId: workspace.id,
    assessmentId: assessment.assessment.assessmentId,
    actorUserId: owner.id,
    ceoPrincipalRef: ceoRef,
    idempotencyKey: `fde-full-chain-accept-${suffix}`,
    inventoryConfirmationRef: `confirmation:inventory-${suffix}`,
    customerAcceptanceRef: `acceptance:owner-${suffix}`,
    acceptedExceptionRefs: [],
    reasonCodes: ["initialization_reviewed"],
    evidenceRefs: [`evidence:g0-acceptance-${suffix}`],
    now: new Date(base.getTime() + 1_000),
  });
  if (accepted.receipt.resultingStatus !== "accepted") {
    throw new Error("caio_fde_full_chain_g0_not_accepted");
  }

  return Object.freeze({
    label: suffix,
    workspaceId: workspace.id,
    workspaceRef: `workspace:${workspace.id}`,
    ownerUserId: owner.id,
    portfolioRef,
    authorizationRef: program.authorizationRef,
    evidenceSnapshotRef: `observation-run:${snapshotRunId}`,
    asOf: base.toISOString(),
    validUntil: validUntil.toISOString(),
    evidence: Object.freeze(
      pending.map((item) =>
        Object.freeze({
          evidenceRef: item.evidenceRef,
          evidenceKind: item.evidenceKind,
          observedAt: item.observedAt.toISOString(),
          validUntil: validUntil.toISOString(),
        }),
      ),
    ),
  });
}

export async function setCaioFdeFullChainObservationOutcome(input: {
  workspaceId: string;
  evidenceRef: string;
  outcome: "partial_success" | "failure";
}): Promise<void> {
  assertCaioFdeFullChainIsolatedDatabaseTarget();
  const prefix = "observation-run:";
  if (!input.evidenceRef.startsWith(prefix)) {
    throw new Error("caio_fde_full_chain_observation_ref_invalid");
  }
  const runId = input.evidenceRef.slice(prefix.length);
  if (!runId) {
    throw new Error("caio_fde_full_chain_observation_ref_invalid");
  }
  const terminalState =
    input.outcome === "partial_success"
      ? ({ status: "PARTIAL", outcome: "PARTIAL_SUCCESS" } as const)
      : ({ status: "FAILED", outcome: "FAILURE" } as const);
  const updated = await db.observationSourceRun.updateMany({
    where: {
      id: runId,
      workspaceId: input.workspaceId,
      status: { in: ["SUCCEEDED", "PARTIAL", "FAILED"] },
    },
    data: terminalState,
  });
  if (updated.count !== 1) {
    throw new Error("caio_fde_full_chain_observation_run_not_found");
  }
}

export async function countCaioFdeFullChainRows(
  workspaceId: string,
): Promise<CaioFdeFullChainRowCounts> {
  const [
    portfolios,
    generationReceipts,
    selectionReceipts,
    decisions,
    actions,
    approvals,
    executions,
  ] = await Promise.all([
    db.caioOperatingQuestionPortfolio.count({ where: { workspaceId } }),
    db.caioOperatingQuestionGenerationReceipt.count({
      where: { workspaceId },
    }),
    db.caioQuestionSelectionReceipt.count({ where: { workspaceId } }),
    db.decisionRecord.count({ where: { workspaceId } }),
    db.actionItem.count({ where: { workspaceId } }),
    db.approvalTask.count({ where: { workspaceId } }),
    db.executionReceipt.count({ where: { workspaceId } }),
  ]);
  return {
    portfolios,
    generationReceipts,
    selectionReceipts,
    decisions,
    actions,
    approvals,
    executions,
  };
}

export async function disconnectCaioFdeFullChainFixture(): Promise<void> {
  await db.$disconnect();
}
