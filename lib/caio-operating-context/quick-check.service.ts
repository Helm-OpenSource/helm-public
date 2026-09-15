import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { isWriteConflictError, runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  beginObservationSourceRun,
  completeObservationSourceRun,
} from "@/lib/stage1-owner-loop/observation.service";

import {
  parseCaioMetricResult,
  type CaioDetector,
  type CaioMetricObservationView,
  type CaioMetricQueryTemplate,
} from "./contracts";
import { projectCaioQuickCheckContext, isCaioContextProjectionEnabled } from "./context-projection.service";
import type { CaioContextHitRow } from "./context-builder";
import { planCaioCandidateTransitions, runCaioDetectors, type CaioDetectorRunResult } from "./detector-runner";
import { buildCaioMetricObservationContent, summarizeCaioSourceRun } from "./metric-evidence";
import { getRegisteredCaioOperatingContext } from "./registry";

/**
 * CAIO quick check: one pass per workspace per 10-minute bucket.
 *
 * 1. Claim the bucket with a unique CaioQuickCheckTick row (the scheduler holds no database lock).
 * 2. Per source, open an observation run through the data-asset catalog gate; a refused gate means
 *    the templates of that source are never executed and are recorded as unknown.
 * 3. Store each aggregate reading, or unknown with a closed error code. Unknown is never zero.
 * 4. Run deterministic detectors; detectors with an unknown input are skipped.
 * 5. Merge hits into open candidates; clear only candidates whose detector ran on known inputs.
 *
 * Writes CAIO-owned tables and the existing observation run receipt path only.
 */

export const CAIO_QUICK_CHECK_BUCKET_MINUTES = 10;
const BUCKET_MS = CAIO_QUICK_CHECK_BUCKET_MINUTES * 60_000;
const DEFAULT_TEMPLATE_TIMEOUT_MS = 20_000;
const ACTOR_NAME = "caio-quick-check";
// Candidate reads and writes run serializable so the open set read at the start holds until commit:
// an overlapping slow bucket cannot clear or refresh a row this transaction has already decided on.
const CANDIDATE_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

export type CaioQuickCheckResult =
  | { status: "claimed_elsewhere" }
  | {
      status: "completed" | "failed";
      tickId: string;
      known: number;
      unknown: number;
      opened: number;
      refreshed: number;
      cleared: number;
      skippedDetectors: number;
      failedDetectors: number;
      contextProjection: CaioQuickCheckContextProjection;
    };

export type CaioQuickCheckContextProjection = "disabled" | "projected" | "rejected" | "no_signals" | "failed";

type MetricErrorCode =
  | "observation_gate_rejected"
  | "observation_run_already_terminal"
  | "metric_query_failed"
  | "metric_query_timeout"
  | "metric_result_invalid"
  | "metric_result_unsafe";

export function caioQuickCheckBucketStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / BUCKET_MS) * BUCKET_MS);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const TIMEOUT = Symbol("caio_metric_query_timeout");

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMEOUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<typeof TIMEOUT>((resolve) => { timer = setTimeout(() => resolve(TIMEOUT), ms); })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type ObserveContext = Readonly<{
  workspaceId: string;
  tickId: string;
  now: Date;
  windowStart: Date;
  windowEnd: Date;
  executionKey: string;
  templateTimeoutMs: number;
}>;

async function recordUnknown(ctx: ObserveContext, template: CaioMetricQueryTemplate, observationRunId: string | null, errorCode: MetricErrorCode) {
  await db.caioMetricObservation.create({
    data: {
      workspaceId: ctx.workspaceId, tickId: ctx.tickId, observationRunId, sourceKey: template.sourceKey,
      templateId: template.templateId, domain: template.domain, windowStart: ctx.windowStart, windowEnd: ctx.windowEnd,
      observedAt: ctx.now, status: "unknown", valuesJson: null, denominator: null, errorCode, contentHash: null, evidenceRef: null,
    },
  });
  const view: CaioMetricObservationView = {
    templateId: template.templateId, domain: template.domain, status: "unknown", values: null, denominator: null, evidenceRef: null,
  };
  return { view, contentHash: null };
}

async function readTemplate(ctx: ObserveContext, template: CaioMetricQueryTemplate, observationRunId: string) {
  let raw: unknown;
  try {
    raw = await withTimeout(
      Promise.resolve().then(() => template.run({ workspaceId: ctx.workspaceId, windowStart: ctx.windowStart, windowEnd: ctx.windowEnd, now: ctx.now })),
      ctx.templateTimeoutMs,
    );
  } catch {
    return recordUnknown(ctx, template, observationRunId, "metric_query_failed");
  }
  if (raw === TIMEOUT) return recordUnknown(ctx, template, observationRunId, "metric_query_timeout");
  const parsed = parseCaioMetricResult(raw);
  if (!parsed.ok) return recordUnknown(ctx, template, observationRunId, parsed.errorCode);

  const { contentHash, evidenceRef } = buildCaioMetricObservationContent({
    templateId: template.templateId, domain: template.domain, sourceKey: template.sourceKey,
    windowStart: ctx.windowStart, windowEnd: ctx.windowEnd, values: parsed.values, denominator: parsed.denominator,
  });
  await db.caioMetricObservation.create({
    data: {
      workspaceId: ctx.workspaceId, tickId: ctx.tickId, observationRunId, sourceKey: template.sourceKey,
      templateId: template.templateId, domain: template.domain, windowStart: ctx.windowStart, windowEnd: ctx.windowEnd,
      observedAt: ctx.now, status: "ok", valuesJson: JSON.stringify(parsed.values), denominator: parsed.denominator,
      errorCode: null, contentHash, evidenceRef,
    },
  });
  const view: CaioMetricObservationView = {
    templateId: template.templateId, domain: template.domain, status: "ok", values: parsed.values, denominator: parsed.denominator, evidenceRef,
  };
  return { view, contentHash };
}

async function observeSources(ctx: ObserveContext, templates: readonly CaioMetricQueryTemplate[]) {
  const views = new Map<string, CaioMetricObservationView>();
  const bySource = new Map<string, CaioMetricQueryTemplate[]>();
  for (const template of templates) bySource.set(template.sourceKey, [...(bySource.get(template.sourceKey) ?? []), template]);

  for (const sourceKey of [...bySource.keys()].sort()) {
    const group = bySource.get(sourceKey) ?? [];
    let run: { id: string; status: string };
    try {
      run = await beginObservationSourceRun({
        workspaceId: ctx.workspaceId, sourceKey, executionKey: ctx.executionKey,
        windowStart: ctx.windowStart, windowEnd: ctx.windowEnd, now: ctx.now,
      });
    } catch {
      // The gate refused (authorization, connection, window, revocation): do not read the source.
      for (const template of group) views.set(template.templateId, (await recordUnknown(ctx, template, null, "observation_gate_rejected")).view);
      continue;
    }
    if (run.status !== "RUNNING") {
      for (const template of group) views.set(template.templateId, (await recordUnknown(ctx, template, run.id, "observation_run_already_terminal")).view);
      continue;
    }

    const readings: Array<{ status: "ok" | "unknown"; contentHash: string | null; evidenceRef: string | null }> = [];
    for (const template of group) {
      const { view, contentHash } = await readTemplate(ctx, template, run.id);
      views.set(template.templateId, view);
      readings.push({ status: view.status, contentHash, evidenceRef: view.evidenceRef });
    }
    const summary = summarizeCaioSourceRun(readings);
    await completeObservationSourceRun({
      workspaceId: ctx.workspaceId, runId: run.id, observedAt: ctx.now, summaryHash: summary.summaryHash,
      completenessPercent: summary.completenessPercent, freshness: summary.freshness, outcome: summary.outcome,
      evidenceRefs: summary.evidenceRefs, errorCodes: summary.errorCodes, actorName: ACTOR_NAME,
    });
  }
  return views;
}

async function applyCandidateTransitions(input: {
  workspaceId: string;
  tickId: string;
  now: Date;
  run: CaioDetectorRunResult;
  detectors: readonly CaioDetector[];
  views: ReadonlyMap<string, CaioMetricObservationView>;
}) {
  const titles = new Map(input.detectors.map((detector) => [detector.detectorId, detector.title]));
  const attempt = () => db.$transaction(async (tx) => {
    const open = await tx.caioAnomalyCandidate.findMany({
      where: { workspaceId: input.workspaceId, status: "OPEN" },
      select: { id: true, detectorId: true, mergeKey: true },
    });
    const plan = planCaioCandidateTransitions({ run: input.run, openCandidates: open });
    let opened = 0;
    let refreshed = 0;
    for (const { detectorId, hit } of plan.upserts) {
      const evidenceRefsJson = JSON.stringify(hit.evidenceTemplateIds.map((id) => input.views.get(id)?.evidenceRef).filter(Boolean).sort());
      const existing = open.find((candidate) => candidate.detectorId === detectorId && candidate.mergeKey === hit.mergeKey);
      if (existing) {
        await tx.caioAnomalyCandidate.update({
          where: { id: existing.id },
          data: {
            hitCount: { increment: 1 }, lastSeenAt: input.now, severity: hit.severity, reasonCode: hit.reasonCode,
            objectKey: hit.objectKey, evidenceRefsJson, lastTickId: input.tickId,
          },
        });
        refreshed += 1;
      } else {
        const title = titles.get(detectorId) ?? { zh: detectorId, en: detectorId };
        await tx.caioAnomalyCandidate.create({
          data: {
            workspaceId: input.workspaceId, detectorId, mergeKey: hit.mergeKey, openKey: `${detectorId}:${hit.mergeKey}`,
            objectKey: hit.objectKey, severity: hit.severity, reasonCode: hit.reasonCode, titleZh: title.zh, titleEn: title.en,
            status: "OPEN", hitCount: 1, firstSeenAt: input.now, lastSeenAt: input.now, lastTickId: input.tickId, evidenceRefsJson,
          },
        });
        opened += 1;
      }
    }
    let cleared = 0;
    for (const { detectorId, mergeKey } of plan.clears) {
      const result = await tx.caioAnomalyCandidate.updateMany({
        where: { workspaceId: input.workspaceId, openKey: `${detectorId}:${mergeKey}`, status: "OPEN" },
        data: { status: "CLEARED", openKey: null, clearedAt: input.now },
      });
      cleared += result.count;
    }
    const hits: CaioContextHitRow[] = plan.upserts.map(({ detectorId, hit }) => ({
      detectorId, mergeKey: hit.mergeKey, objectKey: hit.objectKey, evidenceTemplateIds: [...hit.evidenceTemplateIds],
    }));
    return { opened, refreshed, cleared, hits };
  }, CANDIDATE_TRANSACTION_OPTIONS);
  // Serializable conflicts retry with bounded backoff; a unique violation means an overlapping bucket
  // opened the same merge key first, and the retry then refreshes that row instead.
  return runWithWriteConflictRetry(attempt, {
    maxAttempts: 4,
    retryDelayMs: 50,
    isConflict: (error) => isUniqueViolation(error) || isWriteConflictError(error),
  });
}

export async function runCaioQuickCheck(input: {
  workspaceId: string;
  now?: Date;
  templates?: readonly CaioMetricQueryTemplate[];
  detectors?: readonly CaioDetector[];
  templateTimeoutMs?: number;
}): Promise<CaioQuickCheckResult> {
  const now = input.now ?? new Date();
  const registered = input.templates && input.detectors ? null : getRegisteredCaioOperatingContext();
  const templates = input.templates ?? registered?.templates ?? [];
  const detectors = input.detectors ?? registered?.detectors ?? [];
  const bucketStart = caioQuickCheckBucketStart(now);
  const windowEnd = bucketStart;
  const windowStart = new Date(bucketStart.getTime() - BUCKET_MS);

  let tickId: string;
  try {
    tickId = (await db.caioQuickCheckTick.create({ data: { workspaceId: input.workspaceId, bucketStart } })).id;
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "claimed_elsewhere" };
    throw error;
  }

  try {
    const views = await observeSources({
      workspaceId: input.workspaceId, tickId, now, windowStart, windowEnd,
      executionKey: `caio-quick-check:${bucketStart.toISOString()}`,
      templateTimeoutMs: input.templateTimeoutMs ?? DEFAULT_TEMPLATE_TIMEOUT_MS,
    }, templates);
    const run = runCaioDetectors({ detectors, observations: views, now });
    const { hits, ...counts } = await applyCandidateTransitions({ workspaceId: input.workspaceId, tickId, now, run, detectors, views });
    const known = [...views.values()].filter((view) => view.status === "ok").length;
    let contextProjection: CaioQuickCheckContextProjection = "disabled";
    if (isCaioContextProjectionEnabled()) {
      // A projection failure never changes the quick-check outcome; it is reported on its own.
      contextProjection = await projectCaioQuickCheckContext({
        workspaceId: input.workspaceId, tickId, tickBucketStart: bucketStart, windowStart, asOf: now, hits,
      }).catch(() => "failed" as const);
    }
    const result = {
      status: "completed" as const, tickId, known, unknown: views.size - known, ...counts,
      skippedDetectors: run.skipped.length, failedDetectors: run.failed.length, contextProjection,
    };
    await db.caioQuickCheckTick.update({
      where: { id: tickId },
      data: {
        status: "COMPLETED", completedAt: new Date(),
        summaryJson: JSON.stringify({ ...result, status: undefined, tickId: undefined, skipped: run.skipped, failed: run.failed }),
      },
    });
    return result;
  } catch {
    await db.caioQuickCheckTick.update({
      where: { id: tickId },
      data: { status: "FAILED", completedAt: new Date(), summaryJson: JSON.stringify({ errorCode: "quick_check_failed" }) },
    }).catch(() => undefined);
    return {
      status: "failed", tickId, known: 0, unknown: 0, opened: 0, refreshed: 0, cleared: 0, skippedDetectors: 0, failedDetectors: 0,
      contextProjection: "disabled",
    };
  }
}
