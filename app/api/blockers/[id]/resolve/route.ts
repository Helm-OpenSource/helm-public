import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { assertWorkspaceBlockerOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { resolveBlocker } from "@/lib/memory/blocker.service";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { resolveBlockerSchema } from "@/lib/memory/schemas";
import { canManageWorkspaceMemory, getMemoryManagementDeniedMessage } from "@/lib/memory/permissions";
import { serverErrorMessage } from "@/lib/http/server-error";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const { id } = await params;
  const payload = resolveBlockerSchema.safeParse(await request.json().catch(() => ({})));

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
    await assertWorkspaceBlockerOwnership(workspace.id, id);

    const updated = await resolveBlocker({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      sourcePage: "/memory",
      blockerId: id,
      resolutionNote: payload.data.resolutionNote,
    });

    return successResponse(
      {
        id: updated.id,
        status: updated.status,
        resolvedAt: updated.resolvedAt,
      },
      "blocker resolved",
    );
  } catch (error) {
    return errorResponse(
      isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "解决阻塞失败"),
      isWorkspaceOwnershipError(error) ? "BLOCKER_NOT_FOUND" : "RESOLVE_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
