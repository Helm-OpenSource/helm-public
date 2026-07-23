import {
  ActionStatus,
  ActorType,
  ApprovalStatus,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
  MemoryStatus,
  WorkspaceRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DecisionObject } from "@/lib/agentos-decision-supervision/types";
import { db } from "@/lib/db";
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
import { evaluateStage1DecisionRecord } from "./decision-evaluation.service";
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

const integrationDatabaseUrl = process.env.STAGE1_OWNER_LOOP_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;

describeMysql("Stage 1 owner loop with an isolated MySQL database", () => {
  let workspaceId = "";
  let ownerUserId = "";
  let reviewerUserId = "";
  let dispatchedDecisionRecordId = "";
  let dispatchedDecisionKey = "";
  let dispatchedActionItemId = "";

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

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error(
        "DATABASE_URL must equal STAGE1_OWNER_LOOP_DATABASE_URL for the isolated integration test.",
      );
    }
    const workspace = await db.workspace.create({
      data: {
        name: `Stage 1 integration ${suffix}`,
        slug: `stage1-integration-${suffix}`,
      },
    });
    const [owner, reviewer] = await Promise.all([
      db.user.create({
        data: {
          name: "Stage 1 Owner",
          email: `stage1-owner-${suffix}@example.test`,
        },
      }),
      db.user.create({
        data: {
          name: "Stage 1 Reviewer",
          email: `stage1-reviewer-${suffix}@example.test`,
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
  });

  afterAll(async () => {
    if (!workspaceId) return;
    await db.$transaction(async (tx) => {
      await tx.memoryFact.deleteMany({ where: { workspaceId } });
      await tx.executionReceipt.deleteMany({ where: { workspaceId } });
      await tx.decisionWorkPacketClaim.deleteMany({ where: { workspaceId } });
      await tx.approvalTask.deleteMany({ where: { workspaceId } });
      await tx.actionItem.deleteMany({ where: { workspaceId } });
      await tx.supervisionSignalRecord.deleteMany({ where: { workspaceId } });
      await tx.decisionRecord.deleteMany({ where: { workspaceId } });
      await tx.observationSourceRun.deleteMany({ where: { workspaceId } });
      await tx.observationCompatReceipt.deleteMany({
        where: { workspaceId },
      });
      await tx.observationSource.deleteMany({ where: { workspaceId } });
      await tx.dataAssetStageReceipt.deleteMany({ where: { workspaceId } });
      await tx.dataAssetCatalogEntry.deleteMany({ where: { workspaceId } });
      await tx.enterpriseObservationProgram.deleteMany({ where: { workspaceId } });
      await tx.notification.deleteMany({ where: { workspaceId } });
      await tx.auditLog.deleteMany({ where: { workspaceId } });
      await tx.membership.deleteMany({ where: { workspaceId } });
    });
  });

  it("creates one observation run for concurrent identical execution keys", async () => {
    const program = await createEnterpriseObservationProgram({
      workspaceId,
      purpose: "Observe synthetic CRM facts for an owner decision",
      scopeRefs: ["scope:synthetic-crm"],
      dataCategories: ["synthetic-opportunity"],
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
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
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
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
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
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
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
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
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
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
      contextRefs: ["context:synthetic-weekly-ops"],
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
      expiryOrReviewAt: "2026-08-01T00:00:00.000Z",
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

    expect(first.actionItemId).toBe(second.actionItemId);
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

  it("commits one decision evaluation and observed memory under concurrent replay", async () => {
    expect(dispatchedDecisionRecordId).not.toBe("");
    expect(dispatchedActionItemId).not.toBe("");
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
          status: ActionStatus.EXECUTED,
          executionStatus: "completed",
          executedAt: new Date("2026-07-18T02:00:00.000Z"),
        },
      }),
    ]);
    await recordExecutionReceipt({
      workspaceId,
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: dispatchedActionItemId,
      actionItemId: dispatchedActionItemId,
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "SYNTHETIC_DECISION_FOLLOW_THROUGH",
      evidenceRefs: ["evidence:synthetic-recovery"],
      executedByUserId: ownerUserId,
      executedByActorType: ActorType.USER,
      actorName: "Stage 1 Owner",
    });
    await verifyExecutionReceipt({
      workspaceId,
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: dispatchedActionItemId,
      verifierUserId: reviewerUserId,
      verifierName: "Stage 1 Reviewer",
    });

    const evaluate = () =>
      evaluateStage1DecisionRecord({
        workspaceId,
        decisionRecordId: dispatchedDecisionRecordId,
        followedAiRecommendation: true,
        outcome: {
          outcomeRef: `business-outcome:synthetic-recovery-${suffix}`,
          result: "success",
        },
        actorName: "Helm Evaluation Runtime",
        actorType: ActorType.AI,
      });
    const results = await Promise.all([evaluate(), evaluate()]);

    expect(results.map((result) => result.created).sort()).toEqual([
      false,
      true,
    ]);
    expect(results[0].evaluation).toEqual(results[1].evaluation);
    expect(results[0].evaluation.automationImpact).toBe("promote_candidate");
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
      await db.decisionRecord.findUnique({
        where: { id: dispatchedDecisionRecordId },
        select: { status: true, evaluationJson: true, evaluatedAt: true },
      }),
    ).toMatchObject({
      status: "EVALUATED",
      evaluationJson: expect.any(String),
      evaluatedAt: expect.any(Date),
    });
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
