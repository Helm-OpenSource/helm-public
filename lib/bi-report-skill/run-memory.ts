import { db } from "@/lib/db";
import { isMissingTableError } from "@/lib/bi-report-skill/missing-table-error";
import type {
  BiReportContinuityStatus,
  BiReportRunMemoryEntry,
  BiReportSeverity,
  BiReportSummaryMetric,
} from "@/lib/bi-report-skill/types";

type BiReportRunMemoryRow = {
  id: string;
  workspaceId: string;
  extensionKey: string | null;
  skillKey: string;
  skillVersion: string;
  windowLabel: string;
  severity: BiReportSeverity | null;
  shouldSend: boolean;
  summaryMetricsJson: string;
  topFindingsJson: string;
  analysisSummary: string;
  continuityStatus: string | null;
  historicalContext: string | null;
  createdAt: Date;
};

export async function listRecentBiReportRunMemories(input: {
  workspaceId: string;
  extensionKey?: string | null;
  skillKey: string;
  take?: number;
}): Promise<BiReportRunMemoryEntry[]> {
  try {
    const rows = await db.biReportRunMemory.findMany({
      where: {
        workspaceId: input.workspaceId,
        skillKey: input.skillKey,
        extensionKey: input.extensionKey ?? undefined,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: input.take ?? 5,
    });

    return rows.map(mapBiReportRunMemoryRow);
  } catch (error) {
    if (isMissingBiReportRunMemoryTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function recordBiReportRunMemory(input: {
  workspaceId: string;
  extensionKey?: string | null;
  skillKey: string;
  skillVersion: string;
  windowLabel: string;
  severity: BiReportSeverity;
  shouldSend: boolean;
  summaryMetrics: BiReportSummaryMetric[];
  topFindings: string[];
  analysisSummary: string;
  continuityStatus: BiReportContinuityStatus;
  historicalContext?: string | null;
}) {
  try {
    await db.biReportRunMemory.create({
      data: {
        id: crypto.randomUUID(),
        workspaceId: input.workspaceId,
        extensionKey: input.extensionKey ?? null,
        skillKey: input.skillKey,
        skillVersion: input.skillVersion,
        windowLabel: input.windowLabel,
        severity: input.severity,
        shouldSend: input.shouldSend,
        summaryMetricsJson: JSON.stringify(input.summaryMetrics),
        topFindingsJson: JSON.stringify(input.topFindings),
        analysisSummary: input.analysisSummary,
        continuityStatus: input.continuityStatus,
        historicalContext: input.historicalContext ?? null,
      },
    });
  } catch (error) {
    if (isMissingBiReportRunMemoryTableError(error)) {
      return;
    }
    throw error;
  }
}

function mapBiReportRunMemoryRow(row: BiReportRunMemoryRow): BiReportRunMemoryEntry {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    extensionKey: row.extensionKey,
    skillKey: row.skillKey,
    skillVersion: row.skillVersion,
    windowLabel: row.windowLabel,
    severity: row.severity,
    shouldSend: row.shouldSend,
    summaryMetrics: safeParseJson<BiReportSummaryMetric[]>(row.summaryMetricsJson, []),
    topFindings: safeParseJson<string[]>(row.topFindingsJson, []),
    analysisSummary: row.analysisSummary,
    continuityStatus: isContinuityStatus(row.continuityStatus) ? row.continuityStatus : null,
    historicalContext: row.historicalContext,
    createdAt: row.createdAt.toISOString(),
  };
}

function safeParseJson<T>(raw: string, fallback: T) {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isContinuityStatus(value: string | null): value is BiReportContinuityStatus {
  return value === "first_seen" || value === "recurring" || value === "worsening" || value === "recovering";
}

function isMissingBiReportRunMemoryTableError(error: unknown) {
  return isMissingTableError(error);
}
