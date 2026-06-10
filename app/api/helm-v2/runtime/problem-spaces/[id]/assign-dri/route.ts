import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import {
  canManageWorkspaceRuntime,
  getRuntimeManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceProblemSpaceOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import {
  getWorkspaceAssignableOwnerDeniedMessage,
  resolveWorkspaceAssignableOwnerId,
} from "@/lib/auth/workspace-data-governance";
import { assignProblemSpaceDri } from "@/lib/helm-v2/runtime-upgrade";
import { serverErrorMessage } from "@/lib/http/server-error";

const assignSchema = z.object({
  assignedUserId: z.string().optional(),
  assignedUserName: z.string().optional(),
  note: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const { id } = await params;
  const payload = assignSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return Response.json({ success: false, message: payload.error.issues[0]?.message ?? "参数不完整" }, { status: 400 });
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return Response.json({ success: false, message: getRuntimeManagementDeniedMessage(english) }, { status: 403 });
  }

  try {
    await assertWorkspaceProblemSpaceOwnership(workspace.id, id);
    const assignedUserId = payload.data.assignedUserId
      ? await resolveWorkspaceAssignableOwnerId({
          workspaceId: workspace.id,
          requestedOwnerId: payload.data.assignedUserId,
          fallbackUserId: user.id,
        })
      : undefined;
    if (payload.data.assignedUserId && !assignedUserId) {
      return Response.json({ success: false, message: getWorkspaceAssignableOwnerDeniedMessage(english) }, { status: 400 });
    }

    const result = await assignProblemSpaceDri({
      workspaceId: workspace.id,
      problemSpaceId: id,
      assignedUserId,
      assignedUserName: payload.data.assignedUserName,
      assignedByUserId: user.id,
      assignedByName: user.name,
      note: payload.data.note,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, message: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "Assign DRI failed") },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
