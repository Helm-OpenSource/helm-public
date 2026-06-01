"use server";

import { ActionType, ActorType, MemoryEntityType, MemoryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentWorkspace, getCurrentWorkspaceSession, requireCurrentUser } from "@/lib/auth/session";
import {
  canManageWorkspaceRecords,
  getWorkspaceRecordManagementDeniedMessage,
  getWorkspaceScopedRecordUnavailableMessage,
} from "@/lib/auth/workspace-data-governance";
import { db } from "@/lib/db";
import { canManageWorkspaceMemory, getMemoryManagementDeniedMessage } from "@/lib/memory/permissions";
import { createGovernedAction } from "@/lib/policies/engine";

export async function generateContactFollowUpAction(contactId: string, channel: "email" | "message" = "email") {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = workspace.defaultLocale === "en-US";
  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId: workspace.id },
    include: {
      company: true,
      opportunities: true,
    },
  });

  if (!contact) {
    return { ok: false, error: english ? "Contact not found" : "联系人不存在" };
  }

  const mainOpportunity = contact.opportunities[0];
  const result = await createGovernedAction({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    english,
    actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
    title: english ? `${contact.name} follow-up draft` : `${contact.name} 跟进草稿`,
    description: english ? `${channel === "email" ? "Draft an email" : "Draft a message"} follow-up` : `${channel === "email" ? "起草邮件" : "起草微信/短信"}文案`,
    aiReason:
      mainOpportunity?.type === "RECRUITING"
        ? (english ? "The relationship is inside an active window, so candidate experience and timing need active management." : "当前关系处于推进窗口，候选人体验和节奏需要持续被管理。")
        : (english ? "This contact has pending momentum to recover, so the next follow-up should be more explicit." : "联系人最近有待推进事项，建议输出更明确的下一步跟进。"),
    draftContent:
      channel === "email"
        ? (english ? `Hi ${contact.name}, I pulled together the key points from our recent discussion and a proposed next step. I’d like to confirm it with you...` : `${contact.name} 你好，我把我们最近讨论的重点和下一步建议整理好了，想和你确认一下……`)
        : (english ? `${contact.name}, quick sync: I’ve already organized the next-step proposal on my side. If it works for you, I can align for 10 minutes today.` : `${contact.name}，和你快速同步一下：我这边已经整理好下一步建议，如果你方便，今天我可以再和你对齐 10 分钟。`),
    riskLevel: mainOpportunity?.riskLevel ?? "MEDIUM",
    opportunityId: mainOpportunity?.id,
    contactId: contact.id,
    ownerId: contact.ownerId ?? user.id,
    resultPreview: english ? "After approval, this will write into the contact timeline and update the latest interaction time." : "审批通过后将写入联系人时间线，并更新最近互动时间。",
  });

  return { ok: true, result };
}

export async function createMeetingForContactAction(contactId: string) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = workspace.defaultLocale === "en-US";
  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId: workspace.id },
    include: { opportunities: true },
  });

  if (!contact) return { ok: false, error: english ? "Contact not found" : "联系人不存在" };

  const result = await createGovernedAction({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    english,
    actionType: ActionType.CREATE_MEETING,
    title: english ? `Create a follow-up meeting with ${contact.name}` : `与 ${contact.name} 创建后续会议`,
    description: english ? "Create a follow-up meeting placeholder automatically." : "自动创建一个后续推进会议占位",
    aiReason: english ? "This contact has a clear next step and holding a meeting slot early reduces drop-off risk." : "当前联系人有明确下一步，先占住会议节奏可以减少掉动作。",
    riskLevel: "MEDIUM",
    opportunityId: contact.opportunities[0]?.id,
    contactId: contact.id,
    ownerId: contact.ownerId ?? user.id,
    metadata: {
      createMeetingTitle: english ? `${contact.name} follow-up sync` : `${contact.name} 后续推进会议`,
      agenda: english ? "Confirm the key questions and the next move" : "确认关键问题与下一步动作",
    },
  });

  return { ok: true, result };
}

export async function addContactToOpportunityAction(contactId: string, opportunityId: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  const [contact, opportunity] = await Promise.all([
    db.contact.findFirst({
      where: { id: contactId, workspaceId: workspace.id },
      select: { id: true },
    }),
    db.opportunity.findFirst({
      where: { id: opportunityId, workspaceId: workspace.id },
      select: { id: true },
    }),
  ]);

  if (!contact) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "contact") };
  }

  if (!opportunity) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "opportunity") };
  }

  await db.opportunity.update({
    where: { id: opportunityId },
    data: {
      contacts: {
        connect: [{ id: contactId }],
      },
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "CONTACT_LINKED_TO_OPPORTUNITY",
    targetType: "Contact",
    targetId: contactId,
    summary: english ? "Contact linked to opportunity" : "联系人已加入机会",
    payload: { opportunityId },
  });

  revalidatePath("/opportunities");
  revalidatePath(`/contacts/${contactId}`);

  return { ok: true };
}

export async function mergeContactsAction(sourceContactId: string, targetContactId: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (sourceContactId === targetContactId) {
    return { ok: false, error: english ? "Cannot merge a contact into itself" : "不能合并到同一个联系人" };
  }

  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  const [source, target] = await Promise.all([
    db.contact.findFirst({
      where: { id: sourceContactId, workspaceId: workspace.id },
      include: {
        opportunities: true,
        meetings: true,
      },
    }),
    db.contact.findFirst({
      where: { id: targetContactId, workspaceId: workspace.id },
    }),
  ]);

  if (!source || !target) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "contact") };
  }

  for (const opportunity of source.opportunities) {
    await db.opportunity.update({
      where: { id: opportunity.id },
      data: {
        contacts: {
          connect: [{ id: targetContactId }],
        },
      },
    });
  }

  for (const meeting of source.meetings) {
    await db.meeting.update({
      where: { id: meeting.id },
      data: {
        contacts: {
          connect: [{ id: targetContactId }],
        },
      },
    });
  }

  await Promise.all([
    db.emailThread.updateMany({
      where: { workspaceId: workspace.id, contactId: sourceContactId },
      data: { contactId: targetContactId },
    }),
    db.actionItem.updateMany({
      where: { workspaceId: workspace.id, contactId: sourceContactId },
      data: { contactId: targetContactId },
    }),
    db.memoryEntry.updateMany({
      where: { workspaceId: workspace.id, contactId: sourceContactId },
      data: { contactId: targetContactId },
    }),
    db.contact.update({
      where: { id: sourceContactId },
      data: {
        archivedAt: new Date(),
        mergedIntoId: targetContactId,
      },
    }),
  ]);

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "CONTACT_MERGED",
    targetType: "Contact",
    targetId: sourceContactId,
    summary: english ? `${source.name} merged into ${target.name}` : `${source.name} 已合并到 ${target.name}`,
    payload: { sourceContactId, targetContactId },
  });

  revalidatePath(`/contacts/${targetContactId}`);
  revalidatePath("/memory");

  return { ok: true };
}

export async function archiveContactAction(contactId: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId: workspace.id },
    select: { id: true },
  });

  if (!contact) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "contact") };
  }

  await db.contact.update({
    where: { id: contactId },
    data: { archivedAt: new Date() },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "CONTACT_ARCHIVED",
    targetType: "Contact",
    targetId: contactId,
    summary: english ? "Contact archived" : "联系人已归档",
  });

  revalidatePath(`/contacts/${contactId}`);

  return { ok: true };
}

const memoryCorrectionSchema = z.object({
  entryId: z.string(),
  content: z.string().min(2),
});

export async function appendContactMemoryAction(input: z.infer<typeof memoryCorrectionSchema>) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceMemory(membership.role)) {
    return { ok: false, error: getMemoryManagementDeniedMessage(english) };
  }

  const parsed = memoryCorrectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: english ? "Content is required" : "内容不能为空" };

  const existingEntry = await db.memoryEntry.findFirst({
    where: {
      id: parsed.data.entryId,
      workspaceId: workspace.id,
    },
    select: { id: true },
  });

  if (!existingEntry) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "memory entry") };
  }

  const entry = await db.memoryEntry.update({
    where: { id: parsed.data.entryId },
    data: {
      content: parsed.data.content,
      correctedAt: new Date(),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "MEMORY_CORRECTED",
    targetType: "MemoryEntry",
    targetId: entry.id,
    summary: english ? "Corrected one contact memory entry" : "修正了一条联系人记忆",
    payload: parsed.data,
  });

  revalidatePath("/memory");
  return { ok: true };
}

export async function addWorkingMemoryAction(contactId: string, content: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceMemory(membership.role)) {
    return { ok: false, error: getMemoryManagementDeniedMessage(english) };
  }

  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId: workspace.id },
    select: { id: true },
  });

  if (!contact) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "contact") };
  }

  const created = await db.memoryEntry.create({
    data: {
      workspaceId: workspace.id,
      contactId: contact.id,
      entityType: MemoryEntityType.CONTACT,
      memoryType: MemoryType.NOTE,
      title: content.slice(0, 20),
      content,
      source: english ? "Manual note" : "人工补充",
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "MEMORY_ADDED",
    targetType: "MemoryEntry",
    targetId: created.id,
    summary: english ? "Added one working memory entry" : "新增了一条工作记忆",
  });

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/memory");
  return { ok: true };
}
