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
  MemberSignalCandidateReviewError,
  promoteMemberWorkSignalCandidateToTask,
  reviewMemberWorkSignalCandidate,
} from "@/lib/member-gateway/signal-candidate-review.service";

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
    title: z.string().trim().min(1).max(175),
    description: z.string().trim().max(191).optional(),
  })
  .strict();

function candidateErrorMessage(
  error: MemberSignalCandidateReviewError,
  english: boolean,
) {
  const messages: Record<
    MemberSignalCandidateReviewError["code"],
    [string, string]
  > = {
    invalid_input: [
      "Invalid candidate review parameters.",
      "候选复核参数无效。",
    ],
    candidate_not_found: [
      "Candidate artifact not found.",
      "候选产物不存在。",
    ],
    candidate_artifact_corrupt: [
      "Candidate artifact failed validation and remains blocked.",
      "候选产物校验失败，当前保持阻断。",
    ],
    candidate_review_conflict: [
      "This candidate has already reached a different review state.",
      "该候选已进入其他复核终态。",
    ],
    signal_receipt_superseded: [
      "The underlying signal was superseded by a correction; this candidate is stale.",
      "对应信号已被修正取代，该候选已过期。",
    ],
    promotion_title_too_long: [
      "Task title is too long.",
      "任务标题过长。",
    ],
    promotion_description_too_long: [
      "Task description is too long.",
      "任务描述过长。",
    ],
    candidate_promotion_requires_confirmation: [
      "Human confirmation is required before task promotion.",
      "晋级为任务前必须先完成人工确认。",
    ],
    candidate_promotion_policy_forbidden: [
      "Workspace policy forbids this task action.",
      "当前工作区策略禁止此类任务动作。",
    ],
    candidate_promotion_policy_suggest_only: [
      "Workspace policy is suggest-only, so no task was created.",
      "当前策略仅允许建议，因此未创建任务。",
    ],
    candidate_promotion_state_conflict: [
      "Candidate promotion state is inconsistent and remains blocked.",
      "候选晋级状态不一致，当前保持阻断。",
    ],
  };
  return messages[error.code][english ? 0 : 1];
}

function refreshMemberSignalCandidatePaths() {
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
}

export async function reviewMemberSignalCandidateAction(input: unknown) {
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
    const result = await reviewMemberWorkSignalCandidate({
      workspaceId: workspace.id,
      reviewerId: user.id,
      reviewerName: user.name,
      ...parsed.data,
    });
    refreshMemberSignalCandidatePaths();
    return { ok: true as const, result };
  } catch (error) {
    if (error instanceof MemberSignalCandidateReviewError) {
      return { ok: false as const, error: candidateErrorMessage(error, english) };
    }
    if (isWorkspaceServiceGovernanceError(error)) {
      return { ok: false as const, error: error.message };
    }
    throw error;
  }
}

export async function promoteMemberSignalCandidateToTaskAction(
  input: unknown,
) {
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
    const result = await promoteMemberWorkSignalCandidateToTask({
      workspaceId: workspace.id,
      actorUserId: user.id,
      actorName: user.name,
      ...parsed.data,
    });
    refreshMemberSignalCandidatePaths();
    return { ok: true as const, result };
  } catch (error) {
    if (error instanceof MemberSignalCandidateReviewError) {
      return { ok: false as const, error: candidateErrorMessage(error, english) };
    }
    if (isWorkspaceServiceGovernanceError(error)) {
      return { ok: false as const, error: error.message };
    }
    throw error;
  }
}
