import { db } from "@/lib/db";
import {
  ASK_HELM_SIGNAL_CANDIDATE_ACTION_TYPE,
  ASK_HELM_SIGNAL_CANDIDATE_TARGET_TYPE,
} from "@/features/search/ask-helm-signal-candidate";

export type AskHelmSignalCandidateAuditEntry = {
  candidateId: string;
  signalType: string;
  urgency: string;
  summary: string;
  createdAt: Date;
  actorName: string;
  relatedObjectType: string | null;
  relatedObjectId: string | null;
};

export async function loadRecentAskHelmSignalCandidatesForWorkspace(
  workspaceId: string,
  limit = 5,
): Promise<AskHelmSignalCandidateAuditEntry[]> {
  const rows = await db.auditLog.findMany({
    where: {
      workspaceId,
      actionType: ASK_HELM_SIGNAL_CANDIDATE_ACTION_TYPE,
      targetType: ASK_HELM_SIGNAL_CANDIDATE_TARGET_TYPE,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      targetId: true,
      summary: true,
      payload: true,
      createdAt: true,
      actor: true,
      relatedObjectType: true,
      relatedObjectId: true,
    },
  });

  return rows.map((row) => {
    let signalType = "other";
    let urgency = "normal";
    if (row.payload) {
      try {
        const parsed = JSON.parse(row.payload) as {
          signalType?: unknown;
          urgency?: unknown;
        };
        if (typeof parsed.signalType === "string") signalType = parsed.signalType;
        if (typeof parsed.urgency === "string") urgency = parsed.urgency;
      } catch {
        // AuditLog summary remains the user-visible fallback.
      }
    }

    return {
      candidateId: row.targetId,
      signalType,
      urgency,
      summary: row.summary,
      createdAt: row.createdAt,
      actorName: row.actor,
      relatedObjectType: row.relatedObjectType ?? null,
      relatedObjectId: row.relatedObjectId ?? null,
    };
  });
}
