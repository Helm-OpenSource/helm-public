import { logEvent } from "@/lib/analytics";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage,
} from "@/lib/auth/insight-governance";
import { assertWorkspaceRecommendationOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { refreshRecommendationExplanationWithLLM } from "@/lib/recommendations/recommendation.service";

export async function POST(_: Request, { params }: { params: Promise<{ recommendationId: string }> }) {
  let english = false;

  try {
    const { user, membership, workspace } = await getCurrentWorkspaceSession();
    const { recommendationId } = await params;
    english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

    if (!canManageWorkspaceInsights(membership.role)) {
      return Response.json(
        {
          success: false,
          message: getInsightGovernanceDeniedMessage(english),
        },
        { status: 403 },
      );
    }

    await assertWorkspaceRecommendationOwnership(workspace.id, recommendationId);

    const data = await refreshRecommendationExplanationWithLLM({
      workspaceId: workspace.id,
      recommendationId,
      userId: user.id,
      english,
    });

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "recommendation_explanation_refreshed",
      eventCategory: "llm",
      targetType: "RecommendationLog",
      targetId: recommendationId,
      metadata: {
        supportingFactCount: data.supportingFacts.length,
        blockerCount: data.blockers.length,
        commitmentCount: data.commitments.length,
      },
      sourcePage: "/approvals",
    });

    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error
          ? error.message
          : english
            ? "Failed to enhance recommendation explanation"
            : "增强建议解释失败",
      },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
