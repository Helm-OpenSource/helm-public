"use server";

import { revalidatePath } from "next/cache";
import { RecommendationFeedbackType } from "@prisma/client";
import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceGovernedActions,
  getGovernedActionManagementDeniedMessage,
} from "@/lib/auth/action-governance";
import {
  canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage,
} from "@/lib/auth/insight-governance";
import {
  assertWorkspaceActionItemOwnership,
  assertWorkspaceApprovalTaskOwnership,
  assertWorkspaceRecommendationOwnership,
} from "@/lib/auth/tenant-ownership";
import { db } from "@/lib/db";
import { submitRecommendationFeedback } from "@/lib/recommendations/recommendation-feedback.service";
import {
  createActionFromRecommendation,
  refreshRecommendationExplanationWithLLM,
} from "@/lib/recommendations/recommendation.service";
import { safeParseJson } from "@/lib/utils";

export async function createActionFromRecommendationAction(recommendationId: string, sourcePage?: string) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceGovernedActions(membership.role)) {
    return { ok: false as const, error: getGovernedActionManagementDeniedMessage(english) };
  }

  try {
    await assertWorkspaceRecommendationOwnership(workspace.id, recommendationId);

    const result = await createActionFromRecommendation({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      english,
      sourcePage,
      recommendationId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/approvals");
    revalidatePath("/opportunities");
    if (sourcePage) {
      revalidatePath(sourcePage);
    }
    revalidatePath("/search");
    revalidatePath("/meetings");
    revalidatePath("/analytics");
    revalidatePath("/reports");

    return { ok: true as const, result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : english ? "Failed to create an action from the recommendation" : "按 recommendation 生成动作失败" };
  }
}

export async function enhanceRecommendationExplanationAction(recommendationId: string, sourcePage?: string) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceInsights(membership.role)) {
    return {
      ok: false as const,
      error: getInsightGovernanceDeniedMessage(english),
    };
  }

  try {
    await assertWorkspaceRecommendationOwnership(workspace.id, recommendationId);
    const recommendation = await db.recommendationLog.findFirst({
      where: { workspaceId: workspace.id, id: recommendationId },
      select: { recommendationPayload: true },
    });
    const payload = safeParseJson<Record<string, unknown>>(
      recommendation?.recommendationPayload ?? "{}",
      {},
    );

    if (payload.llmEnhanced === true) {
      return { ok: true as const, skipped: true as const };
    }

    await refreshRecommendationExplanationWithLLM({
      workspaceId: workspace.id,
      recommendationId,
      userId: user.id,
    });

    revalidatePath("/dashboard");
    revalidatePath("/approvals");
    revalidatePath("/opportunities");
    revalidatePath("/search");
    revalidatePath("/meetings");
    revalidatePath("/analytics");
    revalidatePath("/reports");
    if (sourcePage) {
      revalidatePath(sourcePage);
    }

    return { ok: true as const, skipped: false as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to enhance recommendation with LLM"
            : "使用 LLM 增强 recommendation 失败",
    };
  }
}

const feedbackSchema = z.object({
  recommendationId: z.string(),
  feedbackType: z.nativeEnum(RecommendationFeedbackType),
  edited: z.boolean().optional(),
  resultNote: z.string().optional(),
  actionItemId: z.string().optional(),
  approvalTaskId: z.string().optional(),
  sourcePage: z.string().optional(),
});

export async function submitRecommendationFeedbackAction(input: z.infer<typeof feedbackSchema>) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";
  const parsed = feedbackSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? (english ? "Invalid feedback input" : "反馈参数错误") };
  }

  if (!canManageWorkspaceInsights(membership.role)) {
    return {
      ok: false as const,
      error: getInsightGovernanceDeniedMessage(workspace.defaultLocale === "en-US"),
    };
  }

  try {
    await assertWorkspaceRecommendationOwnership(workspace.id, parsed.data.recommendationId);
    if (parsed.data.actionItemId) {
      await assertWorkspaceActionItemOwnership(workspace.id, parsed.data.actionItemId);
    }
    if (parsed.data.approvalTaskId) {
      await assertWorkspaceApprovalTaskOwnership(workspace.id, parsed.data.approvalTaskId);
    }

    await submitRecommendationFeedback({
      workspaceId: workspace.id,
      recommendationId: parsed.data.recommendationId,
      userId: user.id,
      actorName: user.name,
      english,
      feedbackType: parsed.data.feedbackType,
      edited: parsed.data.edited,
      resultNote: parsed.data.resultNote,
      actionItemId: parsed.data.actionItemId,
      approvalTaskId: parsed.data.approvalTaskId,
      sourcePage: parsed.data.sourcePage,
    });

    revalidatePath("/dashboard");
    revalidatePath("/approvals");
    revalidatePath("/memory");
    revalidatePath("/analytics");
    revalidatePath("/reports");

    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : workspace.defaultLocale === "en-US" ? "Failed to record recommendation feedback" : "记录 recommendation 反馈失败" };
  }
}
