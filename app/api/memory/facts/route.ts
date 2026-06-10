import { MemoryStatus, type MemoryFactType, type ObjectType } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { getCurrentWorkspace, getCurrentWorkspaceSession, requireCurrentUser } from "@/lib/auth/session";
import { assertWorkspaceObjectOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { createMemoryFact, getMemoryFacts } from "@/lib/memory/memory-fact.service";
import {
  MEMORY_FACTS_QUERY_LIMIT,
  buildMemoryQueryPageInfo,
  encodeMemoryCursor,
  parseMemoryFactCursor,
  resolveMemoryBoundedLimit,
  splitMemoryPage,
} from "@/lib/memory/query-contract";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { createMemoryFactSchema } from "@/lib/memory/schemas";
import { canManageWorkspaceMemory, getMemoryManagementDeniedMessage } from "@/lib/memory/permissions";
import { serverErrorMessage } from "@/lib/http/server-error";

export async function GET(request: Request) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const { searchParams } = new URL(request.url);
  const objectType = searchParams.get("objectType") as ObjectType | null;
  const objectId = searchParams.get("objectId");
  const factType = searchParams.get("factType") as MemoryFactType | null;
  const status = searchParams.get("status") as MemoryStatus | null;
  const limit = resolveMemoryBoundedLimit(searchParams.get("limit"), {
    defaultLimit: MEMORY_FACTS_QUERY_LIMIT.default,
    maxLimit: MEMORY_FACTS_QUERY_LIMIT.max,
  });
  const cursor = parseMemoryFactCursor(searchParams.get("cursor"));
  const query = searchParams.get("query")?.trim() || undefined;

  if (!objectType || !objectId) {
    return errorResponse("objectType 和 objectId 不能为空");
  }

  if (!cursor.ok) {
    return errorResponse(cursor.message, "INVALID_CURSOR", 400);
  }

  try {
    await assertWorkspaceObjectOwnership({
      workspaceId: workspace.id,
      objectType,
      objectId,
    });

    const factsWithSentinel = await getMemoryFacts({
      workspaceId: workspace.id,
      objectType,
      objectId,
      factType: factType ?? undefined,
      status: status ?? undefined,
      limit: limit.limit + 1,
      cursor: cursor.cursor,
      query,
    });
    const factsPage = splitMemoryPage(factsWithSentinel, limit.limit);
    const lastFact = factsPage.items.at(-1);
    const pageInfo = buildMemoryQueryPageInfo({
      limit,
      hasNextPage: factsPage.hasNextPage,
      nextCursor:
        factsPage.hasNextPage && lastFact
          ? encodeMemoryCursor({
              importance: lastFact.importance,
              createdAt: lastFact.createdAt.toISOString(),
              id: lastFact.id,
            })
          : null,
      appliedCursor: cursor.rawCursor,
    });

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: query ? "memory_search_performed" : "memory_timeline_viewed",
      eventCategory: "memory",
      targetType: objectType,
      targetId: objectId,
      metadata: {
        factType: factType ?? null,
        status: status ?? null,
        requestedLimit: limit.requestedLimit,
        limit: limit.limit,
        cursor: cursor.rawCursor,
        query: query ?? null,
        resultCount: factsPage.items.length,
        hasNextPage: pageInfo.hasNextPage,
        bounded: pageInfo.bounded,
      },
      sourcePage: "/memory",
    });

    return successResponse(
      {
        items: factsPage.items,
        activeFacts: factsPage.items.filter((fact) => fact.status === MemoryStatus.ACTIVE),
        observedFacts: factsPage.items.filter((fact) => fact.status === MemoryStatus.OBSERVED),
        archivedFacts: factsPage.items.filter((fact) => fact.status === MemoryStatus.ARCHIVED),
        invalidFacts: factsPage.items.filter((fact) => fact.status === MemoryStatus.INVALID),
        pageInfo,
      },
      "ok",
    );
  } catch (error) {
    return errorResponse(
      isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "对象不在当前 workspace 中"),
      isWorkspaceOwnershipError(error) ? "OBJECT_NOT_FOUND" : "READ_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}

export async function POST(request: Request) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const payload = createMemoryFactSchema.safeParse(await request.json());

  if (!payload.success) {
    return errorResponse(payload.error.issues[0]?.message ?? "参数不完整");
  }

  if (!canManageWorkspaceMemory(membership.role)) {
    return errorResponse(
      getMemoryManagementDeniedMessage(english),
      "FORBIDDEN",
      403,
    );
  }

  try {
    await assertWorkspaceObjectOwnership({
      workspaceId: workspace.id,
      objectType: payload.data.objectType,
      objectId: payload.data.objectId,
    });

    const created = await createMemoryFact({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      english,
      sourcePage: "/memory",
      ...payload.data,
    });

    return successResponse(
      {
        id: created.id,
        objectType: created.objectType,
        objectId: created.objectId,
        factType: created.factType,
        title: created.title,
        status: created.status,
      },
      "memory fact created",
    );
  } catch (error) {
    return errorResponse(
      isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "创建记忆失败"),
      isWorkspaceOwnershipError(error) ? "OBJECT_NOT_FOUND" : "CREATE_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
