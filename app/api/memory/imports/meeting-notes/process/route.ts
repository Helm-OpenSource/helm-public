import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { assertWorkspaceMeetingOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiValidationIssueMessage,
} from "@/lib/i18n/api-message-locale";
import { processMeetingMemory } from "@/lib/memory/meeting-memory-pipeline.service";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { processImportedMeetingNoteSchema } from "@/lib/memory/schemas";
import { canManageWorkspaceMemory, getMemoryManagementDeniedMessage } from "@/lib/memory/permissions";
import { serverErrorMessage } from "@/lib/http/server-error";

export async function POST(request: Request) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const payload = processImportedMeetingNoteSchema.safeParse(await request.json().catch(() => ({})));

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
    await assertWorkspaceMeetingOwnership(workspace.id, payload.data.meetingId);

    const result = await processMeetingMemory({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      sourcePage: "/imports",
      meetingId: payload.data.meetingId,
      force: payload.data.force,
    });

    return successResponse(
      {
        meetingId: payload.data.meetingId,
        factCount: result.facts.length,
        commitmentCount: result.commitments.length,
        blockerCount: result.blockers.length,
        briefingSnapshotId: result.briefing.snapshot.id,
      },
      "imported meeting notes processed",
    );
  } catch (error) {
    return errorResponse(
      isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "导入纪要处理失败"),
      isWorkspaceOwnershipError(error) ? "MEETING_NOT_FOUND" : "IMPORTED_MEETING_MEMORY_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
