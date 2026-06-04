import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspacePolicies,
  getWorkspaceGovernanceDeniedMessage,
} from "@/lib/auth/settings-governance";
import {
  assertWorkspaceSkillSuggestionOwnership,
  isWorkspaceOwnershipError,
} from "@/lib/auth/tenant-ownership";
import { deferSkillFormalReview } from "@/lib/evolution/skill-suggestion.service";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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

  const payload = await request.json().catch(() => ({}));
  try {
    await assertWorkspaceSkillSuggestionOwnership(workspace.id, id);

    const suggestion = await deferSkillFormalReview({
      workspaceId: workspace.id,
      suggestionId: id,
      userId: user.id,
      actorName: user.name,
      reviewNote: typeof payload.note === "string" ? payload.note : undefined,
      checklist: {
        catalogPatchReady: payload?.checklist?.catalogPatchReady === true,
        testsReady: payload?.checklist?.testsReady === true,
        guardsReady: payload?.checklist?.guardsReady === true,
        docsReady: payload?.checklist?.docsReady === true,
        boundaryConfirmed: payload?.checklist?.boundaryConfirmed === true,
      },
    });

    return successResponse(
      { suggestion },
      english ? "Skill formal review deferred" : "正式评审已暂缓",
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : english
          ? "Failed to defer skill formal review"
          : "暂缓正式评审失败",
      isWorkspaceOwnershipError(error) ? "SKILL_SUGGESTION_NOT_FOUND" : "FORMAL_REVIEW_DEFER_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
