// CAIO Pro V1 synthetic end-to-end loop (public-safe reference slice).
//
// One replayable integration suite that drives the REAL services (no mocks)
// through the full CAIO Pro V1 chain inside a single workspace on an
// isolated MySQL database:
//
//   catalog inventory -> classification -> authorization -> observation
//   sources -> synthetic runs -> G0 assessment ready_for_owner_acceptance
//   -> CEO acceptance via the CaioPrincipalBinding seam -> exactly-ten
//   operating-question portfolio -> CEO selects two questions -> canonical
//   DecisionRecord bindings + implementation plans -> one dispatched work
//   packet -> execution receipt -> independent verification -> decision
//   evaluation -> OBSERVED memory candidate. Plus one context-agent
//   consent -> revocation -> deletion-receipt chain and one refused
//   (fail-closed) model-route decision. The suite then drives the
//   site-deployment completion gate: the P4-P8 TODO readout with missing
//   items -> synthetic value receipts + retrospective + owner attestations
//   -> ready assessment -> CEO acceptance -> revocation fail-close.
//
// Honesty statement: every fixture string below is synthetic. This suite is
// a public reference loop only — it is NOT customer initialization, NOT
// production evidence, NOT value evidence, and it performs no external side
// effect. The evidence-package hash asserted at the end proves same-run
// determinism only (identifiers carry per-run suffixes), not cross-run
// replayability.

import {
  ActionStatus,
  ActorType,
  ApprovalStatus,
  ArtifactBundleStatus,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
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
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  activateCaioMandate,
  createCaioMandateDraft,
  registerCaioPrincipalBinding,
} from "@/lib/caio-governance/mandate-store.service";
import {
  inviteContextAgentParticipation,
  recordContextAgentConsent,
  recordContextAgentDeletionOutcome,
  revokeContextAgentConsent,
} from "@/lib/context-agent/context-agent-store.service";
import { db } from "@/lib/db";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import {
  GOVERNED_GATEWAY_AUTHORITY,
  prepareModelRouteDecision,
} from "@/lib/llm/model-egress-store.service";
import { syntheticTemporalOperatingContextInput } from "@/lib/operating-harness/context-fixtures";
import { projectTemporalOperatingContext } from "@/lib/operating-harness/context-projector";
import {
  recordExecutionReceipt,
  verifyExecutionReceipt,
} from "@/lib/receipts/execution-receipt.service";
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
import { CAIO_PRO_V1_ATTESTABLE_ITEMS } from "./caio-pro-completion";
import {
  acceptCaioProV1CompletionGate,
  getCaioProV1CompletionStatus,
  recordCaioProV1CompletionAssessment,
  recordCaioProV1EvidenceAttestation,
  recordCaioProV1RetrospectiveReceipt,
  recordCaioQuestionValueReceipt,
  revokeCaioProV1CompletionGate,
} from "./caio-pro-completion-store.service";
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
import type {
  DataAssetProcessingDisposition,
  DataAssetShape,
  DataAssetTechnicalFeasibility,
} from "./data-asset-catalog.types";
import { evaluateStage1DecisionRecord } from "./decision-evaluation.service";
import {
  confirmStage1DecisionRecord,
  dispatchStage1DecisionWorkPacket,
} from "./decision-follow-through.service";
import {
  beginObservationSourceRun,
  completeObservationSourceRun,
  createEnterpriseObservationProgram,
  registerObservationSource,
} from "./observation.service";
import type { ObservationSensitivity, OwnerCommandDraft } from "./types";

const integrationDatabaseUrl = process.env.CAIO_PRO_V1_DATABASE_URL;
const confirmedIntegrationDatabaseName =
  process.env.CAIO_PRO_V1_TEST_DATABASE_NAME;
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const WORKSPACE_SLUG = `caio-pro-v1-loop-${suffix}`;
const OWNER_EMAIL = `caio-pro-v1-owner-${suffix}@example.test`;
const EMPLOYEE_EMAIL = `caio-pro-v1-member-${suffix}@example.test`;
const REVIEWER_EMAIL = `caio-pro-v1-reviewer-${suffix}@example.test`;
const CEO_REF = `ceo-caio-pro-v1-${suffix}`;
const ISOLATED_DATABASE_PREFIX = "helm_caio_pro_v1_";
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

function assertIsolatedDatabaseTarget(): void {
  if (
    !integrationDatabaseUrl ||
    process.env.DATABASE_URL !== integrationDatabaseUrl
  ) {
    throw new Error(
      "DATABASE_URL must equal CAIO_PRO_V1_DATABASE_URL for the isolated integration test.",
    );
  }
  let databaseName = "";
  try {
    const parsed = new URL(integrationDatabaseUrl);
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ""));
  } catch {
    throw new Error(
      "CAIO_PRO_V1_DATABASE_URL must be a valid isolated MySQL URL.",
    );
  }
  if (
    !databaseName.startsWith(ISOLATED_DATABASE_PREFIX) ||
    databaseName !== confirmedIntegrationDatabaseName
  ) {
    throw new Error(
      "Refusing CAIO Pro V1 integration test: confirm the isolated database name with CAIO_PRO_V1_TEST_DATABASE_NAME and use the helm_caio_pro_v1_ prefix.",
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

type ConnectedAssetSpec = {
  key: string;
  sourceKind: string;
  dataShape: DataAssetShape;
  sensitivity: ObservationSensitivity;
  processingDisposition: Exclude<
    DataAssetProcessingDisposition,
    "prohibited"
  >;
  // A stale source keeps a succeeded run whose observation window is older
  // than the freshness SLA; the owning asset carries a transparent
  // exception (blocker codes, risk owner, review date, evidence).
  stale: boolean;
};

type ExceptionAssetSpec = {
  key: string;
  sourceKind: string;
  dataShape: DataAssetShape;
  sensitivity: ObservationSensitivity;
  processingDisposition: DataAssetProcessingDisposition;
  technicalFeasibility: Exclude<DataAssetTechnicalFeasibility, "unassessed">;
  denialReasonCode: string;
};

const CONNECTED_ASSET_SPECS: readonly ConnectedAssetSpec[] = [
  {
    key: "crm",
    sourceKind: "crm",
    dataShape: "structured",
    sensitivity: "confidential",
    processingDisposition: "local_only",
    stale: false,
  },
  {
    key: "erp",
    sourceKind: "erp_finance_database",
    dataShape: "structured",
    sensitivity: "internal",
    processingDisposition: "local_only",
    stale: true,
  },
  {
    key: "docs",
    sourceKind: "document_repository",
    dataShape: "document",
    sensitivity: "confidential",
    processingDisposition: "remote_projected",
    stale: false,
  },
  {
    key: "code",
    sourceKind: "code_repository",
    dataShape: "code",
    sensitivity: "internal",
    processingDisposition: "local_only",
    stale: false,
  },
  {
    key: "chat",
    sourceKind: "messaging_channel_archive",
    dataShape: "message",
    sensitivity: "confidential",
    processingDisposition: "local_only",
    stale: false,
  },
  {
    key: "calls",
    sourceKind: "call_audio_archive",
    dataShape: "audio",
    sensitivity: "confidential",
    processingDisposition: "local_only",
    stale: false,
  },
  {
    key: "web",
    sourceKind: "public_website_snapshot",
    dataShape: "semi_structured",
    sensitivity: "public",
    processingDisposition: "remote_projected",
    stale: false,
  },
] as const;

const EXCEPTION_ASSET_SPECS: readonly ExceptionAssetSpec[] = [
  {
    // Restricted people data: processing prohibited by synthetic policy.
    key: "hr",
    sourceKind: "hr_people_system",
    dataShape: "structured",
    sensitivity: "restricted",
    processingDisposition: "prohibited",
    technicalFeasibility: "feasible",
    denialReasonCode: "synthetic_policy_prohibits_processing",
  },
  {
    key: "legal",
    sourceKind: "legal_contract_vault",
    dataShape: "document",
    sensitivity: "restricted",
    processingDisposition: "prohibited",
    technicalFeasibility: "feasible",
    denialReasonCode: "synthetic_policy_prohibits_processing",
  },
  {
    // Feasible but deliberately left unauthorized by the synthetic owner.
    key: "support",
    sourceKind: "customer_support_desk",
    dataShape: "structured",
    sensitivity: "confidential",
    processingDisposition: "local_only",
    technicalFeasibility: "feasible",
    denialReasonCode: "synthetic_owner_deferred_authorization",
  },
  {
    // Technically blocked: no connector exists for the legacy medium.
    key: "tape",
    sourceKind: "legacy_backup_tape",
    dataShape: "other",
    sensitivity: "internal",
    processingDisposition: "local_only",
    technicalFeasibility: "not_feasible",
    denialReasonCode: "synthetic_connector_unavailable",
  },
  {
    key: "bi",
    sourceKind: "bi_reporting_warehouse",
    dataShape: "semi_structured",
    sensitivity: "internal",
    processingDisposition: "local_only",
    technicalFeasibility: "feasible",
    denialReasonCode: "synthetic_risk_review_pending",
  },
] as const;

const EVIDENCE_OUTPUT_TYPES = [
  "owner_answer",
  "operating_brief",
  "supervision_signal",
] as const;

type ConnectedAssetState = {
  spec: ConnectedAssetSpec;
  assetId: string;
  sourceId: string;
  runId: string;
  authorizationReceiptId: string;
  connectionReceiptId: string;
  initializationReceiptId: string;
  evidenceRef: string;
  memoryBinding: { ref: string; contentHash: string };
};

describeMysql(
  "CAIO Pro V1 synthetic loop with an isolated MySQL database",
  () => {
    let workspaceId = "";
    let ownerUserId = "";
    let employeeUserId = "";
    let reviewerUserId = "";
    let mandateRecordId = "";
    let base = new Date(0);
    let validFrom = new Date(0);
    let validUntil = new Date(0);
    let programId = "";
    let programAuthorizationRef = "";
    let temporalContextArtifactRef = "";
    const connectedAssets: ConnectedAssetState[] = [];
    let assessmentId = "";
    let assessmentExceptionRefs: string[] = [];
    let gateReceiptRef = "";
    let gateReceiptHash = "";
    let portfolioRef = "";
    let portfolioHash = "";
    let portfolioOpportunityRef = "";
    let portfolioQuestionIds: string[] = [];
    let selectionReceiptRef = "";
    let selectionReceiptHash = "";
    let boundDecisionRecordIds: string[] = [];
    let dispatchedDecisionRecordId = "";
    let dispatchedActionItemId = "";
    let executionReceiptId = "";
    let consentReceiptRef = "";
    let revocationReceiptRef = "";
    let deletionReceiptRef = "";
    let refusedRouteDecisionRef = "";

    function evidenceRefFor(key: string): string {
      return `evidence:caio-pro-v1:${key}:${suffix}`;
    }

    async function establishConnectedAsset(
      spec: ConnectedAssetSpec,
      index: number,
    ): Promise<ConnectedAssetState> {
      const slaMinutes = spec.stale ? 30 : 60;
      const windowStart = spec.stale
        ? new Date(base.getTime() - 110 * MINUTE_MS)
        : new Date(base.getTime() - 10 * MINUTE_MS);
      const windowEnd = spec.stale
        ? new Date(base.getTime() - 105 * MINUTE_MS)
        : new Date(base.getTime() - 5 * MINUTE_MS);
      const observedAt = spec.stale
        ? new Date(base.getTime() - 100 * MINUTE_MS)
        : new Date(base.getTime() - 4 * MINUTE_MS);
      const evidenceRef = evidenceRefFor(spec.key);

      const entry = await createDataAssetCatalogEntry({
        workspaceId,
        assetKey: `asset-${spec.key}-${suffix}`,
        sourceSystemRef: `system:synthetic-${spec.key}:${suffix}`,
        displayName: `Synthetic ${spec.sourceKind}`,
        sourceKind: spec.sourceKind,
        businessDomain: index % 2 === 0 ? "sales" : "delivery",
        businessOwnerRef: ownerUserId,
        purpose: `Observe the synthetic ${spec.sourceKind} for the CAIO Pro V1 loop`,
        scopeRefs: [`scope:synthetic-${spec.key}`],
        recommendedAccessMode: "read_only_api",
        retentionDays: 30,
        freshnessSlaMinutes: slaMinutes,
        residencyRequirements: ["region:test"],
        blindSpots: [],
        blockerCodes: spec.stale
          ? ["synthetic_stale_window_accepted"]
          : [],
        riskOwnerRef: ownerUserId,
        nextReviewAt: validUntil,
        evidenceRefs: [evidenceRefFor(`inventory-${spec.key}`)],
        actorName: "CAIO Pro Owner",
        actorUserId: ownerUserId,
        now: validFrom,
      });
      await recordDataAssetClassificationReceipt({
        workspaceId,
        assetId: entry.id,
        receiptId: `classification-${spec.key}-${suffix}`,
        idempotencyKey: `classification:${spec.key}:${suffix}`,
        expectedVersion: 1,
        dataShape: spec.dataShape,
        sensitivity: spec.sensitivity,
        processingDisposition: spec.processingDisposition,
        technicalFeasibility: "feasible",
        evidenceRefs: [evidenceRefFor(`classification-${spec.key}`)],
        actorName: "CAIO Pro Owner",
        actorUserId: ownerUserId,
        now: validFrom,
      });
      const authorizationReceiptId = `authorization-${spec.key}-${suffix}`;
      await recordDataAssetAuthorizationReceipt({
        workspaceId,
        assetId: entry.id,
        receiptId: authorizationReceiptId,
        idempotencyKey: `authorization:${spec.key}:${suffix}`,
        expectedVersion: 2,
        authorizationStatus: "authorized",
        authorizationRef: programAuthorizationRef,
        scopeRefs: [`scope:synthetic-${spec.key}`],
        consentRefs: [],
        validFrom,
        validUntil,
        reasonCodes: [],
        evidenceRefs: [evidenceRefFor(`authorization-${spec.key}`)],
        actorName: "CAIO Pro Owner",
        actorUserId: ownerUserId,
        now: validFrom,
      });
      const source = await registerObservationSource({
        workspaceId,
        programId,
        catalogEntryId: entry.id,
        sourceKey: `source-${spec.key}-${suffix}`,
        sourceKind: spec.sourceKind,
        accessMode: "read_only_api",
        ownerRef: ownerUserId,
        freshnessSlaMinutes: slaMinutes,
        sensitivity: spec.sensitivity,
        authorizationRef: programAuthorizationRef,
        secretRef: `secret-manager:synthetic-${spec.key}-${suffix}`,
        retentionDays: 30,
        actorName: "CAIO Pro Owner",
        actorUserId: ownerUserId,
        now: validFrom,
      });
      const connectionReceiptId = `connection-${spec.key}-${suffix}`;
      await recordDataAssetConnectionReceipt({
        workspaceId,
        assetId: entry.id,
        receiptId: connectionReceiptId,
        idempotencyKey: `connection:${spec.key}:${suffix}`,
        expectedVersion: 3,
        connectionStatus: "connected",
        accessMode: "read_only_api",
        connectorRef: `connector:synthetic-${spec.key}-${suffix}`,
        secretRef: `secret-manager:synthetic-${spec.key}-${suffix}`,
        authorizationReceiptRef: authorizationReceiptId,
        observationSourceRef: source.id,
        reasonCodes: [],
        evidenceRefs: [evidenceRefFor(`connection-${spec.key}`)],
        actorName: "CAIO Pro Owner",
        actorUserId: ownerUserId,
        now: validFrom,
      });
      const run = await beginObservationSourceRun({
        workspaceId,
        sourceKey: source.sourceKey,
        executionKey: `window-${spec.key}-${suffix}`,
        windowStart,
        windowEnd,
        now: new Date(windowEnd.getTime() + 1_000),
      });
      await completeObservationSourceRun({
        workspaceId,
        runId: run.id,
        observedAt,
        summaryHash: sha256(`synthetic-window:${spec.key}:${suffix}`),
        completenessPercent: 100,
        freshness: "fresh",
        outcome: "success",
        evidenceRefs: [evidenceRef],
        errorCodes: [],
      });

      const memory = await db.memoryFact.create({
        data: {
          workspaceId,
          objectType: ObjectType.COMPANY,
          objectId: `company:synthetic-${spec.key}:${suffix}`,
          factType: MemoryFactType.SUMMARY,
          title: `Synthetic operating fact from ${spec.sourceKind}`,
          content: `Synthetic company evidence derived from the ${spec.sourceKind} window`,
          sourceType: SourceType.SYSTEM_INFERENCE,
          sourceId: source.id,
          confidence: 90,
          importance: 80,
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
      const schemaArtifactId = `schema-${spec.key}-${suffix}`;
      const schemaArtifactRef = `artifact-bundle:${schemaArtifactId}`;
      const schemaMapping = withContentHash({
        schemaVersion: CAIO_SCHEMA_MAPPING_SCHEMA_VERSION,
        artifactRef: schemaArtifactRef,
        assetRef: entry.id,
        sourceSchemaHash: sha256(`source-schema:${spec.key}:${suffix}`),
        targetSchemaHash: sha256(`target-schema:${spec.key}:${suffix}`),
        mappingHash: sha256(`mapping:${spec.key}:${suffix}`),
        generatedAt: observedAt.toISOString(),
      });
      await db.artifactBundle.create({
        data: {
          id: schemaArtifactId,
          workspaceId,
          artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.schemaMapping,
          title: `Synthetic schema mapping for ${spec.sourceKind}`,
          status: ArtifactBundleStatus.CONFIRMED,
          artifactsJson: JSON.stringify(schemaMapping),
          systemOfRecordWrite: false,
          createdAt: observedAt,
        },
      });
      const initializationReceiptId = `initialization-${spec.key}-${suffix}`;
      await recordDataAssetInitializationReceipt({
        workspaceId,
        assetId: entry.id,
        receiptId: initializationReceiptId,
        idempotencyKey: `initialization:${spec.key}:${suffix}`,
        expectedVersion: 4,
        initializationStatus: "initialized",
        connectionReceiptRef: connectionReceiptId,
        observationRunRefs: [run.id],
        schemaMappingRefs: [schemaArtifactRef],
        companyMemoryRefs: [memoryBinding.ref],
        temporalContextSnapshotRef: temporalContextArtifactRef,
        reasonCodes: [],
        evidenceRefs: [evidenceRefFor(`initialization-${spec.key}`)],
        actorName: "CAIO Pro Owner",
        actorUserId: ownerUserId,
        now: new Date(base.getTime() - 2 * MINUTE_MS),
      });

      const traceSeed = {
        schemaVersion: CAIO_EVIDENCE_TRACE_SCHEMA_VERSION,
        evidenceRef,
        sourceRef: source.id,
        assetRef: entry.id,
        observationRunRef: run.id,
        authorizationReceiptRef: authorizationReceiptId,
        connectionReceiptRef: connectionReceiptId,
        initializationReceiptRef: initializationReceiptId,
        sensitivity: spec.sensitivity,
        outputType:
          EVIDENCE_OUTPUT_TYPES[index % EVIDENCE_OUTPUT_TYPES.length],
        capturedAt: new Date(observedAt.getTime() - 30_000).toISOString(),
        resolved: true,
      };
      await db.artifactBundle.create({
        data: {
          id: `trace-${spec.key}-${suffix}`,
          workspaceId,
          artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.evidenceTrace,
          title: `Synthetic evidence trace for ${spec.sourceKind}`,
          status: ArtifactBundleStatus.CONFIRMED,
          artifactsJson: JSON.stringify({
            ...traceSeed,
            traceHash: computeCaioEvidenceTraceHash(traceSeed),
          }),
          systemOfRecordWrite: false,
          createdAt: observedAt,
        },
      });

      return {
        spec,
        assetId: entry.id,
        sourceId: source.id,
        runId: run.id,
        authorizationReceiptId,
        connectionReceiptId,
        initializationReceiptId,
        evidenceRef,
        memoryBinding,
      };
    }

    async function establishExceptionAsset(
      spec: ExceptionAssetSpec,
    ): Promise<string> {
      const entry = await createDataAssetCatalogEntry({
        workspaceId,
        assetKey: `asset-${spec.key}-${suffix}`,
        sourceSystemRef: `system:synthetic-${spec.key}:${suffix}`,
        displayName: `Synthetic ${spec.sourceKind}`,
        sourceKind: spec.sourceKind,
        businessDomain: "operations",
        businessOwnerRef: ownerUserId,
        purpose: `Record the synthetic ${spec.sourceKind} inventory decision`,
        scopeRefs: [`scope:synthetic-${spec.key}`],
        recommendedAccessMode: "read_only_api",
        retentionDays: 30,
        freshnessSlaMinutes: 60,
        residencyRequirements: ["region:test"],
        blindSpots: [],
        blockerCodes: [],
        riskOwnerRef: ownerUserId,
        nextReviewAt: validUntil,
        evidenceRefs: [evidenceRefFor(`inventory-${spec.key}`)],
        actorName: "CAIO Pro Owner",
        actorUserId: ownerUserId,
        now: validFrom,
      });
      await recordDataAssetClassificationReceipt({
        workspaceId,
        assetId: entry.id,
        receiptId: `classification-${spec.key}-${suffix}`,
        idempotencyKey: `classification:${spec.key}:${suffix}`,
        expectedVersion: 1,
        dataShape: spec.dataShape,
        sensitivity: spec.sensitivity,
        processingDisposition: spec.processingDisposition,
        technicalFeasibility: spec.technicalFeasibility,
        evidenceRefs: [evidenceRefFor(`classification-${spec.key}`)],
        actorName: "CAIO Pro Owner",
        actorUserId: ownerUserId,
        now: validFrom,
      });
      // The transparent exception path: the asset stays denied with a
      // reason code, a risk owner, a future review date, and evidence.
      await recordDataAssetAuthorizationReceipt({
        workspaceId,
        assetId: entry.id,
        receiptId: `authorization-${spec.key}-${suffix}`,
        idempotencyKey: `authorization:${spec.key}:${suffix}`,
        expectedVersion: 2,
        authorizationStatus: "denied",
        authorizationRef: null,
        scopeRefs: [],
        consentRefs: [],
        validFrom: null,
        validUntil: null,
        reasonCodes: [spec.denialReasonCode],
        evidenceRefs: [evidenceRefFor(`authorization-${spec.key}`)],
        actorName: "CAIO Pro Owner",
        actorUserId: ownerUserId,
        now: validFrom,
      });
      return entry.id;
    }

    function selectionFor(
      questionId: string,
      priority: number,
    ) {
      return {
        questionId,
        questionOverride: null,
        goal: `Validate evidence-bound operating priority ${priority}`,
        successMetrics: [
          {
            metricKey: `metric-${priority}`,
            target: `Improve the governed baseline ${priority} without external mutation`,
          },
        ],
        priority,
        implementationScopeRefs: ["scope:review-only"],
        ownerRef: null,
        reviewerRef: null,
        startsAt: null,
        endsAt: null,
        prohibitedActions: ["external_side_effect"],
      };
    }

    function syntheticEvidencePackageSeed() {
      return {
        schemaVersion: "helm.caio-pro-v1.synthetic-evidence-package.v1",
        workspaceRef: `workspace:${workspaceId}`,
        g0: {
          assessmentRef: assessmentId,
          gateReceiptRef,
          gateReceiptHash,
        },
        portfolio: { portfolioRef, portfolioHash },
        selection: { selectionReceiptRef, selectionReceiptHash },
        decisions: [...boundDecisionRecordIds].sort((left, right) =>
          left.localeCompare(right),
        ),
        execution: {
          actionItemRef: dispatchedActionItemId,
          executionReceiptRef: executionReceiptId,
        },
        contextAgent: {
          consentReceiptRef,
          revocationReceiptRef,
          deletionReceiptRef,
        },
        refusedRouteDecisionRef,
      };
    }

    beforeAll(async () => {
      assertIsolatedDatabaseTarget();
      base = new Date(Math.floor(Date.now() / 1_000) * 1_000);
      validFrom = new Date(base.getTime() - 3 * HOUR_MS);
      validUntil = new Date(base.getTime() + 24 * HOUR_MS);

      const workspace = await db.workspace.create({
        data: {
          name: `CAIO Pro V1 loop ${suffix}`,
          slug: WORKSPACE_SLUG,
        },
      });
      workspaceId = workspace.id;
      const [owner, employee, reviewer] = await Promise.all([
        db.user.create({
          data: { name: "CAIO Pro Owner", email: OWNER_EMAIL },
        }),
        db.user.create({
          data: { name: "CAIO Pro Member", email: EMPLOYEE_EMAIL },
        }),
        db.user.create({
          data: { name: "CAIO Pro Reviewer", email: REVIEWER_EMAIL },
        }),
      ]);
      ownerUserId = owner.id;
      employeeUserId = employee.id;
      reviewerUserId = reviewer.id;
      await db.membership.createMany({
        data: [
          {
            workspaceId,
            userId: ownerUserId,
            role: WorkspaceRole.OWNER,
            status: MembershipStatus.ACTIVE,
          },
          {
            workspaceId,
            userId: employeeUserId,
            role: WorkspaceRole.MEMBER,
            status: MembershipStatus.ACTIVE,
          },
          {
            workspaceId,
            userId: reviewerUserId,
            role: WorkspaceRole.REVIEWER,
            status: MembershipStatus.ACTIVE,
          },
        ],
      });
      const portfolioOpportunity = await db.opportunity.create({
        data: {
          workspaceId,
          ownerId: ownerUserId,
          title: `CAIO Pro V1 business Portfolio ${suffix}`,
          type: OpportunityType.INTERNAL,
          stage: OpportunityStage.ADVANCING,
          riskLevel: RiskLevel.HIGH,
          nextAction: "Complete the governed synthetic operating review",
        },
      });
      portfolioOpportunityRef = `opportunity:${portfolioOpportunity.id}`;

      await registerCaioPrincipalBinding({
        workspaceId,
        actorUserId: ownerUserId,
        userId: ownerUserId,
        principalRef: CEO_REF,
        principalKind: "ceo",
        evidenceRef: evidenceRefFor("ceo-binding"),
      });
      const mandate = await createCaioMandateDraft({
        workspaceId,
        actorUserId: ownerUserId,
        caioRef: "caio:synthetic-pro-v1",
        ceoRef: CEO_REF,
        stage: "observe",
        stageDecisionRef: `stage-decision:pro-v1:${suffix}`,
        objectiveRefs: ["objective:initialize-company-truth"],
        scopeRefs: ["scope:read-only-observation"],
        grantBasisRefs: [`caio-mandate-grant:${CEO_REF}:pro-v1-${suffix}`],
        reservedMatterRefs: ["reserved:external-side-effects"],
        humanResponsePolicyRef: "policy:human-response-v1",
        accountabilityAnchorRefs: ["anchor:ceo"],
        guardianStopRefs: [],
        validFrom: withoutMilliseconds(validFrom),
        validUntil: withoutMilliseconds(validUntil),
        inFlightDisposition: "freeze",
        auditRefs: [`audit:pro-v1-mandate:${suffix}`],
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
        purpose:
          "Observe the synthetic enterprise catalog for the CAIO Pro V1 loop",
        scopeRefs: ["scope:synthetic-enterprise"],
        dataCategories: ["synthetic-operating-record"],
        startsAt: validFrom,
        expiresAt: validUntil,
        retentionDays: 30,
        authorizationRef: `authorization:pro-v1:${suffix}`,
        actorName: "CAIO Pro Owner",
        actorUserId: ownerUserId,
      });
      programId = program.id;
      programAuthorizationRef = program.authorizationRef;

      const contextInput = syntheticTemporalOperatingContextInput();
      const contextProjection = projectTemporalOperatingContext(contextInput);
      if (!contextProjection.snapshot) {
        throw new Error("synthetic temporal context projection failed");
      }
      const contextArtifactId = `context-pro-v1-${suffix}`;
      temporalContextArtifactRef = `artifact-bundle:${contextArtifactId}`;
      const context = withContentHash({
        schemaVersion: CAIO_TEMPORAL_CONTEXT_ARTIFACT_SCHEMA_VERSION,
        artifactRef: temporalContextArtifactRef,
        workspaceRef: `workspace:${workspaceId}`,
        projectionInput: contextInput,
        snapshot: contextProjection.snapshot,
        projectionInputHash: sha256(canonicalJson(contextInput)),
        snapshotHash: contextProjection.snapshot.contentHash,
        replayRootHash: contextProjection.snapshot.replayRootHash,
      });
      await db.artifactBundle.create({
        data: {
          id: contextArtifactId,
          workspaceId,
          artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.temporalContext,
          title: "Synthetic CAIO Pro V1 temporal context",
          status: ArtifactBundleStatus.CONFIRMED,
          artifactsJson: JSON.stringify(context),
          systemOfRecordWrite: false,
          createdAt: new Date(base.getTime() - 4 * MINUTE_MS),
        },
      });
    });

    afterAll(async () => {
      // The suite targets a disposable, prefix-guarded database and every
      // identifier carries a per-run suffix, so retained rows never collide
      // with a later run. Model-egress evidence is append-only by design and
      // is intentionally not deleted.
      await db.$disconnect();
    });

    it("inventories, classifies, and authorizes a broad synthetic catalog", async () => {
      for (const [index, spec] of CONNECTED_ASSET_SPECS.entries()) {
        connectedAssets.push(await establishConnectedAsset(spec, index));
      }
      for (const spec of EXCEPTION_ASSET_SPECS) {
        await establishExceptionAsset(spec);
      }

      const allSpecs = [
        ...CONNECTED_ASSET_SPECS,
        ...EXCEPTION_ASSET_SPECS,
      ];
      expect(
        new Set(allSpecs.map((spec) => spec.sourceKind)).size,
      ).toBeGreaterThanOrEqual(12);
      expect(new Set(allSpecs.map((spec) => spec.sensitivity))).toEqual(
        new Set(["public", "internal", "confidential", "restricted"]),
      );
      expect(
        new Set(allSpecs.map((spec) => spec.processingDisposition)),
      ).toEqual(
        new Set(["prohibited", "local_only", "remote_projected"]),
      );
      expect(
        allSpecs.some((spec) => spec.dataShape === "document") &&
          allSpecs.some((spec) => spec.dataShape === "structured") &&
          allSpecs.some((spec) => spec.dataShape === "code") &&
          allSpecs.some((spec) => spec.dataShape === "message") &&
          allSpecs.some((spec) => spec.dataShape === "audio"),
      ).toBe(true);

      const entries = await db.dataAssetCatalogEntry.findMany({
        where: { workspaceId },
        select: {
          sourceKind: true,
          authorizationStatus: true,
          technicalFeasibility: true,
          blockerCodes: true,
        },
      });
      expect(entries).toHaveLength(allSpecs.length);
      expect(
        entries.filter((entry) => entry.authorizationStatus === "DENIED"),
      ).toHaveLength(EXCEPTION_ASSET_SPECS.length);
      const blocked = entries.find(
        (entry) => entry.technicalFeasibility === "NOT_FEASIBLE",
      );
      expect(blocked).toBeDefined();
      expect(
        JSON.parse(blocked?.blockerCodes ?? "[]"),
      ).toContain("synthetic_connector_unavailable");
    });

    it("computes a ready G0 assessment with transparent exceptions", async () => {
      // The stale erp source keeps a SUCCEEDED run whose observation window
      // is older than its 30-minute SLA, so the projection marks it stale
      // and its transparent exception must surface in the assessment.
      const staleAsset = connectedAssets.find((asset) => asset.spec.stale);
      expect(staleAsset).toBeDefined();

      const memoryReceiptBindings = connectedAssets
        .map((asset) => asset.memoryBinding)
        .sort((left, right) => left.ref.localeCompare(right.ref));
      const memoryArtifactId = `memory-rebuild-pro-v1-${suffix}`;
      const memoryReceipt = withContentHash({
        schemaVersion: CAIO_MEMORY_REBUILD_RECEIPT_SCHEMA_VERSION,
        artifactRef: `artifact-bundle:${memoryArtifactId}`,
        receiptRef: `receipt:memory-rebuild:${suffix}`,
        workspaceRef: `workspace:${workspaceId}`,
        memoryFactBindings: memoryReceiptBindings,
        memoryRootHash: computeCaioMemoryRootHash(memoryReceiptBindings),
        rebuiltAt: new Date(base.getTime() - 3 * MINUTE_MS).toISOString(),
      });
      await db.artifactBundle.create({
        data: {
          id: memoryArtifactId,
          workspaceId,
          artifactType:
            CAIO_INITIALIZATION_ARTIFACT_TYPES.memoryRebuildReceipt,
          title: "Synthetic CAIO Pro V1 memory rebuild receipt",
          status: ArtifactBundleStatus.CONFIRMED,
          artifactsJson: JSON.stringify(memoryReceipt),
          systemOfRecordWrite: false,
          createdAt: new Date(base.getTime() - 3 * MINUTE_MS),
        },
      });

      const evaluation = await recordCaioInitializationAssessment({
        workspaceId,
        mandateRecordId,
        evaluationKey: `pro-v1-evaluation-${suffix}`,
        actorUserId: ownerUserId,
        now: base,
      });
      expect(evaluation.assessment.failures).toEqual([]);
      expect(evaluation.assessment.decision).toBe(
        "ready_for_owner_acceptance",
      );
      // 5 denied assets + 1 stale-source exception, all transparent.
      expect(evaluation.assessment.exceptionRefs).toHaveLength(
        EXCEPTION_ASSET_SPECS.length + 1,
      );
      expect(evaluation.assessment.authorityEffect).toBe("none");
      assessmentId = evaluation.assessment.assessmentId;
      assessmentExceptionRefs = [...evaluation.assessment.exceptionRefs];
    });

    it("records CEO acceptance of the G0 gate through the principal binding seam", async () => {
      const accepted = await acceptCaioInitializationGate({
        workspaceId,
        assessmentId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `pro-v1-accept-${suffix}`,
        inventoryConfirmationRef: `confirmation:inventory:${suffix}`,
        customerAcceptanceRef: `acceptance:ceo:${suffix}`,
        acceptedExceptionRefs: assessmentExceptionRefs,
        reasonCodes: ["initialization_reviewed"],
        evidenceRefs: [evidenceRefFor("g0-acceptance")],
        now: new Date(base.getTime() + 1_000),
      });
      expect(accepted.replayed).toBe(false);
      expect(accepted.receipt.resultingStatus).toBe("accepted");
      expect(accepted.receipt.authorityEffect).toBe("none");
      expect(accepted.receipt.acceptedExceptionRefs).toEqual(
        [...assessmentExceptionRefs].sort((left, right) =>
          left.localeCompare(right),
        ),
      );
      gateReceiptRef = accepted.receipt.receiptId;
      gateReceiptHash = accepted.receipt.contentHash;
      expect(await db.actionItem.count({ where: { workspaceId } })).toBe(0);
      expect(await db.approvalTask.count({ where: { workspaceId } })).toBe(0);
    });

    it("generates an exactly-ten portfolio including a conflicting-facts candidate", async () => {
      const evidenceRefs = connectedAssets.map((asset) => asset.evidenceRef);
      const candidates = Array.from({ length: 10 }, (_, index) => {
        const candidate = syntheticOperatingQuestionCandidate(index);
        const evidenceRef = evidenceRefs[index % evidenceRefs.length];
        return {
          ...candidate,
          impactObjectRefs: [
            ...candidate.impactObjectRefs,
            portfolioOpportunityRef,
          ],
          facts: candidate.facts.map((fact) => ({
            ...fact,
            evidenceRefs: [evidenceRef],
          })),
          inferences: candidate.inferences.map((inference) => ({
            ...inference,
            evidenceRefs: [evidenceRef],
          })),
          evidenceRefs:
            index === 0
              ? [evidenceRefs[0], evidenceRefs[1]]
              : [evidenceRef],
          conflicts:
            index === 0
              ? [
                  {
                    description:
                      "Two synthetic sources report different values for the same operating window.",
                    evidenceRefs: [evidenceRefs[0], evidenceRefs[1]],
                  },
                ]
              : candidate.conflicts,
        };
      });
      expect(
        candidates.filter((candidate) => candidate.conflicts.length > 0)
          .length,
      ).toBeGreaterThanOrEqual(1);

      const generated = await generateCaioOperatingQuestionPortfolio({
        workspaceId,
        actorUserId: ownerUserId,
        generationKey: `pro-v1-generation-${suffix}`,
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        candidates,
        auditRefs: [`audit:pro-v1-generation:${suffix}`],
        now: new Date(base.getTime() + 2_000),
      });
      expect(generated.receipt.gapCodes).toEqual([]);
      expect(generated.receipt.status).toBe("generated");
      if (!generated.portfolio) {
        throw new Error("CAIO Pro V1 portfolio missing");
      }
      expect(generated.portfolio.candidates).toHaveLength(10);
      expect(generated.portfolio.authorityEffect).toBe("none");
      expect(
        generated.portfolio.candidates.filter(
          (candidate) => candidate.conflicts.length > 0,
        ),
      ).toHaveLength(1);
      portfolioRef = generated.portfolio.portfolioId;
      portfolioHash = generated.portfolio.contentHash;
      portfolioQuestionIds = generated.portfolio.candidates.map(
        (candidate) => candidate.questionId,
      );
    });

    it("records the CEO selecting two questions and binds them to DecisionRecords", async () => {
      const selected = await selectCaioOperatingQuestions({
        workspaceId,
        expectedPortfolioId: portfolioRef,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `pro-v1-selection-${suffix}`,
        selections: [
          selectionFor(portfolioQuestionIds[0], 1),
          selectionFor(portfolioQuestionIds[1], 2),
        ],
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: [connectedAssets[0].evidenceRef],
        now: new Date(base.getTime() + 3_000),
      });
      expect(selected.receipt.selectedQuestionIds).toHaveLength(2);
      expect(selected.receipt.workPacketEffect).toBe("none");
      selectionReceiptRef = selected.receipt.receiptId;
      selectionReceiptHash = selected.receipt.contentHash;

      const bound = await bindCurrentCaioQuestionSelectionToDecisionRecords({
        workspaceId,
        expectedSelectionReceiptId: selectionReceiptRef,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        now: new Date(base.getTime() + 4_000),
      });
      expect(bound.bindings).toHaveLength(2);
      boundDecisionRecordIds = bound.bindings.map(
        (binding) => binding.decisionRecordId,
      );

      const plans = await db.caioOperatingQuestionImplementationPlan.findMany({
        where: { workspaceId },
        select: { authorityEffect: true, workPacketEffect: true },
      });
      expect(plans).toHaveLength(2);
      for (const plan of plans) {
        expect(plan.authorityEffect).toBe("none");
        expect(plan.workPacketEffect).toBe("none");
      }
      // Binding alone must not dispatch anything.
      expect(await db.actionItem.count({ where: { workspaceId } })).toBe(0);
      expect(await db.approvalTask.count({ where: { workspaceId } })).toBe(0);
    });

    it("dispatches one work packet and records an independently verified execution receipt", async () => {
      dispatchedDecisionRecordId = boundDecisionRecordIds[0];
      await confirmStage1DecisionRecord({
        workspaceId,
        decisionRecordId: dispatchedDecisionRecordId,
        conclusion: "Review the first selected operating question now",
        actorName: "CAIO Pro Owner",
        actorUserId: ownerUserId,
      });
      const command: OwnerCommandDraft = {
        commandId: `command-pro-v1-${suffix}`,
        workspaceRef: `workspace:${workspaceId}`,
        decisionRef: dispatchedDecisionRecordId,
        ownerRef: ownerUserId,
        executionTargetRef: "team:synthetic-operating-review",
        portfolioRef: portfolioOpportunityRef,
        goal: "Validate the first selected operating question",
        action: "Prepare a governed review packet after approval",
        dueAt: new Date(base.getTime() + 48 * HOUR_MS).toISOString(),
        acceptanceCriteria: [
          "The review packet is independently verified",
        ],
        evidenceRequirements: [evidenceRefFor("work-packet")],
        invalidationConditions: ["The synthetic operating focus changes"],
        escalationOwnerRef: ownerUserId,
        automationLevel: "assist",
        allowedToolRefs: ["tool:task-draft"],
        externalSideEffects: [],
        policyEnvelopeRef: null,
        status: "owner_confirmed",
      };
      const dispatched = await dispatchStage1DecisionWorkPacket({
        workspaceId,
        decisionRecordId: dispatchedDecisionRecordId,
        command,
        actorName: "CAIO Pro Owner",
        actorUserId: ownerUserId,
      });
      dispatchedActionItemId = dispatched.actionItemId;
      expect(
        await db.approvalTask.count({
          where: { workspaceId, actionItemId: dispatchedActionItemId },
        }),
      ).toBe(1);

      await db.$transaction([
        db.approvalTask.update({
          where: { actionItemId: dispatchedActionItemId },
          data: {
            status: ApprovalStatus.EXECUTED,
            reviewedById: reviewerUserId,
            reviewedAt: new Date(),
          },
        }),
        db.actionItem.update({
          where: { id: dispatchedActionItemId },
          data: {
            status: ActionStatus.EXECUTED,
            executionStatus: "completed",
            executedAt: new Date(),
          },
        }),
      ]);
      await recordExecutionReceipt({
        workspaceId,
        subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
        subjectId: dispatchedActionItemId,
        actionItemId: dispatchedActionItemId,
        outcome: ExecutionReceiptOutcome.SUCCESS,
        actionTaken: "SYNTHETIC_CAIO_PRO_V1_FOLLOW_THROUGH",
        evidenceRefs: [evidenceRefFor("execution")],
        executedByUserId: ownerUserId,
        executedByActorType: ActorType.USER,
        actorName: "CAIO Pro Owner",
      });
      await verifyExecutionReceipt({
        workspaceId,
        subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
        subjectId: dispatchedActionItemId,
        verifierUserId: reviewerUserId,
        verifierName: "CAIO Pro Reviewer",
      });
      const receiptRow = await db.executionReceipt.findUniqueOrThrow({
        where: {
          subjectType_subjectId: {
            subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
            subjectId: dispatchedActionItemId,
          },
        },
        select: { id: true, verificationState: true, verifiedByUserId: true },
      });
      expect(receiptRow.verificationState).toBe(
        ExecutionReceiptVerificationState.VERIFIED,
      );
      expect(receiptRow.verifiedByUserId).toBe(reviewerUserId);
      executionReceiptId = receiptRow.id;
    });

    it("evaluates the decision and leaves an OBSERVED memory candidate", async () => {
      const decisionRow = await db.decisionRecord.findUniqueOrThrow({
        where: { id: dispatchedDecisionRecordId },
        select: { decisionKey: true },
      });
      const evaluated = await evaluateStage1DecisionRecord({
        workspaceId,
        decisionRecordId: dispatchedDecisionRecordId,
        followedAiRecommendation: true,
        outcome: {
          outcomeRef: `business-outcome:synthetic-pro-v1-${suffix}`,
          result: "success",
        },
        actorName: "Helm Evaluation Runtime",
        actorType: ActorType.AI,
      });
      expect(evaluated.evaluation).toBeDefined();
      expect(
        await db.memoryFact.count({
          where: {
            workspaceId,
            objectId: dispatchedActionItemId,
            sourceId: `evaluation:${decisionRow.decisionKey}`,
            status: MemoryStatus.OBSERVED,
            confirmedByUser: false,
          },
        }),
      ).toBe(1);
      expect(
        await db.decisionRecord.findUnique({
          where: { id: dispatchedDecisionRecordId },
          select: { status: true },
        }),
      ).toEqual({ status: "EVALUATED" });
    });

    it("closes one context-agent consent, revocation, and deletion-receipt chain", async () => {
      const invitation = await inviteContextAgentParticipation({
        workspaceId,
        actorUserId: ownerUserId,
        memberUserId: employeeUserId,
        scope: {
          deviceRefs: [`device:synthetic-workstation-${suffix}`],
          directoryRefs: ["dir:projects"],
          enterpriseAppRefs: ["app:synthetic-crm"],
          purposes: ["company_memory_candidates"],
        },
        evidenceRefs: [evidenceRefFor("context-invite")],
        idempotencyKey: `context-invite-${suffix}`,
      });
      const consent = await recordContextAgentConsent({
        workspaceId,
        actorUserId: employeeUserId,
        invitationId: invitation.invitation.invitationId,
        evidenceRefs: [evidenceRefFor("context-consent")],
        idempotencyKey: `context-consent-${suffix}`,
      });
      expect(consent.receipt.performanceInputProhibited).toBe(true);
      consentReceiptRef = consent.receipt.receiptId;

      const revocation = await revokeContextAgentConsent({
        workspaceId,
        actorUserId: employeeUserId,
        consentReceiptId: consentReceiptRef,
        reasonCodes: ["member_revoked"],
        evidenceRefs: [evidenceRefFor("context-revocation")],
        idempotencyKey: `context-revoke-${suffix}`,
      });
      revocationReceiptRef = revocation.receipt.receiptId;
      expect(revocation.receipt.deletionWorkItemRef).toMatch(
        /^context-agent-deletion-work:/u,
      );

      const deletion = await recordContextAgentDeletionOutcome({
        workspaceId,
        actorUserId: ownerUserId,
        revocationReceiptId: revocationReceiptRef,
        outcome: "success",
        counts: {
          indicesDeleted: 2,
          cachesDeleted: 1,
          derivedVectorsDeleted: 3,
          memoryCandidatesDeleted: 1,
          observedFactsDeleted: 0,
          observedFactsEvidenceInvalidated: 0,
          multiSourceRecomputed: 0,
        },
        failureCodes: [],
        evidenceRefs: [evidenceRefFor("context-deletion")],
        idempotencyKey: `context-deletion-${suffix}`,
      });
      expect(deletion.receipt.outcome).toBe("success");
      deletionReceiptRef = deletion.receipt.receiptId;
    });

    it("refuses an unregistered model route fail-closed", async () => {
      // No tenant model-route policy is registered for this key, so the
      // governed decision must come back blocked with no started receipt —
      // an unregistered model can never egress data.
      const refused = await prepareModelRouteDecision({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        policyKey: `caio-pro-v1-unregistered-${suffix}`,
        requestKey: `request:pro-v1-refused-${suffix}`,
        taskClass: "summary_briefing",
        taskRef: `briefing:pro-v1-refused-${suffix}`,
        sourceAssetRefs: [connectedAssets[0].assetId],
        candidateEvidenceRefs: [connectedAssets[0].evidenceRef],
        selectedEvidenceRefs: [connectedAssets[0].evidenceRef],
        droppedEvidenceRefs: [],
        projectionReceiptRef: null,
        projectedPayloadHash: sha256(
          canonicalJson({ synthetic: `pro-v1-${suffix}` }),
        ),
        promptInjectionScanStatus: "passed",
        requestedMaxOutputTokens: 200,
        allowFallback: false,
      });
      expect(refused.decision.decision).toBe("blocked");
      expect(refused.decision.reasonCodes).toContain(
        "no_active_model_route_policy",
      );
      expect(refused.startedReceipt).toBeNull();
      refusedRouteDecisionRef = refused.decision.decisionId;
    });

    it("computes a deterministic synthetic evidence-package hash within this run", () => {
      // Replayability statement kept honest: identifiers carry per-run
      // suffixes, so this proves same-run determinism of the canonical
      // hash over the chain's key receipts — not cross-run replay.
      expect(assessmentId).not.toBe("");
      expect(gateReceiptRef).not.toBe("");
      expect(portfolioRef).not.toBe("");
      expect(selectionReceiptRef).not.toBe("");
      expect(executionReceiptId).not.toBe("");
      expect(consentReceiptRef).not.toBe("");
      expect(deletionReceiptRef).not.toBe("");
      expect(refusedRouteDecisionRef).not.toBe("");

      const first = sha256(canonicalJson(syntheticEvidencePackageSeed()));
      const second = sha256(canonicalJson(syntheticEvidencePackageSeed()));
      expect(first).toBe(second);
      expect(first).toMatch(/^sha256:[a-f0-9]{64}$/u);
    });

    // ----------------------------------------------------------------------
    // Site-deployment completion gate: P4-P8 as a governed TODO checklist.
    // ----------------------------------------------------------------------

    const DAY_MS = 24 * HOUR_MS;

    function completionValuePayload(questionId: string) {
      return {
        questionId,
        baselineWindow: {
          start: new Date(base.getTime() - 80 * DAY_MS).toISOString(),
          end: new Date(base.getTime() - 45 * DAY_MS).toISOString(),
        },
        resultWindow: {
          start: new Date(base.getTime() - 45 * DAY_MS).toISOString(),
          end: new Date(base.getTime() - 10 * DAY_MS).toISOString(),
        },
        resultWindowShortfallReason: null,
        metricDefinitions: [
          {
            metricKey: `governed-operating-baseline-${questionId}`,
            definition:
              "Synthetic governed operating baseline observed over the evidence window",
            dataSourceRefs: [connectedAssets[0].evidenceRef],
          },
        ],
        observedDelta: {
          description:
            "Synthetic observed improvement of the governed baseline",
          quantifiedValue: 3200,
          currency: "CNY",
          confidence: "medium" as const,
          evidenceRefs: [connectedAssets[0].evidenceRef],
        },
        adviceRefs: [evidenceRefFor(`advice-${questionId}`)],
        decisionRefs: boundDecisionRecordIds,
        executionReceiptRefs: [executionReceiptId],
        acceptanceReceiptRefs: [executionReceiptId],
        counterfactualNotes:
          "Synthetic counterfactual: part of the delta may have occurred without the advice chain",
        externalFactorNotes:
          "Synthetic external factor: demand shifted during the result window",
        valueClasses: ["efficiency" as const],
        unprovenParts: [
          "Causality between the advice chain and the full delta is unproven",
        ],
        nextStepRecommendation:
          "Continue observation for one more governed window before expansion",
        ownerConclusion: "continue" as const,
      };
    }

    it("surfaces the P4-P8 completion TODO list with missing items", async () => {
      const status = await getCaioProV1CompletionStatus({
        workspaceId,
        actorUserId: ownerUserId,
      });
      expect(status.state).toBe("not_ready");
      expect(status.receipt).toBeNull();
      expect(status.items).toHaveLength(13);
      // The chain built so far already satisfies the derivable items...
      for (const satisfiedKey of [
        "p4_asset_states_complete",
        "p5_g0_accepted",
        "p6_portfolio_generated",
        "p6_ceo_selection_recorded",
        "p6_implementation_plans_materialized",
        "p7_supervision_chain_closed",
      ] as const) {
        expect(
          status.items.find((item) => item.itemKey === satisfiedKey)?.status,
        ).toBe("satisfied");
      }
      // ...while the value, retrospective, and attestation items stay open.
      expect(status.missingItemKeys).toEqual([
        "p4_asset_inventory_confirmed",
        "p7_value_receipts_recorded",
        "p3_device_security_accepted",
        "p3_runtime_truth_bound",
        "p8_incident_posture_clear",
        "p8_retrospective_recorded",
        "p8_maturity_decision_recorded",
      ]);
    });

    it("refuses CEO acceptance while completion items are missing", async () => {
      const notReady = await recordCaioProV1CompletionAssessment({
        workspaceId,
        actorUserId: ownerUserId,
        evaluationKey: `completion-not-ready-${suffix}`,
      });
      expect(notReady.assessment.decision).toBe("not_ready");
      await expect(
        acceptCaioProV1CompletionGate({
          workspaceId,
          actorUserId: ownerUserId,
          ceoPrincipalRef: CEO_REF,
          assessmentId: notReady.assessment.assessmentId,
          idempotencyKey: `completion-accept-early-${suffix}`,
          reasonCodes: ["site_deployment_reviewed"],
          evidenceRefs: [evidenceRefFor("completion-acceptance-early")],
        }),
      ).rejects.toThrow(
        "completion_assessment_stale_reassessment_required",
      );
      expect(
        await db.caioProV1CompletionGateReceipt.count({
          where: { workspaceId },
        }),
      ).toBe(0);
    });

    it("records value receipts, the retrospective, and the five owner attestations", async () => {
      for (const questionId of [
        portfolioQuestionIds[0],
        portfolioQuestionIds[1],
      ]) {
        const recorded = await recordCaioQuestionValueReceipt({
          workspaceId,
          actorUserId: ownerUserId,
          payload: completionValuePayload(questionId),
          idempotencyKey: `completion-value-${questionId}-${suffix}`,
        });
        expect(recorded.replayed).toBe(false);
        expect(recorded.receipt.selectionReceiptRef).toBe(
          selectionReceiptRef,
        );
      }
      const retrospective = await recordCaioProV1RetrospectiveReceipt({
        workspaceId,
        actorUserId: ownerUserId,
        payload: {
          reusablePackAssetRefs: [
            evidenceRefFor("retrospective-pack-asset"),
          ],
          customerOverlayRefs: [evidenceRefFor("retrospective-overlay")],
          maturityEvaluations: [
            {
              actionCategory: "operating_review",
              recommendation: "advise",
              evidenceRefs: [evidenceRefFor("retrospective-review")],
            },
          ],
          overallRecommendation: "continue",
        },
        idempotencyKey: `completion-retrospective-${suffix}`,
      });
      expect(retrospective.receipt.maturityPromotionEffect).toBe("none");
      for (const itemKey of CAIO_PRO_V1_ATTESTABLE_ITEMS) {
        const attested = await recordCaioProV1EvidenceAttestation({
          workspaceId,
          actorUserId: ownerUserId,
          ceoPrincipalRef: CEO_REF,
          itemKey,
          statement: `Synthetic owner attestation for ${itemKey}`,
          evidenceRefs: [evidenceRefFor(`attestation-${itemKey}`)],
          idempotencyKey: `completion-attest-${itemKey}-${suffix}`,
        });
        expect(attested.attestation.authorityEffect).toBe("none");
      }
    });

    it("flips the assessment ready, records CEO acceptance, and shows complete", async () => {
      const ready = await recordCaioProV1CompletionAssessment({
        workspaceId,
        actorUserId: ownerUserId,
        evaluationKey: `completion-ready-${suffix}`,
      });
      expect(ready.assessment.decision).toBe("ready_for_owner_acceptance");
      expect(ready.assessment.missingItemKeys).toEqual([]);

      const accepted = await acceptCaioProV1CompletionGate({
        workspaceId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        assessmentId: ready.assessment.assessmentId,
        idempotencyKey: `completion-accept-${suffix}`,
        reasonCodes: ["site_deployment_reviewed"],
        evidenceRefs: [evidenceRefFor("completion-acceptance")],
      });
      expect(accepted.replayed).toBe(false);
      expect(accepted.receipt.resultingStatus).toBe("accepted");
      expect(accepted.receipt.authorityEffect).toBe("none");
      // The frozen boundary: acceptance is the precondition for
      // full-function operation, never its activation.
      expect(accepted.receipt.fullFunctionOperation).toBe(
        "not_authorized_by_this_receipt",
      );
      // Acceptance dispatches nothing beyond the packet already present.
      expect(await db.actionItem.count({ where: { workspaceId } })).toBe(1);

      const status = await getCaioProV1CompletionStatus({
        workspaceId,
        actorUserId: ownerUserId,
      });
      expect(status.state).toBe("accepted");
      expect(status.missingItemKeys).toEqual([]);
      expect(status.staleReasons).toEqual([]);
    });

    it("revokes the completion gate and fail-closes the accepted state", async () => {
      const revoked = await revokeCaioProV1CompletionGate({
        workspaceId,
        actorUserId: ownerUserId,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: `completion-revoke-${suffix}`,
        reasonCodes: ["synthetic_revocation_drill"],
        evidenceRefs: [evidenceRefFor("completion-revocation")],
      });
      expect(revoked.receipt.resultingStatus).toBe("revoked");
      expect(revoked.receipt.fullFunctionOperation).toBe(
        "not_authorized_by_this_receipt",
      );

      const status = await getCaioProV1CompletionStatus({
        workspaceId,
        actorUserId: ownerUserId,
      });
      // Accepted is no longer current; the checklist itself remains ready
      // but a NEW assessment and a fresh CEO acceptance are required.
      expect(status.state).toBe("revoked");
      expect(status.receipt?.resultingStatus).toBe("revoked");
    });
  },
);
