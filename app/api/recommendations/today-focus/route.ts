import { getCurrentWorkspaceSessionOrNull } from "@/lib/auth/session";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { getTodayFocusRecommendations } from "@/lib/recommendations/recommendation.service";

export async function GET(request: Request) {
  try {
    const session = await getCurrentWorkspaceSessionOrNull();

    if (!session) {
      return errorResponse("UNAUTHORIZED", "UNAUTHORIZED", 401);
    }

    const user = session.user;
    const workspace = session.workspace;
    const data = await getTodayFocusRecommendations({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      sourcePage: request.url,
    });

    return successResponse(data, "ok");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "生成今日重点失败", "TODAY_FOCUS_FAILED", 500);
  }
}
