import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { logEvent } from "@/lib/analytics";
import { resolveApiWorkspaceMessage } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { getRecommendationExplanation } from "@/lib/recommendations/recommendation.service";
import { serverErrorMessage } from "@/lib/http/server-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let workspaceLocale: string | null | undefined;

  try {
    const user = await requireCurrentUser();
    const workspace = await getCurrentWorkspace();
    workspaceLocale = workspace.defaultLocale;
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
    return errorResponse(
      serverErrorMessage(
        error,
        resolveApiWorkspaceMessage(workspaceLocale, {
          zh: "读取 recommendation 解释失败",
          en: "Failed to read recommendation explanation",
        }),
      ),
      "RECOMMENDATION_NOT_FOUND",
      404,
    );
  }
}
