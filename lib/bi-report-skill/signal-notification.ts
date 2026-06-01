import { db } from "@/lib/db";
import type { BiReportSignalNotificationRecord, BiReportSignalNotificationStatus } from "@/lib/bi-report-skill/types";
import { safeParseJson } from "@/lib/utils";

type BiReportSignalNotificationRow = {
  id: string;
  workspaceId: string;
  signalId: string;
  targetUserId: string | null;
  channel: string;
  targetKey: string;
  status: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type BiReportSignalNotificationDispatchRow = BiReportSignalNotificationRow & {
  signal: {
    id: string;
    workspaceId: string;
    skillKey: string;
    signalType: string;
    signalKey: string;
    title: string;
    summary: string;
    severity: string;
    ownerUserId: string | null;
    ownerUserName: string | null;
    ownerUserEmail: string | null;
    recommendedActionsJson: string | null;
  };
};

export type BiReportSignalNotificationDispatchCandidate =
  BiReportSignalNotificationRecord & {
    signal: {
      id: string;
      workspaceId: string;
      skillKey: string;
      signalType: string;
      signalKey: string;
      title: string;
      summary: string;
      severity: string;
      ownerUserId: string | null;
      ownerUserName: string | null;
      ownerUserEmail: string | null;
      recommendedActions: string[];
    };
  };

export async function createBiReportSignalNotification(input: {
  workspaceId: string;
  signalId: string;
  targetUserId?: string | null;
  channel: string;
  targetKey: string;
  status?: BiReportSignalNotificationStatus;
}): Promise<BiReportSignalNotificationRecord | null> {
  try {
    const row = await db.biReportSignalNotification.create({
      data: {
        id: crypto.randomUUID(),
        workspaceId: input.workspaceId,
        signalId: input.signalId,
        targetUserId: input.targetUserId ?? null,
        channel: input.channel,
        targetKey: input.targetKey,
        status: input.status ?? "pending",
      },
    });

    return mapBiReportSignalNotificationRow(row);
  } catch (error) {
    if (isMissingBiReportSignalNotificationTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function createBiReportSignalNotificationDeduped(input: {
  workspaceId: string;
  signalId: string;
  targetUserId?: string | null;
  channel: string;
  targetKey: string;
  status?: BiReportSignalNotificationStatus;
}): Promise<BiReportSignalNotificationRecord | null> {
  try {
    const existing = await db.biReportSignalNotification.findFirst({
      where: {
        workspaceId: input.workspaceId,
        signalId: input.signalId,
        channel: input.channel,
        targetKey: input.targetKey,
        status: { in: ["pending", "processing", "sent"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return mapBiReportSignalNotificationRow(existing);
    }
    return await createBiReportSignalNotification(input);
  } catch (error) {
    if (isMissingBiReportSignalNotificationTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function listRecentBiReportSignalNotifications(input: {
  workspaceId: string;
  signalId?: string;
  take?: number;
}): Promise<BiReportSignalNotificationRecord[]> {
  try {
    const rows = await db.biReportSignalNotification.findMany({
      where: {
        workspaceId: input.workspaceId,
        signalId: input.signalId ?? undefined,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: input.take ?? 10,
    });

    return rows.map(mapBiReportSignalNotificationRow);
  } catch (error) {
    if (isMissingBiReportSignalNotificationTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function listPendingBiReportSignalNotificationDispatchCandidates(input: {
  workspaceId: string;
  channel?: string;
  skillKey?: string;
  take?: number;
}): Promise<BiReportSignalNotificationDispatchCandidate[]> {
  try {
    const rows = await db.biReportSignalNotification.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: "pending",
        channel: input.channel ?? undefined,
        signal: input.skillKey
          ? {
              skillKey: input.skillKey,
            }
          : undefined,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: input.take ?? 20,
      select: {
        id: true,
        workspaceId: true,
        signalId: true,
        targetUserId: true,
        channel: true,
        targetKey: true,
        status: true,
        providerMessageId: true,
        errorMessage: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
        signal: {
          select: {
            id: true,
            workspaceId: true,
            skillKey: true,
            signalType: true,
            signalKey: true,
            title: true,
            summary: true,
            severity: true,
            ownerUserId: true,
            ownerUserName: true,
            ownerUserEmail: true,
            recommendedActionsJson: true,
          },
        },
      },
    });

    return rows.map(mapBiReportSignalNotificationDispatchRow);
  } catch (error) {
    if (isMissingBiReportSignalNotificationTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function listPendingBiReportSignalNotifications(input: {
  workspaceId: string;
  take?: number;
}): Promise<BiReportSignalNotificationRecord[]> {
  try {
    const rows = await db.biReportSignalNotification.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: "pending",
      },
      orderBy: {
        createdAt: "asc",
      },
      take: input.take ?? 100,
    });

    return rows.map(mapBiReportSignalNotificationRow);
  } catch (error) {
    if (isMissingBiReportSignalNotificationTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function claimBiReportSignalNotificationForDispatch(input: {
  id: string;
}): Promise<boolean> {
  const result = await db.biReportSignalNotification.updateMany({
    where: {
      id: input.id,
      status: "pending",
    },
    data: {
      status: "processing",
      errorMessage: null,
    },
  });

  return result.count === 1;
}

export async function markBiReportSignalNotificationSent(input: {
  id: string;
  providerMessageId?: string | null;
  sentAt?: Date;
}): Promise<BiReportSignalNotificationRecord | null> {
  try {
    const row = await db.biReportSignalNotification.update({
      where: {
        id: input.id,
      },
      data: {
        status: "sent",
        providerMessageId: input.providerMessageId ?? null,
        errorMessage: null,
        sentAt: input.sentAt ?? new Date(),
      },
    });

    return mapBiReportSignalNotificationRow(row);
  } catch (error) {
    if (isMissingBiReportSignalNotificationTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function markBiReportSignalNotificationFailed(input: {
  id: string;
  errorMessage: string;
}): Promise<BiReportSignalNotificationRecord | null> {
  try {
    const row = await db.biReportSignalNotification.update({
      where: {
        id: input.id,
      },
      data: {
        status: "failed",
        errorMessage: trimErrorMessage(input.errorMessage),
        providerMessageId: null,
        sentAt: null,
      },
    });

    return mapBiReportSignalNotificationRow(row);
  } catch (error) {
    if (isMissingBiReportSignalNotificationTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function updateBiReportSignalNotificationStatus(input: {
  id: string;
  status: BiReportSignalNotificationStatus;
  errorMessage?: string | null;
  providerMessageId?: string | null;
  sentAt?: Date | null;
}): Promise<BiReportSignalNotificationRecord | null> {
  try {
    const row = await db.biReportSignalNotification.update({
      where: {
        id: input.id,
      },
      data: {
        status: input.status,
        errorMessage: trimErrorMessage(input.errorMessage ?? null),
        providerMessageId: input.providerMessageId ?? null,
        sentAt: input.sentAt ?? null,
      },
    });

    return mapBiReportSignalNotificationRow(row);
  } catch (error) {
    if (isMissingBiReportSignalNotificationTableError(error)) {
      return null;
    }
    throw error;
  }
}

export function mapBiReportSignalNotificationRow(
  row: BiReportSignalNotificationRow,
): BiReportSignalNotificationRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    signalId: row.signalId,
    targetUserId: row.targetUserId,
    channel: row.channel,
    targetKey: row.targetKey,
    status: isNotificationStatus(row.status) ? row.status : "pending",
    providerMessageId: row.providerMessageId,
    errorMessage: row.errorMessage,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isNotificationStatus(value: string): value is BiReportSignalNotificationStatus {
  return value === "pending" || value === "processing" || value === "sent" || value === "failed";
}

function mapBiReportSignalNotificationDispatchRow(
  row: BiReportSignalNotificationDispatchRow,
): BiReportSignalNotificationDispatchCandidate {
  return {
    ...mapBiReportSignalNotificationRow(row),
    signal: {
      id: row.signal.id,
      workspaceId: row.signal.workspaceId,
      skillKey: row.signal.skillKey,
      signalType: row.signal.signalType,
      signalKey: row.signal.signalKey,
      title: row.signal.title,
      summary: row.signal.summary,
      severity: row.signal.severity,
      ownerUserId: row.signal.ownerUserId,
      ownerUserName: row.signal.ownerUserName,
      ownerUserEmail: row.signal.ownerUserEmail,
      recommendedActions: safeParseJson<string[]>(row.signal.recommendedActionsJson, []),
    },
  };
}

function trimErrorMessage(value?: string | null) {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return "BI report signal notification dispatch failed";
  }
  return normalized.length > 1000 ? normalized.slice(0, 1000) : normalized;
}

function isMissingBiReportSignalNotificationTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes(`relation "BiReportSignalNotification" does not exist`) ||
    message.includes("no such table: BiReportSignalNotification") ||
    message.includes("The table `bireportsignalnotification` does not exist") ||
    (message.includes("Table '") && message.includes("bireportsignalnotification' doesn't exist"))
  );
}
