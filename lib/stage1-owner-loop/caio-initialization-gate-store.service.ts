import "server-only";

import {
  ActorType,
  MembershipStatus,
  Prisma,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  WORKSPACE_CAPABILITIES,
  workspaceRoleHasCapability,
} from "@/lib/auth/authorization";
import { assertWorkspacePolicyServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { jsonStringify, safeParseJson } from "@/lib/utils";
import {
  CAIO_INITIALIZATION_ARTIFACT_TYPES,
} from "./caio-initialization-artifacts";
import {
  projectCaioInitializationAssessmentInput,
  type CaioInitializationProjectionSnapshot,
} from "./caio-initialization-assessment-projector";
import {
  computeCaioInitializationAssessment,
  validateCaioInitializationAssessment,
  type CaioInitializationAssessment,
} from "./caio-initialization-gate";
import {
  createCaioInitializationAcceptanceReceipt,
  createCaioInitializationRevocationReceipt,
  validateCaioInitializationGateReceipt,
  type CaioInitializationGateReceipt,
} from "./caio-initialization-gate-receipt";
import type {
  DataAssetInitializationReceipt,
  DataAssetStageReceipt,
} from "./data-asset-catalog.types";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const G0_WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

const G0_ARTIFACT_TYPES = Object.values(CAIO_INITIALIZATION_ARTIFACT_TYPES);

type StoredAssessmentEnvelope = {
  input: ReturnType<
    typeof projectCaioInitializationAssessmentInput
  >["input"];
  diagnostics: string[];
};

type GateStatus =
  | "not_accepted"
  | "accepted"
  | "revoked"
  | "stale";

export class CaioInitializationGateStoreError extends Error {
  readonly reasons: readonly string[];

  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "CaioInitializationGateStoreError";
    this.reasons = reasons;
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

function nonEmpty(value: string, reason: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new CaioInitializationGateStoreError(reason);
  }
  return normalized;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right));
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return jsonStringify(uniqueSorted(left)) === jsonStringify(uniqueSorted(right));
}

async function assertPolicyAccess(input: {
  workspaceId: string;
  actorUserId: string;
  english?: boolean;
}): Promise<void> {
  nonEmpty(input.actorUserId, "signed_in_human_actor_required");
  await assertWorkspacePolicyServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
}

async function assertPolicyAccessInTransaction(
  tx: Tx,
  input: {
    workspaceId: string;
    actorUserId: string;
  },
): Promise<void> {
  const membership = await tx.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
      },
    },
    select: {
      role: true,
      status: true,
    },
  });
  if (
    !membership ||
    membership.status === MembershipStatus.INACTIVE ||
    !workspaceRoleHasCapability(
      membership.role,
      WORKSPACE_CAPABILITIES.MANAGE_POLICIES,
    )
  ) {
    throw new CaioInitializationGateStoreError(
      "workspace_policy_access_lost",
    );
  }
}

// One workspace lock serializes G0 ledger transitions. SERIALIZABLE isolation
// additionally makes concurrent catalog/source writes conflict rather than
// allowing an acceptance to commit against a mixed before/after snapshot.
async function lockWorkspace(
  tx: Tx,
  workspaceId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Workspace WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new CaioInitializationGateStoreError("workspace_not_found");
  }
}

type StoredStageReceiptEnvelope = {
  id: string;
  workspaceId: string;
  assetId: string;
  receiptType: string;
  idempotencyKey: string;
  expectedVersion: number;
  resultingVersion: number;
  status: string;
  actorRef: string;
  evidenceRefs: string;
  payloadJson: string;
  recordedAt: Date;
};

function parseStrictStringArray(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function stageReceiptStatus(receipt: DataAssetStageReceipt): string {
  if (receipt.receiptType === "classification") {
    return receipt.classificationStatus.toUpperCase();
  }
  if (receipt.receiptType === "authorization") {
    return receipt.authorizationStatus.toUpperCase();
  }
  if (receipt.receiptType === "connection") {
    return receipt.connectionStatus.toUpperCase();
  }
  return receipt.initializationStatus.toUpperCase();
}

function resolveStageReceiptEnvelope(
  row: StoredStageReceiptEnvelope | undefined,
  expectedWorkspaceId: string,
): DataAssetStageReceipt | null {
  if (!row) return null;
  const receipt = safeParseJson<DataAssetStageReceipt | null>(
    row.payloadJson,
    null,
  );
  const rowEvidenceRefs = parseStrictStringArray(row.evidenceRefs);
  if (
    !receipt ||
    !rowEvidenceRefs ||
    row.workspaceId !== expectedWorkspaceId ||
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
    receipt.assetRef !== row.assetId ||
    receipt.receiptType.toUpperCase() !== row.receiptType ||
    receipt.idempotencyKey !== row.idempotencyKey ||
    receipt.expectedVersion !== row.expectedVersion ||
    receipt.resultingVersion !== row.resultingVersion ||
    stageReceiptStatus(receipt) !== row.status ||
    receipt.actorRef !== row.actorRef ||
    !sameStrings(receipt.evidenceRefs, rowEvidenceRefs) ||
    receipt.recordedAt !== row.recordedAt.toISOString()
  ) {
    return null;
  }
  return receipt;
}

function parseStoredAssessment(row: {
  id: string;
  workspaceId: string;
  mandateRecordId: string;
  schemaVersion: string;
  evaluatorRevision: string;
  policyRef: string;
  policyHash: string;
  decision: string;
  assessmentJson: string;
  contentHash: string;
  basisHash: string;
  authorityEffect: string;
  evaluatedAt: Date;
}): CaioInitializationAssessment {
  const assessment = safeParseJson<CaioInitializationAssessment | null>(
    row.assessmentJson,
    null,
  );
  if (!assessment) {
    throw new CaioInitializationGateStoreError(
      "stored_assessment_json_invalid",
    );
  }
  const validation = validateCaioInitializationAssessment(assessment);
  if (
    !validation.valid ||
    assessment.assessmentId !== row.id ||
    assessment.workspaceRef !== `workspace:${row.workspaceId}` ||
    assessment.mandateRef !== row.mandateRecordId ||
    assessment.schemaVersion !== row.schemaVersion ||
    assessment.evaluatorRevision !== row.evaluatorRevision ||
    assessment.policyRef !== row.policyRef ||
    assessment.policyHash !== row.policyHash ||
    assessment.decision.toUpperCase() !== row.decision ||
    assessment.contentHash !== row.contentHash ||
    assessment.basisHash !== row.basisHash ||
    assessment.authorityEffect !== row.authorityEffect ||
    assessment.evaluatedAt !== row.evaluatedAt.toISOString()
  ) {
    throw new CaioInitializationGateStoreError(
      "stored_assessment_binding_invalid",
      validation.errors,
    );
  }
  return assessment;
}

function parseStoredAssessmentEnvelope(
  inputJson: string,
  assessment: CaioInitializationAssessment,
): StoredAssessmentEnvelope {
  const envelope = safeParseJson<unknown>(inputJson, null);
  if (
    !envelope ||
    typeof envelope !== "object" ||
    !("input" in envelope) ||
    !("diagnostics" in envelope) ||
    !Array.isArray(envelope.diagnostics) ||
    !envelope.diagnostics.every(
      (diagnostic) => typeof diagnostic === "string",
    )
  ) {
    throw new CaioInitializationGateStoreError(
      "stored_assessment_input_invalid",
    );
  }
  let reproduced: CaioInitializationAssessment;
  try {
    reproduced = computeCaioInitializationAssessment(
      envelope.input as StoredAssessmentEnvelope["input"],
    );
  } catch {
    throw new CaioInitializationGateStoreError(
      "stored_assessment_input_invalid",
    );
  }
  if (
    reproduced.assessmentId !== assessment.assessmentId ||
    reproduced.contentHash !== assessment.contentHash ||
    reproduced.basisHash !== assessment.basisHash ||
    reproduced.evaluatorRevision !== assessment.evaluatorRevision ||
    reproduced.policyRef !== assessment.policyRef ||
    reproduced.policyHash !== assessment.policyHash
  ) {
    throw new CaioInitializationGateStoreError(
      "stored_assessment_input_binding_invalid",
    );
  }
  return {
    input: envelope.input as StoredAssessmentEnvelope["input"],
    diagnostics: envelope.diagnostics,
  };
}

function parseStoredReceipt(row: {
  id: string;
  workspaceId: string;
  assessmentId: string;
  mandateRecordId: string;
  ceoPrincipalBindingId: string;
  previousReceiptId: string | null;
  previousReceiptHash: string | null;
  sequence: number;
  idempotencyKey: string;
  action: string;
  resultingStatus: string;
  actorType: ActorType;
  actorUserId: string;
  ceoPrincipalRef: string;
  inventoryConfirmationRef: string | null;
  customerAcceptanceRef: string | null;
  acceptedExceptionRefs: string;
  reasonCodes: string;
  evidenceRefs: string;
  basisHash: string;
  receiptJson: string;
  contentHash: string;
  authorityEffect: string;
  recordedAt: Date;
}): CaioInitializationGateReceipt {
  const receipt = safeParseJson<CaioInitializationGateReceipt | null>(
    row.receiptJson,
    null,
  );
  if (!receipt) {
    throw new CaioInitializationGateStoreError("stored_gate_receipt_invalid");
  }
  const acceptedExceptionRefs = parseStrictStringArray(
    row.acceptedExceptionRefs,
  );
  const reasonCodes = parseStrictStringArray(row.reasonCodes);
  const evidenceRefs = parseStrictStringArray(row.evidenceRefs);
  const validation = validateCaioInitializationGateReceipt(receipt);
  if (
    !validation.valid ||
    !acceptedExceptionRefs ||
    !reasonCodes ||
    !evidenceRefs ||
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
    receipt.assessmentRef !== row.assessmentId ||
    receipt.mandateRef !== row.mandateRecordId ||
    receipt.ceoPrincipalBindingRef !== row.ceoPrincipalBindingId ||
    receipt.previousReceiptRef !== row.previousReceiptId ||
    receipt.previousReceiptHash !== row.previousReceiptHash ||
    receipt.sequence !== row.sequence ||
    receipt.idempotencyKey !== row.idempotencyKey ||
    receipt.action.toUpperCase() !== row.action ||
    receipt.resultingStatus.toUpperCase() !== row.resultingStatus ||
    row.actorType !== ActorType.USER ||
    receipt.actorUserRef !== row.actorUserId ||
    receipt.ceoPrincipalRef !== row.ceoPrincipalRef ||
    receipt.inventoryConfirmationRef !== row.inventoryConfirmationRef ||
    receipt.customerAcceptanceRef !== row.customerAcceptanceRef ||
    !sameStrings(receipt.acceptedExceptionRefs, acceptedExceptionRefs) ||
    !sameStrings(receipt.reasonCodes, reasonCodes) ||
    !sameStrings(receipt.evidenceRefs, evidenceRefs) ||
    receipt.basisHash !== row.basisHash ||
    receipt.contentHash !== row.contentHash ||
    receipt.authorityEffect !== row.authorityEffect ||
    receipt.recordedAt !== row.recordedAt.toISOString()
  ) {
    throw new CaioInitializationGateStoreError(
      "stored_gate_receipt_binding_invalid",
      validation.errors,
    );
  }
  return receipt;
}

async function loadProjectionSnapshot(
  tx: Tx,
  input: {
    workspaceId: string;
    mandateRecordId: string;
    evaluatedAt: Date;
  },
): Promise<CaioInitializationProjectionSnapshot> {
  const assets = await tx.dataAssetCatalogEntry.findMany({
    where: { workspaceId: input.workspaceId },
    orderBy: { id: "asc" },
  });
  const stageReceiptIds = uniqueSorted(
    assets.flatMap((asset) => [
      asset.authorizationReceiptRef ?? "",
      asset.connectionReceiptRef ?? "",
      asset.initializationReceiptRef ?? "",
    ]),
  );
  const stageReceipts =
    stageReceiptIds.length === 0
      ? []
      : await tx.dataAssetStageReceipt.findMany({
          where: {
            workspaceId: input.workspaceId,
            id: { in: stageReceiptIds },
          },
          select: {
            id: true,
            workspaceId: true,
            assetId: true,
            receiptType: true,
            idempotencyKey: true,
            expectedVersion: true,
            resultingVersion: true,
            status: true,
            actorRef: true,
            evidenceRefs: true,
            payloadJson: true,
            recordedAt: true,
          },
        });
  const receiptsById = new Map(
    stageReceipts.map((receipt) => [receipt.id, receipt]),
  );
  const resolvedReceiptsById = new Map(
    stageReceipts.map((receipt) => [
      receipt.id,
      resolveStageReceiptEnvelope(receipt, input.workspaceId),
    ]),
  );
  const initializationReceiptsByAsset = new Map<
    string,
    DataAssetInitializationReceipt | null
  >();
  for (const asset of assets) {
    const row = asset.initializationReceiptRef
      ? receiptsById.get(asset.initializationReceiptRef)
      : null;
    const receipt = row ? resolvedReceiptsById.get(row.id) : null;
    initializationReceiptsByAsset.set(
      asset.id,
      receipt?.receiptType === "initialization"
        ? receipt
        : null,
    );
  }

  const requiredRunIds = uniqueSorted(
    [...initializationReceiptsByAsset.values()].flatMap((receipt) =>
      receipt?.observationRunRefs ?? [],
    ),
  );
  const [sourceRows, requiredRunRows] = await Promise.all([
    tx.observationSource.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        catalogEntryId: true,
        status: true,
        accessMode: true,
        sensitivity: true,
        freshnessSlaMinutes: true,
        compatibilityReceipt: { select: { id: true } },
        runs: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            id: true,
            status: true,
            outcome: true,
            freshness: true,
            windowStart: true,
            windowEnd: true,
            observedAt: true,
            evidenceRefs: true,
            errorCodes: true,
          },
        },
      },
    }),
    requiredRunIds.length === 0
      ? Promise.resolve([])
      : tx.observationSourceRun.findMany({
          where: {
            workspaceId: input.workspaceId,
            id: { in: requiredRunIds },
          },
          select: {
            id: true,
            sourceId: true,
            status: true,
            outcome: true,
            freshness: true,
            windowStart: true,
            windowEnd: true,
            observedAt: true,
            evidenceRefs: true,
            errorCodes: true,
          },
        }),
  ]);
  const runsBySource = new Map<
    string,
    Array<{
      id: string;
      status: string;
      outcome: string;
      freshness: string;
      windowStart: Date;
      windowEnd: Date;
      observedAt: Date | null;
      evidenceRefs: string | null;
      errorCodes: string | null;
    }>
  >();
  for (const run of requiredRunRows) {
    const rows = runsBySource.get(run.sourceId) ?? [];
    rows.push(run);
    runsBySource.set(run.sourceId, rows);
  }

  const memoryFactIds = uniqueSorted(
    [...initializationReceiptsByAsset.values()]
      .flatMap((receipt) => receipt?.companyMemoryRefs ?? [])
      .filter((ref) => ref.startsWith("memory-fact:"))
      .map((ref) => ref.slice("memory-fact:".length)),
  );
  const [memoryFacts, artifacts] = await Promise.all([
    memoryFactIds.length === 0
      ? Promise.resolve([])
      : tx.memoryFact.findMany({
          where: {
            workspaceId: input.workspaceId,
            id: { in: memoryFactIds },
          },
          orderBy: { id: "asc" },
        }),
    tx.artifactBundle.findMany({
      where: {
        workspaceId: input.workspaceId,
        artifactType: { in: G0_ARTIFACT_TYPES },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1_000,
      select: {
        id: true,
        artifactType: true,
        status: true,
        artifactsJson: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    workspaceId: input.workspaceId,
    mandateRecordId: input.mandateRecordId,
    evaluatedAt: input.evaluatedAt.toISOString(),
    assets: assets.map((asset) => {
      const authorizationRow = asset.authorizationReceiptRef
        ? receiptsById.get(asset.authorizationReceiptRef)
        : null;
      const connectionRow = asset.connectionReceiptRef
        ? receiptsById.get(asset.connectionReceiptRef)
        : null;
      const authorizationReceipt = authorizationRow
        ? resolvedReceiptsById.get(authorizationRow.id)
        : null;
      const connectionReceipt = connectionRow
        ? resolvedReceiptsById.get(connectionRow.id)
        : null;
      return {
        id: asset.id,
        inventoryStatus: asset.inventoryStatus,
        classificationStatus: asset.classificationStatus,
        sensitivity: asset.sensitivity,
        processingDisposition: asset.processingDisposition,
        technicalFeasibility: asset.technicalFeasibility,
        authorizationStatus: asset.authorizationStatus,
        authorizationReceiptRef: asset.authorizationReceiptRef,
        connectionStatus: asset.connectionStatus,
        connectionReceiptRef: asset.connectionReceiptRef,
        initializationStatus: asset.initializationStatus,
        initializationReceiptRef: asset.initializationReceiptRef,
        riskOwnerRef: asset.riskOwnerRef,
        nextReviewAt: asset.nextReviewAt?.toISOString() ?? null,
        blockerCodes: safeParseJson<string[]>(asset.blockerCodes, []),
        evidenceRefs: safeParseJson<string[]>(asset.evidenceRefs, []),
        version: asset.version,
        authorizationReceipt:
          authorizationReceipt?.receiptType === "authorization"
            ? authorizationReceipt
            : null,
        connectionReceipt:
          connectionReceipt?.receiptType === "connection"
            ? connectionReceipt
            : null,
        initializationReceipt:
          initializationReceiptsByAsset.get(asset.id) ?? null,
      };
    }),
    sources: sourceRows.map((source) => {
      const latestRun = source.runs[0] ?? null;
      const requiredRuns = [...(runsBySource.get(source.id) ?? [])].sort(
        (left, right) => left.id.localeCompare(right.id),
      );
      const toProjectionRun = (
        run: (typeof requiredRuns)[number] | NonNullable<typeof latestRun>,
      ) => ({
        id: run.id,
        status: run.status,
        outcome: run.outcome,
        freshness: run.freshness,
        windowStart: run.windowStart.toISOString(),
        windowEnd: run.windowEnd.toISOString(),
        observedAt: run.observedAt?.toISOString() ?? null,
        evidenceRefs: safeParseJson<string[]>(run.evidenceRefs, []),
        errorCodes: safeParseJson<string[]>(run.errorCodes, []),
      });
      return {
        id: source.id,
        catalogEntryId: source.catalogEntryId,
        status: source.status,
        accessMode: source.accessMode,
        sensitivity: source.sensitivity,
        freshnessSlaMinutes: source.freshnessSlaMinutes,
        compatibilityMode: source.compatibilityReceipt !== null,
        runRefs: uniqueSorted([
          ...requiredRuns.map((run) => run.id),
          latestRun?.id ?? "",
        ]),
        runs: requiredRuns.map(toProjectionRun),
        latestRun: latestRun
          ? toProjectionRun(latestRun)
          : null,
      };
    }),
    memoryFacts: memoryFacts.map((fact) => ({
      id: fact.id,
      objectType: String(fact.objectType),
      objectId: fact.objectId,
      factType: String(fact.factType),
      title: fact.title,
      content: fact.content,
      normalizedValue: fact.normalizedValue,
      sourceType: String(fact.sourceType),
      sourceId: fact.sourceId,
      confidence: fact.confidence,
      importance: fact.importance,
      freshnessScore: fact.freshnessScore,
      status: String(fact.status),
      confirmedByUser: fact.confirmedByUser,
      createdBySystem: fact.createdBySystem,
      createdAt: fact.createdAt.toISOString(),
      updatedAt: fact.updatedAt.toISOString(),
    })),
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      artifactType: artifact.artifactType,
      status: String(artifact.status),
      artifactsJson: artifact.artifactsJson,
      createdAt: artifact.createdAt.toISOString(),
    })),
  };
}

async function assertActiveMandate(
  tx: Tx,
  input: {
    workspaceId: string;
    mandateRecordId: string;
    at: Date;
  },
) {
  const claim = await tx.caioActiveMandateClaim.findFirst({
    where: {
      workspaceId: input.workspaceId,
      mandateRecordId: input.mandateRecordId,
    },
    include: { mandateRecord: true },
  });
  const mandate = claim?.mandateRecord;
  if (
    !mandate ||
    mandate.status !== "active" ||
    mandate.validFrom.getTime() > input.at.getTime() ||
    mandate.validUntil.getTime() <= input.at.getTime() ||
    mandate.emergencyStopRef !== null
  ) {
    throw new CaioInitializationGateStoreError(
      "active_in_force_mandate_required",
    );
  }
  const stopCount = await tx.caioGuardianStopRecord.count({
    where: {
      workspaceId: input.workspaceId,
      mandateRecordId: input.mandateRecordId,
      resumedAt: null,
    },
  });
  if (stopCount > 0) {
    throw new CaioInitializationGateStoreError(
      "guardian_stop_in_force",
    );
  }
  return mandate;
}

async function assertLiveCeoBinding(
  tx: Tx,
  input: {
    workspaceId: string;
    actorUserId: string;
    ceoPrincipalRef: string;
  },
) {
  const binding = await tx.caioPrincipalBinding.findFirst({
    where: {
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      principalRef: input.ceoPrincipalRef,
      principalKind: "ceo",
      revokedAt: null,
    },
  });
  if (!binding) {
    throw new CaioInitializationGateStoreError(
      "live_ceo_principal_binding_required",
    );
  }
  return binding;
}

function assertAssessmentStillCurrent(input: {
  stored: CaioInitializationAssessment;
  current: CaioInitializationAssessment;
}): void {
  if (
    input.current.decision !== "ready_for_owner_acceptance" ||
    input.current.basisHash !== input.stored.basisHash ||
    input.current.evaluatorRevision !== input.stored.evaluatorRevision ||
    input.current.policyRef !== input.stored.policyRef ||
    input.current.policyHash !== input.stored.policyHash
  ) {
    throw new CaioInitializationGateStoreError(
      "assessment_stale_reassessment_required",
      input.current.failures,
    );
  }
}

function equivalentAcceptanceReplay(
  receipt: CaioInitializationGateReceipt,
  input: {
    assessmentId: string;
    actorUserId: string;
    ceoPrincipalRef: string;
    inventoryConfirmationRef: string;
    customerAcceptanceRef: string;
    acceptedExceptionRefs: readonly string[];
    reasonCodes: readonly string[];
    evidenceRefs: readonly string[];
  },
): boolean {
  return (
    receipt.action === "accept" &&
    receipt.assessmentRef === input.assessmentId &&
    receipt.actorUserRef === input.actorUserId &&
    receipt.ceoPrincipalRef === input.ceoPrincipalRef &&
    receipt.inventoryConfirmationRef === input.inventoryConfirmationRef &&
    receipt.customerAcceptanceRef === input.customerAcceptanceRef &&
    sameStrings(receipt.acceptedExceptionRefs, input.acceptedExceptionRefs) &&
    sameStrings(receipt.reasonCodes, input.reasonCodes) &&
    sameStrings(receipt.evidenceRefs, input.evidenceRefs)
  );
}

function equivalentRevocationReplay(
  receipt: CaioInitializationGateReceipt,
  input: {
    actorUserId: string;
    ceoPrincipalRef: string;
    reasonCodes: readonly string[];
    evidenceRefs: readonly string[];
  },
): boolean {
  return (
    receipt.action === "revoke" &&
    receipt.actorUserRef === input.actorUserId &&
    receipt.ceoPrincipalRef === input.ceoPrincipalRef &&
    sameStrings(receipt.reasonCodes, input.reasonCodes) &&
    sameStrings(receipt.evidenceRefs, input.evidenceRefs)
  );
}

async function persistReceipt(
  tx: Tx,
  input: {
    workspaceId: string;
    assessmentId: string;
    mandateRecordId: string;
    ceoPrincipalBindingId: string;
    actorUserId: string;
    receipt: CaioInitializationGateReceipt;
  },
) {
  return tx.caioInitializationGateReceipt.create({
    data: {
      id: input.receipt.receiptId,
      workspaceId: input.workspaceId,
      assessmentId: input.assessmentId,
      mandateRecordId: input.mandateRecordId,
      ceoPrincipalBindingId: input.ceoPrincipalBindingId,
      previousReceiptId: input.receipt.previousReceiptRef,
      previousReceiptHash: input.receipt.previousReceiptHash,
      sequence: input.receipt.sequence,
      idempotencyKey: input.receipt.idempotencyKey,
      action: input.receipt.action.toUpperCase(),
      resultingStatus: input.receipt.resultingStatus.toUpperCase(),
      actorType: ActorType.USER,
      actorUserId: input.actorUserId,
      ceoPrincipalRef: input.receipt.ceoPrincipalRef,
      inventoryConfirmationRef: input.receipt.inventoryConfirmationRef,
      customerAcceptanceRef: input.receipt.customerAcceptanceRef,
      acceptedExceptionRefs: jsonStringify(
        input.receipt.acceptedExceptionRefs,
      ),
      reasonCodes: jsonStringify(input.receipt.reasonCodes),
      evidenceRefs: jsonStringify(input.receipt.evidenceRefs),
      basisHash: input.receipt.basisHash,
      receiptJson: jsonStringify(input.receipt),
      contentHash: input.receipt.contentHash,
      authorityEffect: input.receipt.authorityEffect,
      recordedAt: new Date(input.receipt.recordedAt),
    },
  });
}

async function readHeadForUpdate(
  tx: Tx,
  workspaceId: string,
): Promise<{
  workspaceId: string;
  currentAssessmentId: string;
  currentReceiptId: string;
  sequence: number;
  version: number;
} | null> {
  const rows = await tx.$queryRaw<
    Array<{
      workspaceId: string;
      currentAssessmentId: string;
      currentReceiptId: string;
      sequence: number;
      version: number;
    }>
  >`
    SELECT workspaceId, currentAssessmentId, currentReceiptId, sequence, version
    FROM CaioInitializationGateHead
    WHERE workspaceId = ${workspaceId}
    FOR UPDATE`;
  return rows[0] ?? null;
}

function assertHeadReceiptBinding(
  head: NonNullable<Awaited<ReturnType<typeof readHeadForUpdate>>>,
  receipt: CaioInitializationGateReceipt,
): void {
  if (
    receipt.receiptId !== head.currentReceiptId ||
    receipt.assessmentRef !== head.currentAssessmentId ||
    receipt.sequence !== head.sequence
  ) {
    throw new CaioInitializationGateStoreError(
      "gate_head_binding_invalid",
    );
  }
}

function assertReceiptAssessmentBinding(
  receipt: CaioInitializationGateReceipt,
  assessment: CaioInitializationAssessment,
): void {
  if (
    receipt.assessmentRef !== assessment.assessmentId ||
    receipt.assessmentHash !== assessment.contentHash ||
    receipt.basisHash !== assessment.basisHash ||
    receipt.mandateRef !== assessment.mandateRef ||
    receipt.workspaceRef !== assessment.workspaceRef
  ) {
    throw new CaioInitializationGateStoreError(
      "gate_receipt_assessment_binding_invalid",
    );
  }
}

async function assertReceiptChainIntegrity(
  tx: Tx,
  workspaceId: string,
  headReceipt: CaioInitializationGateReceipt,
): Promise<void> {
  const visited = new Set<string>();
  let current = headReceipt;
  while (true) {
    if (visited.has(current.receiptId)) {
      throw new CaioInitializationGateStoreError(
        "gate_receipt_chain_cycle",
      );
    }
    visited.add(current.receiptId);
    if (current.sequence === 1) {
      if (
        current.previousReceiptRef !== null ||
        current.previousReceiptHash !== null
      ) {
        throw new CaioInitializationGateStoreError(
          "gate_receipt_chain_root_invalid",
        );
      }
      return;
    }
    if (
      !current.previousReceiptRef ||
      !current.previousReceiptHash
    ) {
      throw new CaioInitializationGateStoreError(
        "gate_receipt_chain_predecessor_missing",
      );
    }
    const previousRow =
      await tx.caioInitializationGateReceipt.findFirst({
        where: {
          id: current.previousReceiptRef,
          workspaceId,
        },
      });
    if (!previousRow) {
      throw new CaioInitializationGateStoreError(
        "gate_receipt_chain_predecessor_missing",
      );
    }
    const previous = parseStoredReceipt(previousRow);
    if (previous.contentHash !== current.previousReceiptHash) {
      throw new CaioInitializationGateStoreError(
        "gate_receipt_chain_hash_mismatch",
      );
    }
    if (previous.sequence !== current.sequence - 1) {
      throw new CaioInitializationGateStoreError(
        "gate_receipt_chain_sequence_mismatch",
      );
    }
    if (Date.parse(previous.recordedAt) > Date.parse(current.recordedAt)) {
      throw new CaioInitializationGateStoreError(
        "gate_receipt_chain_time_invalid",
      );
    }
    current = previous;
  }
}

async function assertReplayIsCurrentHead(
  tx: Tx,
  input: {
    workspaceId: string;
    receipt: CaioInitializationGateReceipt;
    assessment: CaioInitializationAssessment;
  },
): Promise<void> {
  const head = await readHeadForUpdate(tx, input.workspaceId);
  if (!head) {
    throw new CaioInitializationGateStoreError(
      "idempotency_receipt_no_longer_current",
    );
  }
  if (
    input.receipt.receiptId !== head.currentReceiptId ||
    input.receipt.assessmentRef !== head.currentAssessmentId ||
    input.receipt.sequence !== head.sequence
  ) {
    throw new CaioInitializationGateStoreError(
      "idempotency_receipt_no_longer_current",
    );
  }
  assertReceiptAssessmentBinding(input.receipt, input.assessment);
  await assertReceiptChainIntegrity(
    tx,
    input.workspaceId,
    input.receipt,
  );
}

async function updateHead(
  tx: Tx,
  input: {
    workspaceId: string;
    assessmentId: string;
    receiptId: string;
    sequence: number;
    previous: Awaited<ReturnType<typeof readHeadForUpdate>>;
  },
): Promise<void> {
  if (!input.previous) {
    await tx.caioInitializationGateHead.create({
      data: {
        workspaceId: input.workspaceId,
        currentAssessmentId: input.assessmentId,
        currentReceiptId: input.receiptId,
        sequence: input.sequence,
        version: 1,
      },
    });
    return;
  }
  const updated = await tx.caioInitializationGateHead.updateMany({
    where: {
      workspaceId: input.workspaceId,
      currentReceiptId: input.previous.currentReceiptId,
      sequence: input.previous.sequence,
      version: input.previous.version,
    },
    data: {
      currentAssessmentId: input.assessmentId,
      currentReceiptId: input.receiptId,
      sequence: input.sequence,
      version: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new CaioInitializationGateStoreError(
      "gate_head_concurrent_update",
    );
  }
}

export async function recordCaioInitializationAssessment(input: {
  workspaceId: string;
  mandateRecordId: string;
  evaluationKey: string;
  actorUserId: string;
  now?: Date;
  english?: boolean;
}) {
  await assertPolicyAccess(input);
  const evaluationKey = nonEmpty(
    input.evaluationKey,
    "evaluation_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
      await lockWorkspace(tx, input.workspaceId);
      await assertPolicyAccessInTransaction(tx, input);
      await assertActiveMandate(tx, {
        workspaceId: input.workspaceId,
        mandateRecordId: input.mandateRecordId,
        at: now,
      });
      const existing = await tx.caioInitializationAssessment.findUnique({
        where: {
          workspaceId_evaluationKey: {
            workspaceId: input.workspaceId,
            evaluationKey,
          },
        },
      });
      if (existing) {
        if (existing.mandateRecordId !== input.mandateRecordId) {
          throw new CaioInitializationGateStoreError(
            "idempotency_key_payload_conflict",
          );
        }
        const assessment = parseStoredAssessment(existing);
        const envelope = parseStoredAssessmentEnvelope(
          existing.inputJson,
          assessment,
        );
        return {
          assessment,
          diagnostics: envelope.diagnostics,
          replayed: true,
        };
      }
      const snapshot = await loadProjectionSnapshot(tx, {
        workspaceId: input.workspaceId,
        mandateRecordId: input.mandateRecordId,
        evaluatedAt: now,
      });
      const projection = projectCaioInitializationAssessmentInput(snapshot);
      const assessment = computeCaioInitializationAssessment(projection.input);
      const validation = validateCaioInitializationAssessment(assessment);
      if (!validation.valid) {
        throw new CaioInitializationGateStoreError(
          "computed_assessment_invalid",
          validation.errors,
        );
      }
      await tx.caioInitializationAssessment.create({
        data: {
          id: assessment.assessmentId,
          workspaceId: input.workspaceId,
          mandateRecordId: input.mandateRecordId,
          evaluationKey,
          schemaVersion: assessment.schemaVersion,
          evaluatorRevision: assessment.evaluatorRevision,
          policyRef: assessment.policyRef,
          policyHash: assessment.policyHash,
          basisHash: assessment.basisHash,
          decision: assessment.decision.toUpperCase(),
          inputJson: jsonStringify({
            input: projection.input,
            diagnostics: projection.diagnostics,
          } satisfies StoredAssessmentEnvelope),
          assessmentJson: jsonStringify(assessment),
          contentHash: assessment.contentHash,
          authorityEffect: assessment.authorityEffect,
          evaluatedAt: now,
        },
      });
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
          actor: input.actorUserId,
          actorType: ActorType.USER,
          actionType: "CAIO_INITIALIZATION_ASSESSED",
          targetType: "CaioInitializationAssessment",
          targetId: assessment.assessmentId,
          summary:
            "CAIO initialization evaluated from current evidence (review state only; grants nothing)",
          payload: {
            decision: assessment.decision,
            basisHash: assessment.basisHash,
            policyHash: assessment.policyHash,
            failureCodes: assessment.failures,
            diagnosticCodes: projection.diagnostics,
            authorityEffect: assessment.authorityEffect,
          },
        },
        { client: tx },
      );
      return {
        assessment,
        diagnostics: projection.diagnostics,
        replayed: false,
      };
      }, TRANSACTION_OPTIONS),
    G0_WRITE_RETRY_OPTIONS,
  );
}

export async function acceptCaioInitializationGate(input: {
  workspaceId: string;
  assessmentId: string;
  actorUserId: string;
  ceoPrincipalRef: string;
  idempotencyKey: string;
  inventoryConfirmationRef: string;
  customerAcceptanceRef: string;
  acceptedExceptionRefs: string[];
  reasonCodes: string[];
  evidenceRefs: string[];
  now?: Date;
  english?: boolean;
}) {
  await assertPolicyAccess(input);
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
      await lockWorkspace(tx, input.workspaceId);
      await assertPolicyAccessInTransaction(tx, input);
      const assessmentRow =
        await tx.caioInitializationAssessment.findFirst({
          where: {
            id: input.assessmentId,
            workspaceId: input.workspaceId,
          },
        });
      if (!assessmentRow) {
        throw new CaioInitializationGateStoreError("assessment_not_found");
      }
      const assessment = parseStoredAssessment(assessmentRow);
      const binding = await assertLiveCeoBinding(tx, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        ceoPrincipalRef: input.ceoPrincipalRef,
      });
      const existing =
        await tx.caioInitializationGateReceipt.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey,
            },
          },
        });
      if (existing) {
        const receipt = parseStoredReceipt(existing);
        if (!equivalentAcceptanceReplay(receipt, input)) {
          throw new CaioInitializationGateStoreError(
            "idempotency_key_payload_conflict",
          );
        }
        await assertReplayIsCurrentHead(tx, {
          workspaceId: input.workspaceId,
          receipt,
          assessment,
        });
        return { receipt, replayed: true };
      }
      const mandate = await assertActiveMandate(tx, {
        workspaceId: input.workspaceId,
        mandateRecordId: assessmentRow.mandateRecordId,
        at: now,
      });
      if (mandate.ceoRef !== input.ceoPrincipalRef) {
        throw new CaioInitializationGateStoreError(
          "issuing_ceo_required",
        );
      }
      const snapshot = await loadProjectionSnapshot(tx, {
        workspaceId: input.workspaceId,
        mandateRecordId: assessmentRow.mandateRecordId,
        evaluatedAt: now,
      });
      const current = computeCaioInitializationAssessment(
        projectCaioInitializationAssessmentInput(snapshot).input,
      );
      assertAssessmentStillCurrent({ stored: assessment, current });
      const head = await readHeadForUpdate(tx, input.workspaceId);
      const previousRow = head
        ? await tx.caioInitializationGateReceipt.findFirst({
            where: {
              id: head.currentReceiptId,
              workspaceId: input.workspaceId,
            },
          })
        : null;
      if (head && !previousRow) {
        throw new CaioInitializationGateStoreError(
          "gate_head_receipt_missing",
        );
      }
      const previous = previousRow ? parseStoredReceipt(previousRow) : null;
      if (head && previous) {
        assertHeadReceiptBinding(head, previous);
        const previousAssessmentRow =
          head.currentAssessmentId === assessmentRow.id
            ? assessmentRow
            : await tx.caioInitializationAssessment.findFirst({
                where: {
                  id: head.currentAssessmentId,
                  workspaceId: input.workspaceId,
                },
              });
        if (!previousAssessmentRow) {
          throw new CaioInitializationGateStoreError(
            "gate_head_assessment_missing",
          );
        }
        assertReceiptAssessmentBinding(
          previous,
          parseStoredAssessment(previousAssessmentRow),
        );
        await assertReceiptChainIntegrity(
          tx,
          input.workspaceId,
          previous,
        );
      }
      const receipt = createCaioInitializationAcceptanceReceipt({
        workspaceRef: `workspace:${input.workspaceId}`,
        assessment,
        mandateRef: assessmentRow.mandateRecordId,
        ceoPrincipalBindingRef: binding.id,
        ceoPrincipalRef: input.ceoPrincipalRef,
        actorUserRef: input.actorUserId,
        idempotencyKey,
        evidenceRefs: input.evidenceRefs,
        previousReceipt: previous
          ? {
              receiptId: previous.receiptId,
              contentHash: previous.contentHash,
              sequence: previous.sequence,
              resultingStatus: previous.resultingStatus,
              assessmentRef: previous.assessmentRef,
              recordedAt: previous.recordedAt,
            }
          : null,
        recordedAt: now.toISOString(),
        inventoryConfirmationRef: input.inventoryConfirmationRef,
        customerAcceptanceRef: input.customerAcceptanceRef,
        acceptedExceptionRefs: input.acceptedExceptionRefs,
        reasonCodes: input.reasonCodes,
      });
      try {
        await persistReceipt(tx, {
          workspaceId: input.workspaceId,
          assessmentId: assessmentRow.id,
          mandateRecordId: assessmentRow.mandateRecordId,
          ceoPrincipalBindingId: binding.id,
          actorUserId: input.actorUserId,
          receipt,
        });
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          throw new CaioInitializationGateStoreError(
            "gate_receipt_concurrent_conflict",
          );
        }
        throw error;
      }
      await updateHead(tx, {
        workspaceId: input.workspaceId,
        assessmentId: assessmentRow.id,
        receiptId: receipt.receiptId,
        sequence: receipt.sequence,
        previous: head,
      });
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
          actor: input.ceoPrincipalRef,
          actorType: ActorType.USER,
          actionType: "CAIO_INITIALIZATION_GATE_ACCEPTED",
          targetType: "CaioInitializationGateReceipt",
          targetId: receipt.receiptId,
          summary:
            "CEO accepted the CAIO initialization evidence (governance receipt only; grants nothing)",
          relatedObjectType: "CaioInitializationAssessment",
          relatedObjectId: assessmentRow.id,
          payload: {
            basisHash: receipt.basisHash,
            exceptionRefs: receipt.acceptedExceptionRefs,
            authorityEffect: receipt.authorityEffect,
          },
        },
        { client: tx },
      );
      return { receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    G0_WRITE_RETRY_OPTIONS,
  );
}

export async function revokeCaioInitializationGate(input: {
  workspaceId: string;
  actorUserId: string;
  ceoPrincipalRef: string;
  idempotencyKey: string;
  reasonCodes: string[];
  evidenceRefs: string[];
  now?: Date;
  english?: boolean;
}) {
  await assertPolicyAccess(input);
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
      await lockWorkspace(tx, input.workspaceId);
      await assertPolicyAccessInTransaction(tx, input);
      const binding = await assertLiveCeoBinding(tx, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        ceoPrincipalRef: input.ceoPrincipalRef,
      });
      const existing =
        await tx.caioInitializationGateReceipt.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey,
            },
          },
        });
      if (existing) {
        const receipt = parseStoredReceipt(existing);
        if (!equivalentRevocationReplay(receipt, input)) {
          throw new CaioInitializationGateStoreError(
            "idempotency_key_payload_conflict",
          );
        }
        const replayAssessmentRow =
          await tx.caioInitializationAssessment.findFirst({
            where: {
              id: receipt.assessmentRef,
              workspaceId: input.workspaceId,
            },
          });
        if (!replayAssessmentRow) {
          throw new CaioInitializationGateStoreError(
            "gate_head_assessment_missing",
          );
        }
        await assertReplayIsCurrentHead(tx, {
          workspaceId: input.workspaceId,
          receipt,
          assessment: parseStoredAssessment(replayAssessmentRow),
        });
        return { receipt, replayed: true };
      }
      const head = await readHeadForUpdate(tx, input.workspaceId);
      if (!head) {
        throw new CaioInitializationGateStoreError(
          "accepted_gate_not_found",
        );
      }
      const previousRow =
        await tx.caioInitializationGateReceipt.findFirst({
          where: {
            id: head.currentReceiptId,
            workspaceId: input.workspaceId,
          },
        });
      if (!previousRow) {
        throw new CaioInitializationGateStoreError(
          "gate_head_receipt_missing",
        );
      }
      const previous = parseStoredReceipt(previousRow);
      assertHeadReceiptBinding(head, previous);
      const assessmentRow =
        await tx.caioInitializationAssessment.findFirst({
          where: {
            id: head.currentAssessmentId,
            workspaceId: input.workspaceId,
          },
        });
      if (!assessmentRow) {
        throw new CaioInitializationGateStoreError(
          "gate_head_assessment_missing",
        );
      }
      const assessment = parseStoredAssessment(assessmentRow);
      assertReceiptAssessmentBinding(previous, assessment);
      await assertReceiptChainIntegrity(
        tx,
        input.workspaceId,
        previous,
      );
      const receipt = createCaioInitializationRevocationReceipt({
        workspaceRef: `workspace:${input.workspaceId}`,
        assessment,
        mandateRef: assessmentRow.mandateRecordId,
        ceoPrincipalBindingRef: binding.id,
        ceoPrincipalRef: input.ceoPrincipalRef,
        actorUserRef: input.actorUserId,
        idempotencyKey,
        evidenceRefs: input.evidenceRefs,
        previousReceipt: {
          receiptId: previous.receiptId,
          contentHash: previous.contentHash,
          sequence: previous.sequence,
          resultingStatus: previous.resultingStatus,
          assessmentRef: previous.assessmentRef,
          recordedAt: previous.recordedAt,
        },
        recordedAt: now.toISOString(),
        acceptedExceptionRefs: previous.acceptedExceptionRefs,
        reasonCodes: input.reasonCodes,
      });
      try {
        await persistReceipt(tx, {
          workspaceId: input.workspaceId,
          assessmentId: assessmentRow.id,
          mandateRecordId: assessmentRow.mandateRecordId,
          ceoPrincipalBindingId: binding.id,
          actorUserId: input.actorUserId,
          receipt,
        });
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          throw new CaioInitializationGateStoreError(
            "gate_receipt_concurrent_conflict",
          );
        }
        throw error;
      }
      await updateHead(tx, {
        workspaceId: input.workspaceId,
        assessmentId: assessmentRow.id,
        receiptId: receipt.receiptId,
        sequence: receipt.sequence,
        previous: head,
      });
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
          actor: input.ceoPrincipalRef,
          actorType: ActorType.USER,
          actionType: "CAIO_INITIALIZATION_GATE_REVOKED",
          targetType: "CaioInitializationGateReceipt",
          targetId: receipt.receiptId,
          summary:
            "CEO revoked the CAIO initialization acceptance; no active mandate is required for this safety action",
          relatedObjectType: "CaioInitializationAssessment",
          relatedObjectId: assessmentRow.id,
          payload: {
            previousReceiptRef: receipt.previousReceiptRef,
            reasonCodes: receipt.reasonCodes,
            authorityEffect: receipt.authorityEffect,
          },
        },
        { client: tx },
      );
      return { receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    G0_WRITE_RETRY_OPTIONS,
  );
}

export async function getCaioInitializationGateStatus(input: {
  workspaceId: string;
  actorUserId: string;
  now?: Date;
  english?: boolean;
}): Promise<{
  status: GateStatus;
  receipt: CaioInitializationGateReceipt | null;
  staleReasons: string[];
}> {
  await assertPolicyAccess(input);
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const head = await tx.caioInitializationGateHead.findUnique({
      where: { workspaceId: input.workspaceId },
    });
    if (!head) {
      return { status: "not_accepted", receipt: null, staleReasons: [] };
    }
    const [receiptRow, assessmentRow] = await Promise.all([
      tx.caioInitializationGateReceipt.findFirst({
        where: {
          id: head.currentReceiptId,
          workspaceId: input.workspaceId,
        },
      }),
      tx.caioInitializationAssessment.findFirst({
        where: {
          id: head.currentAssessmentId,
          workspaceId: input.workspaceId,
        },
      }),
    ]);
    if (!receiptRow || !assessmentRow) {
      throw new CaioInitializationGateStoreError(
        "gate_head_binding_invalid",
      );
    }
    const receipt = parseStoredReceipt(receiptRow);
    const assessment = parseStoredAssessment(assessmentRow);
    assertHeadReceiptBinding(head, receipt);
    assertReceiptAssessmentBinding(receipt, assessment);
    await assertReceiptChainIntegrity(
      tx,
      input.workspaceId,
      receipt,
    );
    if (receipt.resultingStatus === "revoked") {
      return { status: "revoked", receipt, staleReasons: [] };
    }
    let mandate;
    try {
      mandate = await assertActiveMandate(tx, {
        workspaceId: input.workspaceId,
        mandateRecordId: assessmentRow.mandateRecordId,
        at: now,
      });
    } catch (error) {
      if (error instanceof CaioInitializationGateStoreError) {
        return {
          status: "stale",
          receipt,
          staleReasons: [error.message],
        };
      }
      throw error;
    }
    if (mandate.ceoRef !== receipt.ceoPrincipalRef) {
      return {
        status: "stale",
        receipt,
        staleReasons: ["issuing_ceo_changed"],
      };
    }
    const liveBinding = await tx.caioPrincipalBinding.findFirst({
      where: {
        id: receipt.ceoPrincipalBindingRef,
        workspaceId: input.workspaceId,
        userId: receipt.actorUserRef,
        principalRef: receipt.ceoPrincipalRef,
        principalKind: "ceo",
        revokedAt: null,
      },
      select: { id: true },
    });
    if (!liveBinding) {
      return {
        status: "stale",
        receipt,
        staleReasons: ["ceo_principal_binding_not_live"],
      };
    }
    const snapshot = await loadProjectionSnapshot(tx, {
      workspaceId: input.workspaceId,
      mandateRecordId: assessmentRow.mandateRecordId,
      evaluatedAt: now,
    });
    const current = computeCaioInitializationAssessment(
      projectCaioInitializationAssessmentInput(snapshot).input,
    );
    const staleReasons =
      current.basisHash === assessment.basisHash &&
      current.decision === "ready_for_owner_acceptance" &&
      current.policyHash === assessment.policyHash
        ? []
        : uniqueSorted([
            "assessment_basis_changed",
            ...current.failures,
          ]);
    return {
      status: staleReasons.length === 0 ? "accepted" : "stale",
      receipt,
      staleReasons,
    };
  }, TRANSACTION_OPTIONS);
}
