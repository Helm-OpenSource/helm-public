import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspacePolicies,
  getWorkspaceGovernanceDeniedMessage,
} from "@/lib/auth/settings-governance";
import { assertWorkspaceStrategySuggestionOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { dismissStrategySuggestion } from "@/lib/evolution/strategy-suggestion.service";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { serverErrorMessage } from "@/lib/http/server-error";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const { id } = await context.params;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canManageWorkspacePolicies(membership.role)) {
    return errorResponse(
      getWorkspaceGovernanceDeniedMessage(english),
      "WORKSPACE_POLICY_REQUIRED",
      403,
    );
  }

  try {
    await assertWorkspaceStrategySuggestionOwnership(workspace.id, id);

    const suggestion = await dismissStrategySuggestion({
      workspaceId: workspace.id,
      suggestionId: id,
      userId: user.id,
      actorName: user.name,
    });

    return successResponse(
      { suggestion },
      english ? "Strategy suggestion dismissed" : "策略建议已忽略",
    );
  } catch (error) {
    return errorResponse(
      isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, english ? "Failed to dismiss strategy suggestion" : "忽略策略建议失败"),
      isWorkspaceOwnershipError(error) ? "SUGGESTION_NOT_FOUND" : "DISMISS_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
