import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspacePolicies,
  getWorkspaceGovernanceDeniedMessage,
} from "@/lib/auth/settings-governance";
import {
  assertWorkspaceSkillSuggestionOwnership,
  isWorkspaceOwnershipError,
} from "@/lib/auth/tenant-ownership";
import { returnSkillFormalReviewForHardening } from "@/lib/evolution/skill-suggestion.service";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";

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
    await assertWorkspaceSkillSuggestionOwnership(workspace.id, id);

    const suggestion = await returnSkillFormalReviewForHardening({
      workspaceId: workspace.id,
      suggestionId: id,
      userId: user.id,
      actorName: user.name,
    });

    return successResponse(
      { suggestion },
      english ? "Skill formal review returned for hardening" : "正式评审已退回加固",
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : english
          ? "Failed to return skill formal review for hardening"
          : "退回加固失败",
      isWorkspaceOwnershipError(error) ? "SKILL_SUGGESTION_NOT_FOUND" : "FORMAL_REVIEW_RETURN_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
