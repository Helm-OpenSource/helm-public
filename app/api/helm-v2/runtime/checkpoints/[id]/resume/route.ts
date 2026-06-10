import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import {
  canManageWorkspaceRuntime,
  getRuntimeManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceRuntimeCheckpointOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { db } from "@/lib/db";
import { resumeRuntimeCheckpoint } from "@/lib/helm-v2/runtime-upgrade";
import { serverErrorMessage } from "@/lib/http/server-error";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const { id } = await params;

  if (!canManageWorkspaceRuntime(membership.role)) {
    return Response.json({ success: false, message: getRuntimeManagementDeniedMessage(english) }, { status: 403 });
  }

  try {
    await assertWorkspaceRuntimeCheckpointOwnership(workspace.id, id);
    const checkpoint = await db.sessionCheckpoint.findFirst({
      where: {
        workspaceId: workspace.id,
        id,
      },
      select: {
        runtimeSessionId: true,
      },
    });
    if (!checkpoint) {
      return Response.json({ success: false, message: "Checkpoint resume failed" }, { status: 404 });
    }

    const result = await resumeRuntimeCheckpoint({
      workspaceId: workspace.id,
      sessionId: checkpoint.runtimeSessionId,
      checkpointId: id,
      sourcePage: `/api/helm-v2/runtime/checkpoints/${id}/resume`,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, message: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "Checkpoint resume failed") },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
