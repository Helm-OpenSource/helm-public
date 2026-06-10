import { RecommendationFeedbackType } from "@prisma/client";
import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage,
} from "@/lib/auth/insight-governance";
import {
  assertWorkspaceActionItemOwnership,
  assertWorkspaceApprovalTaskOwnership,
  assertWorkspaceRecommendationOwnership,
  isWorkspaceOwnershipError,
} from "@/lib/auth/tenant-ownership";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { errorResponse, successResponse } from "@/lib/memory/shared";
import { submitRecommendationFeedback } from "@/lib/recommendations/recommendation-feedback.service";
import { serverErrorMessage } from "@/lib/http/server-error";

const feedbackSchema = z.object({
  feedbackType: z.nativeEnum(RecommendationFeedbackType),
  edited: z.boolean().optional(),
  resultNote: z.string().optional(),
  actionItemId: z.string().optional(),
  approvalTaskId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, membership, workspace } = await getCurrentWorkspaceSession();
    const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
    if (!canManageWorkspaceInsights(membership.role)) {
      return errorResponse(
        getInsightGovernanceDeniedMessage(english),
        "INSIGHT_GOVERNANCE_REQUIRED",
        403,
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "反馈参数错误");
    }

    const { id } = await params;
    await assertWorkspaceRecommendationOwnership(workspace.id, id);
    if (parsed.data.actionItemId) {
      await assertWorkspaceActionItemOwnership(workspace.id, parsed.data.actionItemId);
    }
    if (parsed.data.approvalTaskId) {
      await assertWorkspaceApprovalTaskOwnership(workspace.id, parsed.data.approvalTaskId);
    }
    const data = await submitRecommendationFeedback({
      workspaceId: workspace.id,
      recommendationId: id,
      userId: user.id,
      actorName: user.name,
      english,
      feedbackType: parsed.data.feedbackType,
      edited: parsed.data.edited,
      resultNote: parsed.data.resultNote,
      actionItemId: parsed.data.actionItemId,
      approvalTaskId: parsed.data.approvalTaskId,
      sourcePage: request.url,
    });

    return successResponse(data, "反馈已记录");
  } catch (error) {
    return errorResponse(
      isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "提交 recommendation feedback 失败"),
      isWorkspaceOwnershipError(error) ? "RELATED_OBJECT_NOT_FOUND" : "RECOMMENDATION_FEEDBACK_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }
}
