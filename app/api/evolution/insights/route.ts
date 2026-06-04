import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage,
} from "@/lib/auth/insight-governance";
import { getEvolutionInsights } from "@/lib/evolution/evolution-insights.service";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";

export async function GET(request: Request) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canManageWorkspaceInsights(membership.role)) {
    return errorResponse(
      getInsightGovernanceDeniedMessage(english),
      "INSIGHT_GOVERNANCE_REQUIRED",
      403,
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "4");

  const insights = await getEvolutionInsights({
    workspaceId: workspace.id,
    userId: user.id,
    limit: Number.isFinite(limit) ? limit : 4,
    locale: english ? "en-US" : "zh-CN",
  });

  return successResponse(insights, "ok");
}
