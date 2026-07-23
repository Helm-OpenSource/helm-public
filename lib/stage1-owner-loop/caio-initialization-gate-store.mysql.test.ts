import {
  ArtifactBundleStatus,
  MembershipStatus,
  MemoryFactType,
  MemoryStatus,
  ObjectType,
  Prisma,
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
  loadCurrentAcceptedCaioInitializationContextForRead,
  recordCaioInitializationAssessment,
  revokeCaioInitializationGate,
} from "./caio-initialization-gate-store.service";
import type { CaioInitializationGateReceipt } from "./caio-initialization-gate-receipt";
import {
  createCaioOperatingQuestionImplementationPlan,
  type CaioOperatingQuestionImplementationPlan,
} from "./caio-operating-question-implementation-plan";
import {
  bindCurrentCaioQuestionSelectionToDecisionRecords,
  generateCaioOperatingQuestionPortfolio,
  selectCaioOperatingQuestions,
} from "./caio-operating-question-store.service";
import { syntheticOperatingQuestionCandidate } from "./caio-operating-question.test-fixtures";
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

function operatingQuestionCandidates(evidenceRef: string) {
  return Array.from({ length: 10 }, (_, index) => {
    const candidate = syntheticOperatingQuestionCandidate(index);
    return {
      ...candidate,
      facts: candidate.facts.map((fact) => ({
        ...fact,
        evidenceRefs: [evidenceRef],
      })),
      inferences: candidate.inferences.map((inference) => ({
        ...inference,
        evidenceRefs: [evidenceRef],
      })),
      evidenceRefs: [evidenceRef],
    };
  });
}

function operatingQuestionSelection(questionId: string) {
  return [
    {
      questionId,
      questionOverride: null,
      goal: "Validate one evidence-bound operating priority",
      successMetrics: [
        {
          metricKey: "metric-1",
          target: "Improve the governed baseline without external mutation",
        },
      ],
      priority: 1,
      implementationScopeRefs: ["scope:review-only"],
      ownerRef: null,
      reviewerRef: null,
      startsAt: null,
      endsAt: null,
      prohibitedActions: ["external_side_effect"],
    },
  ];
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

async function resetOperatingQuestionLedger(
  workspaceId: string,
): Promise<void> {
  await runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        const decisionBindings =
          await tx.caioOperatingQuestionDecisionBinding.findMany({
            where: { workspaceId },
            select: { decisionRecordId: true },
          });
        await tx.caioOperatingQuestionImplementationPlan.deleteMany({
          where: { workspaceId },
        });
        await tx.caioOperatingQuestionDecisionBinding.deleteMany({
          where: { workspaceId },
        });
        if (decisionBindings.length > 0) {
          await tx.decisionRecord.deleteMany({
            where: {
              workspaceId,
              id: {
                in: decisionBindings.map(
                  (binding) => binding.decisionRecordId,
                ),
              },
            },
          });
        }
        await tx.caioQuestionSelectionHead.deleteMany({
          where: { workspaceId },
        });
        const selectionReceipts =
          await tx.caioQuestionSelectionReceipt.findMany({
            where: { workspaceId },
            orderBy: { sequence: "desc" },
            select: { id: true },
          });
        for (const receipt of selectionReceipts) {
          await tx.caioQuestionSelectionReceipt.delete({
            where: { id: receipt.id },
          });
        }
        await tx.caioOperatingQuestionPortfolioHead.deleteMany({
          where: { workspaceId },
        });
        const generationReceipts =
          await tx.caioOperatingQuestionGenerationReceipt.findMany({
            where: { workspaceId },
            orderBy: { sequence: "desc" },
            select: { id: true },
          });
        for (const receipt of generationReceipts) {
          await tx.caioOperatingQuestionGenerationReceipt.delete({
            where: { id: receipt.id },
          });
        }
        const portfolios = await tx.caioOperatingQuestionPortfolio.findMany({
          where: { workspaceId },
          orderBy: { sequence: "desc" },
          select: { id: true },
        });
        for (const portfolio of portfolios) {
          await tx.caioOperatingQuestionPortfolio.delete({
            where: { id: portfolio.id },
          });
        }
        await tx.auditLog.deleteMany({
          where: {
            workspaceId,
            actionType: {
              in: [
                "CAIO_OPERATING_QUESTIONS_GENERATED",
                "CAIO_OPERATING_QUESTIONS_SELECTED",
                "CAIO_OPERATING_QUESTION_DECISION_BOUND",
                "CAIO_OPERATING_QUESTION_IMPLEMENTATION_PLAN_MATERIALIZED",
                "STAGE1_DECISION_RECORDED",
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

    async function acceptCurrentG0ForP1c(
      label: string,
      offsetMs: number,
    ) {
      return acceptCaioInitializationGate({
        workspaceId,
        assessmentId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `g0-accept-p1c-${label}-${suffix}`,
        inventoryConfirmationRef: `confirmation:inventory:${suffix}`,
        customerAcceptanceRef: `acceptance:customer:${suffix}`,
        acceptedExceptionRefs: [],
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: [`evidence:g0-acceptance:${suffix}`],
        now: new Date(evaluatedAt.getTime() + offsetMs),
      });
    }

    async function generateP1cPortfolio(input: {
      label: string;
      offsetMs: number;
      candidates?: unknown;
      generationKey?: string;
    }) {
      return generateCaioOperatingQuestionPortfolio({
        workspaceId,
        actorUserId: ownerUserId,
        generationKey:
          input.generationKey ?? `p1c-generation-${input.label}-${suffix}`,
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        candidates:
          input.candidates ?? operatingQuestionCandidates(EVIDENCE_REF),
        auditRefs: [`audit:p1c-generation:${input.label}:${suffix}`],
        now: new Date(evaluatedAt.getTime() + input.offsetMs),
      });
    }

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
      await resetOperatingQuestionLedger(workspaceId);
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
      await db.caioPrincipalBinding.updateMany({
        where: {
          workspaceId,
          userId: ownerUserId,
          principalRef: CEO_REF,
          principalKind: "ceo",
        },
        data: { revokedAt: null },
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
          await resetOperatingQuestionLedger(cleanupWorkspaceId);
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

    it("fails closed on reads when the accepted G0 live evidence has drifted", async () => {
      await acceptCurrentG0ForP1c("read-live-projection", 55_000);
      const readAt = new Date(evaluatedAt.getTime() + 56_000);
      const transactionOptions = {
        isolationLevel:
          Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 10_000,
        timeout: 30_000,
      } as const;

      const current = await db.$transaction(
        (tx) =>
          loadCurrentAcceptedCaioInitializationContextForRead(tx, {
            workspaceId,
            at: readAt,
          }),
        transactionOptions,
      );
      expect(current?.assessment.assessmentId).toBe(assessmentId);
      if (!current) {
        throw new Error("current accepted G0 context required");
      }
      const memoryRef =
        current.assessmentInput.assets[0]?.companyMemoryBindings[0]
          ?.ref;
      if (!memoryRef?.startsWith("memory-fact:")) {
        throw new Error("bound company-memory fact required");
      }
      const memoryFactId = memoryRef.slice("memory-fact:".length);
      const originalFact = await db.memoryFact.findUniqueOrThrow({
        where: { id: memoryFactId },
        select: { content: true, updatedAt: true },
      });
      await db.memoryFact.update({
        where: { id: memoryFactId },
        data: {
          content:
            "The accepted Company Memory fact changed after the G0 snapshot.",
          updatedAt: readAt,
        },
      });
      try {
        const stale = await db.$transaction(
          (tx) =>
            loadCurrentAcceptedCaioInitializationContextForRead(tx, {
              workspaceId,
              at: new Date(readAt.getTime() + 1_000),
            }),
          transactionOptions,
        );
        expect(stale).toBeNull();
      } finally {
        await db.memoryFact.update({
          where: { id: memoryFactId },
          data: originalFact,
        });
      }
    });

    it("converges concurrent identical operating-question generation to one receipt", async () => {
      await acceptCurrentG0ForP1c("generation", 60_000);
      const generationInput = {
        workspaceId,
        actorUserId: ownerUserId,
        generationKey: `p1c-generation-concurrent-${suffix}`,
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        candidates: operatingQuestionCandidates(EVIDENCE_REF),
        auditRefs: [`audit:p1c-generation:${suffix}`],
        now: new Date(evaluatedAt.getTime() + 61_000),
      };

      const settled = await Promise.allSettled([
        generateCaioOperatingQuestionPortfolio(generationInput),
        generateCaioOperatingQuestionPortfolio(generationInput),
      ]);

      expect(settled.map((result) => result.status)).toEqual([
        "fulfilled",
        "fulfilled",
      ]);
      const results = settled
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<
            Awaited<
              ReturnType<typeof generateCaioOperatingQuestionPortfolio>
            >
          > => result.status === "fulfilled",
        )
        .map((result) => result.value);
      expect(results.map((result) => result.replayed).sort()).toEqual([
        false,
        true,
      ]);
      expect(
        await db.caioOperatingQuestionGenerationReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(1);
      expect(
        await db.caioOperatingQuestionPortfolio.count({
          where: { workspaceId },
        }),
      ).toBe(1);
    });

    it("converges concurrent identical CEO selection to one receipt", async () => {
      await acceptCurrentG0ForP1c("selection", 70_000);
      const generated = await generateCaioOperatingQuestionPortfolio({
        workspaceId,
        actorUserId: ownerUserId,
        generationKey: `p1c-generation-selection-${suffix}`,
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        candidates: operatingQuestionCandidates(EVIDENCE_REF),
        auditRefs: [`audit:p1c-generation-selection:${suffix}`],
        now: new Date(evaluatedAt.getTime() + 71_000),
      });
      if (!generated.portfolio) {
        throw new Error("P1C integration portfolio missing");
      }
      const selectionInput = {
        workspaceId,
        expectedPortfolioId: generated.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-concurrent-${suffix}`,
        selections: operatingQuestionSelection(
          generated.portfolio.candidates[0].questionId,
        ),
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 72_000),
      };

      const settled = await Promise.allSettled([
        selectCaioOperatingQuestions(selectionInput),
        selectCaioOperatingQuestions(selectionInput),
      ]);

      expect(settled.map((result) => result.status)).toEqual([
        "fulfilled",
        "fulfilled",
      ]);
      const results = settled
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<
            Awaited<ReturnType<typeof selectCaioOperatingQuestions>>
          > => result.status === "fulfilled",
        )
        .map((result) => result.value);
      expect(results.map((result) => result.replayed).sort()).toEqual([
        false,
        true,
      ]);
      expect(
        await db.caioQuestionSelectionReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(1);
    });

    it("rejects one generation key reused with a different payload", async () => {
      await acceptCurrentG0ForP1c("generation-payload-conflict", 80_000);
      const generationKey = `p1c-generation-conflict-${suffix}`;
      await generateP1cPortfolio({
        label: "generation-payload-conflict",
        generationKey,
        offsetMs: 81_000,
      });
      const changedCandidates = operatingQuestionCandidates(EVIDENCE_REF);
      changedCandidates[0] = {
        ...changedCandidates[0],
        title: "Changed operating focus",
      };

      await expect(
        generateP1cPortfolio({
          label: "generation-payload-conflict",
          generationKey,
          candidates: changedCandidates,
          offsetMs: 82_000,
        }),
      ).rejects.toThrow("generation_key_payload_conflict");
      expect(
        await db.caioOperatingQuestionGenerationReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(1);
      expect(
        await db.caioOperatingQuestionPortfolio.count({
          where: { workspaceId },
        }),
      ).toBe(1);
    });

    it("appends an explicit second generation without forking the portfolio chain", async () => {
      await acceptCurrentG0ForP1c("second-generation", 90_000);
      const first = await generateP1cPortfolio({
        label: "second-generation-1",
        offsetMs: 91_000,
      });
      const second = await generateP1cPortfolio({
        label: "second-generation-2",
        offsetMs: 92_000,
      });
      if (!first.portfolio || !second.portfolio) {
        throw new Error("P1C generation chain portfolio missing");
      }

      expect(first.receipt.sequence).toBe(1);
      expect(first.portfolio.sequence).toBe(1);
      expect(second.receipt.sequence).toBe(2);
      expect(second.receipt.previousReceiptRef).toBe(first.receipt.receiptId);
      expect(second.receipt.previousReceiptHash).toBe(
        first.receipt.contentHash,
      );
      expect(second.portfolio.sequence).toBe(2);
      expect(second.portfolio.previousPortfolioRef).toBe(
        first.portfolio.portfolioId,
      );
      expect(second.portfolio.previousPortfolioHash).toBe(
        first.portfolio.contentHash,
      );
      expect(
        await db.caioOperatingQuestionPortfolioHead.findUnique({
          where: { workspaceId },
          select: {
            currentGenerationReceiptId: true,
            currentPortfolioId: true,
            generationSequence: true,
            portfolioSequence: true,
          },
        }),
      ).toEqual({
        currentGenerationReceiptId: second.receipt.receiptId,
        currentPortfolioId: second.portfolio.portfolioId,
        generationSequence: 2,
        portfolioSequence: 2,
      });
    });

    it("keeps the last valid portfolio current when a later generation has insufficient evidence", async () => {
      await acceptCurrentG0ForP1c("insufficient-preserves-head", 100_000);
      const valid = await generateP1cPortfolio({
        label: "insufficient-preserves-head-valid",
        offsetMs: 101_000,
      });
      const insufficient = await generateP1cPortfolio({
        label: "insufficient-preserves-head-gap",
        candidates: [operatingQuestionCandidates(EVIDENCE_REF)[0]],
        offsetMs: 102_000,
      });
      if (!valid.portfolio) {
        throw new Error("P1C valid portfolio missing");
      }

      expect(insufficient.portfolio).toBeNull();
      expect(insufficient.receipt.status).toBe("insufficient_evidence");
      expect(insufficient.receipt.sequence).toBe(2);
      expect(
        await db.caioOperatingQuestionPortfolioHead.findUnique({
          where: { workspaceId },
          select: {
            currentGenerationReceiptId: true,
            currentPortfolioId: true,
            generationSequence: true,
            portfolioSequence: true,
          },
        }),
      ).toEqual({
        currentGenerationReceiptId: insufficient.receipt.receiptId,
        currentPortfolioId: valid.portfolio.portfolioId,
        generationSequence: 2,
        portfolioSequence: 1,
      });
      const selected = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: valid.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-after-gap-${suffix}`,
        selections: operatingQuestionSelection(
          valid.portfolio.candidates[0].questionId,
        ),
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 103_000),
      });
      expect(selected.receipt.workPacketEffect).toBe("none");
    });

    it("accepts zero-to-three selections only against the current portfolio", async () => {
      await acceptCurrentG0ForP1c("selection-bounds", 110_000);
      const first = await generateP1cPortfolio({
        label: "selection-bounds-1",
        offsetMs: 111_000,
      });
      if (!first.portfolio) {
        throw new Error("P1C first portfolio missing");
      }
      const zeroSelection = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: first.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-zero-${suffix}`,
        selections: [],
        reasonCodes: ["ceo_deferred_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 112_000),
      });
      expect(zeroSelection.receipt.selectedQuestionIds).toEqual([]);
      const threeSelections = first.portfolio.candidates
        .slice(0, 3)
        .map((candidate, index) => ({
          ...operatingQuestionSelection(candidate.questionId)[0],
          priority: index + 1,
          successMetrics: [
            {
              metricKey: `metric-${index + 1}`,
              target: `Validate priority ${index + 1}`,
            },
          ],
        }));
      const threeSelection = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: first.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-three-${suffix}`,
        selections: threeSelections,
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 113_000),
      });
      expect(threeSelection.receipt.selectedQuestionIds).toHaveLength(3);
      expect(threeSelection.receipt.sequence).toBe(2);

      const second = await generateP1cPortfolio({
        label: "selection-bounds-2",
        offsetMs: 114_000,
      });
      if (!second.portfolio) {
        throw new Error("P1C second portfolio missing");
      }
      await expect(
        selectCaioOperatingQuestions({
          workspaceId,
          expectedPortfolioId: first.portfolio.portfolioId,
          actorUserId: ownerUserId,
          ceoPrincipalRef: CEO_REF,
          idempotencyKey: `p1c-selection-stale-${suffix}`,
          selections: operatingQuestionSelection(
            first.portfolio.candidates[0].questionId,
          ),
          reasonCodes: ["ceo_selected_operating_focus"],
          evidenceRefs: [EVIDENCE_REF],
          now: new Date(evaluatedAt.getTime() + 115_000),
        }),
      ).rejects.toThrow("current_question_portfolio_required");
    });

    it("fails closed when the accepted G0 is revoked after the outer policy check", async () => {
      await acceptCurrentG0ForP1c("revoked-before-generation", 120_000);
      policyInterleaveState.afterAccess = async () => {
        await revokeCaioInitializationGate({
          workspaceId,
          actorUserId: ownerUserId,
          ceoPrincipalRef: CEO_REF,
          idempotencyKey: `g0-revoke-before-p1c-${suffix}`,
          reasonCodes: ["owner_revoked_initialization_acceptance"],
          evidenceRefs: [`evidence:g0-revocation:${suffix}`],
          now: new Date(evaluatedAt.getTime() + 121_000),
        });
      };

      await expect(
        generateP1cPortfolio({
          label: "revoked-before-generation",
          offsetMs: 122_000,
        }),
      ).rejects.toThrow("current_gate_not_accepted");
      expect(
        await db.caioOperatingQuestionGenerationReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.caioOperatingQuestionPortfolioHead.findUnique({
          where: { workspaceId },
        }),
      ).toBeNull();
    });

    it("rejects a tampered predecessor before appending another generation", async () => {
      await acceptCurrentG0ForP1c("tampered-predecessor", 130_000);
      const first = await generateP1cPortfolio({
        label: "tampered-predecessor-1",
        offsetMs: 131_000,
      });
      await generateP1cPortfolio({
        label: "tampered-predecessor-2",
        offsetMs: 132_000,
      });
      if (!first.portfolio) {
        throw new Error("P1C predecessor portfolio missing");
      }
      await db.caioOperatingQuestionPortfolio.update({
        where: { id: first.portfolio.portfolioId },
        data: { contentHash: sha256(`tampered-p1c:${suffix}`) },
      });

      await expect(
        generateP1cPortfolio({
          label: "tampered-predecessor-3",
          offsetMs: 133_000,
        }),
      ).rejects.toThrow("stored_question_portfolio_binding_invalid");
      expect(
        await db.caioOperatingQuestionGenerationReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(2);
    });

    it("fails closed when OWNER access is lost after the outer binding check", async () => {
      await acceptCurrentG0ForP1c("binding-policy-loss", 134_000);
      const generated = await generateP1cPortfolio({
        label: "binding-policy-loss",
        offsetMs: 135_000,
      });
      if (!generated.portfolio) {
        throw new Error("P1C binding-policy portfolio missing");
      }
      const selected = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: generated.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-binding-policy-loss-${suffix}`,
        selections: operatingQuestionSelection(
          generated.portfolio.candidates[0].questionId,
        ),
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 136_000),
      });
      policyInterleaveState.afterAccess = async () => {
        await db.membership.update({
          where: {
            workspaceId_userId: {
              workspaceId,
              userId: ownerUserId,
            },
          },
          data: { status: MembershipStatus.INACTIVE },
        });
      };

      await expect(
        bindCurrentCaioQuestionSelectionToDecisionRecords({
          workspaceId,
          expectedSelectionReceiptId: selected.receipt.receiptId,
          actorUserId: ownerUserId,
          ceoPrincipalRef: CEO_REF,
          now: new Date(evaluatedAt.getTime() + 137_000),
        }),
      ).rejects.toThrow("workspace_policy_access_lost");
      expect(
        await db.caioOperatingQuestionDecisionBinding.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.caioOperatingQuestionImplementationPlan.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.decisionRecord.count({ where: { workspaceId } }),
      ).toBe(0);
    });

    it("fails closed when the live CEO binding is revoked before persistence", async () => {
      const accepted = await acceptCurrentG0ForP1c(
        "binding-ceo-revoked",
        137_100,
      );
      const generated = await generateP1cPortfolio({
        label: "binding-ceo-revoked",
        offsetMs: 137_200,
      });
      if (!generated.portfolio) {
        throw new Error("P1C binding-CEO portfolio missing");
      }
      const selected = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: generated.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-binding-ceo-revoked-${suffix}`,
        selections: operatingQuestionSelection(
          generated.portfolio.candidates[0].questionId,
        ),
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 137_300),
      });
      policyInterleaveState.afterAccess = async () => {
        await db.caioPrincipalBinding.update({
          where: {
            id: accepted.receipt.ceoPrincipalBindingRef,
          },
          data: {
            revokedAt: new Date(evaluatedAt.getTime() + 137_350),
          },
        });
      };

      await expect(
        bindCurrentCaioQuestionSelectionToDecisionRecords({
          workspaceId,
          expectedSelectionReceiptId: selected.receipt.receiptId,
          actorUserId: ownerUserId,
          ceoPrincipalRef: CEO_REF,
          now: new Date(evaluatedAt.getTime() + 137_400),
        }),
      ).rejects.toThrow("live_ceo_principal_binding_required");
      expect(
        await db.caioOperatingQuestionDecisionBinding.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.caioOperatingQuestionImplementationPlan.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.decisionRecord.count({ where: { workspaceId } }),
      ).toBe(0);
    });

    it("binds the current CEO selection to canonical DecisionRecords exactly once", async () => {
      await acceptCurrentG0ForP1c("decision-binding", 140_000);
      const generated = await generateP1cPortfolio({
        label: "decision-binding",
        offsetMs: 141_000,
      });
      if (!generated.portfolio) {
        throw new Error("P1C decision-binding portfolio missing");
      }
      const selections = generated.portfolio.candidates
        .slice(0, 2)
        .map((candidate, index) => ({
          ...operatingQuestionSelection(candidate.questionId)[0],
          priority: index + 1,
          successMetrics: [
            {
              metricKey: `metric-${index + 1}`,
              target: `Validate selected priority ${index + 1}`,
            },
          ],
        }));
      const selected = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: generated.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-decision-binding-${suffix}`,
        selections,
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 142_000),
      });
      const bindingInput = {
        workspaceId,
        expectedSelectionReceiptId: selected.receipt.receiptId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        now: new Date(evaluatedAt.getTime() + 143_000),
      };

      const settled = await Promise.allSettled([
        bindCurrentCaioQuestionSelectionToDecisionRecords(bindingInput),
        bindCurrentCaioQuestionSelectionToDecisionRecords(bindingInput),
      ]);

      expect(settled.map((result) => result.status)).toEqual([
        "fulfilled",
        "fulfilled",
      ]);
      const results = settled
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<
            Awaited<
              ReturnType<
                typeof bindCurrentCaioQuestionSelectionToDecisionRecords
              >
            >
          > => result.status === "fulfilled",
        )
        .map((result) => result.value);
      expect(
        results
          .map((result) =>
            result.bindings.every((binding) => binding.replayed),
          )
          .sort(),
      ).toEqual([false, true]);
      expect(
        await db.caioOperatingQuestionDecisionBinding.count({
          where: { workspaceId },
        }),
      ).toBe(2);
      expect(
        await db.caioOperatingQuestionImplementationPlan.count({
          where: { workspaceId },
        }),
      ).toBe(2);
      expect(
        await db.caioOperatingQuestionImplementationPlan.findMany({
          where: { workspaceId },
          orderBy: { questionId: "asc" },
          select: {
            id: true,
            status: true,
            implementationReadiness: true,
            authorityEffect: true,
            workPacketEffect: true,
            decisionRecordId: true,
          },
        }),
      ).toEqual(
        expect.arrayContaining(
          results[0].bindings.map((binding) => ({
            id: binding.implementationPlanId,
            status: "DRAFT",
            implementationReadiness: "needs_configuration",
            authorityEffect: "none",
            workPacketEffect: "none",
            decisionRecordId: binding.decisionRecordId,
          })),
        ),
      );
      expect(
        results.every((result) =>
          result.bindings.every(
            (binding) =>
              binding.implementationPlanId.startsWith(
                "caio-operating-question-plan:",
              ) && binding.implementationPlanReplayed === binding.replayed,
          ),
        ),
      ).toBe(true);
      expect(
        await db.decisionRecord.findMany({
          where: { workspaceId },
          orderBy: { decisionKey: "asc" },
          select: {
            status: true,
            allowedActionLevel: true,
            ownerGate: true,
            ownerConfirmedAt: true,
          },
        }),
      ).toEqual([
        {
          status: "EVIDENCE_READY",
          allowedActionLevel: "draft_task",
          ownerGate: "approval_required",
          ownerConfirmedAt: null,
        },
        {
          status: "EVIDENCE_READY",
          allowedActionLevel: "draft_task",
          ownerGate: "approval_required",
          ownerConfirmedAt: null,
        },
      ]);
      expect(await db.actionItem.count({ where: { workspaceId } })).toBe(0);
      expect(await db.approvalTask.count({ where: { workspaceId } })).toBe(0);
    });

    it("backfills a missing implementation plan without dispatching work", async () => {
      await acceptCurrentG0ForP1c("implementation-plan-backfill", 145_000);
      const generated = await generateP1cPortfolio({
        label: "implementation-plan-backfill",
        offsetMs: 146_000,
      });
      if (!generated.portfolio) {
        throw new Error("P1C implementation-plan portfolio missing");
      }
      const selected = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: generated.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-plan-backfill-${suffix}`,
        selections: operatingQuestionSelection(
          generated.portfolio.candidates[0].questionId,
        ),
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 147_000),
      });
      const bindingInput = {
        workspaceId,
        expectedSelectionReceiptId: selected.receipt.receiptId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        now: new Date(evaluatedAt.getTime() + 148_000),
      };
      const first =
        await bindCurrentCaioQuestionSelectionToDecisionRecords(
          bindingInput,
        );
      const firstBinding = first.bindings[0];
      await db.caioOperatingQuestionImplementationPlan.delete({
        where: { id: firstBinding.implementationPlanId },
      });

      const backfilled =
        await bindCurrentCaioQuestionSelectionToDecisionRecords(
          bindingInput,
        );
      expect(backfilled.bindings).toEqual([
        expect.objectContaining({
          bindingId: firstBinding.bindingId,
          decisionRecordId: firstBinding.decisionRecordId,
          implementationPlanId: firstBinding.implementationPlanId,
          implementationPlanReplayed: false,
          replayed: false,
        }),
      ]);
      const replayed =
        await bindCurrentCaioQuestionSelectionToDecisionRecords(
          bindingInput,
        );
      expect(replayed.bindings).toEqual([
        expect.objectContaining({
          implementationPlanId: firstBinding.implementationPlanId,
          implementationPlanReplayed: true,
          replayed: true,
        }),
      ]);
      expect(
        await db.caioOperatingQuestionDecisionBinding.count({
          where: { workspaceId },
        }),
      ).toBe(1);
      expect(
        await db.caioOperatingQuestionImplementationPlan.count({
          where: { workspaceId },
        }),
      ).toBe(1);
      expect(
        await db.decisionRecord.count({ where: { workspaceId } }),
      ).toBe(1);
      expect(await db.actionItem.count({ where: { workspaceId } })).toBe(0);
      expect(await db.approvalTask.count({ where: { workspaceId } })).toBe(0);
    });

    it("rejects a tampered implementation plan before replay", async () => {
      await acceptCurrentG0ForP1c("implementation-plan-tamper", 149_000);
      const generated = await generateP1cPortfolio({
        label: "implementation-plan-tamper",
        offsetMs: 149_500,
      });
      if (!generated.portfolio) {
        throw new Error("P1C implementation-plan portfolio missing");
      }
      const selected = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: generated.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-plan-tamper-${suffix}`,
        selections: operatingQuestionSelection(
          generated.portfolio.candidates[0].questionId,
        ),
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 149_750),
      });
      const bindingInput = {
        workspaceId,
        expectedSelectionReceiptId: selected.receipt.receiptId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        now: new Date(evaluatedAt.getTime() + 149_900),
      };
      const first =
        await bindCurrentCaioQuestionSelectionToDecisionRecords(
          bindingInput,
        );
      await db.caioOperatingQuestionImplementationPlan.update({
        where: { id: first.bindings[0].implementationPlanId },
        data: {
          contentHash: sha256(`tampered-plan:${suffix}`),
        },
      });

      await expect(
        bindCurrentCaioQuestionSelectionToDecisionRecords(bindingInput),
      ).rejects.toThrow(
        "stored_question_implementation_plan_binding_invalid",
      );
      expect(
        await db.caioOperatingQuestionDecisionBinding.count({
          where: { workspaceId },
        }),
      ).toBe(1);
      expect(
        await db.caioOperatingQuestionImplementationPlan.count({
          where: { workspaceId },
        }),
      ).toBe(1);
      expect(
        await db.decisionRecord.count({ where: { workspaceId } }),
      ).toBe(1);
      expect(await db.actionItem.count({ where: { workspaceId } })).toBe(0);
    });

    it("rejects valid implementation plans swapped across decision bindings", async () => {
      await acceptCurrentG0ForP1c("implementation-plan-swap", 149_910);
      const generated = await generateP1cPortfolio({
        label: "implementation-plan-swap",
        offsetMs: 149_915,
      });
      if (!generated.portfolio) {
        throw new Error("P1C implementation-plan portfolio missing");
      }
      const selectedCandidates = generated.portfolio.candidates.slice(0, 2);
      const selected = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: generated.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-plan-swap-${suffix}`,
        selections: selectedCandidates.map((candidate, index) => ({
          ...operatingQuestionSelection(candidate.questionId)[0],
          priority: index + 1,
        })),
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 149_920),
      });
      const bindingInput = {
        workspaceId,
        expectedSelectionReceiptId: selected.receipt.receiptId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        now: new Date(evaluatedAt.getTime() + 149_925),
      };
      const first =
        await bindCurrentCaioQuestionSelectionToDecisionRecords(
          bindingInput,
        );
      const [firstBinding, secondBinding] = first.bindings;
      const firstCandidate = selectedCandidates[0];
      const secondCandidate = selectedCandidates[1];
      const secondPlanOnFirstBinding =
        createCaioOperatingQuestionImplementationPlan({
          portfolio: generated.portfolio,
          selectionReceipt: selected.receipt,
          questionId: secondCandidate.questionId,
          decisionRecordRef: firstBinding.decisionRecordId,
        });
      const firstPlanOnSecondBinding =
        createCaioOperatingQuestionImplementationPlan({
          portfolio: generated.portfolio,
          selectionReceipt: selected.receipt,
          questionId: firstCandidate.questionId,
          decisionRecordRef: secondBinding.decisionRecordId,
        });
      const swappedPlanData = (
        plan: CaioOperatingQuestionImplementationPlan,
      ) => ({
        id: plan.planId,
        questionId: plan.questionId,
        candidateHash: plan.candidateHash,
        planJson: JSON.stringify(plan),
        contentHash: plan.contentHash,
        status: plan.status,
        implementationReadiness: plan.implementationReadiness,
        gapCodes: JSON.stringify(plan.gapCodes),
        authorityEffect: plan.authorityEffect,
        workPacketEffect: plan.workPacketEffect,
        plannedAt: new Date(plan.createdAt),
      });
      await db.$transaction(async (tx) => {
        await tx.caioOperatingQuestionImplementationPlan.update({
          where: { id: firstBinding.implementationPlanId },
          data: { questionId: `swap-temp-${suffix}` },
        });
        await tx.caioOperatingQuestionImplementationPlan.update({
          where: { id: secondBinding.implementationPlanId },
          data: swappedPlanData(firstPlanOnSecondBinding),
        });
        await tx.caioOperatingQuestionImplementationPlan.update({
          where: { id: firstBinding.implementationPlanId },
          data: swappedPlanData(secondPlanOnFirstBinding),
        });
      });

      await expect(
        bindCurrentCaioQuestionSelectionToDecisionRecords(bindingInput),
      ).rejects.toThrow(
        "stored_question_implementation_plan_binding_invalid",
      );
      expect(
        await db.caioOperatingQuestionImplementationPlan.count({
          where: { workspaceId },
        }),
      ).toBe(2);
      expect(
        await db.decisionRecord.count({ where: { workspaceId } }),
      ).toBe(2);
      expect(await db.actionItem.count({ where: { workspaceId } })).toBe(0);
      expect(await db.approvalTask.count({ where: { workspaceId } })).toBe(0);
    });

    it("rolls back the full chain when implementation-plan audit fails", async () => {
      await acceptCurrentG0ForP1c("implementation-plan-audit", 149_925);
      const generated = await generateP1cPortfolio({
        label: "implementation-plan-audit",
        offsetMs: 149_950,
      });
      if (!generated.portfolio) {
        throw new Error("P1C implementation-plan portfolio missing");
      }
      const selected = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: generated.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-plan-audit-${suffix}`,
        selections: operatingQuestionSelection(
          generated.portfolio.candidates[0].questionId,
        ),
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 149_975),
      });
      auditFaultState.failActionType =
        "CAIO_OPERATING_QUESTION_IMPLEMENTATION_PLAN_MATERIALIZED";

      await expect(
        bindCurrentCaioQuestionSelectionToDecisionRecords({
          workspaceId,
          expectedSelectionReceiptId: selected.receipt.receiptId,
          actorUserId: ownerUserId,
          ceoPrincipalRef: CEO_REF,
          now: new Date(evaluatedAt.getTime() + 149_990),
        }),
      ).rejects.toThrow("injected_audit_failure");
      auditFaultState.failActionType = null;

      expect(
        await db.caioOperatingQuestionDecisionBinding.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.caioOperatingQuestionImplementationPlan.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.decisionRecord.count({ where: { workspaceId } }),
      ).toBe(0);
      expect(
        await db.auditLog.count({
          where: {
            workspaceId,
            actionType: {
              in: [
                "STAGE1_DECISION_RECORDED",
                "CAIO_OPERATING_QUESTION_DECISION_BOUND",
                "CAIO_OPERATING_QUESTION_IMPLEMENTATION_PLAN_MATERIALIZED",
              ],
            },
          },
        }),
      ).toBe(0);
    });

    it("rejects a superseded CEO selection before creating DecisionRecords", async () => {
      await acceptCurrentG0ForP1c("superseded-selection", 150_000);
      const generated = await generateP1cPortfolio({
        label: "superseded-selection",
        offsetMs: 151_000,
      });
      if (!generated.portfolio) {
        throw new Error("P1C superseded-selection portfolio missing");
      }
      const first = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: generated.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-superseded-1-${suffix}`,
        selections: operatingQuestionSelection(
          generated.portfolio.candidates[0].questionId,
        ),
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 152_000),
      });
      await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: generated.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-superseded-2-${suffix}`,
        selections: operatingQuestionSelection(
          generated.portfolio.candidates[1].questionId,
        ),
        reasonCodes: ["ceo_reprioritized_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 153_000),
      });

      await expect(
        bindCurrentCaioQuestionSelectionToDecisionRecords({
          workspaceId,
          expectedSelectionReceiptId: first.receipt.receiptId,
          actorUserId: ownerUserId,
          ceoPrincipalRef: CEO_REF,
          now: new Date(evaluatedAt.getTime() + 154_000),
        }),
      ).rejects.toThrow("current_question_selection_required");
      expect(
        await db.caioOperatingQuestionDecisionBinding.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.caioOperatingQuestionImplementationPlan.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.decisionRecord.count({ where: { workspaceId } }),
      ).toBe(0);
    });

    it("rolls back DecisionRecords and bindings when the binding audit fails", async () => {
      await acceptCurrentG0ForP1c("decision-binding-audit", 160_000);
      const generated = await generateP1cPortfolio({
        label: "decision-binding-audit",
        offsetMs: 161_000,
      });
      if (!generated.portfolio) {
        throw new Error("P1C binding-audit portfolio missing");
      }
      const selected = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: generated.portfolio.portfolioId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `p1c-selection-binding-audit-${suffix}`,
        selections: operatingQuestionSelection(
          generated.portfolio.candidates[0].questionId,
        ),
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [EVIDENCE_REF],
        now: new Date(evaluatedAt.getTime() + 162_000),
      });
      auditFaultState.failActionType =
        "CAIO_OPERATING_QUESTION_DECISION_BOUND";

      await expect(
        bindCurrentCaioQuestionSelectionToDecisionRecords({
          workspaceId,
          expectedSelectionReceiptId: selected.receipt.receiptId,
          actorUserId: ownerUserId,
          ceoPrincipalRef: CEO_REF,
          now: new Date(evaluatedAt.getTime() + 163_000),
        }),
      ).rejects.toThrow("injected_audit_failure");
      auditFaultState.failActionType = null;

      expect(
        await db.caioOperatingQuestionDecisionBinding.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.caioOperatingQuestionImplementationPlan.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.decisionRecord.count({ where: { workspaceId } }),
      ).toBe(0);
      expect(
        await db.auditLog.count({
          where: {
            workspaceId,
            actionType: {
              in: [
                "STAGE1_DECISION_RECORDED",
                "CAIO_OPERATING_QUESTION_DECISION_BOUND",
              ],
            },
          },
        }),
      ).toBe(0);
    });

    it("rolls back generated records and heads when the P1C audit write fails", async () => {
      await acceptCurrentG0ForP1c("generation-audit-rollback", 170_000);
      auditFaultState.failActionType =
        "CAIO_OPERATING_QUESTIONS_GENERATED";

      await expect(
        generateP1cPortfolio({
          label: "generation-audit-rollback",
          offsetMs: 171_000,
        }),
      ).rejects.toThrow("injected_audit_failure");
      auditFaultState.failActionType = null;

      expect(
        await db.caioOperatingQuestionGenerationReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.caioOperatingQuestionPortfolio.count({
          where: { workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.caioOperatingQuestionPortfolioHead.findUnique({
          where: { workspaceId },
        }),
      ).toBeNull();
      expect(await db.actionItem.count({ where: { workspaceId } })).toBe(0);
      expect(await db.approvalTask.count({ where: { workspaceId } })).toBe(0);
    });
  },
);
