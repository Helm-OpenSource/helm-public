import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiValidationIssueMessage,
} from "@/lib/i18n/api-message-locale";
import {
  canReviewWorkspaceRuntime,
  getRuntimeReviewDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceMeetingOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { runMeetingRuntimeVerificationPass } from "@/lib/helm-v2/runtime-upgrade";
import { serverErrorMessage } from "@/lib/http/server-error";

const verificationSchema = z.object({
  meetingId: z.string().min(1),
});

export async function POST(request: Request) {
  const { membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const payload = verificationSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return Response.json(
      {
        success: false,
        message: resolveApiValidationIssueMessage(workspace.defaultLocale, payload.error.issues[0]?.message),
      },
      { status: 400 },
    );
  }

  if (!canReviewWorkspaceRuntime(membership.role)) {
    return Response.json({ success: false, message: getRuntimeReviewDeniedMessage(english) }, { status: 403 });
  }

  try {
    await assertWorkspaceMeetingOwnership(workspace.id, payload.data.meetingId);

    const result = await runMeetingRuntimeVerificationPass({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, message: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "Verification run failed") },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
