import { UsageType } from "@prisma/client";
import { ensureWorkspaceProcessingAllowed, recordUsageLedgerEntry } from "@/lib/billing/foundation";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage,
} from "@/lib/auth/insight-governance";
import { assertWorkspaceMeetingOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { generateMeetingBriefingSnapshot } from "@/lib/memory/briefing.service";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { serverErrorMessage } from "@/lib/http/server-error";

export async function POST(request: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canManageWorkspaceInsights(membership.role)) {
    return errorResponse(getInsightGovernanceDeniedMessage(english), "INSIGHT_GOVERNANCE_REQUIRED", 403);
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "BRIEFING_GENERATION",
  });
  const { meetingId } = await params;
  const payload = (await request.json().catch(() => ({}))) as { force?: boolean };

  try {
    await assertWorkspaceMeetingOwnership(workspace.id, meetingId);

    const result = await generateMeetingBriefingSnapshot({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      sourcePage: `/meetings/${meetingId}`,
      meetingId,
      force: payload.force,
    });

    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.BRIEFING_GENERATION,
      sourcePage: `/meetings/${meetingId}`,
      metadata: {
        meetingId,
        operation: "meeting_briefing_refresh",
        snapshotId: result.snapshot.id,
      },
    });

    return successResponse(
      {
        snapshotId: result.snapshot.id,
        ...result.payload,
      },
      "briefing generated",
    );
  } catch (error) {
    return errorResponse(
      isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "生成简报失败"),
      isWorkspaceOwnershipError(error) ? "MEETING_NOT_FOUND" : "BRIEFING_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
