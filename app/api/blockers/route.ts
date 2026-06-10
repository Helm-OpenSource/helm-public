import { getCurrentWorkspace, getCurrentWorkspaceSession } from "@/lib/auth/session";
import { assertWorkspaceRelatedObjectOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { resolveBlockerApiMessage } from "@/lib/i18n/api-blocker-messages";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { createBlocker, getBlockers } from "@/lib/memory/blocker.service";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { createBlockerSchema } from "@/lib/memory/schemas";
import { canManageWorkspaceMemory, getMemoryManagementDeniedMessage } from "@/lib/memory/permissions";

export async function GET(request: Request) {
  const workspace = await getCurrentWorkspace();
  const { searchParams } = new URL(request.url);

  const data = await getBlockers({
    workspaceId: workspace.id,
    relatedOpportunityId: searchParams.get("relatedOpportunityId") ?? undefined,
    relatedContactId: searchParams.get("relatedContactId") ?? undefined,
    relatedCompanyId: searchParams.get("relatedCompanyId") ?? undefined,
    relatedMeetingId: searchParams.get("relatedMeetingId") ?? undefined,
    query: searchParams.get("query") ?? undefined,
    status: (searchParams.get("status") as never) ?? undefined,
    onlyActive: searchParams.get("onlyActive") === "true",
  });

  return successResponse(data, "ok");
}

export async function POST(request: Request) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canManageWorkspaceMemory(membership.role)) {
    return errorResponse(getMemoryManagementDeniedMessage(english), "FORBIDDEN", 403);
  }

  const payload = createBlockerSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return errorResponse(
      payload.error.issues[0]?.message ??
        resolveBlockerApiMessage(workspace.defaultLocale, "missingRequiredFields"),
    );
  }

  try {
    await assertWorkspaceRelatedObjectOwnership({
      workspaceId: workspace.id,
      contactId: payload.data.relatedContactId,
      companyId: payload.data.relatedCompanyId,
      opportunityId: payload.data.relatedOpportunityId,
      meetingId: payload.data.relatedMeetingId,
    });

    const created = await createBlocker({
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
        status: created.status,
      },
      english ? "Blocker created" : "阻塞已创建",
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : resolveBlockerApiMessage(workspace.defaultLocale, "createFailed"),
      isWorkspaceOwnershipError(error) ? "RELATED_OBJECT_NOT_FOUND" : "CREATE_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
