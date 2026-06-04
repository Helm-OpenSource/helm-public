import { NextResponse } from "next/server";
import { ObjectType, UsageType } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { recordUsageLedgerEntry } from "@/lib/billing/foundation";
import { db } from "@/lib/db";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { canExportMemory, getMemoryExportDeniedMessage } from "@/lib/memory/permissions";
import {
  assertWorkspaceObjectOwnership,
  assertWorkspaceOwnership,
  isWorkspaceOwnershipError,
} from "@/lib/auth/tenant-ownership";
import {
  buildMemoryEntrySourceWhere,
  normalizeMemorySourceFilter,
} from "@/lib/memory/source-filter";

export async function GET(request: Request) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canExportMemory(membership.role)) {
    return NextResponse.json(
      { success: false, message: getMemoryExportDeniedMessage(english) },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const objectLevel = searchParams.get("objectLevel") ?? searchParams.get("dimension") ?? "ALL";
  const source = normalizeMemorySourceFilter(searchParams.get("source"));
  const rawObjectType = searchParams.get("objectType");
  const objectId = searchParams.get("objectId");
  const objectType = rawObjectType
    ? rawObjectType === "WORKSPACE" || Object.values(ObjectType).includes(rawObjectType as ObjectType)
      ? (rawObjectType as ObjectType | "WORKSPACE")
      : null
    : null;

  if (rawObjectType && !objectType) {
    return NextResponse.json(
      {
        success: false,
        message: english ? "Invalid workspace export filter" : "导出筛选条件无效",
      },
      { status: 400 },
    );
  }

  try {
    if (objectType && objectId) {
      if (objectType === "WORKSPACE") {
        await assertWorkspaceOwnership(workspace.id, objectId);
      } else if (
        objectType === ObjectType.CONTACT ||
        objectType === ObjectType.COMPANY ||
        objectType === ObjectType.OPPORTUNITY ||
        objectType === ObjectType.MEETING
      ) {
        await assertWorkspaceObjectOwnership({
          workspaceId: workspace.id,
          objectType,
          objectId,
        });
      }
    }
  } catch (error) {
    const status = isWorkspaceOwnershipError(error) ? 404 : 400;
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : english
              ? "Invalid workspace export filter"
              : "导出筛选条件无效",
      },
      { status },
    );
  }

  const entrySourceWhere = buildMemoryEntrySourceWhere(source);

  const entries = await db.memoryEntry.findMany({
    where: {
      workspaceId: workspace.id,
      deletedAt: null,
      ...entrySourceWhere,
      ...(objectType === "CONTACT" ? { contactId: objectId ?? undefined } : {}),
      ...(objectType === "COMPANY" ? { companyId: objectId ?? undefined } : {}),
      ...(objectType === "OPPORTUNITY" ? { opportunityId: objectId ?? undefined } : {}),
      ...(objectType === "MEETING" ? { meetingId: objectId ?? undefined } : {}),
      ...(query
        ? {
            OR: [{ title: { contains: query } }, { content: { contains: query } }],
          }
        : {}),
      ...(objectLevel && objectLevel !== "ALL"
        ? {
            entityType: objectLevel as "CONTACT" | "COMPANY" | "OPPORTUNITY" | "MEETING" | "WORKSPACE",
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const content = [
    english ? "Helm workspace memory export" : "Helm 工作域记忆导出",
    english ? `Exported at: ${new Date().toISOString()}` : `导出时间：${new Date().toISOString()}`,
    english ? `Source filter: ${source}` : `来源过滤：${source}`,
    english
      ? `Object filter: ${objectType && objectId ? `${objectType}:${objectId}` : "none"}`
      : `对象过滤：${objectType && objectId ? `${objectType}:${objectId}` : "无"}`,
    "",
    ...entries.map((entry) => `- [${entry.entityType}] ${entry.title}\n  ${entry.content}`),
  ].join("\n");

  await recordUsageLedgerEntry({
    workspaceId: workspace.id,
    usageType: UsageType.MEETING_MEMORY_EXPORT,
    sourcePage: request.url,
    metadata: {
      query,
      dimension: objectLevel,
      source,
      objectType,
      objectId,
      exportedCount: entries.length,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: "USER",
    actionType: "MEMORY_SUMMARY_EXPORTED",
    targetType: "Workspace",
    targetId: workspace.id,
    summary: english ? "Exported workspace memory summary" : "导出了工作区记忆摘要",
    payload: {
      query,
      dimension: objectLevel,
      source,
      objectType,
      objectId,
      exportedCount: entries.length,
    },
    sourcePage: "/memory",
  });

  return new NextResponse(content, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="helm-memory-summary.txt"',
      Vary: "Cookie",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
