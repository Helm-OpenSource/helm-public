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
    return errorResponse(english ? "Capture session not found" : "未找到对应现场记录", "CAPTURE_NOT_FOUND", 404);
  }

  return successResponse(session);
}
