import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { assertWorkspaceCommitmentOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { resolveCommitmentApiMessage } from "@/lib/i18n/api-commitment-messages";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { updateCommitmentStatus } from "@/lib/memory/commitment.service";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { updateCommitmentStatusSchema } from "@/lib/memory/schemas";
import { canManageWorkspaceMemory, getMemoryManagementDeniedMessage } from "@/lib/memory/permissions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const { id } = await params;

  if (!canManageWorkspaceMemory(membership.role)) {
    return errorResponse(getMemoryManagementDeniedMessage(english), "FORBIDDEN", 403);
  }

  const payload = updateCommitmentStatusSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return errorResponse(
      payload.error.issues[0]?.message ??
        resolveCommitmentApiMessage(workspace.defaultLocale, "missingRequiredFields"),
    );
  }

  try {
    await assertWorkspaceCommitmentOwnership(workspace.id, id);

    const updated = await updateCommitmentStatus({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      sourcePage: "/memory",
      commitmentId: id,
      status: payload.data.status,
      statusNote: payload.data.statusNote,
    });

    return successResponse(
      {
        id: updated.id,
        status: updated.status,
        fulfilledAt: updated.fulfilledAt,
      },
      english ? "Commitment status updated" : "承诺状态已更新",
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : resolveCommitmentApiMessage(workspace.defaultLocale, "updateFailed"),
      isWorkspaceOwnershipError(error) ? "COMMITMENT_NOT_FOUND" : "UPDATE_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
