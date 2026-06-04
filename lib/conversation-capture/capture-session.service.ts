import {
  ActorType,
  CaptureProcessingStatus,
  CaptureSessionStatus,
  CaptureSourceType,
  ConversationInsightType,
  ObjectType,
  SourceType,
} from "@prisma/client";
import { differenceInSeconds } from "date-fns";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { assertWorkspaceCaptureServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { processConversationCapture } from "@/lib/conversation-capture/conversation-understanding.service";
import { safeParseJson } from "@/lib/utils";

type RecommendationRefreshObjectType = "MEETING" | "CONTACT" | "COMPANY" | "OPPORTUNITY";

type CaptureActorInput = {
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  english?: boolean;
  sourcePage?: string;
};

export type StartCaptureSessionInput = CaptureActorInput & {
  title?: string | null;
  objectType?: ObjectType | null;
  objectId?: string | null;
  sourceType?: CaptureSourceType;
  sourceId?: string | null;
};

export async function startCaptureSession(input: StartCaptureSessionInput) {
  await assertWorkspaceCaptureServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const created = await db.captureSession.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.actorUserId ?? undefined,
      title: input.title ?? undefined,
      objectType: input.objectType ?? undefined,
      objectId: input.objectId ?? undefined,
      sourceType: input.sourceType ?? CaptureSourceType.MANUAL_CAPTURE,
      sourceId: input.sourceId ?? undefined,
      status: CaptureSessionStatus.RECORDING,
      transcriptStatus: CaptureProcessingStatus.PENDING,
      processingStatus: CaptureProcessingStatus.PENDING,
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actor: input.actorName,
    actorType: input.actorType ?? ActorType.USER,
    actionType: "CAPTURE_STARTED",
    targetType: "CaptureSession",
    targetId: created.id,
    summary: input.english
      ? `Started field capture: ${created.title ?? "Untitled session"}`
      : `开始现场记录：${created.title ?? "未命名会话"}`,
    payload: {
      objectType: created.objectType,
      objectId: created.objectId,
      sourceType: created.sourceType,
    },
    sourcePage: input.sourcePage,
    relatedObjectType: created.objectType ?? undefined,
    relatedObjectId: created.objectId ?? undefined,
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    eventName: "capture_started",
    eventCategory: "conversation_capture",
    targetType: "CaptureSession",
    targetId: created.id,
    metadata: {
      objectType: created.objectType,
      objectId: created.objectId,
      sourceType: created.sourceType,
    },
    sourcePage: input.sourcePage,
  });

  return created;
}

export async function stopCaptureSession(
  input: CaptureActorInput & {
    captureSessionId: string;
    transcriptText?: string | null;
    audioFile?: File | null;
    title?: string | null;
    transcriptSegments?: Array<{ speaker: string; startedAt: number; endedAt: number; text: string }> | null;
    transcriptLanguage?: string | null;
    transcriptConfidence?: number | null;
    transcriptProvider?: string | null;
    transcriptModel?: string | null;
  },
) {
  await assertWorkspaceCaptureServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const existing = await db.captureSession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.captureSessionId,
    },
  });

  if (!existing) {
    throw new Error("未找到对应现场记录");
  }

  const endedAt = new Date();
  const updated = await db.captureSession.update({
    where: { id: existing.id },
    data: {
      title: input.title ?? existing.title ?? undefined,
      endedAt,
      durationSeconds: Math.max(10, differenceInSeconds(endedAt, existing.startedAt)),
      status: CaptureSessionStatus.PROCESSING,
      transcriptStatus: CaptureProcessingStatus.RUNNING,
      processingStatus: CaptureProcessingStatus.RUNNING,
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actor: input.actorName,
    actorType: input.actorType ?? ActorType.USER,
    actionType: "CAPTURE_STOPPED",
    targetType: "CaptureSession",
    targetId: updated.id,
    summary: input.english
      ? `Stopped field capture: ${updated.title ?? "Untitled session"}`
      : `结束现场记录：${updated.title ?? "未命名会话"}`,
    payload: {
      durationSeconds: updated.durationSeconds,
      objectType: updated.objectType,
      objectId: updated.objectId,
    },
    sourcePage: input.sourcePage,
    relatedObjectType: updated.objectType ?? undefined,
    relatedObjectId: updated.objectId ?? undefined,
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    eventName: "capture_stopped",
    eventCategory: "conversation_capture",
    targetType: "CaptureSession",
    targetId: updated.id,
    metadata: {
      durationSeconds: updated.durationSeconds,
      objectType: updated.objectType,
      objectId: updated.objectId,
    },
    sourcePage: input.sourcePage,
  });

  if (input.audioFile) {
    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      eventName: "capture_audio_uploaded",
      eventCategory: "conversation_capture",
      targetType: "CaptureSession",
      targetId: updated.id,
      metadata: {
        mimeType: input.audioFile.type || "audio/unknown",
        sizeKb: Math.round(input.audioFile.size / 1024),
      },
      sourcePage: input.sourcePage,
    });
  }

  return processConversationCapture({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    captureSessionId: updated.id,
    transcriptText: input.transcriptText,
    audioFile: input.audioFile,
    transcriptSegments: input.transcriptSegments,
    transcriptLanguage: input.transcriptLanguage,
    transcriptConfidence: input.transcriptConfidence,
    transcriptProvider: input.transcriptProvider,
    transcriptModel: input.transcriptModel,
  });
}

export async function getCaptureSessionDetails(workspaceId: string, captureSessionId: string) {
  const session = await db.captureSession.findFirst({
    where: {
      workspaceId,
      id: captureSessionId,
    },
    include: {
      user: true,
      linkedMeeting: {
        include: {
          company: true,
          opportunity: true,
          contacts: true,
        },
      },
        transcript: true,
      insights: {
        orderBy: [{ insightType: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!session) {
    return null;
  }

  const [actions, approvals] = await Promise.all([
    db.actionItem.findMany({
      where: {
        workspaceId,
        sourceType: SourceType.CAPTURE_SESSION,
        sourceId: captureSessionId,
      },
      include: {
        approvalTask: true,
        contact: true,
        opportunity: true,
        meeting: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.approvalTask.findMany({
      where: {
        workspaceId,
        actionItem: {
          sourceType: SourceType.CAPTURE_SESSION,
          sourceId: captureSessionId,
        },
      },
      include: {
        actionItem: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const recommendationRefs: Array<{
    objectType: RecommendationRefreshObjectType;
    objectId: string;
    objectLabel: string;
  }> = [
    ...(session.linkedMeeting ? [{ objectType: ObjectType.MEETING, objectId: session.linkedMeeting.id, objectLabel: session.linkedMeeting.title }] : []),
    ...(session.linkedMeeting?.contacts[0]
      ? [{ objectType: ObjectType.CONTACT, objectId: session.linkedMeeting.contacts[0].id, objectLabel: session.linkedMeeting.contacts[0].name }]
      : []),
    ...(session.linkedMeeting?.company
      ? [{ objectType: ObjectType.COMPANY, objectId: session.linkedMeeting.company.id, objectLabel: session.linkedMeeting.company.name }]
      : []),
    ...(session.linkedMeeting?.opportunity
      ? [{ objectType: ObjectType.OPPORTUNITY, objectId: session.linkedMeeting.opportunity.id, objectLabel: session.linkedMeeting.opportunity.title }]
      : []),
  ];

  const [memoryWriteback, refreshedRecommendations] = await Promise.all([
    session.linkedMeeting
      ? Promise.all([
          db.memoryFact.findMany({
            where: {
              workspaceId,
              sourceType: SourceType.MEETING_NOTE,
              sourceId: session.linkedMeeting.id,
            },
            orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
            take: 6,
            select: {
              id: true,
              title: true,
              content: true,
              factType: true,
              confidence: true,
            },
          }),
          db.commitment.findMany({
            where: {
              workspaceId,
              sourceType: SourceType.MEETING_NOTE,
              sourceId: session.linkedMeeting.id,
            },
            orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
            take: 6,
            select: {
              id: true,
              title: true,
              commitmentText: true,
              status: true,
              dueDate: true,
            },
          }),
          db.blocker.findMany({
            where: {
              workspaceId,
              sourceType: SourceType.MEETING_NOTE,
              sourceId: session.linkedMeeting.id,
            },
            orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
            take: 6,
            select: {
              id: true,
              title: true,
              blockerText: true,
              status: true,
              severity: true,
            },
          }),
        ]).then(([facts, commitments, blockers]) => ({ facts, commitments, blockers }))
      : Promise.resolve({ facts: [], commitments: [], blockers: [] }),
    Promise.all(
      recommendationRefs.map(async (ref) => {
        const logs = await db.recommendationLog.findMany({
          where: {
            workspaceId,
            objectType: ref.objectType,
            objectId: ref.objectId,
            status: "ACTIVE",
            createdAt: {
              gte: session.startedAt,
            },
          },
          orderBy: [{ score: "desc" }, { createdAt: "desc" }],
          take: 2,
          select: {
            id: true,
            title: true,
            explanation: true,
            policyResult: true,
            recommendationPayload: true,
          },
        });

        if (!logs.length) {
          return null;
        }

        return {
          objectType: ref.objectType,
          objectId: ref.objectId,
          objectLabel: ref.objectLabel,
          recommendations: logs.map((item) => ({
            id: item.id,
            title: item.title,
            explanation: item.explanation,
            policyResult: item.policyResult,
            recommendationPayload: safeParseJson<Record<string, unknown>>(item.recommendationPayload, {}),
          })),
        };
      }),
    ).then((items) =>
      items.filter(
        (
          item,
        ): item is {
          objectType: RecommendationRefreshObjectType;
          objectId: string;
          objectLabel: string;
          recommendations: Array<{
            id: string;
            title: string;
            explanation: string;
            policyResult: "SUGGEST_ONLY" | "REQUIRES_APPROVAL" | "AUTO_WITHIN_THRESHOLD" | "FORBIDDEN";
            recommendationPayload: Record<string, unknown>;
          }>;
        } => Boolean(item),
      ),
    ),
  ]);

  return {
    ...session,
    transcript: session.transcript
      ? {
          ...session.transcript,
          segments: safeParseJson<Array<{ speaker: string; startedAt: number; endedAt: number; text: string }>>(
            session.transcript.segments,
            [],
          ),
        }
      : null,
    insightsByType: {
      facts: session.insights.filter((item) => item.insightType === ConversationInsightType.FACT),
      commitments: session.insights.filter((item) => item.insightType === ConversationInsightType.COMMITMENT),
      blockers: session.insights.filter((item) => item.insightType === ConversationInsightType.BLOCKER),
      risks: session.insights.filter((item) => item.insightType === ConversationInsightType.RISK),
      nextActions: session.insights.filter((item) => item.insightType === ConversationInsightType.NEXT_ACTION),
    },
    actions,
    approvals,
    memoryWriteback,
    refreshedRecommendations,
  };
}

export async function getRecentCaptureSessions(workspaceId: string, limit = 10) {
  return db.captureSession.findMany({
    where: {
      workspaceId,
    },
    include: {
      linkedMeeting: {
        include: {
          company: true,
          opportunity: true,
        },
      },
      transcript: true,
      insights: {
        select: {
          id: true,
          insightType: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function ingestConversationCapture(
  input: StartCaptureSessionInput & {
    transcriptText: string;
    transcriptSegments?: Array<{ speaker: string; startedAt: number; endedAt: number; text: string }> | null;
    transcriptLanguage?: string | null;
    transcriptConfidence?: number | null;
    transcriptProvider?: string | null;
    transcriptModel?: string | null;
  },
) {
  const session = await startCaptureSession(input);
  return stopCaptureSession({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    captureSessionId: session.id,
    transcriptText: input.transcriptText,
    title: input.title,
    transcriptSegments: input.transcriptSegments,
    transcriptLanguage: input.transcriptLanguage,
    transcriptConfidence: input.transcriptConfidence,
    transcriptProvider: input.transcriptProvider,
    transcriptModel: input.transcriptModel,
  });
}
