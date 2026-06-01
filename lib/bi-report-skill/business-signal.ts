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
 * Dedupe + refresh live signals (no schema change):
 *
 * - severity === "CLEAR": produces no signal row (no anomaly → no incident to track)
 * - same (workspaceId, signalKey) within a live status (open / triaged / actioned) is treated as
 *   the same ongoing incident; refresh the existing row instead of inserting a second
 * - severity === "CLEAR" produces no signal row (CLEAR means no anomaly → no incident to track)
 * - same (workspaceId, signalKey, severity) within a live status (open / triaged / actioned) is treated as
 *   a duplicate observation; we refresh the existing row instead of inserting a second
 *
 * This lets the job be retried safely without unbounded fan-out of duplicate open signals.
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
    // Dedupe: if a live row with the same (workspace, signalKey) exists, refresh it.
    const existingLive = await db.biReportBusinessSignal.findFirst({
      where: {
        workspaceId: input.workspaceId,
        signalKey: input.signalKey,
        // Idempotency across retries: treat (workspaceId, signalKey) as the incident key.
        // Severity may change after upstream fixes / baseline shifts; we refresh in-place instead
        // of creating a second live signal row with a different severity.
        status: { in: ["open", "triaged", "actioned"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingLive) {
      const refreshed = await db.biReportBusinessSignal.update({
        where: { id: existingLive.id },
        data: {
          sourceRunId: input.sourceRunId,
          title: input.title,
          summary: input.summary,
          severity: input.severity,
          continuityStatus: input.continuityStatus ?? existingLive.continuityStatus ?? null,
          dimensionsJson: stringifyJson(input.dimensions ?? null),
          metricsJson: stringifyJson(input.metrics ?? null),
          evidenceJson: stringifyJson(input.evidence ?? null),
          recommendedActionsJson: stringifyJson(input.recommendedActions ?? []),
          ownerUserId: input.ownerUserId ?? existingLive.ownerUserId,
          ownerUserName: input.ownerUserName ?? existingLive.ownerUserName,
          ownerUserEmail: input.ownerUserEmail ?? existingLive.ownerUserEmail,
        },
      });
      const refreshedSignal = mapBiReportBusinessSignalRow(refreshed);
      await syncBiReportSignalToOperatingClosure({
        signal: refreshedSignal,
        extensionKey: input.extensionKey ?? null,
        signalRouting: input.signalRouting,
      });
      return refreshedSignal;
    }

    const row = await db.biReportBusinessSignal.create({
      data: {
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
    });

    const createdSignal = mapBiReportBusinessSignalRow(row);
    await syncBiReportSignalToOperatingClosure({
      signal: createdSignal,
      extensionKey: input.extensionKey ?? null,
      signalRouting: input.signalRouting,
    });
    return createdSignal;
  } catch (error) {
    if (isMissingBiReportBusinessSignalTableError(error)) {
      return null;
    }
    throw error;
  }
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
