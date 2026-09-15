import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * CAIO quick check against real observation, catalog and audit services on an isolated MySQL database.
 *
 *   CAIO_OPERATING_CONTEXT_DATABASE_URL=<disposable helm_caio_operating_context_* db url> DATABASE_URL=<same url> \
 *     npx vitest run lib/caio-operating-context/quick-check.mysql.test.ts --config vitest.public.config.ts
 */

import { db } from "@/lib/db";
import { projectTemporalOperatingContext } from "@/lib/operating-harness/context-projector";
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

import { CAIO_CONTEXT_PROJECTION_ENABLED_ENV } from "./context-projection.service";
import type { CaioDetector, CaioMetricQueryTemplate } from "./contracts";
import { assertDisposableCaioOperatingContextDatabase } from "./mysql-test-guard";
import { caioQuickCheckBucketStart, runCaioQuickCheck } from "./quick-check.service";

const integrationDatabaseUrl = process.env.CAIO_OPERATING_CONTEXT_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const HOUR_MS = 3_600_000;
const BUCKET_MS = 600_000;
// Letters only: refs pass the public-safe ref checks, which reject digit-like identifiers.
const suffix = `${process.pid}${Date.now()}`.replace(/\d/gu, (digit) => "abcdefghij"[Number(digit)]);
const ACTOR = "CAIO Quick Check Test Owner";

describeMysql("CAIO quick check with an isolated MySQL database", () => {
  let workspaceId = "";
  let ownerId = "";
  let programId = "";
  let sourceKey = "";
  let deadLetterCount = 12;
  const base = caioQuickCheckBucketStart(new Date(Date.now() + BUCKET_MS));

  const templates = (): CaioMetricQueryTemplate[] => [
    { templateId: "dead-letters", domain: "operations", sourceKey, run: async () => ({ values: { count: deadLetterCount }, denominator: 40 }) },
    { templateId: "unregistered-queue", domain: "operations", sourceKey: `source-unregistered-${suffix}`, run: async () => { throw new Error("must not run"); } },
  ];
  const detectors: CaioDetector[] = [
    {
      detectorId: "dead-letter-surge", title: { zh: "死信激增", en: "Dead-letter surge" }, requiredTemplateIds: ["dead-letters"],
      evaluate: ({ observations }) => ((observations.get("dead-letters")?.values?.count ?? 0) >= 10
        ? [{ mergeKey: "closure", objectKey: "job:closure", severity: "critical", reasonCode: "dead_letters_over_threshold", evidenceTemplateIds: ["dead-letters"] }]
        : []),
    },
    {
      detectorId: "queue-stall", title: { zh: "队列停滞", en: "Queue stall" }, requiredTemplateIds: ["unregistered-queue"],
      evaluate: () => [{ mergeKey: "queue", objectKey: "queue:main", severity: "warning", reasonCode: "queue_stalled", evidenceTemplateIds: ["unregistered-queue"] }],
    },
  ];

  async function businessRowCounts() {
    const [decisions, supervision, actions, approvals] = await Promise.all([
      db.decisionRecord.count({ where: { workspaceId } }),
      db.supervisionSignalRecord.count({ where: { workspaceId } }),
      db.actionItem.count({ where: { workspaceId } }),
      db.approvalTask.count({ where: { workspaceId } }),
    ]);
    return { decisions, supervision, actions, approvals };
  }

  beforeAll(async () => {
    assertDisposableCaioOperatingContextDatabase(integrationDatabaseUrl);
    const validFrom = new Date(base.getTime() - 4 * HOUR_MS);
    const validUntil = new Date(base.getTime() + 24 * HOUR_MS);
    workspaceId = (await db.workspace.create({ data: { name: `CAIO quick check ${suffix}`, slug: `caio-quick-check-${suffix}` } })).id;
    ownerId = (await db.user.create({ data: { name: ACTOR, email: `caio-quick-check-${suffix}@example.test` } })).id;
    await db.membership.create({ data: { workspaceId, userId: ownerId, role: WorkspaceRole.OWNER, status: MembershipStatus.ACTIVE } });
    const actor = { actorName: ACTOR, actorUserId: ownerId };

    const program = await createEnterpriseObservationProgram({
      workspaceId, purpose: "Observe aggregate operating health", scopeRefs: ["scope:workspace"],
      dataCategories: ["operations-aggregate"], startsAt: validFrom, expiresAt: validUntil, retentionDays: 30,
      authorizationRef: `authorization:quick-check-${suffix}`, ...actor,
    });
    programId = program.id;
    const asset = await createDataAssetCatalogEntry({
      workspaceId, assetKey: `asset-${suffix}`, sourceSystemRef: `system:quick-check-${suffix}`, displayName: "Operations aggregates",
      sourceKind: "relational_database", businessDomain: "operations", businessOwnerRef: ownerId, purpose: "Observe operating health",
      scopeRefs: ["scope:workspace"], recommendedAccessMode: "read_only_api", retentionDays: 30, freshnessSlaMinutes: 10,
      residencyRequirements: ["region:test"], blindSpots: [], blockerCodes: [], riskOwnerRef: ownerId, nextReviewAt: validUntil,
      evidenceRefs: [`evidence:inventory-${suffix}`], ...actor, now: validFrom,
    });
    await recordDataAssetClassificationReceipt({
      workspaceId, assetId: asset.id, receiptId: `classification-${suffix}`, idempotencyKey: `classification:${suffix}`, expectedVersion: 1,
      dataShape: "structured", sensitivity: "internal", processingDisposition: "local_only", technicalFeasibility: "feasible",
      evidenceRefs: [`evidence:classification-${suffix}`], ...actor, now: validFrom,
    });
    await recordDataAssetAuthorizationReceipt({
      workspaceId, assetId: asset.id, receiptId: `authorization-${suffix}`, idempotencyKey: `authorization:${suffix}`, expectedVersion: 2,
      authorizationStatus: "authorized", authorizationRef: program.authorizationRef, scopeRefs: ["scope:workspace"], consentRefs: [],
      validFrom, validUntil, reasonCodes: [], evidenceRefs: [`evidence:authorization-${suffix}`], ...actor, now: validFrom,
    });
    const source = await registerObservationSource({
      workspaceId, programId: program.id, catalogEntryId: asset.id, sourceKey: `source-${suffix}`, sourceKind: "relational_database",
      accessMode: "read_only_api", ownerRef: ownerId, freshnessSlaMinutes: 10, sensitivity: "internal",
      authorizationRef: program.authorizationRef, secretRef: `secret-manager:quick-check-${suffix}`, retentionDays: 30, ...actor, now: validFrom,
    });
    sourceKey = source.sourceKey;
    await recordDataAssetConnectionReceipt({
      workspaceId, assetId: asset.id, receiptId: `connection-${suffix}`, idempotencyKey: `connection:${suffix}`, expectedVersion: 3,
      connectionStatus: "connected", accessMode: "read_only_api", connectorRef: `connector:quick-check-${suffix}`,
      secretRef: `secret-manager:quick-check-${suffix}`, authorizationReceiptRef: `authorization-${suffix}`, observationSourceRef: source.id,
      reasonCodes: [], evidenceRefs: [`evidence:connection-${suffix}`], ...actor, now: validFrom,
    });
  });

  afterAll(async () => {
    delete process.env[CAIO_CONTEXT_PROJECTION_ENABLED_ENV];
    // Same retention rule as the other CAIO isolated suites: rows are kept.
    await db.$disconnect();
  });

  it("opens a candidate through the catalog gate, never reads an unregistered source, and writes no business rows", async () => {
    const before = await businessRowCounts();
    const result = await runCaioQuickCheck({ workspaceId, now: new Date(base.getTime() + 30_000), templates: templates(), detectors });
    expect(result).toMatchObject({ status: "completed", known: 1, unknown: 1, opened: 1, skippedDetectors: 1 });

    const runs = await db.observationSourceRun.findMany({ where: { workspaceId } });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "SUCCEEDED", executionKey: `caio-quick-check:${base.toISOString()}` });
    const unregistered = await db.caioMetricObservation.findFirst({ where: { workspaceId, templateId: "unregistered-queue" } });
    expect(unregistered).toMatchObject({ status: "unknown", errorCode: "observation_gate_rejected", valuesJson: null });
    const candidates = await db.caioAnomalyCandidate.findMany({ where: { workspaceId, status: "OPEN" } });
    expect(candidates.map((c) => c.detectorId)).toEqual(["dead-letter-surge"]);
    expect(await businessRowCounts()).toEqual(before);

    await expect(runCaioQuickCheck({ workspaceId, now: new Date(base.getTime() + 90_000), templates: templates(), detectors }))
      .resolves.toEqual({ status: "claimed_elsewhere" });
  });

  it("refreshes on a repeat hit, clears on a known miss, and holds state while the gate refuses", async () => {
    process.env[CAIO_CONTEXT_PROJECTION_ENABLED_ENV] = "true";
    const refreshed = await runCaioQuickCheck({ workspaceId, now: new Date(base.getTime() + BUCKET_MS), templates: templates(), detectors });
    expect(refreshed).toMatchObject({ refreshed: 1, opened: 0, contextProjection: "projected" });
    expect(await db.caioAnomalyCandidate.findFirst({ where: { workspaceId, status: "OPEN" } })).toMatchObject({ hitCount: 2 });

    // The stored input replays to the stored snapshot and carries no raw internal identifiers.
    if (refreshed.status !== "completed") throw new Error("expected a completed tick");
    const snapshot = await db.caioOperatingContextSnapshot.findUniqueOrThrow({ where: { tickId: refreshed.tickId } });
    expect(snapshot).toMatchObject({ status: "PROJECTED", objectCount: 1, signalCount: 1 });
    expect(projectTemporalOperatingContext(JSON.parse(snapshot.projectionInputJson ?? "{}")).snapshot?.contentHash).toBe(snapshot.snapshotHash);
    const run = await db.observationSourceRun.findFirstOrThrow({ where: { workspaceId, executionKey: `caio-quick-check:${new Date(base.getTime() + BUCKET_MS).toISOString()}` } });
    const stored = `${snapshot.projectionInputJson}${snapshot.snapshotJson}`;
    for (const raw of [workspaceId, run.id, ownerId, sourceKey]) expect(stored).not.toContain(raw);

    deadLetterCount = 0;
    await expect(runCaioQuickCheck({ workspaceId, now: new Date(base.getTime() + 2 * BUCKET_MS), templates: templates(), detectors }))
      .resolves.toMatchObject({ cleared: 1, contextProjection: "no_signals" });
    expect(await db.caioAnomalyCandidate.count({ where: { workspaceId, status: "OPEN" } })).toBe(0);

    deadLetterCount = 12;
    await expect(runCaioQuickCheck({ workspaceId, now: new Date(base.getTime() + 3 * BUCKET_MS), templates: templates(), detectors }))
      .resolves.toMatchObject({ opened: 1 });
    await revokeEnterpriseObservationProgram({ workspaceId, programId, reason: "integration test revocation", actorName: ACTOR, actorUserId: ownerId });
    const refused = await runCaioQuickCheck({ workspaceId, now: new Date(base.getTime() + 4 * BUCKET_MS), templates: templates(), detectors });
    expect(refused).toMatchObject({ status: "completed", known: 0, unknown: 2, cleared: 0, contextProjection: "no_signals" });
    // Unknown is not "resolved": the open candidate stays open while the source cannot be read.
    expect(await db.caioAnomalyCandidate.count({ where: { workspaceId, status: "OPEN" } })).toBe(1);
    expect(await db.caioAnomalyCandidate.count({ where: { workspaceId, status: "CLEARED" } })).toBe(1);
  });
});
