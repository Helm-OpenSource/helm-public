import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Live G0 path on an isolated MySQL database: catalog-gated quick check → G0 preparation → assessment →
 * CEO acceptance → a later healthy quick-check tick keeps the gate accepted → revoking the observation
 * program stales it. Only real services are used.
 *
 *   CAIO_OPERATING_CONTEXT_DATABASE_URL=<disposable helm_caio_operating_context_* db url> DATABASE_URL=<same url> \
 *     npx vitest run lib/caio-operating-context/g0-preparation.mysql.test.ts --config vitest.public.config.ts
 */

import {
  activateCaioMandate,
  createCaioMandateDraft,
  registerCaioPrincipalBinding,
} from "@/lib/caio-governance/mandate-store.service";
import { db } from "@/lib/db";
import {
  acceptCaioInitializationGate,
  getCaioInitializationGateStatus,
  recordCaioInitializationAssessment,
} from "@/lib/stage1-owner-loop/caio-initialization-gate-store.service";
import {
  createDataAssetCatalogEntry,
  recordDataAssetAuthorizationReceipt,
  recordDataAssetClassificationReceipt,
  recordDataAssetConnectionReceipt,
} from "@/lib/stage1-owner-loop/data-asset-catalog.service";
import {
  createEnterpriseObservationProgram,
  registerObservationSource,
  revokeEnterpriseObservationProgram,
} from "@/lib/stage1-owner-loop/observation.service";

import type { CaioDetector, CaioMetricQueryTemplate } from "./contracts";
import { prepareCaioG0FromLiveObservation } from "./g0-preparation.service";
import { assertDisposableCaioOperatingContextDatabase } from "./mysql-test-guard";
import { caioQuickCheckBucketStart, runCaioQuickCheck } from "./quick-check.service";

const integrationDatabaseUrl = process.env.CAIO_OPERATING_CONTEXT_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const HOUR_MS = 3_600_000;
const BUCKET_MS = 600_000;
const suffix = `g${process.pid}${Date.now()}`.replace(/\d/gu, (digit) => "abcdefghij"[Number(digit)]);
const ACTOR = "CAIO G0 Test Owner";
const CEO_REF = `ceo-g0-live-${suffix}`;
const withoutMs = (value: Date) => value.toISOString().replace(/\.\d{3}Z$/u, "Z");

describeMysql("CAIO live G0 preparation with an isolated MySQL database", () => {
  let workspaceId = "";
  let ownerId = "";
  let programId = "";
  let mandateRecordId = "";
  const sourceKeys: string[] = [];
  const base = caioQuickCheckBucketStart(new Date(Date.now() + BUCKET_MS));
  const at = (offsetMs: number) => new Date(base.getTime() + offsetMs);

  const templates = (): CaioMetricQueryTemplate[] => [
    { templateId: "ops-dead-letters", domain: "operations", sourceKey: sourceKeys[0], run: async () => ({ values: { count: 1 }, denominator: 40 }) },
    { templateId: "reach-dials", domain: "reach", sourceKey: sourceKeys[1], run: async () => ({ values: { real_dials: 120, connected: 30 }, denominator: null }) },
  ];
  const detectors: CaioDetector[] = [];

  beforeAll(async () => {
    assertDisposableCaioOperatingContextDatabase(integrationDatabaseUrl);
    const validFrom = new Date(base.getTime() - 4 * HOUR_MS);
    const validUntil = new Date(base.getTime() + 24 * HOUR_MS);
    workspaceId = (await db.workspace.create({ data: { name: `CAIO live G0 ${suffix}`, slug: `caio-live-g0-${suffix}` } })).id;
    ownerId = (await db.user.create({ data: { name: ACTOR, email: `caio-live-g0-${suffix}@example.test` } })).id;
    await db.membership.create({ data: { workspaceId, userId: ownerId, role: WorkspaceRole.OWNER, status: MembershipStatus.ACTIVE } });
    const actor = { actorName: ACTOR, actorUserId: ownerId };

    await registerCaioPrincipalBinding({
      workspaceId, actorUserId: ownerId, userId: ownerId, principalRef: CEO_REF, principalKind: "ceo", evidenceRef: `evidence:ceo-binding-${suffix}`,
    });
    const draft = await createCaioMandateDraft({
      workspaceId, actorUserId: ownerId, caioRef: `caio:live-g0-${suffix}`, ceoRef: CEO_REF, stage: "observe",
      stageDecisionRef: `stage-decision:live-g0-${suffix}`, objectiveRefs: ["objective:initialize-company-truth"],
      scopeRefs: ["scope:workspace"], grantBasisRefs: [`caio-mandate-grant:${CEO_REF}:${suffix}`],
      reservedMatterRefs: ["reserved:external-side-effects"], humanResponsePolicyRef: "policy:human-response-v1",
      accountabilityAnchorRefs: ["anchor:ceo"], guardianStopRefs: [], validFrom: withoutMs(validFrom), validUntil: withoutMs(validUntil),
      inFlightDisposition: "freeze", auditRefs: [`audit:live-g0-mandate-${suffix}`],
    });
    mandateRecordId = draft.mandateId;
    await activateCaioMandate({ workspaceId, actorUserId: ownerId, actorCeoRef: CEO_REF, mandateRecordId });

    const program = await createEnterpriseObservationProgram({
      workspaceId, purpose: "Observe aggregate operating health", scopeRefs: ["scope:workspace"],
      dataCategories: ["operations-aggregate"], startsAt: validFrom, expiresAt: validUntil, retentionDays: 30,
      authorizationRef: `authorization:live-g0-${suffix}`, ...actor,
    });
    programId = program.id;
    for (const [index, domain] of ["operations", "reach"].entries()) {
      const tag = `${domain}-${suffix}`;
      const asset = await createDataAssetCatalogEntry({
        workspaceId, assetKey: `asset-${tag}`, sourceSystemRef: `system:${tag}`, displayName: `Aggregates ${domain}`,
        sourceKind: "relational_database", businessDomain: domain, businessOwnerRef: ownerId, purpose: `Observe ${domain} health`,
        scopeRefs: ["scope:workspace"], recommendedAccessMode: "read_only_api", retentionDays: 30, freshnessSlaMinutes: 30,
        residencyRequirements: ["region:test"], blindSpots: [], blockerCodes: [], riskOwnerRef: ownerId, nextReviewAt: validUntil,
        evidenceRefs: [`evidence:inventory-${tag}`], ...actor, now: validFrom,
      });
      await recordDataAssetClassificationReceipt({
        workspaceId, assetId: asset.id, receiptId: `classification-${tag}`, idempotencyKey: `classification:${tag}`, expectedVersion: 1,
        dataShape: "structured", sensitivity: index === 0 ? "internal" : "confidential", processingDisposition: "local_only",
        technicalFeasibility: "feasible", evidenceRefs: [`evidence:classification-${tag}`], ...actor, now: validFrom,
      });
      await recordDataAssetAuthorizationReceipt({
        workspaceId, assetId: asset.id, receiptId: `authorization-${tag}`, idempotencyKey: `authorization:${tag}`, expectedVersion: 2,
        authorizationStatus: "authorized", authorizationRef: program.authorizationRef, scopeRefs: ["scope:workspace"], consentRefs: [],
        validFrom, validUntil, reasonCodes: [], evidenceRefs: [`evidence:authorization-${tag}`], ...actor, now: validFrom,
      });
      const source = await registerObservationSource({
        workspaceId, programId: program.id, catalogEntryId: asset.id, sourceKey: `source-${tag}`, sourceKind: "relational_database",
        accessMode: "read_only_api", ownerRef: ownerId, freshnessSlaMinutes: 30, sensitivity: index === 0 ? "internal" : "confidential",
        authorizationRef: program.authorizationRef, secretRef: `secret-manager:${tag}`, retentionDays: 30, ...actor, now: validFrom,
      });
      sourceKeys.push(source.sourceKey);
      await recordDataAssetConnectionReceipt({
        workspaceId, assetId: asset.id, receiptId: `connection-${tag}`, idempotencyKey: `connection:${tag}`, expectedVersion: 3,
        connectionStatus: "connected", accessMode: "read_only_api", connectorRef: `connector:${tag}`, secretRef: `secret-manager:${tag}`,
        authorizationReceiptRef: `authorization-${tag}`, observationSourceRef: source.id, reasonCodes: [],
        evidenceRefs: [`evidence:connection-${tag}`], ...actor, now: validFrom,
      });
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("refuses to prepare before any successful quick-check run and for a non-owner", async () => {
    await expect(prepareCaioG0FromLiveObservation({ workspaceId, actorUserId: ownerId, actorName: ACTOR, apply: false, now: at(10_000) }))
      .resolves.toMatchObject({ ok: false, code: "no_successful_run" });
    await expect(prepareCaioG0FromLiveObservation({ workspaceId, actorUserId: `missing-${suffix}`, actorName: ACTOR, apply: false }))
      .resolves.toEqual({ ok: false, code: "not_owner" });
  });

  it("reaches an accepted G0 from live observation that stays current across healthy ticks", async () => {
    await expect(runCaioQuickCheck({ workspaceId, now: at(30_000), templates: templates(), detectors }))
      .resolves.toMatchObject({ status: "completed", known: 2 });

    const dryRun = await prepareCaioG0FromLiveObservation({ workspaceId, actorUserId: ownerId, actorName: ACTOR, apply: false, now: at(40_000) });
    expect(dryRun).toMatchObject({ ok: true, summary: { assets: 2, validated: true, initializationReceipts: 0 } });
    expect(await db.artifactBundle.count({ where: { workspaceId } })).toBe(0);

    const prepared = await prepareCaioG0FromLiveObservation({ workspaceId, actorUserId: ownerId, actorName: ACTOR, apply: true, now: at(50_000) });
    expect(prepared).toMatchObject({ ok: true, summary: { assets: 2, memoryFacts: 2, initializationReceipts: 2 } });

    const evaluation = await recordCaioInitializationAssessment({
      workspaceId, mandateRecordId, evaluationKey: `live-g0-${suffix}`, actorUserId: ownerId, now: at(60_000),
    });
    expect(evaluation.assessment.failures).toEqual([]);
    expect(evaluation.assessment.decision).toBe("ready_for_owner_acceptance");
    expect(evaluation.assessment.exceptionRefs).toEqual([]);

    await acceptCaioInitializationGate({
      workspaceId, assessmentId: evaluation.assessment.assessmentId, actorUserId: ownerId, ceoPrincipalRef: CEO_REF,
      idempotencyKey: `live-g0-accept-${suffix}`, inventoryConfirmationRef: `confirmation:inventory:${suffix}`,
      customerAcceptanceRef: `acceptance:customer:${suffix}`, acceptedExceptionRefs: [], reasonCodes: ["initialization_reviewed"],
      evidenceRefs: [`evidence:live-g0-acceptance:${suffix}`], now: at(70_000),
    });
    await expect(getCaioInitializationGateStatus({ workspaceId, actorUserId: ownerId, now: at(80_000) }))
      .resolves.toMatchObject({ status: "accepted" });

    // A later healthy quick-check tick creates new runs; evaluator v2 keeps the accepted gate current.
    await expect(runCaioQuickCheck({ workspaceId, now: at(BUCKET_MS + 30_000), templates: templates(), detectors }))
      .resolves.toMatchObject({ status: "completed", known: 2 });
    await expect(getCaioInitializationGateStatus({ workspaceId, actorUserId: ownerId, now: at(BUCKET_MS + 40_000) }))
      .resolves.toMatchObject({ status: "accepted" });

    await revokeEnterpriseObservationProgram({ workspaceId, programId, reason: "integration test revocation", actorName: ACTOR, actorUserId: ownerId });
    const stale = await getCaioInitializationGateStatus({ workspaceId, actorUserId: ownerId, now: at(BUCKET_MS + 50_000) });
    expect(stale.status).toBe("stale");
  });
});
