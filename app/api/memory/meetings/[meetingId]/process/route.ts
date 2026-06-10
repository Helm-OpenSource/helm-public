import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { assertWorkspaceMeetingOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiValidationIssueMessage,
} from "@/lib/i18n/api-message-locale";
import { processMeetingMemory } from "@/lib/memory/meeting-memory-pipeline.service";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { processMeetingMemorySchema } from "@/lib/memory/schemas";
import { canManageWorkspaceMemory, getMemoryManagementDeniedMessage } from "@/lib/memory/permissions";
import { serverErrorMessage } from "@/lib/http/server-error";

export async function POST(request: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const { meetingId } = await params;
  const payload = processMeetingMemorySchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return errorResponse(
      resolveApiValidationIssueMessage(workspace.defaultLocale, payload.error.issues[0]?.message),
    );
  }

  if (!canManageWorkspaceMemory(membership.role)) {
    return errorResponse(
      getMemoryManagementDeniedMessage(english),
      "FORBIDDEN",
      403,
    );
  }

  try {
    await assertWorkspaceMeetingOwnership(workspace.id, meetingId);

    const result = await processMeetingMemory({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      english,
      sourcePage: `/meetings/${meetingId}`,
      meetingId,
      force: payload.data.force,
    });

    return successResponse(
      {
        meetingId,
        factCount: result.facts.length,
        commitmentCount: result.commitments.length,
        blockerCount: result.blockers.length,
        briefingSnapshotId: result.briefing.snapshot.id,
      },
      "meeting memory processed",
    );
  } catch (error) {
    return errorResponse(
      isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, english ? "Failed to process meeting memory" : "处理会议记忆失败"),
      isWorkspaceOwnershipError(error) ? "MEETING_NOT_FOUND" : "MEETING_MEMORY_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
