import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { getTodayFocusRecommendations } from "@/lib/recommendations/recommendation.service";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUser();
    const workspace = await getCurrentWorkspace();
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
