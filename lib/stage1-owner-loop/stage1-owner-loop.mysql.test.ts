import {
  ActionStatus,
  ActorType,
  ApprovalStatus,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
  MemoryStatus,
  OpportunityStage,
  OpportunityType,
  RiskLevel,
  WorkspaceRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DecisionObject } from "@/lib/agentos-decision-supervision/types";
import type { CaioAccessPrincipal } from "@/lib/caio-access-gateway/token-store.service";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  ReceiptChangedDuringVerificationError,
  recordExecutionReceipt,
  verifyExecutionReceipt,
} from "@/lib/receipts/execution-receipt.service";
import {
  confirmStage1DecisionRecord,
  createStage1DecisionRecord,
  dispatchStage1DecisionWorkPacket,
} from "./decision-follow-through.service";
import { reconcileStage1TerminalResult } from "./terminal-result-reconciliation.service";
import {
  CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
  createCaioProPrivateExecutionResultProjection,
} from "./caio-pro-fde-cross-repo-contract";
import { ingestCaioPrivateExecutionResultProjection } from "./private-execution-result-ingress.service";
import {
  beginObservationSourceRun,
  completeObservationSourceRun,
  createEnterpriseObservationProgram,
  registerObservationSource,
  revokeEnterpriseObservationProgram,
} from "./observation.service";
import {
  createDataAssetCatalogEntry,
  recordDataAssetAuthorizationReceipt,
  recordDataAssetClassificationReceipt,
  recordDataAssetConnectionReceipt,
} from "./data-asset-catalog.service";
import type { OwnerCommandDraft } from "./types";

// 授权窗上界必须**始终在未来**：本文件的派发路径用真实时钟校验决策 validUntil
// （decision-follow-through 的 `record.validUntil <= now`）。原先写死 2026-08-01，
// 真实日期越过后固定报 decision_expired —— 用例从 2026-08-02 起必然失败并卡死下游构建。
// 用相对锚点表达"授权/决策仍然有效"这一夹具意图，用例不再随日历漂移。
// 同时用于决策对象的 expiryOrReviewAt（它才是 decision_expired 的直接判据）。
const PROGRAM_EXPIRES_AT = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

const integrationDatabaseUrl = process.env.STAGE1_OWNER_LOOP_DATABASE_URL;
const confirmedIntegrationDatabaseName =
  process.env.STAGE1_OWNER_LOOP_TEST_DATABASE_NAME;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const publicSafeSuffix = `${process.pid.toString(36)}-${Date.now().toString(36)}`;
const WORKSPACE_SLUG = `stage1-integration-${suffix}`;
const OWNER_EMAIL = `stage1-owner-${suffix}@example.test`;
const REVIEWER_EMAIL = `stage1-reviewer-${suffix}@example.test`;
const ISOLATED_DATABASE_PREFIX = "helm_caio_stage1_";

function assertIsolatedDatabaseTarget(): void {
  if (
    !integrationDatabaseUrl ||
    process.env.DATABASE_URL !== integrationDatabaseUrl
  ) {
    throw new Error(
      "DATABASE_URL must equal STAGE1_OWNER_LOOP_DATABASE_URL for the isolated integration test.",
    );
  }
  let databaseName = "";
  try {
    const parsed = new URL(integrationDatabaseUrl);
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ""));
  } catch {
    throw new Error(
      "STAGE1_OWNER_LOOP_DATABASE_URL must be a valid isolated MySQL URL.",
    );
  }
  if (
    !databaseName.startsWith(ISOLATED_DATABASE_PREFIX) ||
    databaseName !== confirmedIntegrationDatabaseName
  ) {
    throw new Error(
      "Refusing Stage 1 integration test: confirm the isolated database name with STAGE1_OWNER_LOOP_TEST_DATABASE_NAME and use the helm_caio_stage1_ prefix.",
    );
  }
}

describeMysql("Stage 1 owner loop with an isolated MySQL database", () => {
  let workspaceId = "";
  let ownerUserId = "";
  let reviewerUserId = "";
  let dispatchedDecisionRecordId = "";
  let dispatchedDecisionKey = "";
  let dispatchedActionItemId = "";
  let dispatchedApprovalTaskId = "";
  let portfolioOpportunityId = "";
  let terminalObservationSourceId = "";
  let terminalProjectionInput: Parameters<
    typeof createCaioProPrivateExecutionResultProjection
  >[0] | null = null;

  const privateExecutorPrincipal = (): CaioAccessPrincipal => ({
    tokenId: `token-${suffix}`,
    workspaceId,
    userRef: `service:workbuddy-${suffix}`,
    clientType: "workbuddy",
    deviceRef: `device:workbuddy-${suffix}`,
    audience: "mcp",
  });

  async function createAuthorizedCatalogAsset(input: {
    sourceKey: string;
    authorizationRef: string;
    validFrom: Date;
    validUntil: Date;
  }) {
    const entry = await createDataAssetCatalogEntry({
      workspaceId,
      assetKey: `asset-${input.sourceKey}`,
      sourceSystemRef: `system:${input.sourceKey}`,
      displayName: `Synthetic ${input.sourceKey}`,
      sourceKind: "crm",
      businessDomain: "sales",
      businessOwnerRef: ownerUserId,
      purpose: "Observe synthetic CRM facts for owner decisions",
      scopeRefs: ["scope:synthetic-crm"],
      recommendedAccessMode: "read_only_api",
      retentionDays: 30,
      freshnessSlaMinutes: 60,
      residencyRequirements: ["region:test"],
      blindSpots: [],
      blockerCodes: [],
      riskOwnerRef: ownerUserId,
      nextReviewAt: input.validUntil,
      evidenceRefs: [`evidence:inventory:${input.sourceKey}`],
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: input.validFrom,
    });
    await recordDataAssetClassificationReceipt({
      workspaceId,
      assetId: entry.id,
      receiptId: `classification-${input.sourceKey}`,
      idempotencyKey: `classification:${input.sourceKey}:v1`,
      expectedVersion: 1,
      dataShape: "structured",
      sensitivity: "confidential",
      processingDisposition: "local_only",
      technicalFeasibility: "feasible",
      evidenceRefs: [`evidence:classification:${input.sourceKey}`],
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: input.validFrom,
    });
    const authorizationReceiptId = `authorization-${input.sourceKey}`;
    await recordDataAssetAuthorizationReceipt({
      workspaceId,
      assetId: entry.id,
      receiptId: authorizationReceiptId,
      idempotencyKey: `authorization:${input.sourceKey}:v1`,
      expectedVersion: 2,
      authorizationStatus: "authorized",
      authorizationRef: input.authorizationRef,
      scopeRefs: ["scope:synthetic-crm"],
      consentRefs: [],
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      reasonCodes: [],
      evidenceRefs: [`evidence:authorization:${input.sourceKey}`],
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: input.validFrom,
    });
    return { entry, authorizationReceiptId };
  }

  async function createTrustedTerminalObservation(input: {
    portfolioRef: string;
    bindingRefs: string[];
    proofRefs: string[];
    outcome: "success" | "failure";
  }) {
    const observedAt = new Date(Date.now() - 2 * 60 * 1000);
    const startsAt = new Date(observedAt.getTime() - 24 * 60 * 60 * 1000);
    const expiresAt = new Date(observedAt.getTime() + 24 * 60 * 60 * 1000);
    const sourceKey = `terminal-evidence-${suffix}`;
    const program = await createEnterpriseObservationProgram({
      workspaceId,
      purpose: "Observe the governed synthetic terminal result",
      scopeRefs: [input.portfolioRef],
      dataCategories: ["synthetic-terminal-result"],
      startsAt,
      expiresAt,
      retentionDays: 30,
      authorizationRef: `authorization:terminal-result-${suffix}`,
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
    });
    const catalog = await createAuthorizedCatalogAsset({
      sourceKey,
      authorizationRef: program.authorizationRef,
      validFrom: startsAt,
      validUntil: expiresAt,
    });
    const source = await registerObservationSource({
      workspaceId,
      programId: program.id,
      catalogEntryId: catalog.entry.id,
      sourceKey,
      sourceKind: "crm",
      accessMode: "read_only_api",
      ownerRef: ownerUserId,
      freshnessSlaMinutes: 60,
      sensitivity: "confidential",
      authorizationRef: program.authorizationRef,
      secretRef: `secret-manager:${sourceKey}`,
      retentionDays: 30,
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: startsAt,
    });
    await recordDataAssetConnectionReceipt({
      workspaceId,
      assetId: catalog.entry.id,
      receiptId: `connection-${sourceKey}`,
      idempotencyKey: `connection:${sourceKey}:v1`,
      expectedVersion: 3,
      connectionStatus: "connected",
      accessMode: "read_only_api",
      connectorRef: `connector:${sourceKey}`,
      secretRef: `secret-manager:${sourceKey}`,
      authorizationReceiptRef: catalog.authorizationReceiptId,
      observationSourceRef: source.id,
      reasonCodes: [],
      evidenceRefs: [`evidence:connection:${sourceKey}`],
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: new Date(startsAt.getTime() + 1_000),
    });
    const run = await beginObservationSourceRun({
      workspaceId,
      sourceKey,
      executionKey: `terminal-window-${suffix}`,
      windowStart: new Date(observedAt.getTime() - 8 * 60 * 1000),
      windowEnd: new Date(observedAt.getTime() + 60 * 1000),
      now: new Date(observedAt.getTime() + 2 * 60 * 1000),
    });
    const completed = await completeObservationSourceRun({
      workspaceId,
      runId: run.id,
      observedAt,
      summaryHash: `sha256:${"a".repeat(64)}`,
      completenessPercent: 100,
      freshness: "fresh",
      outcome: input.outcome,
      evidenceRefs: [
        input.portfolioRef,
        ...input.bindingRefs,
        ...input.proofRefs,
      ],
      errorCodes: [],
    });
    return { program, source, run: completed, observedAt };
  }

  beforeAll(async () => {
    assertIsolatedDatabaseTarget();
    const workspace = await db.workspace.create({
      data: {
        name: `Stage 1 integration ${suffix}`,
        slug: WORKSPACE_SLUG,
      },
    });
    const [owner, reviewer] = await Promise.all([
      db.user.create({
        data: {
          name: "Stage 1 Owner",
          email: OWNER_EMAIL,
        },
      }),
      db.user.create({
        data: {
          name: "Stage 1 Reviewer",
          email: REVIEWER_EMAIL,
        },
      }),
    ]);
    await db.membership.createMany({
      data: [
        { workspaceId: workspace.id, userId: owner.id, role: WorkspaceRole.OWNER },
        {
          workspaceId: workspace.id,
          userId: reviewer.id,
          role: WorkspaceRole.REVIEWER,
        },
      ],
    });
    workspaceId = workspace.id;
    ownerUserId = owner.id;
    reviewerUserId = reviewer.id;
    const opportunity = await db.opportunity.create({
      data: {
        workspaceId,
        ownerId: ownerUserId,
        title: `Stage 1 synthetic Portfolio ${suffix}`,
        type: OpportunityType.INTERNAL,
        stage: OpportunityStage.ADVANCING,
        riskLevel: RiskLevel.HIGH,
        nextAction: "Complete the governed synthetic work packet",
      },
    });
    portfolioOpportunityId = opportunity.id;
  });

  afterAll(async () => {
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
    const cleanupReviewerUserId =
      reviewerUserId ||
      (
        await db.user.findUnique({
          where: { email: REVIEWER_EMAIL },
          select: { id: true },
        })
      )?.id ||
      "";
    if (cleanupWorkspaceId) {
      await runWithWriteConflictRetry(
        () =>
          db.$transaction(async (tx) => {
            await tx.memoryFact.deleteMany({
              where: { workspaceId: cleanupWorkspaceId },
            });
            await tx.executionReceipt.deleteMany({
              where: { workspaceId: cleanupWorkspaceId },
            });
            await tx.decisionWorkPacketClaim.deleteMany({
              where: { workspaceId: cleanupWorkspaceId },
            });
            await tx.approvalTask.deleteMany({
              where: { workspaceId: cleanupWorkspaceId },
            });
            await tx.actionItem.deleteMany({
              where: { workspaceId: cleanupWorkspaceId },
            });
            await tx.opportunity.deleteMany({
              where: { workspaceId: cleanupWorkspaceId },
            });
            await tx.supervisionSignalRecord.deleteMany({
              where: { workspaceId: cleanupWorkspaceId },
            });
            await tx.decisionRecord.deleteMany({
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
            await tx.notification.deleteMany({
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
    for (const userId of [cleanupOwnerUserId, cleanupReviewerUserId]) {
      if (userId) {
        await db.$executeRaw`DELETE FROM User WHERE id = ${userId}`;
      }
    }
  });

  it("creates one observation run for concurrent identical execution keys", async () => {
    const program = await createEnterpriseObservationProgram({
      workspaceId,
      purpose: "Observe synthetic CRM facts for an owner decision",
      scopeRefs: ["scope:synthetic-crm"],
      dataCategories: ["synthetic-opportunity"],
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: PROGRAM_EXPIRES_AT,
      retentionDays: 30,
      authorizationRef: `authorization:${suffix}`,
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
    });
    const sourceKey = `synthetic-crm-${suffix}`;
    const catalog = await createAuthorizedCatalogAsset({
      sourceKey,
      authorizationRef: program.authorizationRef,
      validFrom: program.startsAt,
      validUntil: program.expiresAt,
    });
    const source = await registerObservationSource({
      workspaceId,
      programId: program.id,
      catalogEntryId: catalog.entry.id,
      sourceKey,
      sourceKind: "crm",
      accessMode: "read_only_api",
      ownerRef: ownerUserId,
      freshnessSlaMinutes: 60,
      sensitivity: "confidential",
      authorizationRef: program.authorizationRef,
      secretRef: `secret-manager:synthetic-crm-${suffix}`,
      retentionDays: 30,
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: new Date("2026-07-18T00:00:00.000Z"),
    });
    await recordDataAssetConnectionReceipt({
      workspaceId,
      assetId: catalog.entry.id,
      receiptId: `connection-${sourceKey}`,
      idempotencyKey: `connection:${sourceKey}:v1`,
      expectedVersion: 3,
      connectionStatus: "connected",
      accessMode: "read_only_api",
      connectorRef: `connector:${sourceKey}`,
      secretRef: `secret-manager:synthetic-crm-${suffix}`,
      authorizationReceiptRef: catalog.authorizationReceiptId,
      observationSourceRef: source.id,
      reasonCodes: [],
      evidenceRefs: [`evidence:connection:${sourceKey}`],
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: new Date("2026-07-18T00:00:00.000Z"),
    });

    const input = {
      workspaceId,
      sourceKey: `  synthetic-crm-${suffix}  `,
      executionKey: "  same-window  ",
      windowStart: new Date("2026-07-18T00:00:00.000Z"),
      windowEnd: new Date("2026-07-18T01:00:00.000Z"),
      now: new Date("2026-07-18T01:01:00.000Z"),
    };
    const [first, second] = await Promise.all([
      beginObservationSourceRun(input),
      beginObservationSourceRun(input),
    ]);
    const completed = await completeObservationSourceRun({
      workspaceId,
      runId: first.id,
      observedAt: new Date("2026-07-18T01:02:00.000Z"),
      summaryHash: "sha256:synthetic-crm-window",
      completenessPercent: 100,
      freshness: "fresh",
      outcome: "success",
      evidenceRefs: ["evidence:synthetic-crm-window"],
      errorCodes: [],
    });

    expect(first.id).toBe(second.id);
    expect(completed.status).toBe("SUCCEEDED");
    expect(
      await db.observationSourceRun.count({
        where: { workspaceId, executionKey: "same-window" },
      }),
    ).toBe(1);
    expect(
      await db.enterpriseObservationProgram.findUnique({
        where: { id: program.id },
        select: { runSequence: true },
      }),
    ).toEqual({ runSequence: 1 });
  });

  it("stops a catalog-bound source and running observation when its connection fails", async () => {
    const program = await createEnterpriseObservationProgram({
      workspaceId,
      purpose: "Observe a synthetic source until its connection fails",
      scopeRefs: ["scope:synthetic-connection-failure"],
      dataCategories: ["synthetic-record"],
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: PROGRAM_EXPIRES_AT,
      retentionDays: 30,
      authorizationRef: `authorization:connection-failure-${suffix}`,
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
    });
    const sourceKey = `synthetic-connection-failure-${suffix}`;
    const catalog = await createAuthorizedCatalogAsset({
      sourceKey,
      authorizationRef: program.authorizationRef,
      validFrom: program.startsAt,
      validUntil: program.expiresAt,
    });
    const source = await registerObservationSource({
      workspaceId,
      programId: program.id,
      catalogEntryId: catalog.entry.id,
      sourceKey,
      sourceKind: "crm",
      accessMode: "read_only_api",
      ownerRef: ownerUserId,
      freshnessSlaMinutes: 60,
      sensitivity: "confidential",
      authorizationRef: program.authorizationRef,
      secretRef: `secret-manager:${sourceKey}`,
      retentionDays: 30,
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: new Date("2026-07-18T00:00:00.000Z"),
    });
    await recordDataAssetConnectionReceipt({
      workspaceId,
      assetId: catalog.entry.id,
      receiptId: `connection-${sourceKey}`,
      idempotencyKey: `connection:${sourceKey}:v1`,
      expectedVersion: 3,
      connectionStatus: "connected",
      accessMode: "read_only_api",
      connectorRef: `connector:${sourceKey}`,
      secretRef: `secret-manager:${sourceKey}`,
      authorizationReceiptRef: catalog.authorizationReceiptId,
      observationSourceRef: source.id,
      reasonCodes: [],
      evidenceRefs: [`evidence:connection:${sourceKey}`],
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: new Date("2026-07-18T00:00:00.000Z"),
    });
    const run = await beginObservationSourceRun({
      workspaceId,
      sourceKey,
      executionKey: "connection-failure-window",
      windowStart: new Date("2026-07-18T00:00:00.000Z"),
      windowEnd: new Date("2026-07-18T01:00:00.000Z"),
      now: new Date("2026-07-18T01:01:00.000Z"),
    });

    await recordDataAssetConnectionReceipt({
      workspaceId,
      assetId: catalog.entry.id,
      receiptId: `connection-failed-${sourceKey}`,
      idempotencyKey: `connection:${sourceKey}:failed:v1`,
      expectedVersion: 4,
      connectionStatus: "failed",
      accessMode: "read_only_api",
      connectorRef: `connector:${sourceKey}`,
      secretRef: `secret-manager:${sourceKey}`,
      authorizationReceiptRef: catalog.authorizationReceiptId,
      observationSourceRef: source.id,
      reasonCodes: ["synthetic_connection_failure"],
      evidenceRefs: [`evidence:connection-failed:${sourceKey}`],
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: new Date("2026-07-18T01:02:00.000Z"),
    });

    expect(
      await db.observationSource.findUnique({
        where: { id: source.id },
        select: { status: true },
      }),
    ).toEqual({ status: "ERROR" });
    const stoppedRun = await db.observationSourceRun.findUnique({
      where: { id: run.id },
      select: {
        status: true,
        outcome: true,
        errorCodes: true,
      },
    });
    expect(stoppedRun).toMatchObject({
      status: "CANCELLED",
      outcome: "FAILURE",
    });
    expect(JSON.parse(stoppedRun?.errorCodes ?? "[]")).toEqual([
      "asset_connection_failed",
    ]);
  });

  it("serializes a new observation run against a concurrent connection failure", async () => {
    const program = await createEnterpriseObservationProgram({
      workspaceId,
      purpose: "Serialize observation start against connection failure",
      scopeRefs: ["scope:synthetic-connection-race"],
      dataCategories: ["synthetic-record"],
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: PROGRAM_EXPIRES_AT,
      retentionDays: 30,
      authorizationRef: `authorization:connection-race-${suffix}`,
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
    });
    const sourceKey = `synthetic-connection-race-${suffix}`;
    const catalog = await createAuthorizedCatalogAsset({
      sourceKey,
      authorizationRef: program.authorizationRef,
      validFrom: program.startsAt,
      validUntil: program.expiresAt,
    });
    const source = await registerObservationSource({
      workspaceId,
      programId: program.id,
      catalogEntryId: catalog.entry.id,
      sourceKey,
      sourceKind: "crm",
      accessMode: "read_only_api",
      ownerRef: ownerUserId,
      freshnessSlaMinutes: 60,
      sensitivity: "confidential",
      authorizationRef: program.authorizationRef,
      secretRef: `secret-manager:${sourceKey}`,
      retentionDays: 30,
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: new Date("2026-07-18T00:00:00.000Z"),
    });
    await recordDataAssetConnectionReceipt({
      workspaceId,
      assetId: catalog.entry.id,
      receiptId: `connection-${sourceKey}`,
      idempotencyKey: `connection:${sourceKey}:v1`,
      expectedVersion: 3,
      connectionStatus: "connected",
      accessMode: "read_only_api",
      connectorRef: `connector:${sourceKey}`,
      secretRef: `secret-manager:${sourceKey}`,
      authorizationReceiptRef: catalog.authorizationReceiptId,
      observationSourceRef: source.id,
      reasonCodes: [],
      evidenceRefs: [`evidence:connection:${sourceKey}`],
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: new Date("2026-07-18T00:00:00.000Z"),
    });

    const [beginResult, failureResult] = await Promise.allSettled([
      beginObservationSourceRun({
        workspaceId,
        sourceKey,
        executionKey: "connection-race-window",
        windowStart: new Date("2026-07-18T00:00:00.000Z"),
        windowEnd: new Date("2026-07-18T01:00:00.000Z"),
        now: new Date("2026-07-18T01:01:00.000Z"),
      }),
      recordDataAssetConnectionReceipt({
        workspaceId,
        assetId: catalog.entry.id,
        receiptId: `connection-failed-race-${sourceKey}`,
        idempotencyKey: `connection:${sourceKey}:failed-race:v1`,
        expectedVersion: 4,
        connectionStatus: "failed",
        accessMode: "read_only_api",
        connectorRef: `connector:${sourceKey}`,
        secretRef: `secret-manager:${sourceKey}`,
        authorizationReceiptRef: catalog.authorizationReceiptId,
        observationSourceRef: source.id,
        reasonCodes: ["synthetic_connection_race_failure"],
        evidenceRefs: [`evidence:connection-failed-race:${sourceKey}`],
        actorName: "Stage 1 Owner",
        actorUserId: ownerUserId,
        now: new Date("2026-07-18T01:01:00.000Z"),
      }),
    ]);

    expect(failureResult.status).toBe("fulfilled");
    if (beginResult.status === "rejected") {
      expect(beginResult.reason).toBeInstanceOf(Error);
    }
    expect(
      await db.observationSource.findUnique({
        where: { id: source.id },
        select: { status: true },
      }),
    ).toEqual({ status: "ERROR" });
    expect(
      await db.observationSourceRun.count({
        where: {
          workspaceId,
          sourceId: source.id,
          status: { in: ["RUNNING", "SUCCEEDED", "PARTIAL"] },
        },
      }),
    ).toBe(0);
    await expect(
      beginObservationSourceRun({
        workspaceId,
        sourceKey,
        executionKey: "connection-race-after-failure",
        windowStart: new Date("2026-07-18T01:00:00.000Z"),
        windowEnd: new Date("2026-07-18T01:02:00.000Z"),
        now: new Date("2026-07-18T01:03:00.000Z"),
      }),
    ).rejects.toMatchObject({
      reasons: ["catalog_asset_not_connected"],
    });
  });

  it("serializes a new observation run against concurrent authorization revocation", async () => {
    const program = await createEnterpriseObservationProgram({
      workspaceId,
      purpose: "Serialize observation start against authorization revocation",
      scopeRefs: ["scope:synthetic-authorization-race"],
      dataCategories: ["synthetic-record"],
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: PROGRAM_EXPIRES_AT,
      retentionDays: 30,
      authorizationRef: `authorization:authorization-race-${suffix}`,
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
    });
    const sourceKey = `synthetic-authorization-race-${suffix}`;
    const catalog = await createAuthorizedCatalogAsset({
      sourceKey,
      authorizationRef: program.authorizationRef,
      validFrom: program.startsAt,
      validUntil: program.expiresAt,
    });
    const source = await registerObservationSource({
      workspaceId,
      programId: program.id,
      catalogEntryId: catalog.entry.id,
      sourceKey,
      sourceKind: "crm",
      accessMode: "read_only_api",
      ownerRef: ownerUserId,
      freshnessSlaMinutes: 60,
      sensitivity: "confidential",
      authorizationRef: program.authorizationRef,
      secretRef: `secret-manager:${sourceKey}`,
      retentionDays: 30,
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: new Date("2026-07-18T00:00:00.000Z"),
    });
    await recordDataAssetConnectionReceipt({
      workspaceId,
      assetId: catalog.entry.id,
      receiptId: `connection-${sourceKey}`,
      idempotencyKey: `connection:${sourceKey}:v1`,
      expectedVersion: 3,
      connectionStatus: "connected",
      accessMode: "read_only_api",
      connectorRef: `connector:${sourceKey}`,
      secretRef: `secret-manager:${sourceKey}`,
      authorizationReceiptRef: catalog.authorizationReceiptId,
      observationSourceRef: source.id,
      reasonCodes: [],
      evidenceRefs: [`evidence:connection:${sourceKey}`],
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
      now: new Date("2026-07-18T00:00:00.000Z"),
    });

    const [beginResult, revocationResult] = await Promise.allSettled([
      beginObservationSourceRun({
        workspaceId,
        sourceKey,
        executionKey: "authorization-race-window",
        windowStart: new Date("2026-07-18T00:00:00.000Z"),
        windowEnd: new Date("2026-07-18T01:00:00.000Z"),
        now: new Date("2026-07-18T01:01:00.000Z"),
      }),
      recordDataAssetAuthorizationReceipt({
        workspaceId,
        assetId: catalog.entry.id,
        receiptId: `authorization-revoked-race-${sourceKey}`,
        idempotencyKey: `authorization:${sourceKey}:revoked-race:v1`,
        expectedVersion: 4,
        authorizationStatus: "revoked",
        authorizationRef: null,
        scopeRefs: [],
        consentRefs: [],
        validFrom: null,
        validUntil: null,
        reasonCodes: ["synthetic_authorization_race_revocation"],
        evidenceRefs: [`evidence:authorization-revoked-race:${sourceKey}`],
        actorName: "Stage 1 Owner",
        actorUserId: ownerUserId,
        now: new Date("2026-07-18T01:01:00.000Z"),
      }),
    ]);

    expect(revocationResult.status).toBe("fulfilled");
    if (beginResult.status === "rejected") {
      expect(beginResult.reason).toBeInstanceOf(Error);
    }
    expect(
      await db.observationSource.findUnique({
        where: { id: source.id },
        select: { status: true },
      }),
    ).toEqual({ status: "REVOKED" });
    expect(
      await db.observationSourceRun.count({
        where: {
          workspaceId,
          sourceId: source.id,
          status: { in: ["RUNNING", "SUCCEEDED", "PARTIAL"] },
        },
      }),
    ).toBe(0);
    await expect(
      beginObservationSourceRun({
        workspaceId,
        sourceKey,
        executionKey: "authorization-race-after-revocation",
        windowStart: new Date("2026-07-18T01:00:00.000Z"),
        windowEnd: new Date("2026-07-18T01:02:00.000Z"),
        now: new Date("2026-07-18T01:03:00.000Z"),
      }),
    ).rejects.toMatchObject({
      reasons: ["catalog_asset_not_authorized"],
    });
  });

  it("never leaves an ACTIVE source when registration races revocation", async () => {
    const program = await createEnterpriseObservationProgram({
      workspaceId,
      purpose: "Observe a synthetic source until the owner revokes access",
      scopeRefs: ["scope:synthetic-revocation"],
      dataCategories: ["synthetic-record"],
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: PROGRAM_EXPIRES_AT,
      retentionDays: 30,
      authorizationRef: `authorization:revoke-${suffix}`,
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
    });
    const sourceKey = `synthetic-revoke-${suffix}`;
    const catalog = await createAuthorizedCatalogAsset({
      sourceKey,
      authorizationRef: program.authorizationRef,
      validFrom: program.startsAt,
      validUntil: program.expiresAt,
    });

    const [, revocation] = await Promise.allSettled([
      registerObservationSource({
        workspaceId,
        programId: program.id,
        catalogEntryId: catalog.entry.id,
        sourceKey,
        sourceKind: "crm",
        accessMode: "read_only_api",
        ownerRef: ownerUserId,
        freshnessSlaMinutes: 60,
        sensitivity: "confidential",
        authorizationRef: program.authorizationRef,
        secretRef: `secret-manager:${sourceKey}`,
        retentionDays: 30,
        actorName: "Stage 1 Owner",
        actorUserId: ownerUserId,
        now: new Date("2026-07-18T00:00:00.000Z"),
      }),
      revokeEnterpriseObservationProgram({
        workspaceId,
        programId: program.id,
        reason: "Synthetic owner revocation",
        actorName: "Stage 1 Owner",
        actorUserId: ownerUserId,
      }),
    ]);

    expect(revocation.status).toBe("fulfilled");
    expect(
      await db.enterpriseObservationProgram.findUnique({
        where: { id: program.id },
        select: { status: true },
      }),
    ).toEqual({ status: "REVOKED" });
    expect(
      await db.observationSource.count({
        where: { workspaceId, programId: program.id, status: "ACTIVE" },
      }),
    ).toBe(0);
  });

  it("creates one governed work packet for concurrent owner dispatch", async () => {
    const decision: DecisionObject = {
      decisionId: `decision-${suffix}`,
      tenantRef: `workspace:${workspaceId}`,
      decisionType: "prioritization",
      businessQuestion: "Which synthetic delivery risk should be handled first?",
      problemCategoryRef: "synthetic-delivery-risk",
      contextRefs: [
        "context:synthetic-weekly-ops",
        `opportunity:${portfolioOpportunityId}`,
      ],
      knowledgeRefs: ["knowledge:synthetic-delivery-policy"],
      evidenceRefs: ["evidence:synthetic-delay"],
      policyRefs: ["policy:review-first"],
      receiptRefs: [],
      alternatives: ["Escalate now", "Observe one more day"],
      recommendedOption: "Escalate now",
      confidence: "medium",
      riskLevel: "high",
      allowedActionLevel: "draft_task",
      ownerGate: "approval_required",
      expiryOrReviewAt: PROGRAM_EXPIRES_AT.toISOString(),
      rollbackPath: "Withdraw the work packet before execution",
    };
    const record = await createStage1DecisionRecord({
      workspaceId,
      decision,
      facts: [
        {
          statement: "The synthetic delivery is late",
          evidenceRefs: ["evidence:synthetic-delay"],
          freshness: "fresh",
        },
      ],
      inferences: [],
      unknowns: [],
      risks: ["The delivery may miss its synthetic SLA"],
      actorName: "Helm Decision Runtime",
      actorType: ActorType.AI,
    });
    await confirmStage1DecisionRecord({
      workspaceId,
      decisionRecordId: record.id,
      conclusion: "Escalate now",
      actorName: "Stage 1 Owner",
      actorUserId: ownerUserId,
    });
    const command: OwnerCommandDraft = {
      commandId: `command-${suffix}`,
      workspaceRef: `workspace:${workspaceId}`,
      decisionRef: record.id,
      ownerRef: ownerUserId,
      executionTargetRef: "team:synthetic-delivery",
      portfolioRef: `opportunity:${portfolioOpportunityId}`,
      goal: "Resolve the synthetic delivery risk",
      action: "Prepare a recovery plan after approval",
      dueAt: "2026-07-20T00:00:00.000Z",
      acceptanceCriteria: ["Recovery plan is independently verified"],
      evidenceRequirements: ["evidence:synthetic-recovery"],
      invalidationConditions: ["Synthetic customer priority changes"],
      escalationOwnerRef: ownerUserId,
      automationLevel: "assist",
      allowedToolRefs: ["tool:task-draft"],
      externalSideEffects: [],
      policyEnvelopeRef: null,
      status: "owner_confirmed",
    };
    const dispatch = () =>
      dispatchStage1DecisionWorkPacket({
        workspaceId,
        decisionRecordId: record.id,
        command,
        actorName: "Stage 1 Owner",
        actorUserId: ownerUserId,
      });
    const [first, second] = await Promise.all([dispatch(), dispatch()]);
    dispatchedDecisionRecordId = record.id;
    dispatchedDecisionKey = record.decisionKey;
    dispatchedActionItemId = first.actionItemId;
    dispatchedApprovalTaskId = first.approvalTaskId ?? "";

    expect(first.actionItemId).toBe(second.actionItemId);
    expect(dispatchedApprovalTaskId).not.toBe("");
    expect(
      await db.actionItem.findUnique({
        where: { id: first.actionItemId },
        select: { opportunityId: true },
      }),
    ).toEqual({ opportunityId: portfolioOpportunityId });
    expect(
      await db.actionItem.count({
        where: { workspaceId, sourceId: `decision-record:${record.id}` },
      }),
    ).toBe(1);
    expect(
      await db.approvalTask.count({
        where: { workspaceId, actionItemId: first.actionItemId },
      }),
    ).toBe(1);
    expect(
      await db.decisionWorkPacketClaim.count({
        where: { workspaceId, decisionRecordId: record.id },
      }),
    ).toBe(1);
  });

  it("accepts a scoped private projection once and converges concurrent replay", async () => {
    expect(dispatchedDecisionRecordId).not.toBe("");
    expect(dispatchedActionItemId).not.toBe("");
    expect(dispatchedApprovalTaskId).not.toBe("");
    await db.$transaction([
      db.approvalTask.update({
        where: { actionItemId: dispatchedActionItemId },
        data: {
          status: ApprovalStatus.EXECUTED,
          reviewedById: reviewerUserId,
          reviewedAt: new Date("2026-07-18T01:55:00.000Z"),
        },
      }),
      db.actionItem.update({
        where: { id: dispatchedActionItemId },
        data: {
          status: ActionStatus.APPROVED,
          executionStatus: "approved_for_private_execution",
          executedAt: null,
        },
      }),
    ]);
    const portfolioRef = `opportunity:${portfolioOpportunityId}`;
    const decisionRecordRef = `decision-record:${dispatchedDecisionRecordId}`;
    const actionItemRef = `action-item:${dispatchedActionItemId}`;
    const approvalTaskRef = `approval-task:${dispatchedApprovalTaskId}`;
    const proofRef = `proof:terminal-result-${publicSafeSuffix}`;
    const observation = await createTrustedTerminalObservation({
      portfolioRef,
      bindingRefs: [decisionRecordRef, actionItemRef, approvalTaskRef],
      proofRefs: [proofRef],
      outcome: "success",
    });
    terminalObservationSourceId = observation.source.id;
    terminalProjectionInput = {
      interfaceVersion: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
      contractRef: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
      contractHash: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
      evaluatorRevision:
        CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorRevision,
      evaluatorContractRef:
        CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractRef,
      evaluatorContractHash:
        CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractHash,
      projectionRef: `private-result:terminal-${publicSafeSuffix}`,
      workspaceRef: `workspace:${workspaceId}`,
      portfolioRef,
      evidenceSnapshotRef: `observation-run:${observation.run.id}`,
      decisionRecordRef,
      actionItemRef,
      approvalTaskRef,
      executionProofRefs: [proofRef],
      receiptOutcome: "SUCCESS",
      actionTaken: "Recorded the governed synthetic private executor result.",
      outcome: {
        outcomeRef: `observation-run:${observation.run.id}`,
        result: "success",
        followedAiRecommendation: true,
      },
      recordedAt: new Date(
        observation.observedAt.getTime() + 30_000,
      ).toISOString(),
    };
    const projection = createCaioProPrivateExecutionResultProjection(
      terminalProjectionInput,
    );

    await db.observationSource.update({
      where: { id: terminalObservationSourceId },
      data: { status: "REVOKED" },
    });
    await expect(
      ingestCaioPrivateExecutionResultProjection({
        principal: privateExecutorPrincipal(),
        projection,
        now: new Date(),
      }),
    ).rejects.toMatchObject({
      reasons: ["observation_evidence_source_inactive"],
    });
    expect(
      await db.actionItem.findUnique({
        where: { id: dispatchedActionItemId },
        select: { status: true, executionReceipt: { select: { id: true } } },
      }),
    ).toEqual({ status: ActionStatus.APPROVED, executionReceipt: null });
    await db.observationSource.update({
      where: { id: terminalObservationSourceId },
      data: { status: "ACTIVE" },
    });

    const ingress = () =>
      ingestCaioPrivateExecutionResultProjection({
        principal: privateExecutorPrincipal(),
        projection,
        now: new Date(),
      });
    const ingressResults = await Promise.all([ingress(), ingress()]);
    expect(ingressResults.map((result) => result.kind).sort()).toEqual([
      "recorded",
      "replayed",
    ]);
    expect(
      await db.executionReceipt.count({
        where: {
          workspaceId,
          actionItemId: dispatchedActionItemId,
        },
      }),
    ).toBe(1);
    expect(
      await db.executionReceipt.findUniqueOrThrow({
        where: {
          subjectType_subjectId: {
            subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
            subjectId: dispatchedActionItemId,
          },
        },
        select: { verificationState: true, outcome: true },
      }),
    ).toEqual({
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
      outcome: ExecutionReceiptOutcome.SUCCESS,
    });

    const conflictingProjection =
      createCaioProPrivateExecutionResultProjection({
        ...terminalProjectionInput,
        actionTaken:
          "Changed action text must not overwrite the canonical receipt.",
      });
    await expect(
      ingestCaioPrivateExecutionResultProjection({
        principal: privateExecutorPrincipal(),
        projection: conflictingProjection,
        now: new Date(),
      }),
    ).rejects.toMatchObject({ reasons: ["projection_replay_conflict"] });
  });

  it("rolls back receipt verification and evaluation when supervision conflicts, then converges", async () => {
    expect(terminalProjectionInput).not.toBeNull();
    const projectionInput = terminalProjectionInput!;
    await db.supervisionSignalRecord.create({
      data: {
        workspaceId,
        decisionRecordId: dispatchedDecisionRecordId,
        signalKey: `stage1-terminal-result:${dispatchedDecisionRecordId}`,
        signalType: "anomaly",
        observedObjectRef: `action-item:${dispatchedActionItemId}`,
        baselineRef: `decision-record:${dispatchedDecisionRecordId}`,
        evidenceRefs: JSON.stringify(["conflict:injected-supervision"]),
        severity: "warning",
        confidence: "high",
        recommendedRoute: "owner_review",
        ownerRef: ownerUserId,
        deadlineOrSla: null,
        status: "open",
        observedFact: "Injected conflicting supervision payload.",
        interpretation: null,
        expectedState: null,
        actualState: "injected_conflict",
        responsibilityScopeRef: projectionInput.portfolioRef,
        escalationCondition: "Remove the injected test conflict before retry.",
      },
    });

    const reconcile = () =>
      reconcileStage1TerminalResult({
        workspaceId,
        actionItemId: dispatchedActionItemId,
        outcome: {
          outcomeRef: projectionInput.evidenceSnapshotRef,
          result: "success",
          followedAiRecommendation: true,
        },
        actorName: "Stage 1 Owner",
        actorUserId: ownerUserId,
        actorType: ActorType.USER,
      });
    await expect(reconcile()).rejects.toMatchObject({
      reasons: ["supervision_idempotency_conflict"],
    });
    expect(
      await db.executionReceipt.findUniqueOrThrow({
        where: {
          subjectType_subjectId: {
            subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
            subjectId: dispatchedActionItemId,
          },
        },
        select: {
          verificationState: true,
          verifiedByUserId: true,
        },
      }),
    ).toEqual({
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
      verifiedByUserId: null,
    });
    expect(
      await db.decisionRecord.findUniqueOrThrow({
        where: { id: dispatchedDecisionRecordId },
        select: { status: true, evaluationJson: true, evaluatedAt: true },
      }),
    ).toEqual({ status: "DISPATCHED", evaluationJson: null, evaluatedAt: null });
    expect(
      await db.memoryFact.count({
        where: {
          workspaceId,
          objectId: dispatchedActionItemId,
          sourceId: `evaluation:${dispatchedDecisionKey}`,
        },
      }),
    ).toBe(0);
    await db.supervisionSignalRecord.delete({
      where: {
        workspaceId_signalKey: {
          workspaceId,
          signalKey: `stage1-terminal-result:${dispatchedDecisionRecordId}`,
        },
      },
    });

    const results = await Promise.all([reconcile(), reconcile()]);

    expect(results.map((result) => result.kind)).toEqual([
      "reconciled",
      "reconciled",
    ]);
    const reconciled = results.filter(
      (result): result is Extract<typeof result, { kind: "reconciled" }> =>
        result.kind === "reconciled",
    );
    expect(
      reconciled.map((result) => result.evaluation.created).sort(),
    ).toEqual([false, true]);
    expect(reconciled[0]?.evaluation.evaluation).toEqual(
      reconciled[1]?.evaluation.evaluation,
    );
    expect(reconciled[0]?.evaluation.evaluation.automationImpact).toBe(
      "promote_candidate",
    );
    expect(
      await db.memoryFact.count({
        where: {
          workspaceId,
          objectId: dispatchedActionItemId,
          sourceId: `evaluation:${dispatchedDecisionKey}`,
          status: MemoryStatus.OBSERVED,
          confirmedByUser: false,
        },
      }),
    ).toBe(1);
    expect(
      await db.supervisionSignalRecord.findMany({
        where: {
          workspaceId,
          decisionRecordId: dispatchedDecisionRecordId,
          signalKey: `stage1-terminal-result:${dispatchedDecisionRecordId}`,
        },
        select: {
          status: true,
          severity: true,
          recommendedRoute: true,
        },
      }),
    ).toEqual([
      {
        status: "resolved",
        severity: "info",
        recommendedRoute: "watch",
      },
    ]);
    expect(
      await db.decisionRecord.findUnique({
        where: { id: dispatchedDecisionRecordId },
        select: { status: true, evaluationJson: true, evaluatedAt: true },
      }),
    ).toMatchObject({
      status: "EVALUATED",
      evaluationJson: expect.any(String),
      evaluatedAt: expect.any(Date),
    });

    await expect(reconcile()).resolves.toMatchObject({
      kind: "reconciled",
      evaluation: { created: false },
    });
    await expect(
      reconcileStage1TerminalResult({
        workspaceId: `outside-${workspaceId}`,
        actionItemId: dispatchedActionItemId,
        outcome: {
          outcomeRef: projectionInput.evidenceSnapshotRef,
          result: "success",
          followedAiRecommendation: true,
        },
        actorName: "Outside workspace owner",
        actorUserId: ownerUserId,
        actorType: ActorType.USER,
      }),
    ).rejects.toMatchObject({
      reasons: ["workspace_insight_permission_required"],
    });
    await expect(
      reconcileStage1TerminalResult({
        workspaceId,
        actionItemId: dispatchedActionItemId,
        outcome: {
          outcomeRef: projectionInput.evidenceSnapshotRef,
          result: "failure",
          followedAiRecommendation: true,
        },
        actorName: "Stage 1 Owner",
        actorUserId: ownerUserId,
        actorType: ActorType.USER,
      }),
    ).rejects.toMatchObject({ reasons: ["business_outcome_receipt_mismatch"] });
    await expect(
      reconcileStage1TerminalResult({
        workspaceId,
        actionItemId: dispatchedActionItemId,
        outcome: {
          outcomeRef: projectionInput.evidenceSnapshotRef,
          result: "success",
          followedAiRecommendation: false,
        },
        actorName: "Stage 1 Owner",
        actorUserId: ownerUserId,
        actorType: ActorType.USER,
      }),
    ).rejects.toMatchObject({ reasons: ["decision_evaluation_conflict"] });
    expect(
      await db.memoryFact.count({
        where: {
          workspaceId,
          objectId: dispatchedActionItemId,
          sourceId: `evaluation:${dispatchedDecisionKey}`,
        },
      }),
    ).toBe(1);
    expect(
      await db.supervisionSignalRecord.count({
        where: {
          workspaceId,
          decisionRecordId: dispatchedDecisionRecordId,
          signalKey: `stage1-terminal-result:${dispatchedDecisionRecordId}`,
        },
      }),
    ).toBe(1);
  });

  it("never downgrades a verified receipt during concurrent record and verify", async () => {
    const subjectId = `receipt-race-${suffix}`;
    const record = (outcome: ExecutionReceiptOutcome) =>
      recordExecutionReceipt({
        workspaceId,
        subjectType: ExecutionReceiptSubjectType.HUMAN_ACTION_EXECUTION,
        subjectId,
        outcome,
        actionTaken: "SYNTHETIC_WORK",
        evidenceRefs: [`evidence:${outcome.toLowerCase()}`],
        executedByUserId: ownerUserId,
        executedByActorType: ActorType.USER,
        actorName: "Stage 1 Owner",
      });
    await record(ExecutionReceiptOutcome.SUCCESS);

    const results = await Promise.allSettled([
      verifyExecutionReceipt({
        workspaceId,
        subjectType: ExecutionReceiptSubjectType.HUMAN_ACTION_EXECUTION,
        subjectId,
        verifierUserId: reviewerUserId,
        verifierName: "Stage 1 Reviewer",
      }),
      record(ExecutionReceiptOutcome.FAILURE),
    ]);
    const verification = results[0];
    expect(results[1].status).toBe("fulfilled");
    if (verification.status === "rejected") {
      expect(verification.reason).toBeInstanceOf(
        ReceiptChangedDuringVerificationError,
      );
      await verifyExecutionReceipt({
        workspaceId,
        subjectType: ExecutionReceiptSubjectType.HUMAN_ACTION_EXECUTION,
        subjectId,
        verifierUserId: reviewerUserId,
        verifierName: "Stage 1 Reviewer",
      });
    } else {
      // Service contract: a FULFILLED verification must have returned a
      // VERIFIED receipt. If the database row later reads SELF_REPORTED
      // while this held, that is a lost persist or a downgrade — the
      // exact defect this test exists to catch — so pin the contract
      // here for a sharp failure signal.
      expect(verification.value.verificationState).toBe(
        ExecutionReceiptVerificationState.VERIFIED,
      );
    }
    await record(ExecutionReceiptOutcome.REJECTED);

    const finalReceipt = await db.executionReceipt.findUniqueOrThrow({
      where: {
        subjectType_subjectId: {
          subjectType: ExecutionReceiptSubjectType.HUMAN_ACTION_EXECUTION,
          subjectId,
        },
      },
    });
    expect(finalReceipt.verificationState).toBe(
      ExecutionReceiptVerificationState.VERIFIED,
    );
    expect(finalReceipt.verifiedByUserId).toBe(reviewerUserId);
  });
});
