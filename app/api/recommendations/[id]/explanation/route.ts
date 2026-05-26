import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { logEvent } from "@/lib/analytics";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { getRecommendationExplanation } from "@/lib/recommendations/recommendation.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentUser();
    const workspace = await getCurrentWorkspace();
    const { id } = await params;
    const data = await getRecommendationExplanation(workspace.id, id);
    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "recommendation_explanation_viewed",
      eventCategory: "recommendation",
      targetType: "RecommendationLog",
      targetId: id,
      sourcePage: request.url,
    });
    return successResponse(data, "ok");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "读取 recommendation 解释失败", "RECOMMENDATION_NOT_FOUND", 404);
  }
}
