import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { logEvent } from "@/lib/analytics";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { serverErrorMessage } from "@/lib/http/server-error";

const supportedEvents = new Set(["recommendation_card_viewed", "recommendation_explanation_viewed"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentUser();
    const workspace = await getCurrentWorkspace();
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as { eventName?: string; sourcePage?: string | null } | null;
    const eventName = body?.eventName;

    if (!eventName || !supportedEvents.has(eventName)) {
      return errorResponse("不支持的 recommendation 埋点事件", "RECOMMENDATION_TRACK_UNSUPPORTED", 400);
    }

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName,
      eventCategory: "recommendation",
      targetType: "RecommendationLog",
      targetId: id,
      sourcePage: body?.sourcePage ?? request.url,
    });

    return successResponse({ ok: true }, "ok");
  } catch (error) {
    return errorResponse(serverErrorMessage(error, "记录 recommendation 埋点失败"), "RECOMMENDATION_TRACK_FAILED", 500);
  }
}
