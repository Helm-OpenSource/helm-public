import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiValidationIssueMessage,
} from "@/lib/i18n/api-message-locale";
import {
  canManageWorkspaceRuntime,
  getRuntimeManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceMeetingOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { ingestMeetingEndedRuntime } from "@/lib/helm-v2/meeting-action-pack-runtime";
import { getMeetingRuntimeUpgradeSummary } from "@/lib/helm-v2/runtime-upgrade";
import { serverErrorMessage } from "@/lib/http/server-error";

const ingestSchema = z.object({
  meetingId: z.string().min(1),
  force: z.boolean().optional(),
});

export async function POST(request: Request) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const payload = ingestSchema.safeParse(await request.json().catch(() => ({})));

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
    await assertWorkspaceMeetingOwnership(workspace.id, payload.data.meetingId);

    const result = await ingestMeetingEndedRuntime({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
      force: payload.data.force ?? false,
    });
    const summary = await getMeetingRuntimeUpgradeSummary(workspace.id, payload.data.meetingId);

    return Response.json({
      success: true,
      data: {
        ...result,
        v21: summary,
      },
    });
  } catch (error) {
    return Response.json(
      { success: false, message: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "Helm v2.1 meeting ingest failed") },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
