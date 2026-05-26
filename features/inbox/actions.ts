"use server";

import { ActionType, ActorType, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentWorkspace, getCurrentWorkspaceSession, requireCurrentUser } from "@/lib/auth/session";
import {
  canManageWorkspaceRecords,
  getWorkspaceRecordManagementDeniedMessage,
  getWorkspaceScopedRecordUnavailableMessage,
} from "@/lib/auth/workspace-data-governance";
import { db } from "@/lib/db";
import { createGovernedAction } from "@/lib/policies/engine";

export async function generateReplyDraftAction(threadId: string) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = workspace.defaultLocale === "en-US";
  const thread = await db.emailThread.findFirst({
    where: { id: threadId, workspaceId: workspace.id },
    include: {
      contact: true,
      opportunity: true,
      messages: {
        orderBy: { sentAt: "desc" },
        take: 1,
      },
    },
  });

  if (!thread) return { ok: false, error: english ? "Thread not found" : "线程不存在" };

  const lastMessage = thread.messages[0];
  const result = await createGovernedAction({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    english,
    actionType: ActionType.GENERATE_REPLY_DRAFT,
    title: english ? `Reply draft: ${thread.subject}` : `回复草稿：${thread.subject}`,
    description: english ? "Generate a reply draft from the thread context." : "基于线程上下文生成一封回复草稿",
    aiReason: english ? `The thread is currently "${thread.status}" and ${thread.waitingOn ?? "our side"} is expected to make the next move.` : `当前线程状态为 ${thread.status}，${thread.waitingOn ?? "我方"} 在等下一步。`,
    draftContent: english ? `Hi ${thread.counterpart}, thanks for your message. Based on "${lastMessage?.body.slice(0, 20) ?? thread.subject}", our suggested next step is...` : `${thread.counterpart} 你好，收到你的信息。针对“${lastMessage?.body.slice(0, 20) ?? thread.subject}”，我们建议下一步这样推进……`,
    riskLevel: thread.opportunity?.riskLevel ?? "MEDIUM",
    opportunityId: thread.opportunityId ?? undefined,
    contactId: thread.contactId ?? undefined,
    ownerId: thread.opportunity?.ownerId ?? user.id,
    metadata: {
      threadId: thread.id,
    },
    resultPreview: english ? "After approval, the reply draft will write into the audit trail and contact timeline." : "审批通过后将把回复草稿写入审计与联系人时间线。",
  });

  return { ok: true, result };
}

export async function addThreadToOpportunityAction(threadId: string, opportunityId: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  const [thread, opportunity] = await Promise.all([
    db.emailThread.findFirst({
      where: { id: threadId, workspaceId: workspace.id },
      select: { id: true },
    }),
    db.opportunity.findFirst({
      where: { id: opportunityId, workspaceId: workspace.id },
      select: { id: true },
    }),
  ]);

  if (!thread) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "thread") };
  }

  if (!opportunity) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "opportunity") };
  }

  await db.emailThread.update({
    where: { id: threadId },
    data: { opportunityId },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "THREAD_LINKED_TO_OPPORTUNITY",
    targetType: "EmailThread",
    targetId: threadId,
    summary: english ? "Thread linked to opportunity" : "线程已绑定到机会",
    payload: { opportunityId },
  });

  revalidatePath("/inbox");
  revalidatePath("/opportunities");
  return { ok: true };
}

export async function createTodoFromThreadAction(threadId: string) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = workspace.defaultLocale === "en-US";
  const thread = await db.emailThread.findFirst({
    where: { id: threadId, workspaceId: workspace.id },
  });
  if (!thread) return { ok: false, error: english ? "Thread not found" : "线程不存在" };

  const result = await createGovernedAction({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    english,
    actionType: ActionType.CREATE_TASK,
    title: english ? `Task: ${thread.subject}` : `待办：${thread.subject}`,
    description: english ? "Create a task from the inbox thread." : "从收件箱线程生成待办",
    aiReason: english ? "The thread already contains a clear next step and should not stay only in the inbox." : "线程中已经出现明确下一步，不应只留在收件箱里。",
    riskLevel: "LOW",
    opportunityId: thread.opportunityId ?? undefined,
    contactId: thread.contactId ?? undefined,
    ownerId: user.id,
  });

  return { ok: true, result };
}

export async function scheduleMeetingFromThreadAction(threadId: string) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = workspace.defaultLocale === "en-US";
  const thread = await db.emailThread.findFirst({
    where: { id: threadId, workspaceId: workspace.id },
  });
  if (!thread) return { ok: false, error: english ? "Thread not found" : "线程不存在" };

  const result = await createGovernedAction({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    english,
    actionType: ActionType.CREATE_MEETING,
    title: english ? `Thread to meeting: ${thread.subject}` : `线程转会议：${thread.subject}`,
    description: english ? "Create a follow-up meeting from this thread." : "从线程创建后续会议",
    aiReason: english ? "This thread has reached a stage where synchronous alignment is better handled in a meeting." : "当前线程已进入需要同步的阶段，用会议收口更高效。",
    riskLevel: "MEDIUM",
    opportunityId: thread.opportunityId ?? undefined,
    contactId: thread.contactId ?? undefined,
    ownerId: user.id,
    metadata: {
      createMeetingTitle: english ? `${thread.subject} follow-up meeting` : `${thread.subject} 跟进会议`,
      agenda: english ? "Make a decision around the main thread focus" : "围绕当前线程焦点做出决策",
    },
  });

  return { ok: true, result };
}

export async function upgradeThreadToOpportunityAction(threadId: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";
  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  const thread = await db.emailThread.findFirst({
    where: { id: threadId, workspaceId: workspace.id },
    include: {
      contact: true,
      company: true,
    },
  });

  if (!thread) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "thread") };
  }

  if (thread.opportunityId) {
    return { ok: true, opportunityId: thread.opportunityId };
  }

  const type = thread.subject.includes("候选人") || thread.subject.includes("面试")
    ? "RECRUITING"
    : thread.subject.includes("合作") || thread.subject.includes("联名")
      ? "PARTNERSHIP"
      : "CLIENT";

  const opportunity = await db.opportunity.create({
    data: {
      workspaceId: workspace.id,
      companyId: thread.companyId ?? undefined,
      ownerId: user.id,
      title: thread.subject,
      type,
      stage: "CONTACTED",
      riskLevel: "MEDIUM",
      nextAction: english ? "Confirm the single next step from the current thread" : "基于当前线程确认唯一下一步动作",
      priorityScore: 72,
      contacts: thread.contactId ? { connect: [{ id: thread.contactId }] } : undefined,
    },
  });

  await db.emailThread.update({
    where: { id: threadId },
    data: {
      opportunityId: opportunity.id,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "THREAD_UPGRADED_TO_OPPORTUNITY",
    targetType: "EmailThread",
    targetId: threadId,
    summary: english ? `Thread upgraded into opportunity: ${opportunity.title}` : `线程已升级为机会：${opportunity.title}`,
    payload: { opportunityId: opportunity.id, type },
  });

  revalidatePath("/inbox");
  revalidatePath("/opportunities");
  revalidatePath("/search");

  return { ok: true, opportunityId: opportunity.id };
}

export async function setReminderFromThreadAction(threadId: string, timingLabel?: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";
  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }
  const resolvedTimingLabel = timingLabel ?? (english ? "in 24 hours" : "24 小时后");
  const thread = await db.emailThread.findFirst({
    where: { id: threadId, workspaceId: workspace.id },
  });
  if (!thread) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "thread") };
  }

  await db.notification.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      type: NotificationType.REMINDER,
      title: english ? `Thread reminder: ${thread.subject}` : `线程提醒：${thread.subject}`,
      body: english ? `Handle the next step for this thread ${resolvedTimingLabel}.` : `请在 ${resolvedTimingLabel} 处理这条线程的下一步。`,
      url: `/inbox?threadId=${thread.id}`,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "THREAD_REMINDER_SET",
    targetType: "EmailThread",
    targetId: thread.id,
    summary: english ? `Reminder created for thread: ${thread.subject}` : `已为线程设置提醒：${thread.subject}`,
    payload: { timingLabel: resolvedTimingLabel },
  });

  revalidatePath("/inbox");
  revalidatePath("/settings");
  return { ok: true };
}
