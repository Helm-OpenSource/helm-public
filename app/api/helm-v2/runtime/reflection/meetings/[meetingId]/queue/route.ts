import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import {
  canManageWorkspaceRuntime,
  getRuntimeManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceMeetingOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { queueReflectionJob } from "@/lib/helm-v2/runtime-upgrade";

export async function POST(_: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  const { membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const { meetingId } = await params;

  if (!canManageWorkspaceRuntime(membership.role)) {
    return Response.json({ success: false, message: getRuntimeManagementDeniedMessage(english) }, { status: 403 });
  }

  try {
    await assertWorkspaceMeetingOwnership(workspace.id, meetingId);

    const result = await queueReflectionJob({
      workspaceId: workspace.id,
      meetingId,
      trigger: "manual_operator_queue",
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "Reflection queue failed" },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
