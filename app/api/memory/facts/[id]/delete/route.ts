import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { assertWorkspaceMemoryFactOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiValidationIssueMessage,
} from "@/lib/i18n/api-message-locale";
import { deleteMemoryFact } from "@/lib/memory/correction.service";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { deleteMemoryFactSchema } from "@/lib/memory/schemas";
import { canManageMemoryFacts, getMemoryFactManagementDeniedMessage } from "@/lib/memory/permissions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const { id } = await params;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const payload = deleteMemoryFactSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return errorResponse(
      resolveApiValidationIssueMessage(workspace.defaultLocale, payload.error.issues[0]?.message),
    );
  }

  if (!canManageMemoryFacts(membership.role)) {
    return errorResponse(
      getMemoryFactManagementDeniedMessage(english),
      "FORBIDDEN",
      403,
    );
  }

  try {
    await assertWorkspaceMemoryFactOwnership(workspace.id, id);

    const result = await deleteMemoryFact({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      sourcePage: "/memory",
      memoryFactId: id,
      reason: payload.data.reason,
    });

    return successResponse(
      {
        id: result.fact.id,
        status: result.fact.status,
      },
      "memory fact deleted",
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : english
          ? "Failed to delete memory fact"
          : "删除记忆失败",
      isWorkspaceOwnershipError(error) ? "FACT_NOT_FOUND" : "DELETE_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
