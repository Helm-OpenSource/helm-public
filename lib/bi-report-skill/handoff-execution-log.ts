import { db } from "@/lib/db";
import type {
  BiReportHandoffExecutionLogRecord,
  BiReportHandoffExecutionLogStage,
} from "@/lib/bi-report-skill/types";

type BiReportHandoffExecutionLogRow = {
  id: string;
  workspaceId: string;
  signalId: string;
  decisionId: string;
  actionItemId: string | null;
  approvalTaskId: string | null;
  stage: string;
  authorUserId: string;
  summary: string;
  detailsJson: string | null;
  isEffective: boolean | null;
  followUpNeeded: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function createBiReportHandoffExecutionLog(input: {
  workspaceId: string;
  signalId: string;
  decisionId: string;
  actionItemId?: string | null;
  approvalTaskId?: string | null;
  stage: BiReportHandoffExecutionLogStage;
  authorUserId: string;
  summary: string;
  details?: Record<string, unknown> | null;
  isEffective?: boolean | null;
  followUpNeeded?: boolean | null;
}): Promise<BiReportHandoffExecutionLogRecord | null> {
  try {
    const delegate = getBiReportHandoffExecutionLogDelegate();
    if (!delegate) {
      return null;
    }

    // Idempotency: avoid duplicate execution logs when the same receipt is posted/replayed.
    // (No schema change, so we approximate with a strict equality match on key fields.)
    const existing = (await delegate.findMany({
      where: {
        workspaceId: input.workspaceId,
        signalId: input.signalId,
        decisionId: input.decisionId,
        stage: input.stage,
        authorUserId: input.authorUserId,
        summary: input.summary,
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    })) ?? [];
    const latest = Array.isArray(existing) ? (existing[0] ?? null) : null;
    if (latest) {
      return mapBiReportHandoffExecutionLogRow(latest);
    }

    const row = await delegate.create({
      data: {
        id: crypto.randomUUID(),
        workspaceId: input.workspaceId,
        signalId: input.signalId,
        decisionId: input.decisionId,
        actionItemId: input.actionItemId ?? null,
        approvalTaskId: input.approvalTaskId ?? null,
        stage: input.stage,
        authorUserId: input.authorUserId,
        summary: input.summary,
        detailsJson: input.details ? JSON.stringify(input.details) : null,
        isEffective: input.isEffective ?? null,
        followUpNeeded: input.followUpNeeded ?? null,
      },
    });

    return mapBiReportHandoffExecutionLogRow(row);
  } catch (error) {
    if (isMissingBiReportHandoffExecutionLogTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function listBiReportHandoffExecutionLogs(input: {
  workspaceId: string;
  signalId?: string;
  decisionId?: string;
  stage?: BiReportHandoffExecutionLogStage;
  take?: number;
}): Promise<BiReportHandoffExecutionLogRecord[]> {
  try {
    const delegate = getBiReportHandoffExecutionLogDelegate();
    if (!delegate) {
      return [];
    }

    const rows = await delegate.findMany({
      where: {
        workspaceId: input.workspaceId,
        signalId: input.signalId ?? undefined,
        decisionId: input.decisionId ?? undefined,
        stage: input.stage ?? undefined,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: input.take ?? 20,
    });

    return rows.map(mapBiReportHandoffExecutionLogRow);
  } catch (error) {
    if (isMissingBiReportHandoffExecutionLogTableError(error)) {
      return [];
    }
    throw error;
  }
}

export function mapBiReportHandoffExecutionLogRow(
  row: BiReportHandoffExecutionLogRow,
): BiReportHandoffExecutionLogRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    signalId: row.signalId,
    decisionId: row.decisionId,
    actionItemId: row.actionItemId,
    approvalTaskId: row.approvalTaskId,
    stage: isExecutionLogStage(row.stage) ? row.stage : "plan",
    authorUserId: row.authorUserId,
    summary: row.summary,
    details: safeParseDetails(row.detailsJson),
    isEffective: row.isEffective,
    followUpNeeded: row.followUpNeeded,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isExecutionLogStage(value: string): value is BiReportHandoffExecutionLogStage {
  return value === "plan" || value === "result";
}

function safeParseDetails(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function isMissingBiReportHandoffExecutionLogTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes(`relation "BiReportHandoffExecutionLog" does not exist`) ||
    message.includes("no such table: BiReportHandoffExecutionLog") ||
    message.includes("The table `bireporthandoffexecutionlog` does not exist") ||
    (message.includes("Table '") && message.includes("bireporthandoffexecutionlog' doesn't exist"))
  );
}

function getBiReportHandoffExecutionLogDelegate() {
  const candidate = (db as unknown as Record<string, unknown>).biReportHandoffExecutionLog;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const delegate = candidate as {
    create: (input: unknown) => Promise<BiReportHandoffExecutionLogRow>;
    findMany: (input: unknown) => Promise<BiReportHandoffExecutionLogRow[]>;
  };

  if (typeof delegate.create !== "function" || typeof delegate.findMany !== "function") {
    return null;
  }

  return delegate;
}
