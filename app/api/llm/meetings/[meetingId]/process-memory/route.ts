import { ActorType } from "@prisma/client";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { assertWorkspaceMeetingOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { processMeetingMemory } from "@/lib/memory/meeting-memory-pipeline.service";
import { canManageWorkspaceMemory, getMemoryManagementDeniedMessage } from "@/lib/memory/permissions";

export async function POST(_: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  let english = false;

  try {
    const session = await getCurrentWorkspaceSession();
    const { user, membership, workspace } = session;
    english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
    const { meetingId } = await params;

    if (!canManageWorkspaceMemory(membership.role)) {
      return Response.json(
        {
          success: false,
          message: getMemoryManagementDeniedMessage(english),
        },
        { status: 403 },
      );
    }

    await assertWorkspaceMeetingOwnership(workspace.id, meetingId);

    const result = await processMeetingMemory({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: ActorType.USER,
      sourcePage: `/meetings/${meetingId}`,
      meetingId,
      force: true,
    });

    return Response.json({
      success: true,
      data: {
        meetingId,
        factCount: result.facts.length,
        commitmentCount: result.commitments.length,
        blockerCount: result.blockers.length,
        actionItemCount: result.createdActionItems.length,
        briefingSnapshotId: result.briefing.snapshot.id,
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error
          ? error.message
          : english
            ? "Failed to process meeting memory"
            : "处理会议记忆失败",
      },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
