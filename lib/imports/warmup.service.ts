import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { hydrateMeetingMemoryFromNote } from "@/lib/memory/pipeline.service";
import { generateRecommendationsForObject } from "@/lib/recommendations/recommendation.service";

export type WarmupResult = {
  processedMeetings: number;
  refreshedObjects: number;
  generatedRecommendations: number;
  detectedCommitments: number;
  detectedBlockers: number;
};

export async function runImportWarmup(input: {
  workspaceId: string;
  userId?: string | null;
  sourceType: string;
  jobId: string;
  meetingIds: string[];
  contactIds: string[];
  companyIds: string[];
  opportunityIds: string[];
}) {
  const refreshedKeys = new Set<string>();
  let processedMeetings = 0;
  let generatedRecommendations = 0;
  let detectedCommitments = 0;
  let detectedBlockers = 0;

  for (const meetingId of Array.from(new Set(input.meetingIds))) {
    const note = await db.meetingNote.findFirst({
      where: {
        workspaceId: input.workspaceId,
        meetingId,
      },
      select: { id: true },
    });

    if (!note) continue;

    const beforeCounts = await db.$transaction([
      db.commitment.count({
        where: {
          workspaceId: input.workspaceId,
          sourceType: "MEETING_NOTE",
          sourceId: note.id,
        },
      }),
      db.blocker.count({
        where: {
          workspaceId: input.workspaceId,
          sourceType: "MEETING_NOTE",
          sourceId: note.id,
        },
      }),
    ]);

    await hydrateMeetingMemoryFromNote({
      workspaceId: input.workspaceId,
      meetingId,
      actorName: "客户关系系统导入预热",
      actorType: "SYSTEM",
      actorUserId: input.userId ?? null,
      sourcePage: "/imports/crm",
    });

    const afterCounts = await db.$transaction([
      db.commitment.count({
        where: {
          workspaceId: input.workspaceId,
          sourceType: "MEETING_NOTE",
          sourceId: note.id,
        },
      }),
      db.blocker.count({
        where: {
          workspaceId: input.workspaceId,
          sourceType: "MEETING_NOTE",
          sourceId: note.id,
        },
      }),
    ]);

    detectedCommitments += Math.max(afterCounts[0] - beforeCounts[0], 0);
    detectedBlockers += Math.max(afterCounts[1] - beforeCounts[1], 0);
    processedMeetings += 1;
  }

  const refreshTargets = [
    ...input.contactIds.map((id) => ({ objectType: "CONTACT" as const, objectId: id })),
    ...input.companyIds.map((id) => ({ objectType: "COMPANY" as const, objectId: id })),
    ...input.opportunityIds.map((id) => ({ objectType: "OPPORTUNITY" as const, objectId: id })),
    ...input.meetingIds.map((id) => ({ objectType: "MEETING" as const, objectId: id })),
  ].filter((target) => {
    const key = `${target.objectType}:${target.objectId}`;
    if (refreshedKeys.has(key)) return false;
    refreshedKeys.add(key);
    return true;
  });

  for (const target of refreshTargets) {
    const recommendations = await generateRecommendationsForObject({
      workspaceId: input.workspaceId,
      actorUserId: input.userId ?? null,
      objectType: target.objectType,
      objectId: target.objectId,
      actorName: "客户关系系统导入预热",
      actorType: "SYSTEM",
      sourcePage: "/imports/crm",
    });
    generatedRecommendations += recommendations.length;
  }

  const result: WarmupResult = {
    processedMeetings,
    refreshedObjects: refreshTargets.length,
    generatedRecommendations,
    detectedCommitments,
    detectedBlockers,
  };

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId ?? null,
    actor: "客户关系系统导入预热",
    actorType: "SYSTEM",
    actionType: "IMPORT_WARMUP_COMPLETED",
    targetType: "ImportJob",
    targetId: input.jobId,
    summary: `已完成 ${input.sourceType} 导入预热，处理 ${processedMeetings} 场会议并刷新 ${refreshTargets.length} 个对象。`,
    payload: result,
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId ?? null,
    eventName: "import_warmup_completed",
    eventCategory: "import",
    targetType: "ImportJob",
    targetId: input.jobId,
    metadata: {
      sourceType: input.sourceType,
      ...result,
    },
    sourcePage: "/imports",
  });

  return result;
}
