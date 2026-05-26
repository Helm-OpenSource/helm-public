import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { getCaptureSessionDetails } from "@/lib/conversation-capture/capture-session.service";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ sessionId: string }>;
  },
) {
  await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const params = await context.params;
  const session = await getCaptureSessionDetails(workspace.id, params.sessionId);

  if (!session) {
    return errorResponse(english ? "Capture result not found" : "未找到对应现场记录结果", "CAPTURE_RESULT_NOT_FOUND", 404);
  }

  return successResponse(
    {
      session,
      transcript: session.transcript,
      insights: session.insightsByType,
      actions: session.actions,
      approvals: session.approvals,
    },
    "capture results",
  );
}
