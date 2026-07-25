import {
  ArtifactBundleStatus,
  MembershipStatus,
  MemoryFactType,
  MemoryStatus,
  ObjectType,
  SourceType,
  WorkspaceRole,
} from "@prisma/client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const auditFaultState = vi.hoisted(() => ({
  failActionType: null as string | null,
}));
const policyInterleaveState = vi.hoisted(() => ({
  afterAccess: null as (() => Promise<void>) | null,
}));

vi.mock("@/lib/audit", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return {
    ...actual,
    writeAuditLog: async (...args: Parameters<typeof actual.writeAuditLog>) => {
      if (auditFaultState.failActionType === args[0].actionType) {
        throw new Error("injected_audit_failure");
      }
      return actual.writeAuditLog(...args);
    },
  };
});

vi.mock("@/lib/auth/service-governance", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/auth/service-governance")
  >("@/lib/auth/service-governance");
  return {
    ...actual,
    assertWorkspacePolicyServiceAccess: async (
      ...args: Parameters<typeof actual.assertWorkspacePolicyServiceAccess>
    ) => {
      const result = await actual.assertWorkspacePolicyServiceAccess(...args);
      const afterAccess = policyInterleaveState.afterAccess;
      if (afterAccess) {
        policyInterleaveState.afterAccess = null;
        await afterAccess();
      }
      return result;
    },
  };
});

import {
  activateCaioMandate,
  createCaioMandateDraft,
  registerCaioPrincipalBinding,
} from "@/lib/caio-governance/mandate-store.service";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
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
  getCaioInitializationGateStatus,
  recordCaioInitializationAssessment,
  revokeCaioInitializationGate,
} from "./caio-initialization-gate-store.service";
import type { CaioInitializationGateReceipt } from "./caio-initialization-gate-receipt";
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

const integrationDatabaseUrl =
  process.env.CAIO_INITIALIZATION_GATE_DATABASE_URL;
const confirmedIntegrationDatabaseName =
  process.env.CAIO_INITIALIZATION_GATE_TEST_DATABASE_NAME;
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const CEO_REF = `ceo-g0-${suffix}`;
const EVIDENCE_REF = `evidence:g0-owner-answer:${suffix}`;
const WORKSPACE_SLUG = `caio-g0-integration-${suffix}`;
const OWNER_EMAIL = `caio-g0-owner-${suffix}@example.test`;
const ISOLATED_DATABASE_PREFIX = "helm_caio_stage1_";

function assertIsolatedDatabaseTarget(): void {
  if (
    !integrationDatabaseUrl ||
    process.env.DATABASE_URL !== integrationDatabaseUrl
  ) {
    throw new Error(
      "DATABASE_URL must equal CAIO_INITIALIZATION_GATE_DATABASE_URL for the isolated integration test.",
    );
  }
  let databaseName = "";
  try {
    const parsed = new URL(integrationDatabaseUrl);
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ""));
  } catch {
    throw new Error(
      "CAIO_INITIALIZATION_GATE_DATABASE_URL must be a valid isolated MySQL URL.",
    );
  }
  if (
    !databaseName.startsWith(ISOLATED_DATABASE_PREFIX) ||
    databaseName !== confirmedIntegrationDatabaseName
  ) {
    throw new Error(
      "Refusing CAIO G0 integration test: confirm the isolated database name with CAIO_INITIALIZATION_GATE_TEST_DATABASE_NAME and use the helm_caio_stage1_ prefix.",
    );
  }
}

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

async function resetGateLedger(workspaceId: string): Promise<void> {
  await runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await tx.caioInitializationGateHead.deleteMany({
          where: { workspaceId },
        });
        const receipts = await tx.caioInitializationGateReceipt.findMany({
          where: { workspaceId },
          orderBy: { sequence: "desc" },
          select: { id: true },
        });
        for (const receipt of receipts) {
          await tx.caioInitializationGateReceipt.delete({
            where: { id: receipt.id },
          });
        }
        await tx.auditLog.deleteMany({
          where: {
            workspaceId,
            actionType: {
              in: [
                "CAIO_INITIALIZATION_GATE_ACCEPTED",
                "CAIO_INITIALIZATION_GATE_REVOKED",
              ],
            },
          },
        });
      }),
    { maxAttempts: 8, retryDelayMs: 50 },
  );
}

describeMysql(
  "CAIO initialization gate with an isolated MySQL database",
  () => {
    let workspaceId = "";
    let ownerUserId = "";
    let mandateRecordId = "";
    let assessmentId = "";
    let evaluatedAt = new Date(0);

    beforeAll(async () => {
      assertIsolatedDatabaseTarget();
      evaluatedAt = new Date(Math.floor(Date.now() / 1_000) * 1_000);
      const validFrom = new Date(evaluatedAt.getTime() - 60 * 60_000);
      const validUntil = new Date(evaluatedAt.getTime() + 24 * 60 * 60_000);
      const windowStart = new Date(evaluatedAt.getTime() - 10 * 60_000);
      const windowEnd = new Date(evaluatedAt.getTime() - 5 * 60_000);
      const observedAt = new Date(evaluatedAt.getTime() - 4 * 60_000);

      const workspace = await db.workspace.create({
        data: {
          name: `CAIO G0 integration ${suffix}`,
          slug: WORKSPACE_SLUG,
        },
      });
      const owner = await db.user.create({
        data: {
          name: "CAIO G0 Owner",
          email: OWNER_EMAIL,
        },
      });
      workspaceId = workspace.id;
      ownerUserId = owner.id;
      await db.membership.create({
        data: {
          workspaceId,
          userId: ownerUserId,
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });

      await registerCaioPrincipalBinding({
        workspaceId,
        actorUserId: ownerUserId,
        userId: ownerUserId,
        principalRef: CEO_REF,
        principalKind: "ceo",
        evidenceRef: `evidence:ceo-binding:${suffix}`,
      });
      const mandate = await createCaioMandateDraft({
        workspaceId,
        actorUserId: ownerUserId,
        caioRef: "caio:synthetic-g0",
        ceoRef: CEO_REF,
        stage: "observe",
        stageDecisionRef: `stage-decision:g0:${suffix}`,
        objectiveRefs: ["objective:initialize-company-truth"],
        scopeRefs: ["scope:read-only-observation"],
        grantBasisRefs: [`caio-mandate-grant:${CEO_REF}:g0-${suffix}`],
        reservedMatterRefs: ["reserved:external-side-effects"],
        humanResponsePolicyRef: "policy:human-response-v1",
        accountabilityAnchorRefs: ["anchor:ceo"],
        guardianStopRefs: [],
        validFrom: withoutMilliseconds(validFrom),
        validUntil: withoutMilliseconds(validUntil),
        inFlightDisposition: "freeze",
        auditRefs: [`audit:g0-mandate:${suffix}`],
      });
      const activeMandate = await activateCaioMandate({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        mandateRecordId: mandate.mandateId,
      });
      mandateRecordId = activeMandate.mandateId;

      const program = await createEnterpriseObservationProgram({
        workspaceId,
        purpose: "Observe synthetic CRM evidence for the G0 integration gate",
        scopeRefs: ["scope:synthetic-crm"],
        dataCategories: ["synthetic-opportunity"],
        startsAt: validFrom,
        expiresAt: validUntil,
        retentionDays: 30,
        authorizationRef: `authorization:g0:${suffix}`,
        actorName: "CAIO G0 Owner",
        actorUserId: ownerUserId,
      });
      const catalog = await createDataAssetCatalogEntry({
        workspaceId,
        assetKey: `asset-g0-${suffix}`,
        sourceSystemRef: `system:synthetic-crm:${suffix}`,
        displayName: "Synthetic G0 CRM",
        sourceKind: "crm",
        businessDomain: "sales",
        businessOwnerRef: ownerUserId,
        purpose: "Provide synthetic read-only evidence for G0",
        scopeRefs: ["scope:synthetic-crm"],
        recommendedAccessMode: "read_only_api",
        retentionDays: 30,
        freshnessSlaMinutes: 60,
        residencyRequirements: ["region:test"],
        blindSpots: [],
        blockerCodes: [],
        riskOwnerRef: ownerUserId,
        nextReviewAt: validUntil,
        evidenceRefs: [`evidence:inventory:${suffix}`],
        actorName: "CAIO G0 Owner",
        actorUserId: ownerUserId,
        now: validFrom,
      });
      await recordDataAssetClassificationReceipt({
        workspaceId,
        assetId: catalog.id,
        receiptId: `classification-g0-${suffix}`,
        idempotencyKey: `classification:g0:${suffix}`,
        expectedVersion: 1,
        dataShape: "structured",
        sensitivity: "confidential",
        processingDisposition: "local_only",
        technicalFeasibility: "feasible",
        evidenceRefs: [`evidence:classification:${suffix}`],
        actorName: "CAIO G0 Owner",
        actorUserId: ownerUserId,
        now: validFrom,
      });
      const authorizationReceiptId = `authorization-g0-${suffix}`;
      await recordDataAssetAuthorizationReceipt({
        workspaceId,
        assetId: catalog.id,
        receiptId: authorizationReceiptId,
        idempotencyKey: `authorization:g0:${suffix}`,
        expectedVersion: 2,
        authorizationStatus: "authorized",
        authorizationRef: program.authorizationRef,
        scopeRefs: ["scope:synthetic-crm"],
        consentRefs: [],
        validFrom,
        validUntil,
        reasonCodes: [],
        evidenceRefs: [`evidence:authorization:${suffix}`],
        actorName: "CAIO G0 Owner",
        actorUserId: ownerUserId,
        now: validFrom,
      });
      const source = await registerObservationSource({
        workspaceId,
        programId: program.id,
        catalogEntryId: catalog.id,
        sourceKey: `source-g0-${suffix}`,
        sourceKind: "crm",
        accessMode: "read_only_api",
        ownerRef: ownerUserId,
        freshnessSlaMinutes: 60,
        sensitivity: "confidential",
        authorizationRef: program.authorizationRef,
        secretRef: `secret-manager:synthetic-g0-${suffix}`,
        retentionDays: 30,
        actorName: "CAIO G0 Owner",
        actorUserId: ownerUserId,
        now: windowStart,
      });
      const connectionReceiptId = `connection-g0-${suffix}`;
      await recordDataAssetConnectionReceipt({
        workspaceId,
        assetId: catalog.id,
        receiptId: connectionReceiptId,
        idempotencyKey: `connection:g0:${suffix}`,
        expectedVersion: 3,
        connectionStatus: "connected",
        accessMode: "read_only_api",
        connectorRef: `connector:synthetic-g0-${suffix}`,
        secretRef: `secret-manager:synthetic-g0-${suffix}`,
        authorizationReceiptRef: authorizationReceiptId,
        observationSourceRef: source.id,
        reasonCodes: [],
        evidenceRefs: [`evidence:connection:${suffix}`],
        actorName: "CAIO G0 Owner",
        actorUserId: ownerUserId,
        now: windowStart,
      });
      const run = await beginObservationSourceRun({
        workspaceId,
        sourceKey: source.sourceKey,
        executionKey: `g0-window-${suffix}`,
        windowStart,
        windowEnd,
        now: new Date(windowEnd.getTime() + 1_000),
      });
      await completeObservationSourceRun({
        workspaceId,
        runId: run.id,
        observedAt,
        summaryHash: sha256(`synthetic-g0-window:${suffix}`),
        completenessPercent: 100,
        freshness: "fresh",
        outcome: "success",
        evidenceRefs: [EVIDENCE_REF],
        errorCodes: [],
      });

      const memory = await db.memoryFact.create({
        data: {
          workspaceId,
          objectType: ObjectType.COMPANY,
          objectId: `company:synthetic-g0:${suffix}`,
          factType: MemoryFactType.SUMMARY,
          title: "Synthetic G0 operating fact",
          content: "Synthetic company evidence for the G0 integration test",
          sourceType: SourceType.SYSTEM_INFERENCE,
          sourceId: source.id,
          confidence: 90,
          importance: 90,
          freshnessScore: 100,
          status: MemoryStatus.ACTIVE,
          confirmedByUser: true,
          createdBySystem: true,
          createdAt: observedAt,
          updatedAt: observedAt,
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
      const schemaArtifactId = `schema-g0-${suffix}`;
      const schemaArtifactRef = `artifact-bundle:${schemaArtifactId}`;
      const schemaMapping = withContentHash({
        schemaVersion: CAIO_SCHEMA_MAPPING_SCHEMA_VERSION,
        artifactRef: schemaArtifactRef,
        assetRef: catalog.id,
        sourceSchemaHash: sha256(`source-schema:${suffix}`),
        targetSchemaHash: sha256(`target-schema:${suffix}`),
        mappingHash: sha256(`mapping:${suffix}`),
        generatedAt: observedAt.toISOString(),
      });
      const memoryArtifactId = `memory-rebuild-g0-${suffix}`;
      const memoryReceipt = withContentHash({
        schemaVersion: CAIO_MEMORY_REBUILD_RECEIPT_SCHEMA_VERSION,
        artifactRef: `artifact-bundle:${memoryArtifactId}`,
        receiptRef: `receipt:memory-rebuild:${suffix}`,
        workspaceRef: `workspace:${workspaceId}`,
        memoryFactBindings: [memoryBinding],
        memoryRootHash: computeCaioMemoryRootHash([memoryBinding]),
        rebuiltAt: observedAt.toISOString(),
      });
      const contextInput = syntheticTemporalOperatingContextInput();
      const contextProjection = projectTemporalOperatingContext(contextInput);
      if (!contextProjection.snapshot) {
        throw new Error("synthetic temporal context projection failed");
      }
      const contextArtifactId = `context-g0-${suffix}`;
      const contextArtifactRef = `artifact-bundle:${contextArtifactId}`;
      const context = withContentHash({
        schemaVersion: CAIO_TEMPORAL_CONTEXT_ARTIFACT_SCHEMA_VERSION,
        artifactRef: contextArtifactRef,
        workspaceRef: `workspace:${workspaceId}`,
        projectionInput: contextInput,
        snapshot: contextProjection.snapshot,
        projectionInputHash: sha256(canonicalJson(contextInput)),
        snapshotHash: contextProjection.snapshot.contentHash,
        replayRootHash: contextProjection.snapshot.replayRootHash,
      });
      await db.artifactBundle.createMany({
        data: Array.from({ length: 1_001 }, (_, index) => ({
          id: `noise-g0-${suffix}-${index}`,
          workspaceId,
          artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.evidenceTrace,
          title: "Synthetic stale G0 noise",
          status: ArtifactBundleStatus.DRAFT,
          artifactsJson: "{}",
          systemOfRecordWrite: false,
          createdAt: new Date(observedAt.getTime() - 60 * 60_000 - index),
        })),
      });
      await db.artifactBundle.createMany({
        data: [
          {
            id: schemaArtifactId,
            workspaceId,
            artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.schemaMapping,
            title: "Synthetic G0 schema mapping",
            status: ArtifactBundleStatus.CONFIRMED,
            artifactsJson: JSON.stringify(schemaMapping),
            systemOfRecordWrite: false,
            createdAt: observedAt,
          },
          {
            id: memoryArtifactId,
            workspaceId,
            artifactType:
              CAIO_INITIALIZATION_ARTIFACT_TYPES.memoryRebuildReceipt,
            title: "Synthetic G0 memory rebuild receipt",
            status: ArtifactBundleStatus.CONFIRMED,
            artifactsJson: JSON.stringify(memoryReceipt),
            systemOfRecordWrite: false,
            createdAt: observedAt,
          },
          {
            id: contextArtifactId,
            workspaceId,
            artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.temporalContext,
            title: "Synthetic G0 temporal context",
            status: ArtifactBundleStatus.CONFIRMED,
            artifactsJson: JSON.stringify(context),
            systemOfRecordWrite: false,
            createdAt: observedAt,
          },
        ],
      });

      const initializationReceiptId = `initialization-g0-${suffix}`;
      await recordDataAssetInitializationReceipt({
        workspaceId,
        assetId: catalog.id,
        receiptId: initializationReceiptId,
        idempotencyKey: `initialization:g0:${suffix}`,
        expectedVersion: 4,
        initializationStatus: "initialized",
        connectionReceiptRef: connectionReceiptId,
        observationRunRefs: [run.id],
        schemaMappingRefs: [schemaArtifactRef],
        companyMemoryRefs: [memoryBinding.ref],
        temporalContextSnapshotRef: contextArtifactRef,
        reasonCodes: [],
        evidenceRefs: [`evidence:initialization:${suffix}`],
        actorName: "CAIO G0 Owner",
        actorUserId: ownerUserId,
        now: new Date(evaluatedAt.getTime() - 2 * 60_000),
      });

      const traceSeed = {
        schemaVersion: CAIO_EVIDENCE_TRACE_SCHEMA_VERSION,
        evidenceRef: EVIDENCE_REF,
        sourceRef: source.id,
        assetRef: catalog.id,
        observationRunRef: run.id,
        authorizationReceiptRef: authorizationReceiptId,
        connectionReceiptRef: connectionReceiptId,
        initializationReceiptRef: initializationReceiptId,
        sensitivity: "confidential" as const,
        outputType: "owner_answer" as const,
        capturedAt: observedAt.toISOString(),
        resolved: true,
      };
      await db.artifactBundle.create({
        data: {
          id: `trace-g0-${suffix}`,
          workspaceId,
          artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.evidenceTrace,
          title: "Synthetic G0 evidence trace",
          status: ArtifactBundleStatus.CONFIRMED,
          artifactsJson: JSON.stringify({
            ...traceSeed,
            traceHash: computeCaioEvidenceTraceHash(traceSeed),
          }),
          systemOfRecordWrite: false,
          createdAt: observedAt,
        },
      });

      const evaluation = await recordCaioInitializationAssessment({
        workspaceId,
        mandateRecordId,
        evaluationKey: `g0-evaluation-${suffix}`,
        actorUserId: ownerUserId,
        now: evaluatedAt,
      });
      expect(evaluation.assessment.decision).toBe("ready_for_owner_acceptance");
      assessmentId = evaluation.assessment.assessmentId;
    });

    beforeEach(async () => {
      auditFaultState.failActionType = null;
      policyInterleaveState.afterAccess = null;
      await resetGateLedger(workspaceId);
      await db.membership.update({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: ownerUserId,
          },
        },
        data: {
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });
    });

    afterAll(async () => {
      try {
        const cleanupWorkspaceId =
          workspaceId ||
          (
            await db.workspace.findUnique({
              where: { slug: WORKSPACE_SLUG },
              select: { id: true },
            })
          )?.id ||
          "";
        const cleanupOwnerUserId =
          ownerUserId ||
          (
            await db.user.findUnique({
              where: { email: OWNER_EMAIL },
              select: { id: true },
            })
          )?.id ||
          "";
        if (cleanupWorkspaceId) {
          await runWithWriteConflictRetry(
            () =>
              db.$transaction(async (tx) => {
                await tx.caioInitializationGateHead.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                const gateReceipts =
                  await tx.caioInitializationGateReceipt.findMany({
                    where: { workspaceId: cleanupWorkspaceId },
                    orderBy: { sequence: "desc" },
                    select: { id: true },
                  });
                for (const receipt of gateReceipts) {
                  await tx.caioInitializationGateReceipt.delete({
                    where: { id: receipt.id },
                  });
                }
                await tx.caioInitializationAssessment.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.caioActiveMandateClaim.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.caioGuardianStopRecord.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.caioAdviceRecord.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.caioMandateRecord.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.caioPrincipalBinding.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.observationSourceRun.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.observationCompatReceipt.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.observationSource.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.dataAssetStageReceipt.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.dataAssetCatalogEntry.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.enterpriseObservationProgram.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.artifactBundle.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.memoryFact.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.auditLog.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
                await tx.membership.deleteMany({
                  where: { workspaceId: cleanupWorkspaceId },
                });
              }),
            { maxAttempts: 8, retryDelayMs: 50 },
          );
          await db.$executeRaw`DELETE FROM Workspace WHERE id = ${cleanupWorkspaceId}`;
        }
        if (cleanupOwnerUserId) {
          await db.$executeRaw`DELETE FROM User WHERE id = ${cleanupOwnerUserId}`;
        }
      } finally {
        await db.$disconnect();
      }
    });

    it("serializes acceptance and revocation without creating an execution path", async () => {
      const acceptanceInput = {
        workspaceId,
        assessmentId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `g0-accept-${suffix}`,
        inventoryConfirmationRef: `confirmation:inventory:${suffix}`,
        customerAcceptanceRef: `acceptance:customer:${suffix}`,
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: [`evidence:g0-acceptance:${suffix}`],
        now: new Date(evaluatedAt.getTime() + 1_000),
      };
      const acceptedSettled = await Promise.allSettled([
        acceptCaioInitializationGate(acceptanceInput),
        acceptCaioInitializationGate(acceptanceInput),
      ]);
      expect(acceptedSettled.map((result) => result.status)).toEqual([
        "fulfilled",
        "fulfilled",
      ]);
      const accepted = acceptedSettled
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<
            Awaited<ReturnType<typeof acceptCaioInitializationGate>>
          > => result.status === "fulfilled",
        )
        .map((result) => result.value);
      expect(accepted.map((result) => result.replayed).sort()).toEqual([
        false,
        true,
      ]);
      expect(
        await db.caioInitializationGateReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(1);
      expect(
        await db.caioInitializationGateHead.findUnique({
          where: { workspaceId },
          select: { sequence: true },
        }),
      ).toEqual({ sequence: 1 });

      const [revocation, repeatedAcceptance] = await Promise.allSettled([
        revokeCaioInitializationGate({
          workspaceId,
          actorUserId: ownerUserId,
          ceoPrincipalRef: CEO_REF,
          idempotencyKey: `g0-revoke-${suffix}`,
          reasonCodes: ["owner_revoked_initialization_acceptance"],
          evidenceRefs: [`evidence:g0-revocation:${suffix}`],
          now: new Date(evaluatedAt.getTime() + 2_000),
        }),
        acceptCaioInitializationGate({
          ...acceptanceInput,
          idempotencyKey: `g0-accept-racing-revocation-${suffix}`,
          now: new Date(evaluatedAt.getTime() + 2_000),
        }),
      ]);
      expect(revocation.status).toBe("fulfilled");
      expect(repeatedAcceptance.status).toBe("rejected");

      const status = await getCaioInitializationGateStatus({
        workspaceId,
        actorUserId: ownerUserId,
        now: new Date(evaluatedAt.getTime() + 3_000),
      });
      expect(status).toMatchObject({ status: "revoked" });
      expect(status.receipt?.sequence).toBe(2);
      expect(
        await db.caioInitializationGateReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(2);

      await expect(
        acceptCaioInitializationGate({
          ...acceptanceInput,
          idempotencyKey: `g0-accept-after-revoke-${suffix}`,
          now: new Date(evaluatedAt.getTime() + 4_000),
        }),
      ).rejects.toThrow(
        "caio_initialization_revoked_assessment_requires_newer_reassessment",
      );
      await expect(
        acceptCaioInitializationGate({
          ...acceptanceInput,
          now: new Date(evaluatedAt.getTime() + 5_000),
        }),
      ).rejects.toThrow("idempotency_receipt_no_longer_current");
      expect(await db.actionItem.count({ where: { workspaceId } })).toBe(0);
      expect(await db.approvalTask.count({ where: { workspaceId } })).toBe(0);

      const acceptedRow = await db.caioInitializationGateReceipt.findFirst({
        where: { workspaceId, sequence: 1 },
        select: { id: true, receiptJson: true },
      });
      if (!acceptedRow) {
        throw new Error("accepted G0 receipt missing");
      }
      const acceptedReceipt = JSON.parse(
        acceptedRow.receiptJson,
      ) as CaioInitializationGateReceipt;
      const { contentHash: _contentHash, ...acceptedSeed } = acceptedReceipt;
      const tamperedSeed = {
        ...acceptedSeed,
        evidenceRefs: [
          ...acceptedSeed.evidenceRefs,
          `evidence:tampered:${suffix}`,
        ],
      };
      const tamperedReceipt: CaioInitializationGateReceipt = {
        ...tamperedSeed,
        contentHash: sha256(canonicalJson(tamperedSeed)),
      };
      await db.caioInitializationGateReceipt.update({
        where: { id: acceptedRow.id },
        data: {
          evidenceRefs: JSON.stringify(tamperedReceipt.evidenceRefs),
          receiptJson: JSON.stringify(tamperedReceipt),
          contentHash: tamperedReceipt.contentHash,
        },
      });

      await expect(
        getCaioInitializationGateStatus({
          workspaceId,
          actorUserId: ownerUserId,
          now: new Date(evaluatedAt.getTime() + 6_000),
        }),
      ).rejects.toThrow("gate_receipt_chain_hash_mismatch");
    });

    it("allows only one acceptance when concurrent requests use different idempotency keys", async () => {
      const baseInput = {
        workspaceId,
        assessmentId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        inventoryConfirmationRef: `confirmation:inventory:${suffix}`,
        customerAcceptanceRef: `acceptance:customer:${suffix}`,
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: [`evidence:g0-acceptance:${suffix}`],
        now: new Date(evaluatedAt.getTime() + 10_000),
      };
      const settled = await Promise.allSettled([
        acceptCaioInitializationGate({
          ...baseInput,
          idempotencyKey: `g0-accept-different-a-${suffix}`,
        }),
        acceptCaioInitializationGate({
          ...baseInput,
          idempotencyKey: `g0-accept-different-b-${suffix}`,
        }),
      ]);

      expect(
        settled.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        settled.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect(
        settled
          .filter(
            (result): result is PromiseRejectedResult =>
              result.status === "rejected",
          )
          .map((result) => String(result.reason)),
      ).toEqual([
        expect.stringContaining("caio_initialization_gate_already_accepted"),
      ]);
      expect(
        await db.caioInitializationGateReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(1);
      expect(
        await db.caioInitializationGateHead.findUnique({
          where: { workspaceId },
          select: { sequence: true },
        }),
      ).toEqual({ sequence: 1 });
    });

    it("replays one revocation when concurrent requests use the same idempotency key", async () => {
      const accepted = await acceptCaioInitializationGate({
        workspaceId,
        assessmentId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `g0-accept-before-same-revoke-${suffix}`,
        inventoryConfirmationRef: `confirmation:inventory:${suffix}`,
        customerAcceptanceRef: `acceptance:customer:${suffix}`,
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: [`evidence:g0-acceptance:${suffix}`],
        now: new Date(evaluatedAt.getTime() + 20_000),
      });
      expect(accepted.replayed).toBe(false);

      const revocationInput = {
        workspaceId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `g0-revoke-same-${suffix}`,
        reasonCodes: ["owner_revoked_initialization_acceptance"],
        evidenceRefs: [`evidence:g0-revocation:${suffix}`],
        now: new Date(evaluatedAt.getTime() + 21_000),
      };
      const settled = await Promise.allSettled([
        revokeCaioInitializationGate(revocationInput),
        revokeCaioInitializationGate(revocationInput),
      ]);
      expect(settled.map((result) => result.status)).toEqual([
        "fulfilled",
        "fulfilled",
      ]);
      const revocations = settled
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<
            Awaited<ReturnType<typeof revokeCaioInitializationGate>>
          > => result.status === "fulfilled",
        )
        .map((result) => result.value);
      expect(revocations.map((result) => result.replayed).sort()).toEqual([
        false,
        true,
      ]);
      expect(
        await db.caioInitializationGateReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(2);
      expect(
        await db.caioInitializationGateHead.findUnique({
          where: { workspaceId },
          select: { sequence: true },
        }),
      ).toEqual({ sequence: 2 });
    });

    it("allows only one revocation when concurrent requests use different idempotency keys", async () => {
      await acceptCaioInitializationGate({
        workspaceId,
        assessmentId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `g0-accept-before-different-revoke-${suffix}`,
        inventoryConfirmationRef: `confirmation:inventory:${suffix}`,
        customerAcceptanceRef: `acceptance:customer:${suffix}`,
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: [`evidence:g0-acceptance:${suffix}`],
        now: new Date(evaluatedAt.getTime() + 30_000),
      });
      const revocationBase = {
        workspaceId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        reasonCodes: ["owner_revoked_initialization_acceptance"],
        evidenceRefs: [`evidence:g0-revocation:${suffix}`],
        now: new Date(evaluatedAt.getTime() + 31_000),
      };
      const settled = await Promise.allSettled([
        revokeCaioInitializationGate({
          ...revocationBase,
          idempotencyKey: `g0-revoke-different-a-${suffix}`,
        }),
        revokeCaioInitializationGate({
          ...revocationBase,
          idempotencyKey: `g0-revoke-different-b-${suffix}`,
        }),
      ]);

      expect(
        settled.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        settled.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect(
        settled
          .filter(
            (result): result is PromiseRejectedResult =>
              result.status === "rejected",
          )
          .map((result) => String(result.reason)),
      ).toEqual([
        expect.stringContaining("caio_initialization_gate_not_accepted"),
      ]);
      expect(
        await db.caioInitializationGateReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(2);
      expect(
        await db.caioInitializationGateHead.findUnique({
          where: { workspaceId },
          select: { sequence: true },
        }),
      ).toEqual({ sequence: 2 });
    });

    it.each([
      {
        label: "membership becomes inactive",
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.INACTIVE,
      },
      {
        label: "owner role is downgraded",
        role: WorkspaceRole.MEMBER,
        status: MembershipStatus.ACTIVE,
      },
    ])(
      "fails closed when $label after the outer policy check",
      async ({ role, status }) => {
        policyInterleaveState.afterAccess = async () => {
          await db.membership.update({
            where: {
              workspaceId_userId: {
                workspaceId,
                userId: ownerUserId,
              },
            },
            data: { role, status },
          });
        };

        await expect(
          acceptCaioInitializationGate({
            workspaceId,
            assessmentId,
            actorUserId: ownerUserId,
            ceoPrincipalRef: CEO_REF,
            idempotencyKey: `g0-accept-policy-loss-${role}-${status}-${suffix}`,
            inventoryConfirmationRef: `confirmation:inventory:${suffix}`,
            customerAcceptanceRef: `acceptance:customer:${suffix}`,
            acceptedExceptionRefs: [],
            reasonCodes: ["initialization_reviewed"],
            evidenceRefs: [`evidence:g0-acceptance:${suffix}`],
            now: new Date(evaluatedAt.getTime() + 40_000),
          }),
        ).rejects.toThrow("workspace_policy_access_lost");
        expect(
          await db.caioInitializationGateReceipt.count({
            where: { workspaceId },
          }),
        ).toBe(0);
        expect(
          await db.caioInitializationGateHead.findUnique({
            where: { workspaceId },
          }),
        ).toBeNull();
      },
    );

    it("rolls back the real transaction when the audit write fails", async () => {
      const acceptanceInput = {
        workspaceId,
        assessmentId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `g0-accept-audit-rollback-${suffix}`,
        inventoryConfirmationRef: `confirmation:inventory:${suffix}`,
        customerAcceptanceRef: `acceptance:customer:${suffix}`,
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: [`evidence:g0-acceptance:${suffix}`],
        now: new Date(evaluatedAt.getTime() + 50_000),
      };
      auditFaultState.failActionType = "CAIO_INITIALIZATION_GATE_ACCEPTED";
      await expect(
        acceptCaioInitializationGate(acceptanceInput),
      ).rejects.toThrow("injected_audit_failure");
      auditFaultState.failActionType = null;

      expect(
        await db.caioInitializationGateReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.caioInitializationGateHead.findUnique({
          where: { workspaceId },
        }),
      ).toBeNull();
      expect(
        await db.auditLog.count({
          where: {
            workspaceId,
            actionType: "CAIO_INITIALIZATION_GATE_ACCEPTED",
          },
        }),
      ).toBe(0);

      const retry = await acceptCaioInitializationGate(acceptanceInput);
      expect(retry.replayed).toBe(false);
      expect(
        await db.caioInitializationGateReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(1);
      expect(
        await db.auditLog.count({
          where: {
            workspaceId,
            actionType: "CAIO_INITIALIZATION_GATE_ACCEPTED",
          },
        }),
      ).toBe(1);
    });
  },
);
