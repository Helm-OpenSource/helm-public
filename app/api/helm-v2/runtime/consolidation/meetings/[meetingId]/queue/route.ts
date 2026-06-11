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
import { assertWorkspaceMeetingOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { queueConsolidationJob } from "@/lib/helm-v2/runtime-upgrade";
import { serverErrorMessage } from "@/lib/http/server-error";

const queueMeetingConsolidationSchema = z.object({
  sourcePage: z.string().min(1).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  const { membership, workspace, user } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const { meetingId } = await params;
  const payload = queueMeetingConsolidationSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return Response.json(
      {
        success: false,
        message: resolveApiValidationIssueMessage(workspace.defaultLocale, payload.error.issues[0]?.message),
      },
      { status: 400 },
    );
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return Response.json({ success: false, message: getRuntimeManagementDeniedMessage(english) }, { status: 403 });
  }

  try {
    await assertWorkspaceMeetingOwnership(workspace.id, meetingId);

    const result = await queueConsolidationJob({
      workspaceId: workspace.id,
      meetingId,
      actorUserId: user.id,
      actorName: user.name,
      sourcePage: payload.data.sourcePage ?? `/meetings/${meetingId}`,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, message: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "Consolidation queue failed") },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
