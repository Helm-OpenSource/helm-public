import { getCurrentWorkspace, getCurrentWorkspaceSession } from "@/lib/auth/session";
import { assertWorkspaceRelatedObjectOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { createCommitment, getCommitments } from "@/lib/memory/commitment.service";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { createCommitmentSchema } from "@/lib/memory/schemas";
import { canManageWorkspaceMemory, getMemoryManagementDeniedMessage } from "@/lib/memory/permissions";
import { serverErrorMessage } from "@/lib/http/server-error";

export async function GET(request: Request) {
  const workspace = await getCurrentWorkspace();
  const { searchParams } = new URL(request.url);

  const data = await getCommitments({
    workspaceId: workspace.id,
    relatedOpportunityId: searchParams.get("relatedOpportunityId") ?? undefined,
    relatedContactId: searchParams.get("relatedContactId") ?? undefined,
    relatedCompanyId: searchParams.get("relatedCompanyId") ?? undefined,
    relatedMeetingId: searchParams.get("relatedMeetingId") ?? undefined,
    query: searchParams.get("query") ?? undefined,
    status: (searchParams.get("status") as never) ?? undefined,
    onlyOpen: searchParams.get("onlyOpen") === "true",
  });

  return successResponse(data, "ok");
}

export async function POST(request: Request) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canManageWorkspaceMemory(membership.role)) {
    return errorResponse(
      getMemoryManagementDeniedMessage(english),
      "FORBIDDEN",
      403,
    );
  }

  const payload = createCommitmentSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return errorResponse(payload.error.issues[0]?.message ?? "参数不完整");
  }

  try {
    await assertWorkspaceRelatedObjectOwnership({
      workspaceId: workspace.id,
      contactId: payload.data.relatedContactId,
      companyId: payload.data.relatedCompanyId,
      opportunityId: payload.data.relatedOpportunityId,
      meetingId: payload.data.relatedMeetingId,
    });

    const created = await createCommitment({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      english,
      sourcePage: "/memory",
      ...payload.data,
      dueDate: payload.data.dueDate ? new Date(payload.data.dueDate) : null,
    });

    return successResponse(
      {
        id: created.id,
        status: created.status,
      },
      "commitment created",
    );
  } catch (error) {
    return errorResponse(
      isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "创建承诺失败"),
      isWorkspaceOwnershipError(error) ? "RELATED_OBJECT_NOT_FOUND" : "CREATE_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
