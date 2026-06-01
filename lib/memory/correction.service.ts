import { ActorType, MemoryCorrectionType, MemoryStatus } from "@prisma/client";
import { assertWorkspaceMemoryServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { recordMemoryCorrectionDelta } from "@/lib/evolution/delta-event.service";
import { refreshEvolutionState } from "@/lib/evolution/pattern-detection.service";
import {
  type MemoryActorContext,
  toMemoryCorrectionPayload,
  writeMemoryAuditAndEvent,
} from "@/lib/memory/shared";
import { jsonStringify, safeParseJson } from "@/lib/utils";

type CorrectInput = MemoryActorContext & {
  memoryFactId: string;
  correctionType: MemoryCorrectionType;
  afterValue?: Record<string, unknown>;
  reason?: string | null;
};

export async function getCorrections(args: { workspaceId: string; memoryFactId: string }) {
  return db.memoryCorrection.findMany({
    where: {
      workspaceId: args.workspaceId,
      memoryFactId: args.memoryFactId,
    },
    include: {
      correctedByUser: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function confirmMemoryFact(input: MemoryActorContext & { memoryFactId: string; reason?: string | null }) {
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const fact = await db.memoryFact.findFirst({
    where: {
      id: input.memoryFactId,
      workspaceId: input.workspaceId,
    },
  });

  if (!fact) {
    throw new Error("未找到对应记忆");
  }

  const updated = await db.memoryFact.update({
    where: { id: fact.id },
    data: {
      confirmedByUser: true,
      status: MemoryStatus.ACTIVE,
    },
  });

  const correction = await db.memoryCorrection.create({
    data: {
      workspaceId: input.workspaceId,
      memoryFactId: fact.id,
      correctionType: MemoryCorrectionType.CONFIRM,
      beforeValue: jsonStringify({ confirmedByUser: fact.confirmedByUser, status: fact.status }),
      afterValue: jsonStringify({ confirmedByUser: updated.confirmedByUser, status: updated.status }),
      correctedByUserId: input.actorUserId!,
      reason: input.reason ?? "用户确认该记忆为有效信息",
    },
  });

  await expireObjectBriefings(input.workspaceId, fact.objectType, fact.objectId);

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.USER,
    sourcePage: input.sourcePage,
    actionType: "MEMORY_FACT_CONFIRMED",
    targetType: "MemoryFact",
    targetId: fact.id,
    summary: `确认记忆：${fact.title}`,
    eventName: "memory_fact_confirmed",
    eventCategory: "memory",
    metadata: {
      correctionId: correction.id,
      objectType: fact.objectType,
      objectId: fact.objectId,
      reason: input.reason ?? null,
    },
  });

  try {
    await recordMemoryCorrectionDelta({
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actorType: input.actorType ?? ActorType.USER,
      sourcePage: input.sourcePage,
      memoryFactId: fact.id,
      correctionType: MemoryCorrectionType.CONFIRM,
      objectType: fact.objectType,
      objectId: fact.objectId,
      reason: input.reason ?? null,
    });

    await refreshEvolutionState({
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actorType: input.actorType ?? ActorType.USER,
      sourcePage: input.sourcePage,
      trigger: "memory_confirmed",
    });
  } catch (error) {
    console.error("memory confirm evolution refresh failed", error);
  }

  return { fact: updated, correction };
}

export async function correctMemoryFact(input: CorrectInput) {
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const fact = await db.memoryFact.findFirst({
    where: {
      id: input.memoryFactId,
      workspaceId: input.workspaceId,
    },
  });

  if (!fact) {
    throw new Error("未找到对应记忆");
  }

  const previous = {
    title: fact.title,
    content: fact.content,
    status: fact.status,
    confidence: fact.confidence,
    normalizedValue: safeParseJson<Record<string, unknown>>(fact.normalizedValue, {}),
  };

  const next = {
    ...previous,
    ...input.afterValue,
  };

  const updated = await db.memoryFact.update({
    where: { id: fact.id },
    data: {
      title: typeof next.title === "string" ? next.title : fact.title,
      content: typeof next.content === "string" ? next.content : fact.content,
      confidence: typeof next.confidence === "number" ? next.confidence : fact.confidence,
      normalizedValue: next.normalizedValue ? jsonStringify(next.normalizedValue) : fact.normalizedValue,
      status: typeof next.status === "string" ? (next.status as MemoryStatus) : fact.status,
    },
  });

  const correction = await db.memoryCorrection.create({
    data: {
      workspaceId: input.workspaceId,
      memoryFactId: fact.id,
      correctionType: input.correctionType,
      beforeValue: jsonStringify(previous),
      afterValue: jsonStringify(next),
      correctedByUserId: input.actorUserId!,
      reason: input.reason ?? null,
    },
  });

  await expireObjectBriefings(input.workspaceId, fact.objectType, fact.objectId);

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.USER,
    sourcePage: input.sourcePage,
    actionType: "MEMORY_FACT_CORRECTED",
    targetType: "MemoryFact",
    targetId: fact.id,
    summary: `修正记忆：${fact.title}`,
    eventName: "memory_fact_corrected",
    eventCategory: "memory",
    metadata: {
      correctionId: correction.id,
      ...toMemoryCorrectionPayload({
        correctionType: input.correctionType,
        beforeValue: previous,
        afterValue: next,
        reason: input.reason,
      }),
    },
  });

  try {
    await recordMemoryCorrectionDelta({
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actorType: input.actorType ?? ActorType.USER,
      sourcePage: input.sourcePage,
      memoryFactId: fact.id,
      correctionType: input.correctionType,
      objectType: fact.objectType,
      objectId: fact.objectId,
      reason: input.reason ?? null,
    });

    await refreshEvolutionState({
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actorType: input.actorType ?? ActorType.USER,
      sourcePage: input.sourcePage,
      trigger: "memory_corrected",
    });
  } catch (error) {
    console.error("memory correction evolution refresh failed", error);
  }

  return { fact: updated, correction };
}

export async function invalidateMemoryFact(input: MemoryActorContext & { memoryFactId: string; reason?: string | null }) {
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const fact = await db.memoryFact.findFirst({
    where: {
      id: input.memoryFactId,
      workspaceId: input.workspaceId,
    },
  });

  if (!fact) {
    throw new Error("未找到对应记忆");
  }

  const updated = await db.memoryFact.update({
    where: { id: fact.id },
    data: {
      status: MemoryStatus.INVALID,
    },
  });

  const correction = await db.memoryCorrection.create({
    data: {
      workspaceId: input.workspaceId,
      memoryFactId: fact.id,
      correctionType: MemoryCorrectionType.INVALIDATE,
      beforeValue: jsonStringify({ status: fact.status }),
      afterValue: jsonStringify({ status: updated.status }),
      correctedByUserId: input.actorUserId!,
      reason: input.reason ?? "该结论已不再成立",
    },
  });

  await expireObjectBriefings(input.workspaceId, fact.objectType, fact.objectId);

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.USER,
    sourcePage: input.sourcePage,
    actionType: "MEMORY_FACT_INVALIDATED",
    targetType: "MemoryFact",
    targetId: fact.id,
    summary: `失效记忆：${fact.title}`,
    eventName: "memory_fact_invalidated",
    eventCategory: "memory",
    metadata: {
      correctionId: correction.id,
      previousStatus: fact.status,
      nextStatus: updated.status,
      reason: input.reason ?? null,
    },
  });

  try {
    await recordMemoryCorrectionDelta({
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actorType: input.actorType ?? ActorType.USER,
      sourcePage: input.sourcePage,
      memoryFactId: fact.id,
      correctionType: MemoryCorrectionType.INVALIDATE,
      objectType: fact.objectType,
      objectId: fact.objectId,
      reason: input.reason ?? null,
    });

    await refreshEvolutionState({
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actorType: input.actorType ?? ActorType.USER,
      sourcePage: input.sourcePage,
      trigger: "memory_invalidated",
    });
  } catch (error) {
    console.error("memory invalidate evolution refresh failed", error);
  }

  return { fact: updated, correction };
}

export async function deleteMemoryFact(input: MemoryActorContext & { memoryFactId: string; reason?: string | null }) {
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const fact = await db.memoryFact.findFirst({
    where: {
      id: input.memoryFactId,
      workspaceId: input.workspaceId,
    },
  });

  if (!fact) {
    throw new Error("未找到对应记忆");
  }

  const updated = await db.memoryFact.update({
    where: { id: fact.id },
    data: {
      status: MemoryStatus.ARCHIVED,
    },
  });

  const correction = await db.memoryCorrection.create({
    data: {
      workspaceId: input.workspaceId,
      memoryFactId: fact.id,
      correctionType: MemoryCorrectionType.DELETE,
      beforeValue: jsonStringify({ status: fact.status, title: fact.title, content: fact.content }),
      afterValue: jsonStringify({ status: updated.status }),
      correctedByUserId: input.actorUserId!,
      reason: input.reason ?? "用户删除该记忆在工作台中的展示",
    },
  });

  await expireObjectBriefings(input.workspaceId, fact.objectType, fact.objectId);

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.USER,
    sourcePage: input.sourcePage,
    actionType: "MEMORY_FACT_DELETED",
    targetType: "MemoryFact",
    targetId: fact.id,
    summary: `删除记忆：${fact.title}`,
    eventName: "memory_fact_deleted",
    eventCategory: "memory",
    metadata: {
      correctionId: correction.id,
      previousStatus: fact.status,
      nextStatus: updated.status,
      reason: input.reason ?? null,
    },
  });

  try {
    await recordMemoryCorrectionDelta({
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actorType: input.actorType ?? ActorType.USER,
      sourcePage: input.sourcePage,
      memoryFactId: fact.id,
      correctionType: MemoryCorrectionType.DELETE,
      objectType: fact.objectType,
      objectId: fact.objectId,
      reason: input.reason ?? null,
    });

    await refreshEvolutionState({
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actorType: input.actorType ?? ActorType.USER,
      sourcePage: input.sourcePage,
      trigger: "memory_deleted",
    });
  } catch (error) {
    console.error("memory delete evolution refresh failed", error);
  }

  return { fact: updated, correction };
}

async function expireObjectBriefings(workspaceId: string, objectType: string, objectId: string) {
  await db.briefingSnapshot.updateMany({
    where: {
      workspaceId,
      objectType: objectType as never,
      objectId,
      expiresAt: null,
    },
    data: {
      expiresAt: new Date(),
    },
  });
}
