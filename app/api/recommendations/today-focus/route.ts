import { getCurrentWorkspaceSessionOrNull } from "@/lib/auth/session";
import { resolveApiWorkspaceMessage } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { getTodayFocusRecommendations } from "@/lib/recommendations/recommendation.service";

export async function GET(request: Request) {
  let workspaceLocale: string | null | undefined;

  try {
    const session = await getCurrentWorkspaceSessionOrNull();

    if (!session) {
      return errorResponse("UNAUTHORIZED", "UNAUTHORIZED", 401);
    }

    const user = session.user;
    const workspace = session.workspace;
    workspaceLocale = workspace.defaultLocale;
    const data = await getTodayFocusRecommendations({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      sourcePage: request.url,
    });

    return successResponse(data, "ok");
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : resolveApiWorkspaceMessage(workspaceLocale, {
          zh: "生成今日重点失败",
          en: "Failed to generate today's focus",
        }),
      "TODAY_FOCUS_FAILED",
      500,
    );
  }
}
