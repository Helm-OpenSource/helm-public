import { db } from "@/lib/db";
import type {
  PreparedBiReportDryRun,
  BiReportBusinessSignalRecord,
  BiReportBusinessSignalStatus,
  BiReportContinuityStatus,
  BiReportSeverity,
  BiReportSignalRoutingConfig,
} from "@/lib/bi-report-skill/types";
import { syncBiReportSignalToOperatingClosure } from "@/lib/bi-report-skill/operating-closure-kernel";
import { dismissOpenBiReportBusinessHandoffDecisionsForSignal } from "@/lib/bi-report-skill/handoff-decision";

type BiReportBusinessSignalRow = {
  id: string;
  workspaceId: string;
  sourceRunId: string;
  skillKey: string;
  signalType: string;
  signalKey: string;
  title: string;
  summary: string;
  severity: BiReportSeverity;
  continuityStatus: string | null;
  dimensionsJson: string | null;
  metricsJson: string | null;
  evidenceJson: string | null;
  recommendedActionsJson: string | null;
  status: string;
  ownerUserId: string | null;
  ownerUserName: string | null;
  ownerUserEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Persist one lifecycle row per `(workspaceId, signalKey)`.
 *
 * Repeated observations refresh mutable evidence while lifecycle fields remain
 * owned by their dedicated transition paths. The compound-key upsert also makes
 * concurrent retries safe from the former find-then-create race.
 */

export async function createBiReportBusinessSignal(input: {
  workspaceId: string;
  sourceRunId: string;
  extensionKey?: string | null;
  skillKey: string;
  signalType: string;
  signalKey: string;
  title: string;
  summary: string;
  severity: BiReportSeverity;
  continuityStatus?: BiReportContinuityStatus | null;
  dimensions?: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  evidence?: Record<string, unknown> | null;
  recommendedActions?: string[];
  status?: BiReportBusinessSignalStatus;
  ownerUserId?: string | null;
  ownerUserName?: string | null;
  ownerUserEmail?: string | null;
  signalRouting?: BiReportSignalRoutingConfig;
}): Promise<BiReportBusinessSignalRecord | null> {
  if (input.severity === "CLEAR") {
    // CLEAR means no anomaly; do not pollute the signal table.
    return null;
  }

  try {
    const row = await db.biReportBusinessSignal.upsert({
      where: {
        workspaceId_signalKey: {
          workspaceId: input.workspaceId,
          signalKey: input.signalKey,
        },
      },
      create: {
        id: crypto.randomUUID(),
        workspaceId: input.workspaceId,
        sourceRunId: input.sourceRunId,
        skillKey: input.skillKey,
        signalType: input.signalType,
        signalKey: input.signalKey,
        title: input.title,
        summary: input.summary,
        severity: input.severity,
        continuityStatus: input.continuityStatus ?? null,
        dimensionsJson: stringifyJson(input.dimensions ?? null),
        metricsJson: stringifyJson(input.metrics ?? null),
        evidenceJson: stringifyJson(input.evidence ?? null),
        recommendedActionsJson: stringifyJson(input.recommendedActions ?? []),
        status: input.status ?? "open",
        ownerUserId: input.ownerUserId ?? null,
        ownerUserName: input.ownerUserName ?? null,
        ownerUserEmail: input.ownerUserEmail ?? null,
      },
      update: {
        sourceRunId: input.sourceRunId,
        title: input.title,
        summary: input.summary,
        severity: input.severity,
        ...(input.continuityStatus != null
          ? { continuityStatus: input.continuityStatus }
          : {}),
        dimensionsJson: stringifyJson(input.dimensions ?? null),
        metricsJson: stringifyJson(input.metrics ?? null),
        evidenceJson: stringifyJson(input.evidence ?? null),
        recommendedActionsJson: stringifyJson(input.recommendedActions ?? []),
        ...(input.ownerUserId != null ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.ownerUserName != null ? { ownerUserName: input.ownerUserName } : {}),
        ...(input.ownerUserEmail != null ? { ownerUserEmail: input.ownerUserEmail } : {}),
      },
    });

    const persistedSignal = mapBiReportBusinessSignalRow(row);
    await syncBiReportSignalToOperatingClosure({
      signal: persistedSignal,
      extensionKey: input.extensionKey ?? null,
      signalRouting: input.signalRouting,
    });
    return persistedSignal;
  } catch (error) {
    if (isMissingBiReportBusinessSignalTableError(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Column set written by the batch upsert. `id`, `createdAt`, `updatedAt` are
 * managed by the statement itself (id via app-generated UUID on INSERT;
 * timestamps via table defaults / ON UPDATE), so they are NOT in this list.
 *
 * Order here is the single source of truth for both the VALUES tuple and the
 * ON DUPLICATE KEY UPDATE clause below — keep them aligned.
 */
const BATCH_UPSERT_COLUMNS = [
  "workspaceId",
  "sourceRunId",
  "skillKey",
  "signalType",
  "signalKey",
  "title",
  "summary",
  "severity",
  "continuityStatus",
  "dimensionsJson",
  "metricsJson",
  "evidenceJson",
  "recommendedActionsJson",
  "status",
  "ownerUserId",
  "ownerUserName",
  "ownerUserEmail",
] as const;

/**
 * Mutable columns refreshed on a duplicate-key hit. This mirrors the in-place
 * refresh semantics of `createBiReportBusinessSignal` (the find-then-update
 * path): a re-run of the same incident (same `(workspaceId, signalKey)`)
 * UPDATEs the live row instead of inserting a second one.
 *
 * Deliberately excluded from the UPDATE set (INSERT-only / immutable):
 *  - `workspaceId`, `signalKey`  — the dedup identity; part of the unique key.
 *  - `skillKey`, `signalType`, `status` — identity/lifecycle columns that the
 *    single-row path also never rewrites on refresh (status transitions are
 *    owned by advanceBiReportBusinessSignalStatus, not the persist path).
 */
const BATCH_UPSERT_UPDATE_COLUMNS = [
  "sourceRunId",
  "title",
  "summary",
  "severity",
  "continuityStatus",
  "dimensionsJson",
  "metricsJson",
  "evidenceJson",
  "recommendedActionsJson",
  "ownerUserId",
  "ownerUserName",
  "ownerUserEmail",
] as const;

const DEFAULT_BATCH_UPSERT_CHUNK_SIZE = 500;
const BATCH_UPSERT_PRESERVE_ON_NULL_COLUMNS = new Set<
  (typeof BATCH_UPSERT_UPDATE_COLUMNS)[number]
>(["continuityStatus", "ownerUserId", "ownerUserName", "ownerUserEmail"]);

export type CreateBiReportBusinessSignalInput = Parameters<typeof createBiReportBusinessSignal>[0];

export type CreateBiReportBusinessSignalsBatchResult = {
  /** Distinct logical identities sent to an upsert statement. */
  persisted: number;
  /** Inputs dropped before the write (severity === "CLEAR"). */
  skippedClear: number;
  /** True when the table is absent (missing-table error swallowed, matching the single-row path). */
  tableMissing: boolean;
};

/**
 * Batch variant of {@link createBiReportBusinessSignal} for high-fan-out jobs.
 * It replaces per-row persistence round trips with bounded, chunked
 * `INSERT ... ON DUPLICATE KEY UPDATE` statements.
 *
 * IDEMPOTENCY / REFRESH SEMANTICS (identical to the single-row path):
 *  - Requires the `(workspaceId, signalKey)` UNIQUE key so a
 *    re-run of the same incident collides on the key and UPDATEs the live row
 *    in place — a re-run REFRESHES, it does not skip and does not duplicate.
 *    (This is why we use ON DUPLICATE KEY UPDATE, NOT createMany +
 *    skipDuplicates, which would silently drop the refresh.)
 *  - severity === "CLEAR" produces no row (same as the single-row path).
 *
 * SIDE EFFECTS: the operating-closure sync (`syncBiReportSignalToOperatingClosure`)
 * is still run once per persisted signal AFTER the batch write, preserving the
 * routing / notification / action-item closure behavior of the single-row path.
 * The batch only optimizes the persistence round trips, not the closure fan-out.
 *
 * ACTIVATION BOUNDARY: callers must not use this path until historical duplicate
 * logical keys are reconciled and the unique constraint is present.
 */
export async function createBiReportBusinessSignalsBatch(
  inputs: CreateBiReportBusinessSignalInput[],
  options?: { chunkSize?: number },
): Promise<CreateBiReportBusinessSignalsBatchResult> {
  let skippedClear = 0;
  const writableByIdentity = new Map<string, CreateBiReportBusinessSignalInput>();
  for (const input of inputs) {
    if (input.severity === "CLEAR") {
      skippedClear += 1;
      continue;
    }
    writableByIdentity.set(JSON.stringify([input.workspaceId, input.signalKey]), input);
  }
  const writable = [...writableByIdentity.values()];

  const result: CreateBiReportBusinessSignalsBatchResult = {
    persisted: 0,
    skippedClear,
    tableMissing: false,
  };

  if (writable.length === 0) {
    return result;
  }

  const chunkSize = normalizeChunkSize(options?.chunkSize);

  // Rows we successfully wrote, paired with the routing context needed for the
  // post-write closure sync. Re-read from the DB so downstream closure logic
  // sees the canonical persisted row (including server timestamps).
  const persistedKeys: Array<{
    workspaceId: string;
    signalKey: string;
    extensionKey: string | null;
    signalRouting: CreateBiReportBusinessSignalInput["signalRouting"];
  }> = [];

  try {
    for (let start = 0; start < writable.length; start += chunkSize) {
      const chunk = writable.slice(start, start + chunkSize);
      await executeBatchUpsertChunk(chunk);
      for (const input of chunk) {
        persistedKeys.push({
          workspaceId: input.workspaceId,
          signalKey: input.signalKey,
          extensionKey: input.extensionKey ?? null,
          signalRouting: input.signalRouting,
        });
      }
    }
  } catch (error) {
    if (isMissingBiReportBusinessSignalTableError(error)) {
      return { persisted: 0, skippedClear, tableMissing: true };
    }
    throw error;
  }

  result.persisted = persistedKeys.length;

  // Post-write closure sync, once per persisted signal (matches single-row path).
  for (const key of persistedKeys) {
    const row = await db.biReportBusinessSignal.findUnique({
      where: {
        workspaceId_signalKey: {
          workspaceId: key.workspaceId,
          signalKey: key.signalKey,
        },
      },
    });
    if (!row) {
      continue;
    }
    await syncBiReportSignalToOperatingClosure({
      signal: mapBiReportBusinessSignalRow(row),
      extensionKey: key.extensionKey,
      signalRouting: key.signalRouting,
    });
  }

  return result;
}

function normalizeChunkSize(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 1) {
    return DEFAULT_BATCH_UPSERT_CHUNK_SIZE;
  }
  return Math.min(raw, DEFAULT_BATCH_UPSERT_CHUNK_SIZE);
}

async function executeBatchUpsertChunk(chunk: CreateBiReportBusinessSignalInput[]): Promise<void> {
  const columns = BATCH_UPSERT_COLUMNS;
  // Each row is `id` + the shared column set. id is app-generated (matches the
  // single-row path's crypto.randomUUID()) so fresh inserts get a stable UUID.
  const placeholdersPerRow = `(${["?", ...columns.map(() => "?")].join(", ")})`;
  const values: unknown[] = [];

  for (const input of chunk) {
    values.push(crypto.randomUUID());
    values.push(input.workspaceId);
    values.push(input.sourceRunId);
    values.push(input.skillKey);
    values.push(input.signalType);
    values.push(input.signalKey);
    values.push(input.title);
    values.push(input.summary);
    values.push(input.severity);
    values.push(input.continuityStatus ?? null);
    values.push(stringifyJson(input.dimensions ?? null));
    values.push(stringifyJson(input.metrics ?? null));
    values.push(stringifyJson(input.evidence ?? null));
    values.push(stringifyJson(input.recommendedActions ?? []));
    values.push(input.status ?? "open");
    values.push(input.ownerUserId ?? null);
    values.push(input.ownerUserName ?? null);
    values.push(input.ownerUserEmail ?? null);
  }

  const insertColumns = ["id", ...columns].map((column) => `\`${column}\``).join(", ");
  const rowPlaceholders = chunk.map(() => placeholdersPerRow).join(", ");
  const updateClause = BATCH_UPSERT_UPDATE_COLUMNS.map((column) => {
    if (BATCH_UPSERT_PRESERVE_ON_NULL_COLUMNS.has(column)) {
      return `\`${column}\` = COALESCE(VALUES(\`${column}\`), \`${column}\`)`;
    }
    return `\`${column}\` = VALUES(\`${column}\`)`;
  }).join(", ");

  const sql =
    `INSERT INTO \`bireportbusinesssignal\` (${insertColumns}) ` +
    `VALUES ${rowPlaceholders} ` +
    `ON DUPLICATE KEY UPDATE ${updateClause}`;

  await db.$executeRawUnsafe(sql, ...values);
}

export function buildBiReportBusinessSignalInput(input: {
  workspaceId: string;
  sourceRunId: string;
  extensionKey?: string | null;
  prepared: PreparedBiReportDryRun;
  queryWarnings?: string[];
  ownerUserId?: string | null;
  ownerUserName?: string | null;
  ownerUserEmail?: string | null;
}) {
  const metricMap = Object.fromEntries(
    input.prepared.computed.summaryMetrics.map((metric) => [metric.key, metric.value]),
  );

  return {
    workspaceId: input.workspaceId,
    sourceRunId: input.sourceRunId,
    extensionKey: input.extensionKey ?? null,
    skillKey: input.prepared.skill.manifest.skillKey,
    signalType: `${input.prepared.skill.manifest.skillKey}.anomaly`,
    signalKey: `${input.prepared.skill.manifest.skillKey}:${input.prepared.windowLabel}`,
    title: input.prepared.analysis.headline,
    summary: input.prepared.analysis.summary,
    severity: input.prepared.evaluation.severity,
    continuityStatus: input.prepared.recentRunContext.continuityStatus,
    dimensions: {
      windowLabel: input.prepared.windowLabel,
      matchedRuleCount: input.prepared.evaluation.matchedRules.length,
    },
    metrics: {
      summaryMetrics: metricMap,
      rowCount: input.prepared.rows.length,
    },
    evidence: {
      findings: input.prepared.analysis.findings,
      topFindings: input.prepared.evaluation.topFindings,
      matchedRuleIds: input.prepared.evaluation.matchedRules.map((rule) => rule.id),
      queryWarnings: input.queryWarnings ?? [],
    },
    recommendedActions: input.prepared.analysis.recommendedActions,
    ownerUserId: input.ownerUserId ?? null,
    ownerUserName: input.ownerUserName ?? null,
    ownerUserEmail: input.ownerUserEmail ?? null,
    signalRouting: input.prepared.subscription.signalRouting,
  } satisfies Parameters<typeof createBiReportBusinessSignal>[0];
}

export async function listRecentBiReportBusinessSignals(input: {
  workspaceId: string;
  skillKey?: string;
  status?: BiReportBusinessSignalStatus;
  take?: number;
}): Promise<BiReportBusinessSignalRecord[]> {
  try {
    const rows = await db.biReportBusinessSignal.findMany({
      where: {
        workspaceId: input.workspaceId,
        skillKey: input.skillKey ?? undefined,
        status: input.status ?? undefined,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: input.take ?? 10,
    });

    return rows.map(mapBiReportBusinessSignalRow);
  } catch (error) {
    if (isMissingBiReportBusinessSignalTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function getBiReportBusinessSignalById(input: {
  id: string;
  workspaceId: string;
}): Promise<BiReportBusinessSignalRecord | null> {
  try {
    const row = await db.biReportBusinessSignal.findFirst({
      where: {
        id: input.id,
        workspaceId: input.workspaceId,
      },
    });

    return row ? mapBiReportBusinessSignalRow(row) : null;
  } catch (error) {
    if (isMissingBiReportBusinessSignalTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function advanceBiReportBusinessSignalStatus(input: {
  id: string;
  workspaceId: string;
  status: BiReportBusinessSignalStatus;
}): Promise<BiReportBusinessSignalRecord | null> {
  try {
    const existing = await db.biReportBusinessSignal.findFirst({
      where: {
        id: input.id,
        workspaceId: input.workspaceId,
      },
    });
    if (!existing) {
      return null;
    }

    const current = mapBiReportBusinessSignalRow(existing);
    const nextStatus = resolveBusinessSignalStatusTransition(current.status, input.status);
    if (nextStatus === current.status) {
      if (isTerminalBusinessSignalStatus(nextStatus)) {
        await dismissOpenBiReportBusinessHandoffDecisionsForSignal({
          workspaceId: input.workspaceId,
          signalId: existing.id,
        });
      }
      return current;
    }

    const row = await db.biReportBusinessSignal.update({
      where: {
        id: existing.id,
      },
      data: {
        status: nextStatus,
      },
    });

    if (isTerminalBusinessSignalStatus(nextStatus)) {
      await dismissOpenBiReportBusinessHandoffDecisionsForSignal({
        workspaceId: input.workspaceId,
        signalId: existing.id,
      });
    }

    return mapBiReportBusinessSignalRow(row);
  } catch (error) {
    if (isMissingBiReportBusinessSignalTableError(error)) {
      return null;
    }
    throw error;
  }
}

export function mapBiReportBusinessSignalRow(row: BiReportBusinessSignalRow): BiReportBusinessSignalRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    sourceRunId: row.sourceRunId,
    skillKey: row.skillKey,
    signalType: row.signalType,
    signalKey: row.signalKey,
    title: row.title,
    summary: row.summary,
    severity: row.severity,
    continuityStatus: isContinuityStatus(row.continuityStatus) ? row.continuityStatus : null,
    dimensions: safeParseJson<Record<string, unknown> | null>(row.dimensionsJson, null),
    metrics: safeParseJson<Record<string, unknown> | null>(row.metricsJson, null),
    evidence: safeParseJson<Record<string, unknown> | null>(row.evidenceJson, null),
    recommendedActions: safeParseJson<string[]>(row.recommendedActionsJson, []),
    status: isBusinessSignalStatus(row.status) ? row.status : "open",
    ownerUserId: row.ownerUserId,
    ownerUserName: row.ownerUserName,
    ownerUserEmail: row.ownerUserEmail,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function resolveBusinessSignalStatusTransition(
  current: BiReportBusinessSignalStatus,
  requested: BiReportBusinessSignalStatus,
): BiReportBusinessSignalStatus {
  if (current === "resolved") {
    return current;
  }
  if (current === "dismissed") {
    return current;
  }
  if (requested === "dismissed" && current === "actioned") {
    return current;
  }

  const rank: Record<BiReportBusinessSignalStatus, number> = {
    open: 0,
    triaged: 1,
    actioned: 2,
    resolved: 3,
    dismissed: 1,
  };

  return rank[requested] >= rank[current] ? requested : current;
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function stringifyJson(value: unknown) {
  return value == null ? null : JSON.stringify(value);
}

function isContinuityStatus(value: string | null): value is BiReportContinuityStatus {
  return value === "first_seen" || value === "recurring" || value === "worsening" || value === "recovering";
}

function isBusinessSignalStatus(value: string): value is BiReportBusinessSignalStatus {
  return value === "open" || value === "triaged" || value === "actioned" || value === "resolved" || value === "dismissed";
}

function isTerminalBusinessSignalStatus(status: BiReportBusinessSignalStatus) {
  return status === "actioned" || status === "resolved" || status === "dismissed";
}

function isMissingBiReportBusinessSignalTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes(`relation "BiReportBusinessSignal" does not exist`) ||
    message.includes("no such table: BiReportBusinessSignal") ||
    message.includes("The table `bireportbusinesssignal` does not exist") ||
    (message.includes("Table '") && message.includes("bireportbusinesssignal' doesn't exist"))
  );
}
