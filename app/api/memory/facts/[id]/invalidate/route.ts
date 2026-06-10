import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { assertWorkspaceMemoryFactOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { invalidateMemoryFact } from "@/lib/memory/correction.service";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { invalidateMemoryFactSchema } from "@/lib/memory/schemas";
import { canManageMemoryFacts, getMemoryFactManagementDeniedMessage } from "@/lib/memory/permissions";
import { serverErrorMessage } from "@/lib/http/server-error";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const { id } = await params;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const payload = invalidateMemoryFactSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return errorResponse(payload.error.issues[0]?.message ?? "参数不完整");
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

    const result = await invalidateMemoryFact({
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
      "memory fact invalidated",
    );
  } catch (error) {
    return errorResponse(
      isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "记忆失效失败"),
      isWorkspaceOwnershipError(error) ? "FACT_NOT_FOUND" : "INVALIDATE_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
