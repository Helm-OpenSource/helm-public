import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiValidationIssueMessage,
} from "@/lib/i18n/api-message-locale";
import { z } from "zod";
import {
  canManageWorkspaceRuntime,
  getRuntimeManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceReflectionJobOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { updateConsolidationJobStatus } from "@/lib/helm-v2/runtime-upgrade";
import { serverErrorMessage } from "@/lib/http/server-error";

const updateReflectionJobStatusSchema = z.object({
  mode: z.enum(["pause", "resume"]).optional(),
  sourcePage: z.string().min(1).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { membership, workspace, user } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const { id } = await params;

  if (!canManageWorkspaceRuntime(membership.role)) {
    return Response.json({ success: false, message: getRuntimeManagementDeniedMessage(english) }, { status: 403 });
  }

  try {
    await assertWorkspaceReflectionJobOwnership(workspace.id, id);

    const body = updateReflectionJobStatusSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) {
      return Response.json(
        {
          success: false,
          message: resolveApiValidationIssueMessage(workspace.defaultLocale, body.error.issues[0]?.message),
        },
        { status: 400 },
      );
    }
    const result = await updateConsolidationJobStatus({
      workspaceId: workspace.id,
      jobId: id,
      mode: body.data.mode === "pause" ? "pause" : "resume",
      actorUserId: user.id,
      actorName: user.name,
      sourcePage: body.data.sourcePage ?? "/operating",
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, message: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "Reflection job update failed") },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
