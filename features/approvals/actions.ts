"use server";

import { ActorType, RejectionReasonCode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canReviewWorkspaceGovernedActions,
  getGovernedActionReviewDeniedMessage,
} from "@/lib/auth/action-governance";
import {
  canManageWorkspacePolicies,
  getWorkspaceGovernanceDeniedMessage,
} from "@/lib/auth/settings-governance";
import { db } from "@/lib/db";
import {
  approveApprovalTask,
  blockApprovedAction,
  executeActionItem,
  HighRiskApprovalIdentityError,
  markApprovalManual,
  rejectApprovalTask,
  SelfApprovalNotAllowedError,
  setActionTypeAutoPolicy,
} from "@/lib/policies/engine";
import {
  ReceiptSelfVerificationError,
  verifyExecutionReceipt,
} from "@/lib/receipts/execution-receipt.service";
import { ExecutionReceiptSubjectType } from "@prisma/client";

async function resolveApprovalTaskForWorkspace(taskId: string, workspaceId: string) {
  return db.approvalTask.findFirst({
    where: {
      id: taskId,
      workspaceId,
    },
    include: {
      actionItem: true,
    },
  });
}

export async function approveTaskAction(taskId: string, editedContent?: string) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";

  if (!canReviewWorkspaceGovernedActions(membership.role)) {
    return { ok: false, error: getGovernedActionReviewDeniedMessage(english) };
  }

  const task = await resolveApprovalTaskForWorkspace(taskId, workspace.id);

  if (!task) {
    return { ok: false, error: english ? "Approval task not found" : "审批任务不存在" };
  }

  try {
    await approveApprovalTask(task.id, user.name, user.id, editedContent, {
      actorType: ActorType.USER,
      english,
    });
  } catch (error) {
    // Separation-of-duties denials are governance decisions, not crashes:
    // return them to the reviewer as a readable result.
    if (error instanceof SelfApprovalNotAllowedError || error instanceof HighRiskApprovalIdentityError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  revalidatePath("/memory");

  return { ok: true };
}

export async function executeApprovedTaskAction(taskId: string, editedContent?: string) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";

  if (!canReviewWorkspaceGovernedActions(membership.role)) {
    return { ok: false, error: getGovernedActionReviewDeniedMessage(english) };
  }

  const task = await resolveApprovalTaskForWorkspace(taskId, workspace.id);

  if (!task) {
    return { ok: false, error: english ? "Approval task not found" : "审批任务不存在" };
  }

  await executeActionItem(task.actionItemId, {
    actorName: user.name,
    actorType: ActorType.USER,
    actorUserId: user.id,
    english,
    editedContent,
    decisionReason: editedContent
      ? english
        ? "Executed after approval with edited content"
        : "已批准后按编辑内容执行"
      : english
        ? "Executed after approval"
        : "已批准后执行",
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "APPROVAL_APPROVED",
    targetType: "ApprovalTask",
    targetId: task.id,
    summary: english ? `Executed approved action: ${task.actionItem.title}` : `已执行已批准动作：${task.actionItem.title}`,
    payload: { editedContent },
  });

  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  revalidatePath("/memory");

  return { ok: true };
}

const blockSchema = z.object({
  taskId: z.string(),
  reason: z.string().optional(),
});

export async function blockApprovedTaskAction(input: z.infer<typeof blockSchema>) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: english ? "Invalid parameters" : "参数错误" };

  if (!canReviewWorkspaceGovernedActions(membership.role)) {
    return { ok: false, error: getGovernedActionReviewDeniedMessage(english) };
  }

  const task = await resolveApprovalTaskForWorkspace(parsed.data.taskId, workspace.id);
  if (!task) {
    return { ok: false, error: english ? "Approval task not found" : "审批任务不存在" };
  }

  await blockApprovedAction(task.actionItemId, user.name, user.id, parsed.data.reason, {
    actorType: ActorType.USER,
    english,
  });

  return { ok: true };
}

const rejectSchema = z.object({
  taskId: z.string(),
  reason: z.string().optional(),
  reasonCode: z.nativeEnum(RejectionReasonCode).optional(),
});

export async function rejectTaskAction(input: z.infer<typeof rejectSchema>) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: english ? "Invalid parameters" : "参数错误" };

  if (!canReviewWorkspaceGovernedActions(membership.role)) {
    return { ok: false, error: getGovernedActionReviewDeniedMessage(english) };
  }

  const task = await resolveApprovalTaskForWorkspace(parsed.data.taskId, workspace.id);
  if (!task) {
    return { ok: false, error: english ? "Approval task not found" : "审批任务不存在" };
  }

  await rejectApprovalTask(parsed.data.taskId, user.name, user.id, parsed.data.reason, {
    actorType: ActorType.USER,
    english,
    rejectionReasonCode: parsed.data.reasonCode,
  });
  return { ok: true };
}

// Receipt-level separation of duties: a reviewer other than the executor
// confirms the closed action's receipt, upgrading it from SELF_REPORTED to
// VERIFIED. Self-verification is refused as a readable governance result.
export async function verifyExecutedTaskReceiptAction(taskId: string) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";

  if (!canReviewWorkspaceGovernedActions(membership.role)) {
    return { ok: false, error: getGovernedActionReviewDeniedMessage(english) };
  }

  const task = await resolveApprovalTaskForWorkspace(taskId, workspace.id);
  if (!task) {
    return { ok: false, error: english ? "Approval task not found" : "审批任务不存在" };
  }

  try {
    await verifyExecutionReceipt({
      workspaceId: workspace.id,
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: task.actionItemId,
      verifierUserId: user.id,
      verifierName: user.name,
      english,
    });
  } catch (error) {
    if (error instanceof ReceiptSelfVerificationError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof Error && error.message.includes(english ? "not found" : "不存在")) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath("/approvals");
  return { ok: true };
}

export async function convertTaskToManualAction(taskId: string) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";

  if (!canReviewWorkspaceGovernedActions(membership.role)) {
    return { ok: false, error: getGovernedActionReviewDeniedMessage(english) };
  }

  const task = await resolveApprovalTaskForWorkspace(taskId, workspace.id);
  if (!task) {
    return { ok: false, error: english ? "Approval task not found" : "审批任务不存在" };
  }

  await markApprovalManual(taskId, user.name, user.id, {
    actorType: ActorType.USER,
    english,
  });
  return { ok: true };
}

export async function enableAutoExecutionForTaskTypeAction(taskId: string) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspacePolicies(membership.role)) {
    return { ok: false, error: getWorkspaceGovernanceDeniedMessage(english) };
  }

  const task = await resolveApprovalTaskForWorkspace(taskId, workspace.id);
  if (!task) {
    return { ok: false, error: english ? "Approval task not found" : "审批任务不存在" };
  }

  await setActionTypeAutoPolicy(taskId, user.name, user.id, {
    actorType: ActorType.USER,
    english,
  });
  return { ok: true };
}
