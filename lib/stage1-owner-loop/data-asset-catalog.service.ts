import "server-only";

import {
  ActorType,
  type DataAssetCatalogEntry as StoredDataAssetCatalogEntry,
  type DataAssetStageReceipt as StoredDataAssetStageReceipt,
  type Prisma,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { assertWorkspacePolicyServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { jsonStringify, safeParseJson } from "@/lib/utils";
import {
  validateDataAssetAuthorizationReceipt,
  validateDataAssetCatalogEntry,
  validateDataAssetClassificationReceipt,
  validateDataAssetConnectionReceipt,
  validateDataAssetInitializationReceipt,
  validateDataAssetReceiptForEntry,
} from "./data-asset-catalog.contract";
import type {
  DataAssetAuthorizationReceipt,
  DataAssetCatalogEntry,
  DataAssetClassificationReceipt,
  DataAssetConnectionReceipt,
  DataAssetInitializationReceipt,
  DataAssetProcessingDisposition,
  DataAssetShape,
  DataAssetStageReceipt,
  DataAssetTechnicalFeasibility,
} from "./data-asset-catalog.types";
import type {
  ObservationAccessMode,
  ObservationSensitivity,
} from "./types";

type StageReceiptType = DataAssetStageReceipt["receiptType"];

type ReceiptPersistenceResult = {
  entry: StoredDataAssetCatalogEntry;
  receipt: StoredDataAssetStageReceipt;
  replayed: boolean;
};

type CommonStageInput = {
  workspaceId: string;
  assetId: string;
  receiptId: string;
  idempotencyKey: string;
  expectedVersion: number;
  actorName: string;
  actorUserId: string;
  evidenceRefs: string[];
  now?: Date;
  english?: boolean;
};

type StoredEntryUpdate =
  Prisma.DataAssetCatalogEntryUpdateManyMutationInput;

// LOCK-BEFORE-READ invariant: every stage transition locks the catalog
// entry before any ordinary read in its transaction. Under InnoDB
// REPEATABLE READ, a transaction that waits for an observation-run claim
// must then read the winner's committed state instead of continuing from a
// stale snapshot and missing the run/source it needs to invalidate.
async function lockCatalogEntryRow(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; assetId: string },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM DataAssetCatalogEntry
    WHERE id = ${input.assetId} AND workspaceId = ${input.workspaceId}
    FOR UPDATE`;
  if (rows.length !== 1) {
    throw new DataAssetCatalogTransitionError(["asset_not_found"]);
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

function uniqueNonEmpty(values: readonly string[]): string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ];
}

function requireNonEmpty(value: string, reason: string): string {
  const normalized = value.trim();
  if (!normalized) throw new DataAssetCatalogContractError([reason]);
  return normalized;
}

function requireHumanActor(input: {
  actorUserId?: string | null;
  english?: boolean;
}): string {
  if (input.actorUserId?.trim()) return input.actorUserId.trim();
  throw new DataAssetCatalogTransitionError(
    input.english
      ? ["signed_in_human_actor_required"]
      : ["必须由已登录人员执行数据资产治理变更"],
  );
}

function toContract(
  entry: StoredDataAssetCatalogEntry,
): DataAssetCatalogEntry {
  return {
    assetId: entry.id,
    assetKey: entry.assetKey,
    workspaceRef: `workspace:${entry.workspaceId}`,
    sourceSystemRef: entry.sourceSystemRef,
    displayName: entry.displayName,
    sourceKind: entry.sourceKind,
    businessDomain: entry.businessDomain,
    businessOwnerRef: entry.businessOwnerRef,
    dataShape: entry.dataShape.toLowerCase() as DataAssetShape,
    sensitivity:
      entry.sensitivity.toLowerCase() as ObservationSensitivity,
    processingDisposition:
      entry.processingDisposition.toLowerCase() as DataAssetProcessingDisposition,
    technicalFeasibility:
      entry.technicalFeasibility.toLowerCase() as DataAssetTechnicalFeasibility,
    inventoryStatus:
      entry.inventoryStatus.toLowerCase() as DataAssetCatalogEntry["inventoryStatus"],
    classificationStatus:
      entry.classificationStatus.toLowerCase() as DataAssetCatalogEntry["classificationStatus"],
    authorizationStatus:
      entry.authorizationStatus.toLowerCase() as DataAssetCatalogEntry["authorizationStatus"],
    connectionStatus:
      entry.connectionStatus.toLowerCase() as DataAssetCatalogEntry["connectionStatus"],
    initializationStatus:
      entry.initializationStatus.toLowerCase() as DataAssetCatalogEntry["initializationStatus"],
    purpose: entry.purpose,
    scopeRefs: safeParseJson<string[]>(entry.scopeRefs, []),
    authorizationRef: entry.authorizationRef,
    consentRefs: safeParseJson<string[]>(entry.consentRefs, []),
    recommendedAccessMode:
      entry.recommendedAccessMode.toLowerCase() as ObservationAccessMode,
    connectorRef: entry.connectorRef,
    retentionDays: entry.retentionDays,
    freshnessSlaMinutes: entry.freshnessSlaMinutes,
    residencyRequirements: safeParseJson<string[]>(
      entry.residencyRequirements,
      [],
    ),
    blindSpots: safeParseJson<string[]>(entry.blindSpots, []),
    blockerCodes: safeParseJson<string[]>(entry.blockerCodes, []),
    riskOwnerRef: entry.riskOwnerRef,
    nextReviewAt: entry.nextReviewAt?.toISOString() ?? null,
    observationSourceRefs: safeParseJson<string[]>(
      entry.observationSourceRefs,
      [],
    ),
    observationRunRefs: safeParseJson<string[]>(
      entry.observationRunRefs,
      [],
    ),
    evidenceRefs: safeParseJson<string[]>(entry.evidenceRefs, []),
    version: entry.version,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function assertValidEntry(entry: DataAssetCatalogEntry): void {
  const validation = validateDataAssetCatalogEntry(entry);
  if (!validation.valid) {
    throw new DataAssetCatalogTransitionError(validation.errors);
  }
}

function assertValidReceipt(receipt: DataAssetStageReceipt): void {
  const validation =
    receipt.receiptType === "classification"
      ? validateDataAssetClassificationReceipt(receipt)
      : receipt.receiptType === "authorization"
        ? validateDataAssetAuthorizationReceipt(receipt)
        : receipt.receiptType === "connection"
          ? validateDataAssetConnectionReceipt(receipt)
          : validateDataAssetInitializationReceipt(receipt);
  if (!validation.valid) {
    throw new DataAssetCatalogContractError(validation.errors);
  }
}

function canonicalReplayPayload(
  receipt: DataAssetStageReceipt,
): string {
  const { recordedAt: _recordedAt, ...stable } = receipt;
  return jsonStringify(stable);
}

function isEquivalentReplay(
  stored: StoredDataAssetStageReceipt,
  receipt: DataAssetStageReceipt,
): boolean {
  if (
    stored.id !== receipt.receiptId ||
    stored.assetId !== receipt.assetRef ||
    stored.expectedVersion !== receipt.expectedVersion ||
    stored.resultingVersion !== receipt.resultingVersion
  ) {
    return false;
  }
  const parsed = safeParseJson<DataAssetStageReceipt | null>(
    stored.payloadJson,
    null,
  );
  return parsed
    ? canonicalReplayPayload(parsed) === canonicalReplayPayload(receipt)
    : false;
}

function stageStatus(receipt: DataAssetStageReceipt): string {
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

function receiptLookup(input: {
  workspaceId: string;
  receiptType: StageReceiptType;
  idempotencyKey: string;
}) {
  return {
    workspaceId_receiptType_idempotencyKey: {
      workspaceId: input.workspaceId,
      receiptType: input.receiptType.toUpperCase(),
      idempotencyKey: input.idempotencyKey,
    },
  } as const;
}

async function assertPolicyAccess(input: {
  workspaceId: string;
  actorUserId: string;
  english?: boolean;
}): Promise<string> {
  const actorUserId = requireHumanActor(input);
  await assertWorkspacePolicyServiceAccess({
    workspaceId: input.workspaceId,
    userId: actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
  return actorUserId;
}

export class DataAssetCatalogContractError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Invalid data asset catalog contract: ${reasons.join(", ")}`);
    this.name = "DataAssetCatalogContractError";
    this.reasons = reasons;
  }
}

export class DataAssetCatalogTransitionError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Data asset catalog transition denied: ${reasons.join(", ")}`);
    this.name = "DataAssetCatalogTransitionError";
    this.reasons = reasons;
  }
}

export class DataAssetCatalogConflictError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Data asset catalog transition conflicted: ${reasons.join(", ")}`);
    this.name = "DataAssetCatalogConflictError";
    this.reasons = reasons;
  }
}

export async function createDataAssetCatalogEntry(input: {
  workspaceId: string;
  assetKey: string;
  sourceSystemRef: string;
  displayName: string;
  sourceKind: string;
  businessDomain: string;
  businessOwnerRef: string;
  purpose: string;
  scopeRefs: string[];
  recommendedAccessMode: ObservationAccessMode;
  retentionDays: number;
  freshnessSlaMinutes: number;
  residencyRequirements: string[];
  blindSpots: string[];
  blockerCodes: string[];
  riskOwnerRef: string | null;
  nextReviewAt: Date | null;
  evidenceRefs: string[];
  actorName: string;
  actorUserId: string;
  now?: Date;
  english?: boolean;
}) {
  const actorUserId = await assertPolicyAccess(input);
  const now = input.now ?? new Date();
  const evidenceRefs = uniqueNonEmpty(input.evidenceRefs);
  if (evidenceRefs.length === 0) {
    throw new DataAssetCatalogContractError([
      "inventory_evidence_required",
    ]);
  }
  const contract: DataAssetCatalogEntry = {
    assetId: "pending",
    assetKey: requireNonEmpty(input.assetKey, "asset_key_required"),
    workspaceRef: `workspace:${input.workspaceId}`,
    sourceSystemRef: requireNonEmpty(
      input.sourceSystemRef,
      "source_system_ref_required",
    ),
    displayName: requireNonEmpty(input.displayName, "display_name_required"),
    sourceKind: requireNonEmpty(input.sourceKind, "source_kind_required"),
    businessDomain: requireNonEmpty(
      input.businessDomain,
      "business_domain_required",
    ),
    businessOwnerRef: requireNonEmpty(
      input.businessOwnerRef,
      "business_owner_ref_required",
    ),
    dataShape: "other",
    sensitivity: "restricted",
    processingDisposition: "local_only",
    technicalFeasibility: "unassessed",
    inventoryStatus: "inventoried",
    classificationStatus: "pending",
    authorizationStatus: "not_requested",
    connectionStatus: "not_started",
    initializationStatus: "not_started",
    purpose: requireNonEmpty(input.purpose, "purpose_required"),
    scopeRefs: uniqueNonEmpty(input.scopeRefs),
    authorizationRef: null,
    consentRefs: [],
    recommendedAccessMode: input.recommendedAccessMode,
    connectorRef: null,
    retentionDays: input.retentionDays,
    freshnessSlaMinutes: input.freshnessSlaMinutes,
    residencyRequirements: uniqueNonEmpty(input.residencyRequirements),
    blindSpots: uniqueNonEmpty(input.blindSpots),
    blockerCodes: uniqueNonEmpty(input.blockerCodes),
    riskOwnerRef: input.riskOwnerRef?.trim() || null,
    nextReviewAt: input.nextReviewAt?.toISOString() ?? null,
    observationSourceRefs: [],
    observationRunRefs: [],
    evidenceRefs,
    version: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  const validation = validateDataAssetCatalogEntry(contract);
  if (!validation.valid) {
    throw new DataAssetCatalogContractError(validation.errors);
  }

  try {
    return await db.$transaction(async (tx) => {
      const entry = await tx.dataAssetCatalogEntry.create({
        data: {
          workspaceId: input.workspaceId,
          assetKey: contract.assetKey,
          sourceSystemRef: contract.sourceSystemRef,
          displayName: contract.displayName,
          sourceKind: contract.sourceKind,
          businessDomain: contract.businessDomain,
          businessOwnerRef: contract.businessOwnerRef,
          dataShape: "OTHER",
          sensitivity: "RESTRICTED",
          processingDisposition: "LOCAL_ONLY",
          technicalFeasibility: "UNASSESSED",
          inventoryStatus: "INVENTORIED",
          classificationStatus: "PENDING",
          authorizationStatus: "NOT_REQUESTED",
          connectionStatus: "NOT_STARTED",
          initializationStatus: "NOT_STARTED",
          purpose: contract.purpose,
          scopeRefs: jsonStringify(contract.scopeRefs),
          consentRefs: jsonStringify([]),
          recommendedAccessMode:
            contract.recommendedAccessMode.toUpperCase(),
          retentionDays: contract.retentionDays,
          freshnessSlaMinutes: contract.freshnessSlaMinutes,
          residencyRequirements: jsonStringify(
            contract.residencyRequirements,
          ),
          blindSpots: jsonStringify(contract.blindSpots),
          blockerCodes: jsonStringify(contract.blockerCodes),
          riskOwnerRef: contract.riskOwnerRef,
          nextReviewAt: input.nextReviewAt,
          observationSourceRefs: jsonStringify([]),
          observationRunRefs: jsonStringify([]),
          evidenceRefs: jsonStringify(evidenceRefs),
          version: 1,
        },
      });
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: actorUserId,
          actor: input.actorName,
          actorType: ActorType.USER,
          actionType: "DATA_ASSET_INVENTORIED",
          targetType: "DataAssetCatalogEntry",
          targetId: entry.id,
          summary: input.english
            ? "Enterprise data asset inventoried with fail-closed defaults"
            : "企业数据资产已盘点并采用失败关闭默认值",
          payload: {
            assetKey: entry.assetKey,
            sourceKind: entry.sourceKind,
            evidenceRefCount: evidenceRefs.length,
          },
        },
        { client: tx },
      );
      return entry;
    });
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
    throw new DataAssetCatalogConflictError([
      "workspace_asset_key_already_exists",
    ]);
  }
}

async function persistStageReceipt(input: {
  workspaceId: string;
  assetId: string;
  receipt: DataAssetStageReceipt;
  actorName: string;
  actorUserId: string;
  english?: boolean;
  preflight?: (
    tx: Prisma.TransactionClient,
    stored: StoredDataAssetCatalogEntry,
    current: DataAssetCatalogEntry,
  ) => Promise<void>;
  afterClaim?: (
    tx: Prisma.TransactionClient,
    stored: StoredDataAssetCatalogEntry,
    current: DataAssetCatalogEntry,
  ) => Promise<void>;
  buildUpdate: (
    stored: StoredDataAssetCatalogEntry,
    current: DataAssetCatalogEntry,
  ) => {
    data: StoredEntryUpdate;
    candidate: DataAssetCatalogEntry;
  };
}): Promise<ReceiptPersistenceResult> {
  const actorUserId = await assertPolicyAccess(input);
  assertValidReceipt(input.receipt);

  const lookup = receiptLookup({
    workspaceId: input.workspaceId,
    receiptType: input.receipt.receiptType,
    idempotencyKey: input.receipt.idempotencyKey,
  });

  const execute = () =>
    db.$transaction(async (tx) => {
      await lockCatalogEntryRow(tx, {
        workspaceId: input.workspaceId,
        assetId: input.assetId,
      });
      const existing = await tx.dataAssetStageReceipt.findUnique({
        where: lookup,
      });
      if (existing) {
        if (!isEquivalentReplay(existing, input.receipt)) {
          throw new DataAssetCatalogConflictError([
            "idempotency_key_reused_with_different_payload",
          ]);
        }
        const replayedEntry = await tx.dataAssetCatalogEntry.findFirst({
          where: {
            id: input.assetId,
            workspaceId: input.workspaceId,
          },
        });
        if (!replayedEntry) {
          throw new DataAssetCatalogTransitionError(["asset_not_found"]);
        }
        return { entry: replayedEntry, receipt: existing, replayed: true };
      }

      const stored = await tx.dataAssetCatalogEntry.findFirst({
        where: {
          id: input.assetId,
          workspaceId: input.workspaceId,
        },
      });
      if (!stored) {
        throw new DataAssetCatalogTransitionError(["asset_not_found"]);
      }
      const current = toContract(stored);
      const binding = validateDataAssetReceiptForEntry(
        current,
        input.receipt,
      );
      if (!binding.valid) {
        throw new DataAssetCatalogTransitionError(binding.errors);
      }
      await input.preflight?.(tx, stored, current);
      const update = input.buildUpdate(stored, current);
      assertValidEntry(update.candidate);

      const claimed = await tx.dataAssetCatalogEntry.updateMany({
        where: {
          id: input.assetId,
          workspaceId: input.workspaceId,
          version: input.receipt.expectedVersion,
        },
        data: update.data,
      });
      if (claimed.count !== 1) {
        throw new DataAssetCatalogConflictError([
          "asset_version_conflict",
        ]);
      }
      await input.afterClaim?.(tx, stored, current);

      const receipt = await tx.dataAssetStageReceipt.create({
        data: {
          id: input.receipt.receiptId,
          workspaceId: input.workspaceId,
          assetId: input.assetId,
          receiptType: input.receipt.receiptType.toUpperCase(),
          idempotencyKey: input.receipt.idempotencyKey,
          expectedVersion: input.receipt.expectedVersion,
          resultingVersion: input.receipt.resultingVersion,
          status: stageStatus(input.receipt),
          actorRef: input.receipt.actorRef,
          evidenceRefs: jsonStringify(input.receipt.evidenceRefs),
          payloadJson: jsonStringify(input.receipt),
          recordedAt: new Date(input.receipt.recordedAt),
        },
      });
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: actorUserId,
          actor: input.actorName,
          actorType: ActorType.USER,
          actionType: `DATA_ASSET_${input.receipt.receiptType.toUpperCase()}_RECORDED`,
          targetType: "DataAssetStageReceipt",
          targetId: receipt.id,
          summary: input.english
            ? `Data asset ${input.receipt.receiptType} receipt recorded`
            : `数据资产${input.receipt.receiptType}阶段回执已记录`,
          payload: {
            assetId: input.assetId,
            expectedVersion: input.receipt.expectedVersion,
            resultingVersion: input.receipt.resultingVersion,
            status: receipt.status,
            evidenceRefCount: input.receipt.evidenceRefs.length,
          },
        },
        { client: tx },
      );
      const entry = await tx.dataAssetCatalogEntry.findUniqueOrThrow({
        where: { id: input.assetId },
      });
      return { entry, receipt, replayed: false };
    });

  try {
    return await runWithWriteConflictRetry(execute);
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
    const winner = await db.dataAssetStageReceipt.findUnique({
      where: lookup,
    });
    if (!winner || !isEquivalentReplay(winner, input.receipt)) {
      throw new DataAssetCatalogConflictError([
        "asset_version_conflict",
      ]);
    }
    const entry = await db.dataAssetCatalogEntry.findFirst({
      where: { id: input.assetId, workspaceId: input.workspaceId },
    });
    if (!entry) {
      throw new DataAssetCatalogTransitionError(["asset_not_found"]);
    }
    return { entry, receipt: winner, replayed: true };
  }
}

export async function recordDataAssetClassificationReceipt(
  input: CommonStageInput & {
    dataShape: DataAssetShape;
    sensitivity: ObservationSensitivity;
    processingDisposition: DataAssetProcessingDisposition;
    technicalFeasibility: Exclude<
      DataAssetTechnicalFeasibility,
      "unassessed"
    >;
  },
) {
  const actorUserId = requireHumanActor(input);
  const recordedAt = input.now ?? new Date();
  const receipt: DataAssetClassificationReceipt = {
    receiptType: "classification",
    receiptId: requireNonEmpty(input.receiptId, "receipt_id_required"),
    workspaceRef: `workspace:${input.workspaceId}`,
    assetRef: input.assetId,
    idempotencyKey: requireNonEmpty(
      input.idempotencyKey,
      "idempotency_key_required",
    ),
    expectedVersion: input.expectedVersion,
    resultingVersion: input.expectedVersion + 1,
    recordedAt: recordedAt.toISOString(),
    actorRef: actorUserId,
    evidenceRefs: uniqueNonEmpty(input.evidenceRefs),
    dataShape: input.dataShape,
    sensitivity: input.sensitivity,
    processingDisposition: input.processingDisposition,
    technicalFeasibility: input.technicalFeasibility,
    classificationStatus: "classified",
  };
  return persistStageReceipt({
    ...input,
    actorUserId,
    receipt,
    preflight: async (_tx, _stored, current) => {
      const classificationChanged =
        current.dataShape !== receipt.dataShape ||
        current.sensitivity !== receipt.sensitivity ||
        current.processingDisposition !== receipt.processingDisposition ||
        current.technicalFeasibility !== receipt.technicalFeasibility;
      if (
        current.authorizationStatus === "authorized" &&
        classificationChanged
      ) {
        throw new DataAssetCatalogTransitionError([
          "classification_change_requires_reauthorization",
        ]);
      }
    },
    buildUpdate: (_stored, current) => {
      const candidate: DataAssetCatalogEntry = {
        ...current,
        dataShape: receipt.dataShape,
        sensitivity: receipt.sensitivity,
        processingDisposition: receipt.processingDisposition,
        technicalFeasibility: receipt.technicalFeasibility,
        classificationStatus: "classified",
        evidenceRefs: uniqueNonEmpty([
          ...current.evidenceRefs,
          ...receipt.evidenceRefs,
        ]),
        version: receipt.resultingVersion,
        updatedAt: receipt.recordedAt,
      };
      return {
        candidate,
        data: {
          dataShape: receipt.dataShape.toUpperCase(),
          sensitivity: receipt.sensitivity.toUpperCase(),
          processingDisposition:
            receipt.processingDisposition.toUpperCase(),
          technicalFeasibility:
            receipt.technicalFeasibility.toUpperCase(),
          classificationStatus: "CLASSIFIED",
          classificationReceiptRef: receipt.receiptId,
          evidenceRefs: jsonStringify(candidate.evidenceRefs),
          version: { increment: 1 },
        },
      };
    },
  });
}

export async function recordDataAssetAuthorizationReceipt(
  input: CommonStageInput & {
    authorizationStatus: DataAssetAuthorizationReceipt["authorizationStatus"];
    authorizationRef: string | null;
    scopeRefs: string[];
    consentRefs: string[];
    validFrom: Date | null;
    validUntil: Date | null;
    reasonCodes: string[];
  },
) {
  const actorUserId = requireHumanActor(input);
  const recordedAt = input.now ?? new Date();
  const receipt: DataAssetAuthorizationReceipt = {
    receiptType: "authorization",
    receiptId: requireNonEmpty(input.receiptId, "receipt_id_required"),
    workspaceRef: `workspace:${input.workspaceId}`,
    assetRef: input.assetId,
    idempotencyKey: requireNonEmpty(
      input.idempotencyKey,
      "idempotency_key_required",
    ),
    expectedVersion: input.expectedVersion,
    resultingVersion: input.expectedVersion + 1,
    recordedAt: recordedAt.toISOString(),
    actorRef: actorUserId,
    evidenceRefs: uniqueNonEmpty(input.evidenceRefs),
    authorizationStatus: input.authorizationStatus,
    authorizationRef: input.authorizationRef?.trim() || null,
    scopeRefs: uniqueNonEmpty(input.scopeRefs),
    consentRefs: uniqueNonEmpty(input.consentRefs),
    validFrom: input.validFrom?.toISOString() ?? null,
    validUntil: input.validUntil?.toISOString() ?? null,
    reasonCodes: uniqueNonEmpty(input.reasonCodes),
  };
  return persistStageReceipt({
    ...input,
    actorUserId,
    receipt,
    preflight: async (_tx, _stored, current) => {
      if (current.classificationStatus !== "classified") {
        throw new DataAssetCatalogTransitionError([
          "authorization_requires_classified_asset",
        ]);
      }
      if (
        receipt.authorizationStatus === "authorized" &&
        current.inventoryStatus === "excluded"
      ) {
        throw new DataAssetCatalogTransitionError([
          "excluded_asset_cannot_advance",
        ]);
      }
      if (
        receipt.authorizationStatus === "authorized" &&
        current.processingDisposition === "prohibited"
      ) {
        throw new DataAssetCatalogTransitionError([
          "prohibited_asset_cannot_be_authorized",
        ]);
      }
    },
    afterClaim: async (tx) => {
      if (
        receipt.authorizationStatus !== "denied" &&
        receipt.authorizationStatus !== "revoked" &&
        receipt.authorizationStatus !== "expired"
      ) {
        return;
      }
      await tx.observationSource.updateMany({
        where: {
          workspaceId: input.workspaceId,
          catalogEntryId: input.assetId,
          status: "ACTIVE",
        },
        data: { status: "REVOKED" },
      });
      await tx.observationSourceRun.updateMany({
        where: {
          workspaceId: input.workspaceId,
          status: "RUNNING",
          source: { catalogEntryId: input.assetId },
        },
        data: {
          status: "CANCELLED",
          outcome: "FAILURE",
          freshness: "UNKNOWN",
          observedAt: recordedAt,
          errorCodes: jsonStringify([
            `asset_authorization_${receipt.authorizationStatus}`,
          ]),
        },
      });
    },
    buildUpdate: (_stored, current) => {
      const authorized = receipt.authorizationStatus === "authorized";
      const invalidatesConnection =
        receipt.authorizationStatus === "denied" ||
        receipt.authorizationStatus === "revoked" ||
        receipt.authorizationStatus === "expired";
      const connectionStatus =
        invalidatesConnection &&
        (current.connectionStatus === "connecting" ||
          current.connectionStatus === "connected")
          ? "revoked"
          : current.connectionStatus;
      const initializationStatus =
        invalidatesConnection &&
        (current.initializationStatus === "running" ||
          current.initializationStatus === "partial" ||
          current.initializationStatus === "initialized")
          ? "stale"
          : current.initializationStatus;
      const blockerCodes = uniqueNonEmpty([
        ...current.blockerCodes,
        ...receipt.reasonCodes,
      ]);
      const candidate: DataAssetCatalogEntry = {
        ...current,
        authorizationStatus: receipt.authorizationStatus,
        authorizationRef: authorized ? receipt.authorizationRef : null,
        scopeRefs: authorized ? receipt.scopeRefs : current.scopeRefs,
        consentRefs: authorized ? receipt.consentRefs : current.consentRefs,
        connectionStatus,
        initializationStatus,
        blockerCodes,
        evidenceRefs: uniqueNonEmpty([
          ...current.evidenceRefs,
          ...receipt.evidenceRefs,
        ]),
        version: receipt.resultingVersion,
        updatedAt: receipt.recordedAt,
      };
      return {
        candidate,
        data: {
          authorizationStatus:
            receipt.authorizationStatus.toUpperCase(),
          authorizationRef: authorized ? receipt.authorizationRef : null,
          authorizationValidFrom: authorized ? input.validFrom : null,
          authorizationValidUntil: authorized ? input.validUntil : null,
          scopeRefs: authorized
            ? jsonStringify(receipt.scopeRefs)
            : undefined,
          consentRefs: authorized
            ? jsonStringify(receipt.consentRefs)
            : undefined,
          connectionStatus: connectionStatus.toUpperCase(),
          initializationStatus: initializationStatus.toUpperCase(),
          blockerCodes: jsonStringify(blockerCodes),
          authorizationReceiptRef: receipt.receiptId,
          evidenceRefs: jsonStringify(candidate.evidenceRefs),
          version: { increment: 1 },
        },
      };
    },
  });
}

export async function recordDataAssetConnectionReceipt(
  input: CommonStageInput & {
    connectionStatus: DataAssetConnectionReceipt["connectionStatus"];
    accessMode: ObservationAccessMode;
    connectorRef: string | null;
    secretRef: string | null;
    authorizationReceiptRef: string | null;
    observationSourceRef: string | null;
    reasonCodes: string[];
  },
) {
  const actorUserId = requireHumanActor(input);
  const recordedAt = input.now ?? new Date();
  const receipt: DataAssetConnectionReceipt = {
    receiptType: "connection",
    receiptId: requireNonEmpty(input.receiptId, "receipt_id_required"),
    workspaceRef: `workspace:${input.workspaceId}`,
    assetRef: input.assetId,
    idempotencyKey: requireNonEmpty(
      input.idempotencyKey,
      "idempotency_key_required",
    ),
    expectedVersion: input.expectedVersion,
    resultingVersion: input.expectedVersion + 1,
    recordedAt: recordedAt.toISOString(),
    actorRef: actorUserId,
    evidenceRefs: uniqueNonEmpty(input.evidenceRefs),
    connectionStatus: input.connectionStatus,
    accessMode: input.accessMode,
    connectorRef: input.connectorRef?.trim() || null,
    secretRef: input.secretRef?.trim() || null,
    authorizationReceiptRef:
      input.authorizationReceiptRef?.trim() || null,
    observationSourceRef: input.observationSourceRef?.trim() || null,
    reasonCodes: uniqueNonEmpty(input.reasonCodes),
  };
  return persistStageReceipt({
    ...input,
    actorUserId,
    receipt,
    preflight: async (tx, stored) => {
      if (receipt.connectionStatus !== "connected") return;
      if (
        stored.classificationStatus !== "CLASSIFIED" ||
        stored.authorizationStatus !== "AUTHORIZED"
      ) {
        throw new DataAssetCatalogTransitionError([
          "connection_requires_authorized_asset",
        ]);
      }
      if (
        !stored.authorizationValidFrom ||
        !stored.authorizationValidUntil ||
        recordedAt < stored.authorizationValidFrom ||
        recordedAt >= stored.authorizationValidUntil
      ) {
        throw new DataAssetCatalogTransitionError([
          "asset_authorization_window_inactive",
        ]);
      }
      if (
        !receipt.authorizationReceiptRef ||
        receipt.authorizationReceiptRef !==
          stored.authorizationReceiptRef
      ) {
        throw new DataAssetCatalogTransitionError([
          "authorization_receipt_mismatch",
        ]);
      }
      const authorizationReceipt =
        await tx.dataAssetStageReceipt.findFirst({
          where: {
            id: receipt.authorizationReceiptRef,
            workspaceId: input.workspaceId,
            assetId: input.assetId,
            receiptType: "AUTHORIZATION",
            status: "AUTHORIZED",
          },
          select: { id: true },
        });
      if (!authorizationReceipt) {
        throw new DataAssetCatalogTransitionError([
          "authorization_receipt_not_found",
        ]);
      }
      const source = await tx.observationSource.findFirst({
        where: {
          id: receipt.observationSourceRef ?? undefined,
          workspaceId: input.workspaceId,
          catalogEntryId: input.assetId,
          status: { in: ["ACTIVE", "ERROR", "PAUSED", "REVOKED"] },
        },
      });
      if (
        !source ||
        source.secretRef !== receipt.secretRef ||
        source.accessMode !== receipt.accessMode.toUpperCase() ||
        source.authorizationRef !== stored.authorizationRef
      ) {
        throw new DataAssetCatalogTransitionError([
          "observation_source_not_bound_to_asset",
        ]);
      }
    },
    afterClaim: async (tx) => {
      if (receipt.connectionStatus === "connected") {
        const sourceId = receipt.observationSourceRef;
        if (!sourceId) {
          throw new DataAssetCatalogTransitionError([
            "observation_source_ref_required",
          ]);
        }
        const activated = await tx.observationSource.updateMany({
          where: {
            id: sourceId,
            workspaceId: input.workspaceId,
            catalogEntryId: input.assetId,
            status: { in: ["ACTIVE", "ERROR", "PAUSED", "REVOKED"] },
            program: {
              status: "ACTIVE",
              revokedAt: null,
              startsAt: { lte: recordedAt },
              expiresAt: { gt: recordedAt },
            },
          },
          data: { status: "ACTIVE" },
        });
        if (activated.count !== 1) {
          throw new DataAssetCatalogTransitionError([
            "observation_source_activation_claim_lost",
          ]);
        }
        return;
      }
      if (
        receipt.connectionStatus !== "blocked" &&
        receipt.connectionStatus !== "failed" &&
        receipt.connectionStatus !== "revoked"
      ) {
        return;
      }
      await tx.observationSource.updateMany({
        where: {
          workspaceId: input.workspaceId,
          catalogEntryId: input.assetId,
          status: "ACTIVE",
        },
        data: {
          status:
            receipt.connectionStatus === "revoked"
              ? "REVOKED"
              : "ERROR",
        },
      });
      await tx.observationSourceRun.updateMany({
        where: {
          workspaceId: input.workspaceId,
          status: "RUNNING",
          source: { catalogEntryId: input.assetId },
        },
        data: {
          status: "CANCELLED",
          outcome: "FAILURE",
          freshness: "UNKNOWN",
          observedAt: recordedAt,
          errorCodes: jsonStringify([
            `asset_connection_${receipt.connectionStatus}`,
          ]),
        },
      });
    },
    buildUpdate: (_stored, current) => {
      const connected = receipt.connectionStatus === "connected";
      const invalidatesInitialization =
        receipt.connectionStatus === "blocked" ||
        receipt.connectionStatus === "revoked" ||
        receipt.connectionStatus === "failed";
      const initializationStatus =
        invalidatesInitialization &&
        (current.initializationStatus === "running" ||
          current.initializationStatus === "partial" ||
          current.initializationStatus === "initialized")
          ? "stale"
          : current.initializationStatus;
      const observationSourceRefs =
        connected && receipt.observationSourceRef
          ? uniqueNonEmpty([
              ...current.observationSourceRefs,
              receipt.observationSourceRef,
            ])
          : current.observationSourceRefs;
      const blockerCodes = uniqueNonEmpty([
        ...current.blockerCodes,
        ...receipt.reasonCodes,
      ]);
      const candidate: DataAssetCatalogEntry = {
        ...current,
        connectionStatus: receipt.connectionStatus,
        initializationStatus,
        connectorRef: connected
          ? receipt.connectorRef
          : current.connectorRef,
        observationSourceRefs,
        blockerCodes,
        evidenceRefs: uniqueNonEmpty([
          ...current.evidenceRefs,
          ...receipt.evidenceRefs,
        ]),
        version: receipt.resultingVersion,
        updatedAt: receipt.recordedAt,
      };
      return {
        candidate,
        data: {
          connectionStatus: receipt.connectionStatus.toUpperCase(),
          initializationStatus: initializationStatus.toUpperCase(),
          connectorRef: connected ? receipt.connectorRef : undefined,
          observationSourceRefs: jsonStringify(observationSourceRefs),
          blockerCodes: jsonStringify(blockerCodes),
          connectionReceiptRef: receipt.receiptId,
          evidenceRefs: jsonStringify(candidate.evidenceRefs),
          version: { increment: 1 },
        },
      };
    },
  });
}

export async function recordDataAssetInitializationReceipt(
  input: CommonStageInput & {
    initializationStatus: DataAssetInitializationReceipt["initializationStatus"];
    connectionReceiptRef: string | null;
    observationRunRefs: string[];
    schemaMappingRefs: string[];
    companyMemoryRefs: string[];
    temporalContextSnapshotRef: string | null;
    reasonCodes: string[];
  },
) {
  const actorUserId = requireHumanActor(input);
  const recordedAt = input.now ?? new Date();
  const receipt: DataAssetInitializationReceipt = {
    receiptType: "initialization",
    receiptId: requireNonEmpty(input.receiptId, "receipt_id_required"),
    workspaceRef: `workspace:${input.workspaceId}`,
    assetRef: input.assetId,
    idempotencyKey: requireNonEmpty(
      input.idempotencyKey,
      "idempotency_key_required",
    ),
    expectedVersion: input.expectedVersion,
    resultingVersion: input.expectedVersion + 1,
    recordedAt: recordedAt.toISOString(),
    actorRef: actorUserId,
    evidenceRefs: uniqueNonEmpty(input.evidenceRefs),
    initializationStatus: input.initializationStatus,
    connectionReceiptRef: input.connectionReceiptRef?.trim() || null,
    observationRunRefs: uniqueNonEmpty(input.observationRunRefs),
    schemaMappingRefs: uniqueNonEmpty(input.schemaMappingRefs),
    companyMemoryRefs: uniqueNonEmpty(input.companyMemoryRefs),
    temporalContextSnapshotRef:
      input.temporalContextSnapshotRef?.trim() || null,
    reasonCodes: uniqueNonEmpty(input.reasonCodes),
  };
  return persistStageReceipt({
    ...input,
    actorUserId,
    receipt,
    preflight: async (tx, stored) => {
      if (
        receipt.initializationStatus !== "running" &&
        receipt.initializationStatus !== "partial" &&
        receipt.initializationStatus !== "initialized"
      ) {
        return;
      }
      if (stored.connectionStatus !== "CONNECTED") {
        throw new DataAssetCatalogTransitionError([
          "initialization_requires_connected_source",
        ]);
      }
      if (
        !receipt.connectionReceiptRef ||
        receipt.connectionReceiptRef !== stored.connectionReceiptRef
      ) {
        throw new DataAssetCatalogTransitionError([
          "connection_receipt_mismatch",
        ]);
      }
      if (receipt.initializationStatus !== "initialized") return;
      const runs = await tx.observationSourceRun.findMany({
        where: {
          id: { in: [...receipt.observationRunRefs] },
          workspaceId: input.workspaceId,
          status: { in: ["SUCCEEDED", "PARTIAL"] },
          source: { catalogEntryId: input.assetId },
        },
        select: { id: true },
      });
      const matched = new Set(runs.map((run) => run.id));
      if (
        receipt.observationRunRefs.length === 0 ||
        receipt.observationRunRefs.some((runId) => !matched.has(runId))
      ) {
        throw new DataAssetCatalogTransitionError([
          "initialization_run_not_bound_to_asset",
        ]);
      }
    },
    buildUpdate: (_stored, current) => {
      const blockerCodes = uniqueNonEmpty([
        ...current.blockerCodes,
        ...receipt.reasonCodes,
      ]);
      const observationRunRefs =
        receipt.initializationStatus === "initialized"
          ? receipt.observationRunRefs
          : current.observationRunRefs;
      const candidate: DataAssetCatalogEntry = {
        ...current,
        initializationStatus: receipt.initializationStatus,
        observationRunRefs,
        blockerCodes,
        evidenceRefs: uniqueNonEmpty([
          ...current.evidenceRefs,
          ...receipt.evidenceRefs,
        ]),
        version: receipt.resultingVersion,
        updatedAt: receipt.recordedAt,
      };
      return {
        candidate,
        data: {
          initializationStatus:
            receipt.initializationStatus.toUpperCase(),
          observationRunRefs: jsonStringify(observationRunRefs),
          blockerCodes: jsonStringify(blockerCodes),
          initializationReceiptRef: receipt.receiptId,
          evidenceRefs: jsonStringify(candidate.evidenceRefs),
          version: { increment: 1 },
        },
      };
    },
  });
}
