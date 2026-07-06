import {
  ActionExecutionMode,
  ActionStatus,
  ActionType,
  ActorType,
  ApprovalStatus,
  MemoryEntityType,
  MemoryType,
  NotificationType,
  OpportunityStage,
  RecommendationFeedbackType,
  SourceType,
  type ApprovalTask,
  type RejectionReasonCode,
  type RiskLevel,
} from "@prisma/client";
import { addDays, addHours } from "date-fns";
import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/analytics";
import {
  assertWorkspaceGovernedActionManagementServiceAccess,
  assertWorkspaceGovernedActionReviewServiceAccess,
  assertWorkspacePolicyServiceAccess,
} from "@/lib/auth/service-governance";
import { writeAuditLog } from "@/lib/audit";
import {
  writeBiReportHandoffApprovalReceipt,
  writeBiReportHandoffExecutionReceipt,
  writeBiReportHandoffRejectionReceipt,
} from "@/lib/bi-report-skill/handoff-receipt";
import { db } from "@/lib/db";
import { resolvePolicyDecision } from "@/lib/policies";
import { getRejectionReasonLabel } from "@/lib/policies/rejection-reason";
import { submitRecommendationFeedback } from "@/lib/recommendations/recommendation-feedback.service";
import { jsonStringify, safeParseJson } from "@/lib/utils";

type CreateGovernedActionInput = {
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  english?: boolean;
  actionType: ActionType;
  title: string;
  description?: string;
  aiReason?: string;
  draftContent?: string;
  riskLevel: RiskLevel;
  dueDate?: Date;
  suggestedExecutionAt?: Date;
  meetingId?: string;
  opportunityId?: string;
  contactId?: string;
  ownerId?: string;
  approverId?: string;
  recommendationLogId?: string;
  sourceType?: SourceType;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  resultPreview?: string;
  // Who authored the proposed content. Defaults to AI: every built-in flow
  // today composes the draft for the user, and the human review gate exists
  // precisely to review that AI-authored content. A flow where a human writes
  // the content themselves must declare USER explicitly — that is what arms
  // the high-risk self-approval block in approveApprovalTask.
  contentAuthorship?: ActorType;
};

type ApprovalActionResult = {
  actionItemId: string;
  approvalTaskId?: string;
  status: ActionStatus;
  requiresApproval: boolean;
  reason: string;
};

// Separation-of-duties review gate errors. Both are governance denials the
// feature layer should surface as a decision result, not as a crash.
export class SelfApprovalNotAllowedError extends Error {
  constructor(english: boolean) {
    super(
      english
        ? "Separation of duties: the person who initiated a high-risk action cannot approve it. Ask another reviewer."
        : "职责分离：高风险动作的发起人不能自行批准，请交由其他复核人处理。",
    );
    this.name = "SelfApprovalNotAllowedError";
  }
}

export class HighRiskApprovalIdentityError extends Error {
  constructor(english: boolean) {
    super(
      english
        ? "High-risk approvals must be made by a real signed-in user identity, not a system or AI actor."
        : "高风险动作的最终批准必须由真实登录用户身份发起，不能由系统或 AI 身份代批。",
    );
    this.name = "HighRiskApprovalIdentityError";
  }
}

export async function createGovernedAction(input: CreateGovernedActionInput): Promise<ApprovalActionResult> {
  await assertWorkspaceGovernedActionManagementServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const policy = await db.policyRule.findFirst({
    where: {
      workspaceId: input.workspaceId,
      actionType: input.actionType,
    },
  });

  const decision = resolvePolicyDecision({
    actionType: input.actionType,
    riskLevel: input.riskLevel,
    policy,
  });

  const policySnapshot = {
    policyId: policy?.id ?? null,
    policyName: decision.appliedPolicyName,
    configuredMode: decision.appliedPolicyMode,
    configuredRiskThreshold: decision.appliedRiskThreshold,
    resolvedMode: decision.mode,
    resolvedBy: decision.resolvedBy,
    reason: decision.reason,
  };

  const created = await db.actionItem.create({
    data: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      opportunityId: input.opportunityId,
      contactId: input.contactId,
      ownerId: input.ownerId,
      actionType: input.actionType,
      title: input.title,
      description: input.description,
      aiReason: input.aiReason,
      draftContent: input.draftContent,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      sourceType: input.sourceType ?? (input.meetingId ? SourceType.MEETING : SourceType.SYSTEM_INFERENCE),
      sourceId: input.sourceId ?? input.meetingId ?? input.opportunityId ?? input.contactId ?? input.title,
      riskLevel: input.riskLevel,
      dueDate: input.dueDate,
      suggestedExecutionAt: input.suggestedExecutionAt,
      executionMode: decision.mode,
      requiresApproval: decision.requiresApproval,
      statusReason: decision.reason,
      policyName: decision.appliedPolicyName ?? policy?.name ?? null,
      policySnapshot: jsonStringify(policySnapshot),
      recommendationLogId: input.recommendationLogId,
      createdByUserId: input.actorUserId ?? null,
      contentAuthorship: input.contentAuthorship ?? ActorType.AI,
      status: decision.blocked
        ? ActionStatus.BLOCKED
        : decision.requiresApproval
          ? ActionStatus.PENDING_APPROVAL
          : decision.mode === ActionExecutionMode.SUGGEST_ONLY
            ? ActionStatus.SUGGESTED
            : ActionStatus.APPROVED,
      executionStatus: decision.blocked
        ? "blocked"
        : decision.requiresApproval
          ? "pending_approval"
          : decision.mode === ActionExecutionMode.SUGGEST_ONLY
            ? "suggested"
            : "approved",
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actor: "Helm AI",
    actorType: ActorType.AI,
    actionType: "AI_GENERATED_ACTION",
    targetType: "ActionItem",
    targetId: created.id,
    summary: `AI 生成动作建议：${input.title}`,
    payload: {
      policy: policy?.name,
      decision,
      input,
    },
  });

  if (
    input.actionType === ActionType.DRAFT_EXTERNAL_EMAIL ||
    input.actionType === ActionType.GENERATE_REPLY_DRAFT
  ) {
    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      eventName: "followup_draft_generated",
      eventCategory: "ai_action",
      targetType: "ActionItem",
      targetId: created.id,
      metadata: {
        actionType: input.actionType,
        contactId: input.contactId,
        opportunityId: input.opportunityId,
        riskLevel: input.riskLevel,
      },
      sourcePage: input.meetingId ? `/meetings/${input.meetingId}` : input.contactId ? `/contacts/${input.contactId}` : "/opportunities",
    });
  }

  let approvalTask: ApprovalTask | null = null;

  if (decision.requiresApproval) {
    approvalTask = await db.approvalTask.create({
      data: {
        workspaceId: input.workspaceId,
        actionItemId: created.id,
        approverId: input.approverId,
        status: ApprovalStatus.PENDING,
        isHighRisk: input.riskLevel === "HIGH" || input.riskLevel === "CRITICAL",
        autoExecute: false,
        contextSnapshot: input.description,
        reasoning: input.aiReason,
        editableContent: input.draftContent ?? input.description,
        resultPreview: input.resultPreview ?? "审批通过后将执行该动作并写入审计日志。",
        decisionReason: decision.reason,
        channel: input.actionType === ActionType.DRAFT_EXTERNAL_EMAIL ? "外发动作" : "内部动作",
      },
    });

    await db.notification.create({
      data: {
        workspaceId: input.workspaceId,
        type: NotificationType.APPROVAL,
        title: `待审批：${input.title}`,
        body: input.aiReason ?? "系统拦截了一条需要人工确认的动作。",
        url: "/approvals",
      },
    });

    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      eventName: "approval_submitted",
      eventCategory: "approval",
      targetType: "ApprovalTask",
      targetId: approvalTask.id,
      metadata: {
        actionItemId: created.id,
        actionType: input.actionType,
        riskLevel: input.riskLevel,
        channel: approvalTask.channel,
        decision,
      },
      sourcePage: "/approvals",
    });
  } else if (decision.blocked) {
    await writeActionMemory(input.workspaceId, {
      companyId: null,
      contactId: input.contactId,
      opportunityId: input.opportunityId,
      meetingId: input.meetingId,
      entityType: input.meetingId ? MemoryEntityType.MEETING : input.contactId ? MemoryEntityType.CONTACT : MemoryEntityType.OPPORTUNITY,
      title: `${input.title} 未执行`,
      content: `该动作已被策略阻止：${decision.reason}`,
    });

    if (input.recommendationLogId) {
      await submitRecommendationFeedback({
        workspaceId: input.workspaceId,
        recommendationId: input.recommendationLogId,
        userId: input.actorUserId,
        actorName: input.actorName,
        feedbackType: RecommendationFeedbackType.FAILED,
        resultNote: decision.reason,
        actionItemId: created.id,
        sourcePage: input.meetingId ? `/meetings/${input.meetingId}` : input.contactId ? `/contacts/${input.contactId}` : "/dashboard",
      });
    }
  }

  if (!decision.requiresApproval && !decision.blocked && decision.mode !== ActionExecutionMode.SUGGEST_ONLY) {
    await executeActionItem(created.id, {
      actorName: "系统",
      actorType: ActorType.SYSTEM,
      actorUserId: input.actorUserId,
      decisionReason: `按策略自动执行：${decision.reason}`,
    });
  }

  revalidateCorePaths();

  return {
    actionItemId: created.id,
    approvalTaskId: approvalTask?.id,
    status: created.status,
    requiresApproval: decision.requiresApproval,
    reason: decision.reason,
  };
}

export async function executeActionItem(
  actionItemId: string,
  actor: {
    actorName: string;
    actorType: ActorType;
    actorUserId?: string | null;
    english?: boolean;
    editedContent?: string;
    decisionReason?: string;
  },
) {
  const action = await db.actionItem.findUnique({
    where: { id: actionItemId },
    include: {
      workspace: true,
      opportunity: true,
      contact: true,
      meeting: {
        include: {
          company: true,
        },
      },
      approvalTask: true,
      recommendationLog: true,
    },
  });

  if (!action) {
    throw new Error("Action item not found");
  }

  await assertWorkspaceGovernedActionReviewServiceAccess({
    workspaceId: action.workspaceId,
    userId: actor.actorUserId,
    actorType: actor.actorType,
    english: actor.english ?? false,
  });

  if (action.status === ActionStatus.EXECUTED) {
    return action;
  }

  // Boundary guard: when an action required approval it carries an approval
  // task, and execution is only permitted once that task is approved (its
  // terminal "EXECUTED" = approved state). A task that is still PENDING (not
  // yet approved) or that was REJECTED/WITHDRAWN must never reach execution —
  // otherwise a rejected suggestion could be executed. Actions with no approval
  // task are the non-gated auto-execute path and proceed unchanged.
  if (action.approvalTask && action.approvalTask.status !== ApprovalStatus.EXECUTED) {
    throw new Error(
      "Cannot execute this action: its approval is not in an approved state",
    );
  }

  const metadata = safeParseJson<Record<string, unknown>>(action.metadata, {});
  const policySnapshot = safeParseJson<Record<string, unknown>>(action.policySnapshot, {});
  const draftContent = actor.editedContent ?? action.draftContent ?? action.description ?? action.title;
  const now = new Date();
  const companyId = action.meeting?.companyId ?? action.opportunity?.companyId ?? action.contact?.companyId ?? null;
  const approvalAlreadyReviewed = action.approvalTask?.status === ApprovalStatus.EXECUTED;

  switch (action.actionType) {
    case ActionType.DRAFT_EXTERNAL_EMAIL:
    case ActionType.GENERATE_REPLY_DRAFT: {
      await writeActionMemory(action.workspaceId, {
        companyId,
        contactId: action.contactId,
        opportunityId: action.opportunityId,
        meetingId: action.meetingId,
        entityType: action.contactId ? MemoryEntityType.CONTACT : MemoryEntityType.OPPORTUNITY,
        title: `${action.title} 已执行`,
        content: `已生成并确认外发草稿：${draftContent}`,
      });

      if (action.contactId) {
        await db.contact.update({
          where: { id: action.contactId },
          data: { lastInteractionAt: now },
        });
      }

      if (action.opportunityId && typeof metadata.nextStage === "string") {
        await updateOpportunityProgress({
          workspaceId: action.workspaceId,
          opportunityId: action.opportunityId,
          actor,
          stage: metadata.nextStage as OpportunityStage,
        });
      }
      break;
    }
    case ActionType.DRAFT_INTERNAL_NOTE:
    case ActionType.SEND_MEETING_SUMMARY: {
      await writeActionMemory(action.workspaceId, {
        companyId,
        opportunityId: action.opportunityId,
        meetingId: action.meetingId,
        entityType: action.meetingId ? MemoryEntityType.MEETING : MemoryEntityType.OPPORTUNITY,
        title: `${action.title} 已执行`,
        content: draftContent,
      });
      break;
    }
    case ActionType.CREATE_MEETING:
    case ActionType.SCHEDULE_INTERVIEW: {
      const createdMeeting = await db.meeting.create({
        data: {
          workspaceId: action.workspaceId,
          companyId: action.meeting?.companyId ?? action.opportunity?.companyId,
          opportunityId: action.opportunityId,
          ownerId: action.ownerId,
          title:
            typeof metadata.createMeetingTitle === "string"
              ? metadata.createMeetingTitle
              : `${action.title} 跟进会议`,
          agenda: typeof metadata.agenda === "string" ? metadata.agenda : action.description,
          location: "Calendar 占位",
          status: "SCHEDULED",
          startsAt: addDays(addHours(now, 1), 2),
          endsAt: addDays(addHours(now, 2), 2),
          contacts: action.contactId ? { connect: [{ id: action.contactId }] } : undefined,
        },
      });

      await writeActionMemory(action.workspaceId, {
        companyId,
        contactId: action.contactId,
        opportunityId: action.opportunityId,
        meetingId: createdMeeting.id,
        entityType: MemoryEntityType.MEETING,
        title: `${createdMeeting.title} 已创建`,
        content: `系统已根据审批结果创建会议占位：${createdMeeting.title}`,
      });

      if (action.opportunityId && typeof metadata.nextStage === "string") {
        await updateOpportunityProgress({
          workspaceId: action.workspaceId,
          opportunityId: action.opportunityId,
          actor,
          stage: metadata.nextStage as OpportunityStage,
        });
      }
      break;
    }
    case ActionType.UPDATE_OPPORTUNITY_STAGE: {
      if (action.opportunityId) {
        await updateOpportunityProgress({
          workspaceId: action.workspaceId,
          opportunityId: action.opportunityId,
          actor,
          stage: typeof metadata.nextStage === "string" ? (metadata.nextStage as OpportunityStage) : undefined,
          nextAction: typeof metadata.nextAction === "string" ? metadata.nextAction : action.opportunity?.nextAction ?? undefined,
        });
      }
      break;
    }
    case ActionType.CREATE_TASK: {
      await writeActionMemory(action.workspaceId, {
        companyId,
        opportunityId: action.opportunityId,
        contactId: action.contactId,
        entityType: action.contactId ? MemoryEntityType.CONTACT : MemoryEntityType.OPPORTUNITY,
        title: `${action.title} 已创建`,
        content: action.description ?? action.title,
      });
      break;
    }
    case ActionType.ASSIGN_OWNER: {
      if (action.opportunityId && typeof metadata.assignToEmail === "string") {
        const user = await db.user.findUnique({
          where: { email: metadata.assignToEmail },
        });
        if (user) {
          await db.opportunity.update({
            where: { id: action.opportunityId },
            data: { ownerId: user.id },
          });
        }
      }
      break;
    }
    case ActionType.CHANGE_DUE_DATE: {
      if (action.opportunityId) {
        const opportunity = action.opportunity;
        const daysOffset =
          typeof metadata.dueDateOffsetDays === "number" ? Number(metadata.dueDateOffsetDays) : 1;
        const nextDueDate = opportunity?.dueDate ? addDays(opportunity.dueDate, daysOffset) : addDays(now, daysOffset);
        await updateOpportunityProgress({
          workspaceId: action.workspaceId,
          opportunityId: action.opportunityId,
          actor,
          dueDate: nextDueDate,
        });
      }
      break;
    }
  }

  await db.actionItem.update({
    where: { id: action.id },
    data: {
      status: ActionStatus.EXECUTED,
      executionStatus: "executed",
      draftContent,
      executedAt: now,
      statusReason: actor.decisionReason ?? (action.approvalTask ? "已批准执行" : "按策略自动执行"),
    },
  });

  if (action.approvalTask && !approvalAlreadyReviewed) {
    await db.approvalTask.update({
      where: { id: action.approvalTask.id },
      data: {
        status: ApprovalStatus.EXECUTED,
        reviewedAt: now,
        reviewedById: actor.actorUserId ?? undefined,
        editableContent: draftContent,
        decisionReason: actor.decisionReason ?? "已批准执行",
      },
    });
  }

  await writeAuditLog({
    workspaceId: action.workspaceId,
    userId: actor.actorUserId,
    actor: actor.actorName,
    actorType: actor.actorType,
    actionType: "ACTION_EXECUTED",
    targetType: "ActionItem",
    targetId: action.id,
    summary: `${action.title} 已执行`,
    payload: {
      actionType: action.actionType,
      metadata,
      policySnapshot,
      draftContent,
    },
  });

  if (action.approvalTask && !approvalAlreadyReviewed) {
    await logEvent({
      workspaceId: action.workspaceId,
      userId: actor.actorUserId,
      eventName: "approval_approved",
      eventCategory: "approval",
      targetType: "ApprovalTask",
      targetId: action.approvalTask.id,
      metadata: {
        actionItemId: action.id,
        actionType: action.actionType,
        riskLevel: action.riskLevel,
        companyId,
        decisionReason: actor.decisionReason ?? "已批准执行",
      },
      sourcePage: "/approvals",
    });
  } else {
    await logEvent({
      workspaceId: action.workspaceId,
      userId: actor.actorUserId,
      eventName: "action_auto_executed",
      eventCategory: "execution",
      targetType: "ActionItem",
      targetId: action.id,
      metadata: {
        actionType: action.actionType,
        policySnapshot,
        companyId,
        decisionReason: actor.decisionReason ?? "按策略自动执行",
      },
      sourcePage: action.meetingId ? `/meetings/${action.meetingId}` : "/dashboard",
    });
  }

  if (action.recommendationLogId && (!action.approvalTask || !approvalAlreadyReviewed)) {
    await submitRecommendationFeedback({
      workspaceId: action.workspaceId,
      recommendationId: action.recommendationLogId,
      userId: actor.actorUserId,
      actorName: actor.actorName,
      feedbackType: action.approvalTask
        ? actor.editedContent
          ? RecommendationFeedbackType.EDITED_AND_APPROVED
          : RecommendationFeedbackType.APPROVED
        : RecommendationFeedbackType.AUTO_EXECUTED,
      edited: Boolean(actor.editedContent),
      resultNote: actor.decisionReason ?? (action.approvalTask ? "已批准执行" : "按策略自动执行"),
      actionItemId: action.id,
      approvalTaskId: action.approvalTask?.id,
      sourcePage: action.approvalTask ? "/approvals" : action.meetingId ? `/meetings/${action.meetingId}` : "/dashboard",
    });
  }

  if (action.approvalTask) {
    await writeBiReportHandoffExecutionReceipt({
      workspaceId: action.workspaceId,
      actionItemId: action.id,
      approvalTaskId: action.approvalTask.id,
      actionTitle: action.title,
      actionMetadata: action.metadata,
      actionSourceId: action.sourceId,
      authorUserId: actor.actorUserId ?? null,
      decisionReason: actor.decisionReason ?? null,
      editedContent: actor.editedContent ?? null,
    });
  }

  revalidateCorePaths({
    contactId: action.contactId,
    opportunityId: action.opportunityId,
    meetingId: action.meetingId,
    companyId: action.meeting?.companyId ?? action.opportunity?.companyId ?? undefined,
  });

  return action;
}

export async function approveApprovalTask(
  taskId: string,
  actorName: string,
  actorUserId?: string | null,
  editedContent?: string,
  options?: {
    actorType?: ActorType;
    english?: boolean;
  },
) {
  const task = await db.approvalTask.findUnique({
    where: { id: taskId },
    include: {
      actionItem: true,
    },
  });

  if (!task) throw new Error("Approval task not found");

  // Terminal-state guard: a task may only be approved from PENDING. Without
  // this, a REJECTED/WITHDRAWN/already-approved task could be flipped to
  // approved (rejected -> approved) and then executed — bypassing the human
  // review gate the boundary is built to enforce.
  if (task.status !== ApprovalStatus.PENDING) {
    throw new Error("Approval task is no longer pending and cannot be approved");
  }

  await assertWorkspaceGovernedActionReviewServiceAccess({
    workspaceId: task.workspaceId,
    userId: actorUserId,
    actorType: options?.actorType ?? ActorType.USER,
    english: options?.english ?? false,
  });

  const english = options?.english ?? false;
  const approvingActorType = options?.actorType ?? ActorType.USER;
  // Separation-of-duties gate.
  // selfApproval = the same user who triggered the action's creation is now
  // approving it. This is always recorded (shadow observation) so a workspace
  // can see how often its review gate collapses to one person. It only
  // hard-blocks when the content was explicitly declared human-authored:
  // a human reviewing AI-authored content they triggered IS the review gate,
  // but a human approving their own hand-written high-risk content defeats it.
  // Legacy rows without creator attribution pass through unchanged.
  const selfApproval = Boolean(
    actorUserId &&
      task.actionItem.createdByUserId &&
      actorUserId === task.actionItem.createdByUserId,
  );
  if (task.isHighRisk) {
    if (approvingActorType !== ActorType.USER || !actorUserId) {
      throw new HighRiskApprovalIdentityError(english);
    }
    if (selfApproval && task.actionItem.contentAuthorship === ActorType.USER) {
      throw new SelfApprovalNotAllowedError(english);
    }
  }

  const now = new Date();
  const draftContent =
    editedContent ?? task.editableContent ?? task.actionItem.draftContent ?? task.actionItem.description ?? task.actionItem.title;
  const decisionReason = editedContent
    ? options?.english
      ? "Approved after editing; awaiting execution"
      : "已编辑后批准，待执行"
    : options?.english
      ? "Approved and awaiting execution"
      : "已批准待执行";

  // Atomic transition: claim the PENDING -> approved move with a conditional
  // write so two concurrent approve calls cannot both pass the guard above and
  // both run the side effects (duplicate receipts, duplicate execution). The
  // loser sees count === 0 and stops.
  const claimed = await db.approvalTask.updateMany({
    where: { id: task.id, status: ApprovalStatus.PENDING },
    data: {
      status: ApprovalStatus.EXECUTED,
      reviewedAt: now,
      reviewedById: actorUserId ?? undefined,
      editableContent: draftContent,
      decisionReason,
    },
  });
  if (claimed.count === 0) {
    throw new Error("Approval task is no longer pending and cannot be approved");
  }

  await db.actionItem.update({
    where: { id: task.actionItemId },
    data: {
      status: ActionStatus.APPROVED,
      executionStatus: "approved",
      draftContent,
      statusReason: decisionReason,
    },
  });

  await writeAuditLog({
    workspaceId: task.workspaceId,
    userId: actorUserId,
    actor: actorName,
    actorType: options?.actorType ?? ActorType.USER,
    actionType: "APPROVAL_APPROVED",
    targetType: "ApprovalTask",
    targetId: task.id,
    summary: options?.english
      ? `Approved action for execution: ${task.actionItem.title}`
      : `已批准动作待执行：${task.actionItem.title}`,
    payload: {
      editedContent,
      selfApproval,
      createdByUserId: task.actionItem.createdByUserId ?? null,
      contentAuthorship: task.actionItem.contentAuthorship ?? null,
    },
  });

  await logEvent({
    workspaceId: task.workspaceId,
    userId: actorUserId,
    eventName: "approval_approved",
    eventCategory: "approval",
    targetType: "ApprovalTask",
    targetId: task.id,
    metadata: {
      actionItemId: task.actionItemId,
      actionType: task.actionItem.actionType,
      riskLevel: task.actionItem.riskLevel,
      edited: Boolean(editedContent),
      decisionReason,
      selfApproval,
    },
    sourcePage: "/approvals",
  });

  if (task.actionItem.recommendationLogId) {
    await submitRecommendationFeedback({
      workspaceId: task.workspaceId,
      recommendationId: task.actionItem.recommendationLogId,
      userId: actorUserId,
      actorName,
      feedbackType: editedContent
        ? RecommendationFeedbackType.EDITED_AND_APPROVED
        : RecommendationFeedbackType.APPROVED,
      edited: Boolean(editedContent),
      resultNote: decisionReason,
      actionItemId: task.actionItemId,
      approvalTaskId: task.id,
      sourcePage: "/approvals",
    });
  }

  await writeBiReportHandoffApprovalReceipt({
    workspaceId: task.workspaceId,
    actionItemId: task.actionItemId,
    approvalTaskId: task.id,
    actionTitle: task.actionItem.title,
    actionMetadata: task.actionItem.metadata,
    actionSourceId: task.actionItem.sourceId,
    authorUserId: actorUserId ?? null,
    decisionReason,
    editedContent,
  });

  revalidateCorePaths({
    contactId: task.actionItem.contactId,
    opportunityId: task.actionItem.opportunityId,
    meetingId: task.actionItem.meetingId,
  });
}

export async function blockApprovedAction(
  actionItemId: string,
  actorName: string,
  actorUserId?: string | null,
  reason?: string,
  options?: {
    actorType?: ActorType;
    english?: boolean;
  },
) {
  const action = await db.actionItem.findUnique({
    where: { id: actionItemId },
    include: {
      approvalTask: true,
      meeting: { include: { company: true } },
      opportunity: true,
      contact: true,
    },
  });

  if (!action) throw new Error("Action item not found");

  await assertWorkspaceGovernedActionReviewServiceAccess({
    workspaceId: action.workspaceId,
    userId: actorUserId,
    actorType: options?.actorType ?? ActorType.USER,
    english: options?.english ?? false,
  });

  const decisionReason = reason ?? (options?.english ? "Execution blocked" : "执行已阻断");

  await db.actionItem.update({
    where: { id: action.id },
    data: {
      status: ActionStatus.BLOCKED,
      executionStatus: "blocked",
      statusReason: decisionReason,
    },
  });

  await writeActionMemory(action.workspaceId, {
    companyId: action.meeting?.companyId ?? action.opportunity?.companyId ?? action.contact?.companyId ?? null,
    contactId: action.contactId,
    opportunityId: action.opportunityId,
    meetingId: action.meetingId,
    entityType: action.meetingId
      ? MemoryEntityType.MEETING
      : action.contactId
        ? MemoryEntityType.CONTACT
        : MemoryEntityType.OPPORTUNITY,
    title: `${action.title} 已阻断`,
    content: decisionReason,
  });

  await writeAuditLog({
    workspaceId: action.workspaceId,
    userId: actorUserId,
    actor: actorName,
    actorType: options?.actorType ?? ActorType.USER,
    actionType: "ACTION_BLOCKED",
    targetType: "ActionItem",
    targetId: action.id,
    summary: `${action.title} 已阻断`,
    payload: { reason: decisionReason },
  });

  revalidateCorePaths({
    contactId: action.contactId,
    opportunityId: action.opportunityId,
    meetingId: action.meetingId,
    companyId: action.meeting?.companyId ?? action.opportunity?.companyId ?? undefined,
  });
}

export async function rejectApprovalTask(
  taskId: string,
  actorName: string,
  actorUserId?: string | null,
  reason?: string,
  options?: {
    actorType?: ActorType;
    english?: boolean;
    // Structured rejection taxonomy (v1.1 receipt chain): a rejection without
    // a classified reason cannot feed learning. Free text stays supplementary.
    rejectionReasonCode?: RejectionReasonCode;
  },
) {
  const task = await db.approvalTask.findUnique({
    where: { id: taskId },
    include: {
      actionItem: true,
    },
  });

  if (!task) throw new Error("Approval task not found");

  await assertWorkspaceGovernedActionReviewServiceAccess({
    workspaceId: task.workspaceId,
    userId: actorUserId,
    actorType: options?.actorType ?? ActorType.USER,
    english: options?.english ?? false,
  });

  const english = options?.english ?? false;
  const rejectionReasonCode = options?.rejectionReasonCode ?? null;
  const effectiveReason =
    reason ??
    (rejectionReasonCode
      ? getRejectionReasonLabel(rejectionReasonCode, english)
      : english
        ? "Rejected for execution"
        : "已拒绝执行");

  // Atomic PENDING -> rejected claim: only a still-pending task may be rejected,
  // and a concurrent approve/reject race resolves to a single winner.
  const claimed = await db.approvalTask.updateMany({
    where: { id: task.id, status: ApprovalStatus.PENDING },
    data: {
      status: ApprovalStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedById: actorUserId ?? undefined,
      decisionReason: effectiveReason,
      rejectionReasonCode: rejectionReasonCode ?? undefined,
    },
  });
  if (claimed.count === 0) {
    throw new Error("Approval task is no longer pending and cannot be rejected");
  }

  await db.actionItem.update({
    where: { id: task.actionItemId },
    data: {
      status: ActionStatus.BLOCKED,
      executionStatus: "blocked",
      statusReason: effectiveReason,
    },
  });

  await writeActionMemory(task.workspaceId, {
    companyId: null,
    contactId: task.actionItem.contactId,
    opportunityId: task.actionItem.opportunityId,
    meetingId: task.actionItem.meetingId,
    entityType: task.actionItem.meetingId
      ? MemoryEntityType.MEETING
      : task.actionItem.contactId
        ? MemoryEntityType.CONTACT
        : MemoryEntityType.OPPORTUNITY,
    title: `${task.actionItem.title} 已被拒绝`,
    content: `审批已拒绝，原因：${effectiveReason}`,
  });

  await writeAuditLog({
    workspaceId: task.workspaceId,
    userId: actorUserId,
    actor: actorName,
    actorType: options?.actorType ?? ActorType.USER,
    actionType: "APPROVAL_REJECTED",
    targetType: "ApprovalTask",
    targetId: task.id,
    summary: `已拒绝动作：${task.actionItem.title}`,
    payload: { reason: effectiveReason, rejectionReasonCode },
  });

  await logEvent({
    workspaceId: task.workspaceId,
    userId: actorUserId,
    eventName: "approval_rejected",
    eventCategory: "approval",
    targetType: "ApprovalTask",
    targetId: task.id,
    metadata: {
      actionItemId: task.actionItemId,
      actionType: task.actionItem.actionType,
      riskLevel: task.actionItem.riskLevel,
      reason: effectiveReason,
      rejectionReasonCode,
    },
    sourcePage: "/approvals",
  });

  if (task.actionItem.recommendationLogId) {
    await submitRecommendationFeedback({
      workspaceId: task.workspaceId,
      recommendationId: task.actionItem.recommendationLogId,
      userId: actorUserId,
      actorName,
      feedbackType: RecommendationFeedbackType.REJECTED,
      resultNote: effectiveReason,
      rejectionReasonCode: rejectionReasonCode ?? undefined,
      actionItemId: task.actionItemId,
      approvalTaskId: task.id,
      sourcePage: "/approvals",
    });
  }

  await writeBiReportHandoffRejectionReceipt({
    workspaceId: task.workspaceId,
    actionItemId: task.actionItemId,
    approvalTaskId: task.id,
    actionTitle: task.actionItem.title,
    actionMetadata: task.actionItem.metadata,
    actionSourceId: task.actionItem.sourceId,
    authorUserId: actorUserId ?? null,
    decisionReason: effectiveReason,
  });

  revalidateCorePaths({
    contactId: task.actionItem.contactId,
    opportunityId: task.actionItem.opportunityId,
    meetingId: task.actionItem.meetingId,
  });
}

export async function markApprovalManual(
  taskId: string,
  actorName: string,
  actorUserId?: string | null,
  options?: {
    actorType?: ActorType;
    english?: boolean;
  },
) {
  const task = await db.approvalTask.findUnique({
    where: { id: taskId },
    include: {
      actionItem: true,
    },
  });

  if (!task) throw new Error("Approval task not found");

  await assertWorkspaceGovernedActionReviewServiceAccess({
    workspaceId: task.workspaceId,
    userId: actorUserId,
    actorType: options?.actorType ?? ActorType.USER,
    english: options?.english ?? false,
  });

  // Atomic PENDING -> withdrawn (manual) claim: only a still-pending task may be
  // moved to manual handling, with single-winner resolution under concurrency.
  const claimed = await db.approvalTask.updateMany({
    where: { id: task.id, status: ApprovalStatus.PENDING },
    data: {
      status: ApprovalStatus.WITHDRAWN,
      reviewedAt: new Date(),
      reviewedById: actorUserId ?? undefined,
      decisionReason: "已改成人工处理",
    },
  });
  if (claimed.count === 0) {
    throw new Error("Approval task is no longer pending and cannot be moved to manual handling");
  }

  await db.actionItem.update({
    where: { id: task.actionItemId },
    data: {
      status: ActionStatus.MANUAL,
      executionStatus: "manual",
      statusReason: "已改成人工处理",
    },
  });

  await writeAuditLog({
    workspaceId: task.workspaceId,
    userId: actorUserId,
    actor: actorName,
    actorType: ActorType.USER,
    actionType: "APPROVAL_CONVERTED_TO_MANUAL",
    targetType: "ApprovalTask",
    targetId: task.id,
    summary: "动作已改成人工处理",
  });

  if (task.actionItem.recommendationLogId) {
    await submitRecommendationFeedback({
      workspaceId: task.workspaceId,
      recommendationId: task.actionItem.recommendationLogId,
      userId: actorUserId,
      actorName,
      feedbackType: RecommendationFeedbackType.IGNORED,
      resultNote: "已改成人工处理",
      actionItemId: task.actionItemId,
      approvalTaskId: task.id,
      sourcePage: "/approvals",
    });
  }

  revalidateCorePaths();
}

export async function setActionTypeAutoPolicy(
  taskId: string,
  actorName: string,
  actorUserId?: string | null,
  options?: {
    actorType?: ActorType;
    english?: boolean;
  },
) {
  const task = await db.approvalTask.findUnique({
    where: { id: taskId },
    include: {
      actionItem: true,
    },
  });

  if (!task) throw new Error("Approval task not found");

  await assertWorkspacePolicyServiceAccess({
    workspaceId: task.workspaceId,
    userId: actorUserId,
    actorType: options?.actorType ?? ActorType.USER,
    english: options?.english ?? false,
  });

  await db.policyRule.updateMany({
    where: {
      workspaceId: task.workspaceId,
      actionType: task.actionItem.actionType,
    },
    data: {
      mode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
    },
  });

  await writeAuditLog({
    workspaceId: task.workspaceId,
    userId: actorUserId,
    actor: actorName,
    actorType: ActorType.USER,
    actionType: "POLICY_AUTO_EXECUTE_ENABLED",
    targetType: "ActionType",
    targetId: task.actionItem.actionType,
    summary: `已将 ${task.actionItem.actionType} 设为阈值内自动执行（仅内部 / 可回滚；客户可见动作仍需复核）`,
    payload: {
      mode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
      scopeNote:
        "policy applies to internal reversible actions only; customer-visible drafts still require explicit human review per README §boundary table",
      sourceTaskId: task.id,
    },
    sourcePage: "/approvals",
  });

  await logEvent({
    workspaceId: task.workspaceId,
    userId: actorUserId,
    eventName: "policy_rule_changed",
    eventCategory: "policy",
    targetType: "PolicyRule",
    targetId: task.actionItem.actionType,
    metadata: {
      actionType: task.actionItem.actionType,
      nextMode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
      source: "approval_center",
    },
    sourcePage: "/approvals",
  });

  revalidateCorePaths();
}

async function writeActionMemory(
  workspaceId: string,
  input: {
    companyId?: string | null;
    contactId?: string | null;
    opportunityId?: string | null;
    meetingId?: string | null;
    entityType: MemoryEntityType;
    title: string;
    content: string;
  },
) {
  await db.memoryEntry.create({
    data: {
      workspaceId,
      companyId: input.companyId ?? undefined,
      contactId: input.contactId ?? undefined,
      opportunityId: input.opportunityId ?? undefined,
      meetingId: input.meetingId ?? undefined,
      entityType: input.entityType,
      memoryType: MemoryType.NEXT_STEP,
      title: input.title,
      content: input.content,
      source: "动作执行",
    },
  });

  if (input.contactId) {
    await db.contact.update({
      where: { id: input.contactId },
      data: {
        lastInteractionAt: new Date(),
      },
    });
  }
}

async function updateOpportunityProgress(input: {
  workspaceId: string;
  opportunityId: string;
  actor: {
    actorName: string;
    actorType: ActorType;
    actorUserId?: string | null;
  };
  stage?: OpportunityStage;
  nextAction?: string;
  dueDate?: Date;
}) {
  const current = await db.opportunity.findUnique({
    where: { id: input.opportunityId },
  });

  if (!current) return null;

  const updated = await db.opportunity.update({
    where: { id: input.opportunityId },
    data: {
      stage: input.stage,
      nextAction: input.nextAction,
      dueDate: input.dueDate,
    },
  });

  if (input.stage && input.stage !== current.stage) {
    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actor.actorUserId,
      actor: input.actor.actorName,
      actorType: input.actor.actorType,
      actionType: "OPPORTUNITY_STAGE_CHANGED",
      targetType: "Opportunity",
      targetId: updated.id,
      summary: `机会阶段更新为 ${input.stage}`,
      payload: { from: current.stage, to: input.stage },
    });

    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actor.actorUserId,
      eventName: "opportunity_stage_changed",
      eventCategory: "opportunity",
      targetType: "Opportunity",
      targetId: updated.id,
      metadata: {
        from: current.stage,
        to: input.stage,
      },
      sourcePage: "/opportunities",
    });
  }

  if (typeof input.nextAction === "string" && input.nextAction !== current.nextAction) {
    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actor.actorUserId,
      actor: input.actor.actorName,
      actorType: input.actor.actorType,
      actionType: "OPPORTUNITY_NEXT_ACTION_UPDATED",
      targetType: "Opportunity",
      targetId: updated.id,
      summary: "更新了机会下一步动作",
      payload: { from: current.nextAction, to: input.nextAction },
    });
  }

  if (input.dueDate && current.dueDate?.getTime() !== input.dueDate.getTime()) {
    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actor.actorUserId,
      actor: input.actor.actorName,
      actorType: input.actor.actorType,
      actionType: "OPPORTUNITY_DUE_DATE_CHANGED",
      targetType: "Opportunity",
      targetId: updated.id,
      summary: "更新了机会截止时间",
      payload: { from: current.dueDate, to: input.dueDate },
    });
  }

  return updated;
}

function revalidateCorePaths(context?: {
  contactId?: string | null;
  opportunityId?: string | null;
  meetingId?: string | null;
  companyId?: string | null;
}) {
  const safeRevalidatePath = (path: string) => {
    try {
      revalidatePath(path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("static generation store missing")) {
        return;
      }
      throw error;
    }
  };

  safeRevalidatePath("/dashboard");
  safeRevalidatePath("/opportunities");
  safeRevalidatePath("/approvals");
  safeRevalidatePath("/inbox");
  safeRevalidatePath("/memory");
  safeRevalidatePath("/search");
  safeRevalidatePath("/settings");

  if (context?.contactId) {
    safeRevalidatePath(`/contacts/${context.contactId}`);
  }

  if (context?.opportunityId) {
    safeRevalidatePath("/opportunities");
  }

  if (context?.meetingId) {
    safeRevalidatePath(`/meetings/${context.meetingId}`);
  }

  if (context?.companyId) {
    safeRevalidatePath(`/companies/${context.companyId}`);
  }
}
