import "server-only";

import { createHash } from "node:crypto";
import {
  ActorType,
  type DataAssetCatalogEntry as StoredDataAssetCatalogEntry,
  type ObservationCompatReceipt as StoredCompatibilityReceipt,
  type ObservationSource as StoredObservationSource,
  type Prisma,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { assertWorkspacePolicyServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { jsonStringify, safeParseJson } from "@/lib/utils";
import {
  isManagedSecretReference,
  validateObservationSourceCompatibilityReceipt,
} from "./data-asset-catalog.contract";
import {
  OBSERVATION_SOURCE_COMPATIBILITY_RESTRICTIONS,
  type ObservationSourceCompatibilityReceipt,
} from "./data-asset-catalog.types";
import {
  authorizeObservation,
  validateEnterpriseObservationProgram,
  validateSourceObservationReceipt,
} from "./contracts";
import type {
  EnterpriseObservationProgram,
  ObservationSource,
  SourceObservationReceipt,
} from "./types";

const SENSITIVITY_RANK: Record<ObservationSource["sensitivity"], number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

// InnoDB REPEATABLE READ requires locking reads to happen before ordinary
// reads. The observation write paths use one order whenever the rows exist:
// catalog asset -> observation program -> observation source. A caller that
// waits for a concurrent revocation/connection transition therefore reloads
// the committed terminal state instead of continuing from a stale snapshot.
async function lockObservationCatalogEntry(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; catalogEntryId: string },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM DataAssetCatalogEntry
    WHERE id = ${input.catalogEntryId}
      AND workspaceId = ${input.workspaceId}
    FOR UPDATE`;
  if (rows.length !== 1) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_not_found",
    ]);
  }
}

async function lockObservationProgram(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; programId: string },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM EnterpriseObservationProgram
    WHERE id = ${input.programId}
      AND workspaceId = ${input.workspaceId}
    FOR UPDATE`;
  if (rows.length !== 1) {
    throw new ObservationAuthorizationDeniedError(["program_not_found"]);
  }
}

async function lockObservationSource(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; sourceId: string },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM ObservationSource
    WHERE id = ${input.sourceId}
      AND workspaceId = ${input.workspaceId}
    FOR UPDATE`;
  if (rows.length !== 1) {
    throw new ObservationAuthorizationDeniedError(["source_not_found"]);
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

function requireHumanOwner(input: {
  actorUserId?: string | null;
  english?: boolean;
}): string {
  if (input.actorUserId?.trim()) return input.actorUserId;
  throw new ObservationAuthorizationDeniedError(
    input.english
      ? ["A signed-in owner identity is required"]
      : ["必须由已登录的一把手身份完成授权"],
  );
}

function toProgramContract(program: {
  id: string;
  workspaceId: string;
  purpose: string;
  scopeRefs: string;
  dataCategories: string;
  startsAt: Date;
  expiresAt: Date;
  retentionDays: number;
  authorizationRef: string;
  status: string;
  revokedAt: Date | null;
  revokedByRef: string | null;
  revocationReason: string | null;
  auditRefs: string | null;
}): EnterpriseObservationProgram {
  return {
    programId: program.id,
    workspaceRef: `workspace:${program.workspaceId}`,
    purpose: program.purpose,
    scopeRefs: safeParseJson<string[]>(program.scopeRefs, []),
    dataCategories: safeParseJson<string[]>(program.dataCategories, []),
    startsAt: program.startsAt.toISOString(),
    expiresAt: program.expiresAt.toISOString(),
    retentionDays: program.retentionDays,
    authorizationRef: program.authorizationRef,
    status:
      program.status.toLowerCase() as EnterpriseObservationProgram["status"],
    revokedAt: program.revokedAt?.toISOString() ?? null,
    revokedByRef: program.revokedByRef,
    revocationReason: program.revocationReason,
    auditRefs: safeParseJson<string[]>(program.auditRefs, []),
  };
}

function toSourceContract(source: {
  id: string;
  workspaceId: string;
  programId: string;
  sourceKind: string;
  accessMode: string;
  ownerRef: string;
  freshnessSlaMinutes: number;
  sensitivity: string;
  authorizationRef: string;
  secretRef: string;
  retentionDays: number;
  status: string;
}): ObservationSource {
  return {
    sourceId: source.id,
    workspaceRef: `workspace:${source.workspaceId}`,
    programRef: source.programId,
    sourceKind: source.sourceKind,
    accessMode:
      source.accessMode.toLowerCase() as ObservationSource["accessMode"],
    ownerRef: source.ownerRef,
    freshnessSlaMinutes: source.freshnessSlaMinutes,
    sensitivity:
      source.sensitivity.toLowerCase() as ObservationSource["sensitivity"],
    authorizationRef: source.authorizationRef,
    secretRef: source.secretRef,
    retentionDays: source.retentionDays,
    status: source.status.toLowerCase() as ObservationSource["status"],
  };
}

function assertCatalogEntryAllowsRegistration(input: {
  entry: StoredDataAssetCatalogEntry | null;
  workspaceId: string;
  sourceKind: string;
  accessMode: ObservationSource["accessMode"];
  sensitivity: ObservationSource["sensitivity"];
  authorizationRef: string;
  secretRef: string;
  retentionDays: number;
  freshnessSlaMinutes: number;
  now: Date;
}): StoredDataAssetCatalogEntry {
  const entry = input.entry;
  if (!entry) {
    throw new ObservationAuthorizationDeniedError(["catalog_asset_not_found"]);
  }
  if (entry.workspaceId !== input.workspaceId) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_workspace_mismatch",
    ]);
  }
  if (
    entry.inventoryStatus !== "INVENTORIED" &&
    entry.inventoryStatus !== "CONFIRMED"
  ) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_excluded",
    ]);
  }
  if (entry.classificationStatus !== "CLASSIFIED") {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_not_classified",
    ]);
  }
  if (
    entry.processingDisposition !== "LOCAL_ONLY" &&
    entry.processingDisposition !== "REMOTE_PROJECTED"
  ) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_processing_prohibited",
    ]);
  }
  if (
    entry.authorizationStatus !== "AUTHORIZED" ||
    !entry.authorizationRef ||
    !entry.authorizationReceiptRef
  ) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_not_authorized",
    ]);
  }
  if (
    !entry.authorizationValidFrom ||
    !entry.authorizationValidUntil ||
    input.now < entry.authorizationValidFrom ||
    input.now >= entry.authorizationValidUntil
  ) {
    throw new ObservationAuthorizationDeniedError([
      "asset_authorization_window_inactive",
    ]);
  }
  if (entry.authorizationRef !== input.authorizationRef.trim()) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_authorization_mismatch",
    ]);
  }
  if (entry.sourceKind !== input.sourceKind.trim()) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_source_kind_mismatch",
    ]);
  }
  if (entry.recommendedAccessMode !== input.accessMode.toUpperCase()) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_access_mode_mismatch",
    ]);
  }
  const assetSensitivity =
    entry.sensitivity.toLowerCase() as ObservationSource["sensitivity"];
  if (!(assetSensitivity in SENSITIVITY_RANK)) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_sensitivity_invalid",
    ]);
  }
  if (
    SENSITIVITY_RANK[input.sensitivity] <
    SENSITIVITY_RANK[assetSensitivity]
  ) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_sensitivity_understated",
    ]);
  }
  if (input.retentionDays > entry.retentionDays) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_retention_exceeded",
    ]);
  }
  if (input.freshnessSlaMinutes > entry.freshnessSlaMinutes) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_freshness_sla_exceeded",
    ]);
  }
  if (!isManagedSecretReference(input.secretRef.trim())) {
    throw new ObservationAuthorizationDeniedError([
      "secret_ref_must_be_managed_reference",
    ]);
  }
  return entry;
}

function legacySourceFingerprint(source: StoredObservationSource): string {
  // Intentional migration-time snapshot: changing any captured field
  // permanently closes the compatibility path and requires catalog backfill.
  const fingerprintInput = [
    source.workspaceId,
    source.programId,
    source.sourceKey,
    source.sourceKind,
    source.accessMode,
    source.ownerRef,
    source.sensitivity,
    source.authorizationRef,
    source.secretRef,
    String(source.retentionDays),
    source.status,
  ].join("|");
  return `sha256:${createHash("sha256").update(fingerprintInput).digest("hex")}`;
}

function toCompatibilityContract(
  receipt: StoredCompatibilityReceipt,
): ObservationSourceCompatibilityReceipt {
  return {
    receiptId: receipt.id,
    workspaceRef: `workspace:${receipt.workspaceId}`,
    observationSourceRef: receipt.observationSourceId,
    migrationRef: receipt.migrationRef,
    capturedAt: receipt.capturedAt.toISOString(),
    actorRef: receipt.actorRef,
    evidenceRefs: safeParseJson<string[]>(receipt.evidenceRefs, []),
    nextReviewAt: receipt.nextReviewAt.toISOString(),
    sourceFingerprint: receipt.sourceFingerprint,
    restrictions: safeParseJson<
      ObservationSourceCompatibilityReceipt["restrictions"][number][]
    >(receipt.restrictions, []),
  };
}

async function assertSourceCatalogGate(
  tx: Prisma.TransactionClient,
  source: StoredObservationSource & {
    catalogEntry: StoredDataAssetCatalogEntry | null;
    compatibilityReceipt: StoredCompatibilityReceipt | null;
  },
  now: Date,
): Promise<void> {
  if (source.catalogEntryId) {
    const entry = source.catalogEntry;
    if (!entry || entry.id !== source.catalogEntryId) {
      throw new ObservationAuthorizationDeniedError([
        "catalog_asset_not_found",
      ]);
    }
    if (entry.workspaceId !== source.workspaceId) {
      throw new ObservationAuthorizationDeniedError([
        "catalog_asset_workspace_mismatch",
      ]);
    }
    if (
      (entry.inventoryStatus !== "INVENTORIED" &&
        entry.inventoryStatus !== "CONFIRMED") ||
      (entry.processingDisposition !== "LOCAL_ONLY" &&
        entry.processingDisposition !== "REMOTE_PROJECTED") ||
      entry.classificationStatus !== "CLASSIFIED" ||
      entry.authorizationStatus !== "AUTHORIZED"
    ) {
      throw new ObservationAuthorizationDeniedError([
        "catalog_asset_not_authorized",
      ]);
    }
    if (entry.connectionStatus !== "CONNECTED") {
      throw new ObservationAuthorizationDeniedError([
        "catalog_asset_not_connected",
      ]);
    }
    if (
      !entry.authorizationValidFrom ||
      !entry.authorizationValidUntil ||
      now < entry.authorizationValidFrom ||
      now >= entry.authorizationValidUntil
    ) {
      throw new ObservationAuthorizationDeniedError([
        "asset_authorization_window_inactive",
      ]);
    }
    if (
      !entry.authorizationReceiptRef ||
      !entry.connectionReceiptRef ||
      !entry.connectorRef ||
      entry.authorizationRef !== source.authorizationRef
    ) {
      throw new ObservationAuthorizationDeniedError([
        "catalog_asset_receipt_chain_incomplete",
      ]);
    }
    const sourceRefs = safeParseJson<string[]>(
      entry.observationSourceRefs,
      [],
    );
    if (!sourceRefs.includes(source.id)) {
      throw new ObservationAuthorizationDeniedError([
        "catalog_asset_source_binding_missing",
      ]);
    }
    const [authorizationReceipt, connectionReceipt] = await Promise.all([
      tx.dataAssetStageReceipt.findFirst({
        where: {
          id: entry.authorizationReceiptRef,
          workspaceId: source.workspaceId,
          assetId: entry.id,
          receiptType: "AUTHORIZATION",
          status: "AUTHORIZED",
        },
        select: { id: true },
      }),
      tx.dataAssetStageReceipt.findFirst({
        where: {
          id: entry.connectionReceiptRef,
          workspaceId: source.workspaceId,
          assetId: entry.id,
          receiptType: "CONNECTION",
          status: "CONNECTED",
        },
        select: { id: true },
      }),
    ]);
    if (!authorizationReceipt) {
      throw new ObservationAuthorizationDeniedError([
        "catalog_asset_authorization_receipt_missing",
      ]);
    }
    if (!connectionReceipt) {
      throw new ObservationAuthorizationDeniedError([
        "catalog_asset_connection_receipt_missing",
      ]);
    }
    return;
  }

  const compatibility = source.compatibilityReceipt;
  if (!compatibility) {
    throw new ObservationAuthorizationDeniedError([
      "legacy_source_compatibility_receipt_required",
    ]);
  }
  const contract = toCompatibilityContract(compatibility);
  const validation = validateObservationSourceCompatibilityReceipt(contract);
  if (!validation.valid) {
    throw new ObservationAuthorizationDeniedError(validation.errors);
  }
  if (
    compatibility.workspaceId !== source.workspaceId ||
    compatibility.observationSourceId !== source.id
  ) {
    throw new ObservationAuthorizationDeniedError([
      "legacy_source_compatibility_binding_mismatch",
    ]);
  }
  if (now >= compatibility.nextReviewAt) {
    throw new ObservationAuthorizationDeniedError([
      "legacy_source_compatibility_review_overdue",
    ]);
  }
  const restrictions = new Set(contract.restrictions);
  if (
    restrictions.size !==
      OBSERVATION_SOURCE_COMPATIBILITY_RESTRICTIONS.length ||
    OBSERVATION_SOURCE_COMPATIBILITY_RESTRICTIONS.some(
      (restriction) => !restrictions.has(restriction),
    )
  ) {
    throw new ObservationAuthorizationDeniedError([
      "legacy_source_compatibility_restrictions_invalid",
    ]);
  }
  if (compatibility.sourceFingerprint !== legacySourceFingerprint(source)) {
    throw new ObservationAuthorizationDeniedError([
      "legacy_source_fingerprint_mismatch",
    ]);
  }
}

async function claimCatalogAssetForObservation(input: {
  tx: Prisma.TransactionClient;
  entry: StoredDataAssetCatalogEntry;
  now: Date;
  requireConnected: boolean;
}): Promise<void> {
  const claimed = await input.tx.dataAssetCatalogEntry.updateMany({
    where: {
      id: input.entry.id,
      workspaceId: input.entry.workspaceId,
      version: input.entry.version,
      inventoryStatus: { in: ["INVENTORIED", "CONFIRMED"] },
      classificationStatus: "CLASSIFIED",
      authorizationStatus: "AUTHORIZED",
      processingDisposition: { in: ["LOCAL_ONLY", "REMOTE_PROJECTED"] },
      authorizationValidFrom: { lte: input.now },
      authorizationValidUntil: { gt: input.now },
      ...(input.requireConnected
        ? { connectionStatus: "CONNECTED" }
        : {}),
    },
    data: { observationClaimSequence: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    throw new ObservationAuthorizationDeniedError([
      "catalog_asset_claim_lost",
    ]);
  }
}

export class ObservationContractError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Invalid observation contract: ${reasons.join(", ")}`);
    this.name = "ObservationContractError";
    this.reasons = reasons;
  }
}

export class ObservationAuthorizationDeniedError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Observation authorization denied: ${reasons.join(", ")}`);
    this.name = "ObservationAuthorizationDeniedError";
    this.reasons = reasons;
  }
}

export async function createEnterpriseObservationProgram(input: {
  workspaceId: string;
  purpose: string;
  scopeRefs: string[];
  dataCategories: string[];
  startsAt: Date;
  expiresAt: Date;
  retentionDays: number;
  authorizationRef: string;
  actorName: string;
  actorUserId: string;
  english?: boolean;
}) {
  const actorUserId = requireHumanOwner(input);
  await assertWorkspacePolicyServiceAccess({
    workspaceId: input.workspaceId,
    userId: actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });

  const contract: EnterpriseObservationProgram = {
    programId: "pending",
    workspaceRef: `workspace:${input.workspaceId}`,
    purpose: input.purpose,
    scopeRefs: input.scopeRefs,
    dataCategories: input.dataCategories,
    startsAt: input.startsAt.toISOString(),
    expiresAt: input.expiresAt.toISOString(),
    retentionDays: input.retentionDays,
    authorizationRef: input.authorizationRef,
    status: "active",
    revokedAt: null,
    revokedByRef: null,
    revocationReason: null,
    auditRefs: [],
  };
  const validation = validateEnterpriseObservationProgram(contract);
  if (!validation.valid) throw new ObservationContractError(validation.errors);

  return db.$transaction(async (tx) => {
    const program = await tx.enterpriseObservationProgram.create({
      data: {
        workspaceId: input.workspaceId,
        purpose: input.purpose.trim(),
        scopeRefs: jsonStringify([
          ...new Set(input.scopeRefs.map((value) => value.trim())),
        ]),
        dataCategories: jsonStringify([
          ...new Set(input.dataCategories.map((value) => value.trim())),
        ]),
        startsAt: input.startsAt,
        expiresAt: input.expiresAt,
        retentionDays: input.retentionDays,
        authorizationRef: input.authorizationRef.trim(),
        status: "ACTIVE",
      },
    });
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: actorUserId,
        actor: input.actorName,
        actorType: ActorType.USER,
        actionType: "ENTERPRISE_OBSERVATION_AUTHORIZED",
        targetType: "EnterpriseObservationProgram",
        targetId: program.id,
        summary: input.english
          ? "Owner authorized a time-bounded read-only observation program"
          : "一把手已授权有期限的只读企业观察计划",
        payload: {
          authorizationRef: program.authorizationRef,
          startsAt: program.startsAt,
          expiresAt: program.expiresAt,
          retentionDays: program.retentionDays,
          scopeRefs: input.scopeRefs,
          dataCategories: input.dataCategories,
        },
      },
      { client: tx },
    );
    return program;
  });
}

export async function registerObservationSource(input: {
  workspaceId: string;
  programId: string;
  catalogEntryId: string;
  sourceKey: string;
  sourceKind: string;
  accessMode: ObservationSource["accessMode"];
  ownerRef: string;
  freshnessSlaMinutes: number;
  sensitivity: ObservationSource["sensitivity"];
  authorizationRef: string;
  secretRef: string;
  retentionDays: number;
  actorName: string;
  actorUserId: string;
  now?: Date;
  english?: boolean;
}) {
  const actorUserId = requireHumanOwner(input);
  await assertWorkspacePolicyServiceAccess({
    workspaceId: input.workspaceId,
    userId: actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(() =>
    db.$transaction(async (tx) => {
      await lockObservationCatalogEntry(tx, {
        workspaceId: input.workspaceId,
        catalogEntryId: input.catalogEntryId,
      });
      await lockObservationProgram(tx, {
        workspaceId: input.workspaceId,
        programId: input.programId,
      });
      const program = await tx.enterpriseObservationProgram.findFirst({
        where: { id: input.programId, workspaceId: input.workspaceId },
      });
      if (!program)
        throw new ObservationAuthorizationDeniedError(["program_not_found"]);
      const catalogEntry = await tx.dataAssetCatalogEntry.findFirst({
        where: {
          id: input.catalogEntryId,
          workspaceId: input.workspaceId,
        },
      });
      const authorizedCatalogEntry = assertCatalogEntryAllowsRegistration({
        entry: catalogEntry,
        workspaceId: input.workspaceId,
        sourceKind: input.sourceKind,
        accessMode: input.accessMode,
        sensitivity: input.sensitivity,
        authorizationRef: input.authorizationRef,
        secretRef: input.secretRef,
        retentionDays: input.retentionDays,
        freshnessSlaMinutes: input.freshnessSlaMinutes,
        now,
      });
      const authorizationReceipt = await tx.dataAssetStageReceipt.findFirst({
        where: {
          id: authorizedCatalogEntry.authorizationReceiptRef ?? undefined,
          workspaceId: input.workspaceId,
          assetId: authorizedCatalogEntry.id,
          receiptType: "AUTHORIZATION",
          status: "AUTHORIZED",
        },
        select: { id: true },
      });
      if (!authorizationReceipt) {
        throw new ObservationAuthorizationDeniedError([
          "catalog_asset_authorization_receipt_missing",
        ]);
      }
      await claimCatalogAssetForObservation({
        tx,
        entry: authorizedCatalogEntry,
        now,
        requireConnected: false,
      });

      const sourceContract: ObservationSource = {
        sourceId: input.sourceKey,
        workspaceRef: `workspace:${input.workspaceId}`,
        programRef: program.id,
        sourceKind: input.sourceKind,
        accessMode: input.accessMode,
        ownerRef: input.ownerRef,
        freshnessSlaMinutes: input.freshnessSlaMinutes,
        sensitivity: input.sensitivity,
        authorizationRef: input.authorizationRef,
        secretRef: input.secretRef,
        retentionDays: input.retentionDays,
        status: "active",
      };
      const authorization = authorizeObservation({
        program: toProgramContract(program),
        source: sourceContract,
        now: now.toISOString(),
      });
      if (!authorization.allowed) {
        throw new ObservationAuthorizationDeniedError(authorization.reasons);
      }

      // Serialize source registration against authorization revocation. A
      // revocation that wins this claim prevents a late ACTIVE source insert.
      const activeProgramClaim =
        await tx.enterpriseObservationProgram.updateMany({
          where: {
            id: program.id,
            workspaceId: input.workspaceId,
            status: "ACTIVE",
            revokedAt: null,
            authorizationVersion: program.authorizationVersion,
          },
          data: { updatedAt: new Date() },
        });
      if (activeProgramClaim.count !== 1) {
        throw new ObservationAuthorizationDeniedError(["program_not_active"]);
      }

      const source = await tx.observationSource.create({
        data: {
          workspaceId: input.workspaceId,
          programId: program.id,
          catalogEntryId: input.catalogEntryId,
          sourceKey: input.sourceKey.trim(),
          sourceKind: input.sourceKind.trim(),
          accessMode: input.accessMode.toUpperCase(),
          ownerRef: input.ownerRef.trim(),
          freshnessSlaMinutes: input.freshnessSlaMinutes,
          sensitivity: input.sensitivity.toUpperCase(),
          authorizationRef: input.authorizationRef.trim(),
          secretRef: input.secretRef.trim(),
          retentionDays: input.retentionDays,
          status: "ACTIVE",
        },
      });
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: actorUserId,
          actor: input.actorName,
          actorType: ActorType.USER,
          actionType: "OBSERVATION_SOURCE_REGISTERED",
          targetType: "ObservationSource",
          targetId: source.id,
          summary: input.english
            ? "Read-only observation source registered"
            : "只读观察来源已登记",
          payload: {
            sourceKey: source.sourceKey,
            catalogEntryId: source.catalogEntryId,
            accessMode: source.accessMode,
            secretRefPresent: Boolean(source.secretRef),
            authorizationRef: source.authorizationRef,
          },
        },
        { client: tx },
      );
      return source;
    }),
  );
}

export async function revokeEnterpriseObservationProgram(input: {
  workspaceId: string;
  programId: string;
  reason: string;
  actorName: string;
  actorUserId: string;
  english?: boolean;
}) {
  const actorUserId = requireHumanOwner(input);
  await assertWorkspacePolicyServiceAccess({
    workspaceId: input.workspaceId,
    userId: actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
  if (!input.reason.trim())
    throw new ObservationContractError(["revocation_reason_required"]);
  const now = new Date();

  const result = await runWithWriteConflictRetry(() =>
    db.$transaction(async (tx) => {
      await lockObservationProgram(tx, {
        workspaceId: input.workspaceId,
        programId: input.programId,
      });
      const claimed = await tx.enterpriseObservationProgram.updateMany({
        where: {
          id: input.programId,
          workspaceId: input.workspaceId,
          status: "ACTIVE",
          revokedAt: null,
        },
        data: {
          status: "REVOKED",
          revokedAt: now,
          revokedByRef: actorUserId,
          revocationReason: input.reason.trim(),
          authorizationVersion: { increment: 1 },
        },
      });
      const program = await tx.enterpriseObservationProgram.findFirst({
        where: { id: input.programId, workspaceId: input.workspaceId },
      });
      if (!program)
        throw new ObservationAuthorizationDeniedError(["program_not_found"]);
      if (claimed.count === 0 && program.status !== "REVOKED") {
        throw new ObservationAuthorizationDeniedError(["program_not_active"]);
      }
      if (claimed.count > 0) {
        await tx.observationSource.updateMany({
          where: {
            workspaceId: input.workspaceId,
            programId: input.programId,
            status: "ACTIVE",
          },
          data: { status: "REVOKED" },
        });
        await tx.observationSourceRun.updateMany({
          where: {
            workspaceId: input.workspaceId,
            programId: input.programId,
            status: "RUNNING",
          },
          data: {
            status: "CANCELLED",
            outcome: "FAILURE",
            freshness: "UNKNOWN",
            observedAt: now,
            errorCodes: jsonStringify(["authorization_revoked"]),
          },
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: actorUserId,
            actor: input.actorName,
            actorType: ActorType.USER,
            actionType: "ENTERPRISE_OBSERVATION_REVOKED",
            targetType: "EnterpriseObservationProgram",
            targetId: program.id,
            summary: input.english
              ? "Owner revoked the observation program; active sources and runs were stopped"
              : "一把手已撤销观察计划，活动来源与运行已停止",
            payload: { reason: input.reason.trim(), revokedAt: now },
          },
          { client: tx },
        );
      }
      return program;
    }),
  );
  return result;
}

export async function beginObservationSourceRun(input: {
  workspaceId: string;
  sourceKey: string;
  executionKey: string;
  windowStart: Date;
  windowEnd: Date;
  now?: Date;
}) {
  const sourceKey = input.sourceKey.trim();
  const executionKey = input.executionKey.trim();
  if (!sourceKey) throw new ObservationContractError(["source_key_required"]);
  if (!executionKey)
    throw new ObservationContractError(["execution_key_required"]);
  if (input.windowStart > input.windowEnd) {
    throw new ObservationContractError(["observation_window_reversed"]);
  }
  const now = input.now ?? new Date();

  return runWithWriteConflictRetry(async () => {
    const locator = await db.observationSource.findUnique({
      where: {
        workspaceId_sourceKey: {
          workspaceId: input.workspaceId,
          sourceKey,
        },
      },
      select: {
        id: true,
        programId: true,
        catalogEntryId: true,
      },
    });
    if (!locator) {
      throw new ObservationAuthorizationDeniedError(["source_not_found"]);
    }
    try {
      return await db.$transaction(async (tx) => {
        if (locator.catalogEntryId) {
          await lockObservationCatalogEntry(tx, {
            workspaceId: input.workspaceId,
            catalogEntryId: locator.catalogEntryId,
          });
        }
        await lockObservationProgram(tx, {
          workspaceId: input.workspaceId,
          programId: locator.programId,
        });
        await lockObservationSource(tx, {
          workspaceId: input.workspaceId,
          sourceId: locator.id,
        });
        const source = await tx.observationSource.findUnique({
          where: {
            workspaceId_sourceKey: {
              workspaceId: input.workspaceId,
              sourceKey,
            },
          },
          include: {
            program: true,
            catalogEntry: true,
            compatibilityReceipt: true,
          },
        });
        if (!source)
          throw new ObservationAuthorizationDeniedError(["source_not_found"]);
        if (
          source.id !== locator.id ||
          source.programId !== locator.programId ||
          source.catalogEntryId !== locator.catalogEntryId
        ) {
          throw new ObservationAuthorizationDeniedError([
            "source_binding_changed",
          ]);
        }

        const existing = await tx.observationSourceRun.findUnique({
          where: {
            sourceId_executionKey: {
              sourceId: source.id,
              executionKey,
            },
          },
        });
        if (existing) return existing;

        await assertSourceCatalogGate(tx, source, now);
        const authorization = authorizeObservation({
          program: toProgramContract(source.program),
          source: toSourceContract(source),
          now: now.toISOString(),
        });
        if (!authorization.allowed) {
          throw new ObservationAuthorizationDeniedError(authorization.reasons);
        }
        if (source.catalogEntry) {
          await claimCatalogAssetForObservation({
            tx,
            entry: source.catalogEntry,
            now,
            requireConnected: true,
          });
        }

        const claimed = await tx.enterpriseObservationProgram.updateMany({
          where: {
            id: source.programId,
            workspaceId: input.workspaceId,
            status: "ACTIVE",
            revokedAt: null,
            startsAt: { lte: now },
            expiresAt: { gt: now },
            authorizationVersion: source.program.authorizationVersion,
          },
          data: { runSequence: { increment: 1 } },
        });
        if (claimed.count !== 1) {
          throw new ObservationAuthorizationDeniedError([
            "authorization_claim_lost",
          ]);
        }

        return tx.observationSourceRun.create({
          data: {
            workspaceId: input.workspaceId,
            programId: source.programId,
            sourceId: source.id,
            executionKey,
            authorizationVersion: source.program.authorizationVersion,
            windowStart: input.windowStart,
            windowEnd: input.windowEnd,
            status: "RUNNING",
          },
        });
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const source = await db.observationSource.findUnique({
        where: {
          workspaceId_sourceKey: {
            workspaceId: input.workspaceId,
            sourceKey,
          },
        },
      });
      if (!source) throw error;
      const winner = await db.observationSourceRun.findUnique({
        where: {
          sourceId_executionKey: {
            sourceId: source.id,
            executionKey,
          },
        },
      });
      if (!winner) throw error;
      return winner;
    }
  });
}

export async function completeObservationSourceRun(input: {
  workspaceId: string;
  runId: string;
  observedAt: Date;
  summaryHash: string | null;
  completenessPercent: number | null;
  freshness: SourceObservationReceipt["freshness"];
  outcome: Exclude<SourceObservationReceipt["outcome"], "unknown">;
  evidenceRefs: string[];
  errorCodes: string[];
  actorName?: string;
}) {
  const run = await db.observationSourceRun.findFirst({
    where: { id: input.runId, workspaceId: input.workspaceId },
  });
  if (!run) throw new ObservationContractError(["observation_run_not_found"]);

  const receipt: SourceObservationReceipt = {
    receiptId: run.id,
    workspaceRef: `workspace:${input.workspaceId}`,
    sourceRef: run.sourceId,
    programRef: run.programId,
    windowStart: run.windowStart.toISOString(),
    windowEnd: run.windowEnd.toISOString(),
    observedAt: input.observedAt.toISOString(),
    summaryHash: input.summaryHash,
    completenessPercent: input.completenessPercent,
    freshness: input.freshness,
    outcome: input.outcome,
    evidenceRefs: input.evidenceRefs,
    errorCodes: input.errorCodes,
  };
  const validation = validateSourceObservationReceipt(receipt);
  if (!validation.valid) throw new ObservationContractError(validation.errors);

  const terminalStatus =
    input.outcome === "success"
      ? "SUCCEEDED"
      : input.outcome === "partial_success"
        ? "PARTIAL"
        : "FAILED";
  const updated = await db.$transaction(async (tx) => {
    const claimed = await tx.observationSourceRun.updateMany({
      where: { id: run.id, workspaceId: input.workspaceId, status: "RUNNING" },
      data: {
        status: terminalStatus,
        observedAt: input.observedAt,
        summaryHash: input.summaryHash,
        completenessPercent: input.completenessPercent,
        freshness: input.freshness.toUpperCase(),
        outcome: input.outcome.toUpperCase(),
        evidenceRefs: jsonStringify(input.evidenceRefs),
        errorCodes:
          input.errorCodes.length > 0 ? jsonStringify(input.errorCodes) : null,
      },
    });
    if (claimed.count === 0) {
      const immutable = await tx.observationSourceRun.findUnique({
        where: { id: run.id },
      });
      if (!immutable)
        throw new ObservationContractError(["observation_run_not_found"]);
      return { run: immutable, changed: false };
    }
    await tx.observationSource.updateMany({
      where: {
        id: run.sourceId,
        workspaceId: input.workspaceId,
        status: "ACTIVE",
      },
      data: { lastObservedAt: input.observedAt },
    });
    const completed = await tx.observationSourceRun.findUniqueOrThrow({
      where: { id: run.id },
    });
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        actor: input.actorName ?? "Helm Observation Runtime",
        actorType: ActorType.SYSTEM,
        actionType: "OBSERVATION_SOURCE_RECEIPT_RECORDED",
        targetType: "ObservationSourceRun",
        targetId: completed.id,
        summary: `Observation receipt recorded: ${completed.outcome}`,
        payload: {
          sourceId: completed.sourceId,
          summaryHash: completed.summaryHash,
          completenessPercent: completed.completenessPercent,
          freshness: completed.freshness,
          evidenceRefCount: input.evidenceRefs.length,
        },
      },
      { client: tx },
    );
    return { run: completed, changed: true };
  });
  return updated.run;
}
