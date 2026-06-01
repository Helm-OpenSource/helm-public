import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage,
} from "@/lib/auth/insight-governance";
import { listSkillSuggestions } from "@/lib/evolution/skill-suggestion.service";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
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
  const status = searchParams.get("status") ?? undefined;

  const suggestions = await listSkillSuggestions(workspace.id, status);
  return successResponse({ suggestions }, "ok");
}
