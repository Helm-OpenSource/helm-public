"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  canPromoteWorkspaceGovernedCandidates,
  canReviewWorkspaceGovernedActions,
  getGovernedActionReviewDeniedMessage,
  getGovernedCandidatePromotionDeniedMessage,
} from "@/lib/auth/action-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isWorkspaceServiceGovernanceError } from "@/lib/auth/service-governance";
import {
  GovernedCandidateReviewError,
  promoteGovernedJudgementCandidateToTask,
  reviewGovernedJudgementCandidate,
} from "@/lib/governed-intelligence/governed-candidate-review";

const reviewActionSchema = z
  .object({
    artifactBundleId: z.string().trim().min(1).max(191),
    decision: z.enum(["confirm", "reject"]),
    notes: z.string().trim().max(2_000).optional(),
  })
  .strict();
const promotionActionSchema = z
  .object({
    artifactBundleId: z.string().trim().min(1).max(191),
    title: z.string().trim().min(1).max(191),
    description: z.string().trim().max(4_000).optional(),
  })
  .strict();

function candidateErrorMessage(
  error: GovernedCandidateReviewError,
  english: boolean,
) {
  const messages: Record<GovernedCandidateReviewError["code"], [string, string]> = {
    invalid_input: ["Invalid candidate review parameters.", "候选复核参数无效。"],
    artifact_not_found: ["Candidate artifact not found.", "候选产物不存在。"],
    artifact_contract_invalid: [
      "Candidate contract validation failed; it remains blocked.",
      "候选契约校验失败，当前保持阻断。",
    ],
    review_state_conflict: [
      "This candidate has already reached a different review state.",
      "该候选已进入其他复核终态。",
    ],
    promotion_requires_confirmation: [
      "Human confirmation is required before task promotion.",
      "晋级内部任务前必须先完成人工确认。",
    ],
    promotion_policy_forbidden: [
      "Workspace policy forbids this task action.",
      "当前工作区策略禁止此类任务动作。",
    ],
    promotion_policy_suggest_only: [
      "Workspace policy is suggest-only, so no task was created.",
      "当前策略仅允许建议，因此未创建任务。",
    ],
    promotion_state_conflict: [
      "Candidate promotion state is inconsistent and remains blocked.",
      "候选晋级状态不一致，当前保持阻断。",
    ],
  };
  return messages[error.code][english ? 0 : 1];
}

function refreshGovernedCandidatePaths() {
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
}

export async function reviewGovernedCandidateAction(input: unknown) {
  const { membership, user, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";
  const parsed = reviewActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: english ? "Invalid candidate review parameters." : "候选复核参数无效。",
    };
  }
  if (!canReviewWorkspaceGovernedActions(membership.role)) {
    return {
      ok: false as const,
      error: getGovernedActionReviewDeniedMessage(english),
    };
  }
  try {
    const result = await reviewGovernedJudgementCandidate({
      workspaceId: workspace.id,
      reviewerId: user.id,
      reviewerName: user.name,
      ...parsed.data,
    });
    refreshGovernedCandidatePaths();
    return { ok: true as const, result };
  } catch (error) {
    if (error instanceof GovernedCandidateReviewError) {
      return { ok: false as const, error: candidateErrorMessage(error, english) };
    }
    if (isWorkspaceServiceGovernanceError(error)) {
      return { ok: false as const, error: error.message };
    }
    throw error;
  }
}

export async function promoteGovernedCandidateToTaskAction(input: unknown) {
  const { membership, user, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";
  const parsed = promotionActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: english ? "A task title is required." : "请填写任务标题。",
    };
  }
  if (!canPromoteWorkspaceGovernedCandidates(membership.role)) {
    return {
      ok: false as const,
      error: getGovernedCandidatePromotionDeniedMessage(english),
    };
  }
  try {
    const result = await promoteGovernedJudgementCandidateToTask({
      workspaceId: workspace.id,
      actorUserId: user.id,
      actorName: user.name,
      ...parsed.data,
    });
    refreshGovernedCandidatePaths();
    return { ok: true as const, result };
  } catch (error) {
    if (error instanceof GovernedCandidateReviewError) {
      return { ok: false as const, error: candidateErrorMessage(error, english) };
    }
    if (isWorkspaceServiceGovernanceError(error)) {
      return { ok: false as const, error: error.message };
    }
    throw error;
  }
}
