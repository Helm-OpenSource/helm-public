import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage,
} from "@/lib/auth/insight-governance";
import { getActivePatternFacts } from "@/lib/evolution/evolution-insights.service";
import { isEnglishWorkspaceDefaultLocale, resolveApiWorkspaceMessage } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";

export async function GET(request: Request) {
  const { membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canManageWorkspaceInsights(membership.role)) {
    return errorResponse(
      getInsightGovernanceDeniedMessage(english),
      "INSIGHT_GOVERNANCE_REQUIRED",
      403,
    );
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const limit = Number(searchParams.get("limit") ?? "12");

  if (searchParams.get("userScoped") === "true" && !userId) {
    return errorResponse(
      resolveApiWorkspaceMessage(workspace.defaultLocale, {
        zh: "userScoped=true 时需要传 userId",
        en: "userId is required when userScoped=true",
      }),
    );
  }

  const patterns = await getActivePatternFacts({
    workspaceId: workspace.id,
    userId: userId ?? undefined,
    limit: Number.isFinite(limit) ? limit : 12,
  });

  return successResponse({ patterns }, "ok");
}
