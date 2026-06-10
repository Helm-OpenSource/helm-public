import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canReviewWorkspaceRuntime,
  getRuntimeReviewDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceMeetingOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { confirmMeetingFactsRuntime } from "@/lib/helm-v2/meeting-action-pack-runtime";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { serverErrorMessage } from "@/lib/http/server-error";

const confirmSchema = z.object({
  meetingId: z.string().min(1),
  mode: z.enum(["confirm", "edit_confirm", "reject", "keep_draft"]),
  factsJson: z.string().optional(),
  actionPackMarkdown: z.string().optional(),
  reviewNotes: z.string().optional(),
});

export async function POST(request: Request) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const payload = confirmSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return Response.json(
      {
        success: false,
        message: payload.error.issues[0]?.message ?? "参数不完整",
      },
      { status: 400 },
    );
  }

  if (!canReviewWorkspaceRuntime(membership.role)) {
    return Response.json(
      { success: false, message: getRuntimeReviewDeniedMessage(english) },
      { status: 403 },
    );
  }

  try {
    await assertWorkspaceMeetingOwnership(workspace.id, payload.data.meetingId);

    const result = await confirmMeetingFactsRuntime({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      reviewerId: user.id,
      reviewerName: user.name,
      mode: payload.data.mode,
      edits: {
        factsJson: payload.data.factsJson,
        actionPackMarkdown: payload.data.actionPackMarkdown,
        reviewNotes: payload.data.reviewNotes,
      },
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "meeting-facts confirm failed"),
      },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
