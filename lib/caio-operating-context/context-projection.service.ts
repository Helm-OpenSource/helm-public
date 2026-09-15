import "server-only";

import { db } from "@/lib/db";
import {
  projectTemporalOperatingContext,
  validateTemporalOperatingContextSnapshotBinding,
} from "@/lib/operating-harness/context-projector";

import {
  buildCaioTenantContextProjectionInput,
  type CaioContextHitRow,
  type CaioContextRunRow,
} from "./context-builder";

/**
 * Projects one completed quick-check tick into a replayable tenant live shadow snapshot.
 * Off unless HELM_CAIO_CONTEXT_PROJECTION_ENABLED is exactly "true". Only terminal observation runs of
 * catalog-bound sources with authorization and connection receipts can back evidence; anything else
 * is rejected with a closed reason rather than partially adopted. Writes CaioOperatingContextSnapshot only.
 */

export const CAIO_CONTEXT_PROJECTION_ENABLED_ENV = "HELM_CAIO_CONTEXT_PROJECTION_ENABLED";

export function isCaioContextProjectionEnabled(): boolean {
  return process.env[CAIO_CONTEXT_PROJECTION_ENABLED_ENV] === "true";
}

async function loadRuns(workspaceId: string, runIds: readonly string[]): Promise<CaioContextRunRow[]> {
  if (runIds.length === 0) return [];
  const runs = await db.observationSourceRun.findMany({
    where: { workspaceId, id: { in: [...runIds] }, status: { in: ["SUCCEEDED", "PARTIAL"] } },
    select: {
      id: true, status: true, windowStart: true, windowEnd: true, observedAt: true, summaryHash: true,
      source: { select: { catalogEntryId: true } },
    },
  });
  const rows: CaioContextRunRow[] = [];
  for (const run of runs) {
    const catalogEntryId = run.source.catalogEntryId;
    if (!catalogEntryId || !run.observedAt || !run.summaryHash) continue;
    const [authorization, connection] = await Promise.all(
      (["AUTHORIZATION", "CONNECTION"] as const).map((receiptType) =>
        db.dataAssetStageReceipt.findFirst({
          where: {
            workspaceId, assetId: catalogEntryId, receiptType,
            status: receiptType === "AUTHORIZATION" ? "AUTHORIZED" : "CONNECTED",
            recordedAt: { lte: run.observedAt! },
          },
          orderBy: { recordedAt: "desc" },
          select: { id: true },
        })),
    );
    if (!authorization || !connection) continue;
    rows.push({
      id: run.id, status: run.status, windowStart: run.windowStart, windowEnd: run.windowEnd, observedAt: run.observedAt,
      summaryHash: run.summaryHash, catalogEntryId, authorizationReceiptId: authorization.id, connectionReceiptId: connection.id,
    });
  }
  return rows;
}

export async function projectCaioQuickCheckContext(input: {
  workspaceId: string;
  tickId: string;
  tickBucketStart: Date;
  windowStart: Date;
  asOf: Date;
  hits: readonly CaioContextHitRow[];
}): Promise<"projected" | "rejected" | "no_signals"> {
  const observations = await db.caioMetricObservation.findMany({
    where: { workspaceId: input.workspaceId, tickId: input.tickId, status: "ok" },
    select: {
      templateId: true, sourceKey: true, observationRunId: true, windowStart: true, windowEnd: true, observedAt: true, contentHash: true,
    },
  });
  const known = observations.flatMap((row) =>
    row.observationRunId && row.contentHash ? [{ ...row, observationRunId: row.observationRunId, contentHash: row.contentHash }] : []);
  const runs = await loadRuns(input.workspaceId, [...new Set(known.map((row) => row.observationRunId))]);

  const built = buildCaioTenantContextProjectionInput({
    workspaceId: input.workspaceId, tickBucketStart: input.tickBucketStart, windowStart: input.windowStart, asOf: input.asOf,
    observations: known, hits: input.hits, runs,
  });
  const base = { workspaceId: input.workspaceId, tickId: input.tickId };
  if (!built.ok) {
    const status = built.reason === "no_signals" ? "NO_SIGNALS" : "REJECTED";
    await db.caioOperatingContextSnapshot.create({ data: { ...base, status, reasonCode: built.reason } });
    return built.reason === "no_signals" ? "no_signals" : "rejected";
  }

  const projection = projectTemporalOperatingContext(built.input);
  const replay = projection.snapshot
    ? validateTemporalOperatingContextSnapshotBinding({ input: built.input, snapshot: projection.snapshot })
    : null;
  if (!projection.ok || !projection.snapshot || !replay?.ok) {
    const errorCodes = [...projection.errors, ...(replay?.errors ?? [])];
    await db.caioOperatingContextSnapshot.create({
      data: { ...base, status: "REJECTED", reasonCode: "context_projection_rejected", errorCodesJson: JSON.stringify(errorCodes) },
    });
    return "rejected";
  }

  await db.caioOperatingContextSnapshot.create({
    data: {
      ...base,
      status: "PROJECTED",
      snapshotId: projection.snapshot.snapshotId,
      snapshotHash: projection.snapshot.contentHash,
      replayRootHash: projection.snapshot.replayRootHash,
      objectCount: projection.snapshot.objectSummaries.length,
      signalCount: built.input.signalEvents.length,
      projectionInputJson: JSON.stringify(built.input),
      snapshotJson: JSON.stringify(projection.snapshot),
    },
  });
  return "projected";
}
