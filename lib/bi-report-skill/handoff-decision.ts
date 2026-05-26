import { db } from "@/lib/db";
import type {
  BiReportBusinessHandoffDecisionRecord,
  BiReportBusinessHandoffDecisionStatus,
} from "@/lib/bi-report-skill/types";

type BiReportBusinessHandoffDecisionRow = {
  id: string;
  workspaceId: string;
  signalId: string;
  targetType: string;
  status: string;
  reviewedByUserId: string | null;
  reviewComment: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function createBiReportBusinessHandoffDecision(input: {
  workspaceId: string;
  signalId: string;
  targetType: string;
  status?: BiReportBusinessHandoffDecisionStatus;
  reviewedByUserId?: string | null;
  reviewComment?: string | null;
  reviewedAt?: Date | null;
}): Promise<BiReportBusinessHandoffDecisionRecord | null> {
  try {
    // Idempotency: avoid creating multiple parallel decisions for the same signal+targetType.
    // If a decision is already open/accepted, reuse it; if it is open and we are now accepting,
    // update in-place rather than inserting a new row.
    const requestedStatus = input.status ?? "open";
    const existingRows = (await db.biReportBusinessHandoffDecision.findMany({
      where: {
        workspaceId: input.workspaceId,
        signalId: input.signalId,
        targetType: input.targetType,
        status: { in: ["open", "accepted"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 1,
    })) ?? [];
    const existing = Array.isArray(existingRows) ? (existingRows[0] ?? null) : null;
    if (existing) {
      if (requestedStatus === "open") {
        return mapBiReportBusinessHandoffDecisionRow(existing);
      }

      if (requestedStatus === "accepted" && existing.status === "accepted") {
        return mapBiReportBusinessHandoffDecisionRow(existing);
      }

      if (existing.status !== requestedStatus) {
        const updated = await db.biReportBusinessHandoffDecision.update({
          where: { id: existing.id },
          data: {
            status: requestedStatus,
            reviewedByUserId: input.reviewedByUserId ?? existing.reviewedByUserId,
            reviewComment: input.reviewComment ?? existing.reviewComment,
            reviewedAt: input.reviewedAt ?? new Date(),
          },
        });
        return mapBiReportBusinessHandoffDecisionRow(updated);
      }
    }

    const row = await db.biReportBusinessHandoffDecision.create({
      data: {
        id: crypto.randomUUID(),
        workspaceId: input.workspaceId,
        signalId: input.signalId,
        targetType: input.targetType,
        status: requestedStatus,
        reviewedByUserId: input.reviewedByUserId ?? null,
        reviewComment: input.reviewComment ?? null,
        reviewedAt:
          requestedStatus !== "open"
            ? (input.reviewedAt ?? new Date())
            : (input.reviewedAt ?? null),
      },
    });

    return mapBiReportBusinessHandoffDecisionRow(row);
  } catch (error) {
    if (isMissingBiReportBusinessHandoffDecisionTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function listBiReportBusinessHandoffDecisions(input: {
  workspaceId: string;
  signalId?: string;
  status?: BiReportBusinessHandoffDecisionStatus;
  take?: number;
}): Promise<BiReportBusinessHandoffDecisionRecord[]> {
  try {
    const rows = await db.biReportBusinessHandoffDecision.findMany({
      where: {
        workspaceId: input.workspaceId,
        signalId: input.signalId ?? undefined,
        status: input.status ?? undefined,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: input.take ?? 20,
    });

    return rows.map(mapBiReportBusinessHandoffDecisionRow);
  } catch (error) {
    if (isMissingBiReportBusinessHandoffDecisionTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function updateBiReportBusinessHandoffDecision(input: {
  id: string;
  status: Exclude<BiReportBusinessHandoffDecisionStatus, "open">;
  reviewedByUserId?: string | null;
  reviewComment?: string | null;
}): Promise<BiReportBusinessHandoffDecisionRecord | null> {
  try {
    const row = await db.biReportBusinessHandoffDecision.update({
      where: {
        id: input.id,
      },
      data: {
        status: input.status,
        reviewedByUserId: input.reviewedByUserId ?? null,
        reviewComment: input.reviewComment ?? null,
        reviewedAt: new Date(),
      },
    });

    return mapBiReportBusinessHandoffDecisionRow(row);
  } catch (error) {
    if (isMissingBiReportBusinessHandoffDecisionTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function dismissOpenBiReportBusinessHandoffDecisionsForSignal(input: {
  workspaceId: string;
  signalId: string;
  reviewedByUserId?: string | null;
  reviewComment?: string | null;
}): Promise<number> {
  try {
    const result = await db.biReportBusinessHandoffDecision.updateMany({
      where: {
        workspaceId: input.workspaceId,
        signalId: input.signalId,
        status: "open",
      },
      data: {
        status: "dismissed",
        reviewedByUserId: input.reviewedByUserId ?? null,
        reviewComment: input.reviewComment ?? "信号已关闭，本 handoff 不再需要进入审批。",
        reviewedAt: new Date(),
      },
    });

    return result.count;
  } catch (error) {
    if (isMissingBiReportBusinessHandoffDecisionTableError(error)) {
      return 0;
    }
    throw error;
  }
}

export function mapBiReportBusinessHandoffDecisionRow(
  row: BiReportBusinessHandoffDecisionRow,
): BiReportBusinessHandoffDecisionRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    signalId: row.signalId,
    targetType: row.targetType,
    status: isHandoffDecisionStatus(row.status) ? row.status : "open",
    reviewedByUserId: row.reviewedByUserId,
    reviewComment: row.reviewComment,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isHandoffDecisionStatus(value: string): value is BiReportBusinessHandoffDecisionStatus {
  return value === "open" || value === "accepted" || value === "dismissed";
}

function isMissingBiReportBusinessHandoffDecisionTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes(`relation "BiReportBusinessHandoffDecision" does not exist`) ||
    message.includes("no such table: BiReportBusinessHandoffDecision") ||
    message.includes("The table `bireportbusinesshandoffdecision` does not exist") ||
    (message.includes("Table '") && message.includes("bireportbusinesshandoffdecision' doesn't exist"))
  );
}
