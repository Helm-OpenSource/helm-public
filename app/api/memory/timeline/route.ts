import { ObjectType } from "@prisma/client";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { logEvent } from "@/lib/analytics";
import { db } from "@/lib/db";
import {
  MEMORY_TIMELINE_QUERY_LIMIT,
  buildMemoryQueryPageInfo,
  buildTimelineCursor,
  compareTimelineEvents,
  isTimelineEventAfterCursor,
  parseMemoryTimelineCursor,
  resolveMemoryBoundedLimit,
  splitMemoryPage,
} from "@/lib/memory/query-contract";
import {
  buildMemoryEntrySourceWhere,
  normalizeMemorySourceFilter,
} from "@/lib/memory/source-filter";
import { errorResponse, successResponse, type TimelineEvent } from "@/lib/memory/shared";

export async function GET(request: Request) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const { searchParams } = new URL(request.url);
  const objectType = searchParams.get("objectType") as ObjectType | null;
  const objectId = searchParams.get("objectId");
  const query = searchParams.get("query")?.trim() || undefined;
  const limit = resolveMemoryBoundedLimit(searchParams.get("limit"), {
    defaultLimit: MEMORY_TIMELINE_QUERY_LIMIT.default,
    maxLimit: MEMORY_TIMELINE_QUERY_LIMIT.max,
  });
  const cursor = parseMemoryTimelineCursor(searchParams.get("cursor"));
  const source = normalizeMemorySourceFilter(searchParams.get("source"));
  const objectLevel = (searchParams.get("objectLevel") ?? "ALL") as
    | "ALL"
    | "WORKSPACE"
    | "CONTACT"
    | "COMPANY"
    | "OPPORTUNITY"
    | "MEETING";
  const includeHelm = source !== "OPENCLAW";
  const includeTimelineObjects = includeHelm && objectLevel !== "WORKSPACE";

  if ((objectType && !objectId) || (!objectType && objectId)) {
    return errorResponse("objectType 和 objectId 需要同时提供");
  }

  if (!cursor.ok) {
    return errorResponse(cursor.message, "INVALID_CURSOR", 400);
  }

  const cursorDate = cursor.cursor ? new Date(cursor.cursor.occurredAt) : null;
  const sourceTake = limit.limit + 1;

  const entrySourceWhere = buildMemoryEntrySourceWhere(source);

  const [facts, commitments, blockers, corrections, entries, meetings, actions, approvals, threads] = await Promise.all([
    includeHelm
      ? db.memoryFact.findMany({
          where: {
            workspaceId: workspace.id,
            ...(objectLevel !== "ALL" && objectLevel !== "WORKSPACE" ? { objectType: objectLevel } : {}),
            ...(objectType && objectId ? { objectType, objectId } : {}),
            ...(cursorDate ? { createdAt: { lte: cursorDate } } : {}),
            ...(query
              ? {
                  OR: [{ title: { contains: query } }, { content: { contains: query } }, { sourceId: { contains: query } }],
                }
              : {}),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: sourceTake,
        })
      : Promise.resolve([]),
    includeHelm
      ? db.commitment.findMany({
          where: {
            workspaceId: workspace.id,
            ...(objectLevel === "CONTACT" ? { relatedContactId: { not: null } } : {}),
            ...(objectLevel === "COMPANY" ? { relatedCompanyId: { not: null } } : {}),
            ...(objectLevel === "OPPORTUNITY" ? { relatedOpportunityId: { not: null } } : {}),
            ...(objectLevel === "MEETING" ? { relatedMeetingId: { not: null } } : {}),
            ...(objectType === ObjectType.CONTACT ? { relatedContactId: objectId } : {}),
            ...(objectType === ObjectType.COMPANY ? { relatedCompanyId: objectId } : {}),
            ...(objectType === ObjectType.OPPORTUNITY ? { relatedOpportunityId: objectId } : {}),
            ...(objectType === ObjectType.MEETING ? { relatedMeetingId: objectId } : {}),
            ...(cursorDate ? { createdAt: { lte: cursorDate } } : {}),
            ...(query
              ? {
                  OR: [{ title: { contains: query } }, { commitmentText: { contains: query } }],
                }
              : {}),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: sourceTake,
        })
      : Promise.resolve([]),
    includeHelm
      ? db.blocker.findMany({
          where: {
            workspaceId: workspace.id,
            ...(objectLevel === "CONTACT" ? { relatedContactId: { not: null } } : {}),
            ...(objectLevel === "COMPANY" ? { relatedCompanyId: { not: null } } : {}),
            ...(objectLevel === "OPPORTUNITY" ? { relatedOpportunityId: { not: null } } : {}),
            ...(objectLevel === "MEETING" ? { relatedMeetingId: { not: null } } : {}),
            ...(objectType === ObjectType.CONTACT ? { relatedContactId: objectId } : {}),
            ...(objectType === ObjectType.COMPANY ? { relatedCompanyId: objectId } : {}),
            ...(objectType === ObjectType.OPPORTUNITY ? { relatedOpportunityId: objectId } : {}),
            ...(objectType === ObjectType.MEETING ? { relatedMeetingId: objectId } : {}),
            ...(cursorDate ? { createdAt: { lte: cursorDate } } : {}),
            ...(query
              ? {
                  OR: [{ title: { contains: query } }, { blockerText: { contains: query } }, { blockerType: { contains: query } }],
                }
              : {}),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: sourceTake,
        })
      : Promise.resolve([]),
    includeHelm
      ? db.memoryCorrection.findMany({
          where: {
            workspaceId: workspace.id,
            ...(objectType && objectId
              ? {
                  memoryFact: {
                    objectType,
                    objectId,
                  },
                }
              : {}),
            ...(cursorDate ? { createdAt: { lte: cursorDate } } : {}),
          },
          include: {
            memoryFact: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: sourceTake,
        })
      : Promise.resolve([]),
    db.memoryEntry.findMany({
      where: {
        workspaceId: workspace.id,
        deletedAt: null,
        ...entrySourceWhere,
        ...(objectLevel !== "ALL" ? { entityType: objectLevel } : {}),
        ...(objectType === ObjectType.CONTACT ? { contactId: objectId } : {}),
        ...(objectType === ObjectType.COMPANY ? { companyId: objectId } : {}),
        ...(objectType === ObjectType.OPPORTUNITY ? { opportunityId: objectId } : {}),
        ...(objectType === ObjectType.MEETING ? { meetingId: objectId } : {}),
        ...(cursorDate ? { createdAt: { lte: cursorDate } } : {}),
        ...(query
          ? {
              OR: [{ title: { contains: query } }, { content: { contains: query } }, { source: { contains: query } }],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: sourceTake,
    }),
    includeTimelineObjects ? queryMeetings(workspace.id, objectType, objectId, query, cursorDate, sourceTake) : Promise.resolve([]),
    includeTimelineObjects ? queryActions(workspace.id, objectType, objectId, query, cursorDate, sourceTake) : Promise.resolve([]),
    includeTimelineObjects ? queryApprovals(workspace.id, objectType, objectId, cursorDate, sourceTake) : Promise.resolve([]),
    includeTimelineObjects ? queryThreads(workspace.id, objectType, objectId, query, cursorDate, sourceTake) : Promise.resolve([]),
  ]);

  const data = [
    ...threads.map((item) => ({ type: "EMAIL_THREAD" as const, id: item.id, title: item.subject, occurredAt: item.updatedAt, status: item.status, sourceLabel: item.source ?? "邮件线程" })),
    ...meetings.map((item) => ({ type: "MEETING" as const, id: item.id, title: item.title, occurredAt: item.startsAt, status: item.status, sourceLabel: "会议" })),
    ...facts.map((item) => ({ type: "MEMORY_FACT" as const, id: item.id, title: item.title, occurredAt: item.createdAt, status: item.status, sourceLabel: item.sourceType })),
    ...commitments.map((item) => ({ type: "COMMITMENT" as const, id: item.id, title: item.title, occurredAt: item.createdAt, status: item.status, sourceLabel: item.sourceType })),
    ...blockers.map((item) => ({ type: "BLOCKER" as const, id: item.id, title: item.title, occurredAt: item.createdAt, status: item.status, sourceLabel: item.sourceType })),
    ...corrections.map((item) => ({ type: "MEMORY_CORRECTION" as const, id: item.id, title: item.reason ?? item.correctionType, occurredAt: item.createdAt, status: item.correctionType, sourceLabel: item.memoryFact?.title ?? "记忆修正" })),
    ...entries.map((item) => ({ type: "MEMORY_ENTRY" as const, id: item.id, title: item.title, occurredAt: item.createdAt, status: item.memoryType, sourceLabel: item.source ?? "工作域记忆" })),
    ...actions.map((item) => ({ type: "ACTION" as const, id: item.id, title: item.title, occurredAt: item.createdAt, status: item.status, sourceLabel: item.sourceType ?? "动作" })),
    ...approvals.map((item) => ({ type: "APPROVAL" as const, id: item.id, title: item.actionItem.title, occurredAt: item.createdAt, status: item.status, sourceLabel: item.actionItem.actionType })),
  ]
    .sort(compareTimelineEvents)
    .filter((item) => isTimelineEventAfterCursor(item, cursor.cursor));
  const page = splitMemoryPage<TimelineEvent>(data, limit.limit);
  const lastEvent = page.items.at(-1);
  const pageInfo = buildMemoryQueryPageInfo({
    limit,
    hasNextPage: page.hasNextPage,
    nextCursor: page.hasNextPage && lastEvent ? buildTimelineCursor(lastEvent) : null,
    appliedCursor: cursor.rawCursor,
  });

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    eventName: "memory_timeline_viewed",
    eventCategory: "memory",
    targetType: objectType ?? "Workspace",
    targetId: objectId ?? workspace.id,
    metadata: {
      objectType,
      objectId,
      source,
      objectLevel,
      requestedLimit: limit.requestedLimit,
      limit: limit.limit,
      cursor: cursor.rawCursor,
      query: query ?? null,
      resultCount: page.items.length,
      hasNextPage: pageInfo.hasNextPage,
      bounded: pageInfo.bounded,
    },
    sourcePage: "/memory",
  });

  if (query) {
    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "memory_search_performed",
      eventCategory: "memory",
      targetType: objectType ?? "Workspace",
      targetId: objectId ?? workspace.id,
      metadata: {
        objectType,
        objectId,
        source,
        objectLevel,
        requestedLimit: limit.requestedLimit,
        limit: limit.limit,
        cursor: cursor.rawCursor,
        query,
        resultCount: page.items.length,
        hasNextPage: pageInfo.hasNextPage,
        bounded: pageInfo.bounded,
      },
      sourcePage: "/memory",
    });
  }

  return successResponse({ items: page.items, pageInfo }, "ok");
}

function queryMeetings(
  workspaceId: string,
  objectType: ObjectType | null,
  objectId?: string | null,
  query?: string,
  cursorDate?: Date | null,
  take = 20,
) {
  if (objectType === ObjectType.MEETING && objectId) {
    return db.meeting.findMany({
      where: {
        workspaceId,
        id: objectId,
        ...(cursorDate ? { startsAt: { lte: cursorDate } } : {}),
        ...(query ? { title: { contains: query } } : {}),
      },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take,
    });
  }

  if (objectType === ObjectType.OPPORTUNITY && objectId) {
    return db.meeting.findMany({
      where: {
        workspaceId,
        opportunityId: objectId,
        ...(cursorDate ? { startsAt: { lte: cursorDate } } : {}),
        ...(query ? { title: { contains: query } } : {}),
      },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take,
    });
  }

  if (objectType === ObjectType.CONTACT && objectId) {
    return db.meeting.findMany({
      where: {
        workspaceId,
        contacts: { some: { id: objectId } },
        ...(cursorDate ? { startsAt: { lte: cursorDate } } : {}),
        ...(query ? { title: { contains: query } } : {}),
      },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take,
    });
  }

  if (objectType === ObjectType.COMPANY && objectId) {
    return db.meeting.findMany({
      where: {
        workspaceId,
        companyId: objectId,
        ...(cursorDate ? { startsAt: { lte: cursorDate } } : {}),
        ...(query ? { title: { contains: query } } : {}),
      },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take,
    });
  }

  return db.meeting.findMany({
    where: {
      workspaceId,
      ...(cursorDate ? { startsAt: { lte: cursorDate } } : {}),
      ...(query ? { title: { contains: query } } : {}),
    },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    take,
  });
}

function queryActions(
  workspaceId: string,
  objectType: ObjectType | null,
  objectId?: string | null,
  query?: string,
  cursorDate?: Date | null,
  take = 20,
) {
  const objectWhere =
    objectType === ObjectType.OPPORTUNITY
      ? { opportunityId: objectId ?? undefined }
      : objectType === ObjectType.CONTACT
        ? { contactId: objectId ?? undefined }
        : objectType === ObjectType.MEETING
          ? { meetingId: objectId ?? undefined }
          : {};

  return db.actionItem.findMany({
    where: {
      workspaceId,
      ...objectWhere,
      ...(cursorDate ? { createdAt: { lte: cursorDate } } : {}),
      ...(query ? { OR: [{ title: { contains: query } }, { description: { contains: query } }] } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
  });
}

function queryApprovals(
  workspaceId: string,
  objectType: ObjectType | null,
  objectId?: string | null,
  cursorDate?: Date | null,
  take = 20,
) {
  const cursorWhere = cursorDate ? { createdAt: { lte: cursorDate } } : {};

  if (objectType === ObjectType.OPPORTUNITY) {
    return db.approvalTask.findMany({
      where: { workspaceId, actionItem: { opportunityId: objectId ?? undefined }, ...cursorWhere },
      include: { actionItem: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });
  }
  if (objectType === ObjectType.CONTACT) {
    return db.approvalTask.findMany({
      where: { workspaceId, actionItem: { contactId: objectId ?? undefined }, ...cursorWhere },
      include: { actionItem: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });
  }
  if (objectType === ObjectType.MEETING) {
    return db.approvalTask.findMany({
      where: { workspaceId, actionItem: { meetingId: objectId ?? undefined }, ...cursorWhere },
      include: { actionItem: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });
  }
  return db.approvalTask.findMany({
    where: { workspaceId, ...cursorWhere },
    include: { actionItem: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
  });
}

function queryThreads(
  workspaceId: string,
  objectType: ObjectType | null,
  objectId?: string | null,
  query?: string,
  cursorDate?: Date | null,
  take = 20,
) {
  const objectWhere =
    objectType === ObjectType.CONTACT
      ? { contactId: objectId ?? undefined }
      : objectType === ObjectType.COMPANY
        ? { companyId: objectId ?? undefined }
        : objectType === ObjectType.OPPORTUNITY
          ? { opportunityId: objectId ?? undefined }
          : {};

  return db.emailThread.findMany({
    where: {
      workspaceId,
      ...objectWhere,
      ...(cursorDate ? { updatedAt: { lte: cursorDate } } : {}),
      ...(query ? { OR: [{ subject: { contains: query } }, { summary: { contains: query } }] } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
  });
}
