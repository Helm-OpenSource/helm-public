import { z } from "zod";
import { getCurrentWorkspace, getCurrentWorkspaceSession, requireCurrentUser } from "@/lib/auth/session";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import {
  canManageWorkspaceRuntime,
  getRuntimeManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceMeetingOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { listConsolidationJobsForWorkspace, queueConsolidationJob } from "@/lib/helm-v2/runtime-upgrade";

const queueSchema = z.object({
  meetingId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

export async function GET() {
  await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const data = await listConsolidationJobsForWorkspace(workspace.id);
  return Response.json({ success: true, data });
}

export async function POST(request: Request) {
  const { membership, workspace, user } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const payload = queueSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return Response.json({ success: false, message: payload.error.issues[0]?.message ?? "参数不完整" }, { status: 400 });
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return Response.json({ success: false, message: getRuntimeManagementDeniedMessage(english) }, { status: 403 });
  }

  try {
    await assertWorkspaceMeetingOwnership(workspace.id, payload.data.meetingId);

    const data = await queueConsolidationJob({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      actorUserId: user.id,
      actorName: user.name,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });
    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "Consolidation queue failed" },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
