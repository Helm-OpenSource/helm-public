"use server";

import { ActorType, MeetingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentWorkspace, getCurrentWorkspaceSession, requireCurrentUser } from "@/lib/auth/session";
import {
  canManageWorkspaceRecords,
  getWorkspaceAssignableOwnerDeniedMessage,
  getWorkspaceRecordManagementDeniedMessage,
  getWorkspaceScopedRecordUnavailableMessage,
  resolveWorkspaceAssignableOwnerId,
} from "@/lib/auth/workspace-data-governance";
import { db } from "@/lib/db";

const quickContactSchema = z.object({
  name: z.string().min(2),
  title: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  companyId: z.string().optional(),
  ownerId: z.string().optional(),
});

export async function quickCreateContactAction(input: z.infer<typeof quickContactSchema>) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  const parsed = quickContactSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? (english ? "Contact input is incomplete" : "联系人信息不完整") };
  }

  const [ownerId, company] = await Promise.all([
    resolveWorkspaceAssignableOwnerId({
      workspaceId: workspace.id,
      requestedOwnerId: parsed.data.ownerId,
      fallbackUserId: user.id,
    }),
    parsed.data.companyId
      ? db.company.findFirst({
          where: {
            id: parsed.data.companyId,
            workspaceId: workspace.id,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!ownerId) {
    return { ok: false, error: getWorkspaceAssignableOwnerDeniedMessage(english) };
  }

  if (parsed.data.companyId && !company) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "company") };
  }

  const contact = await db.contact.create({
    data: {
      workspaceId: workspace.id,
      companyId: company?.id,
      ownerId,
      name: parsed.data.name,
      title: parsed.data.title || undefined,
      email: parsed.data.email || undefined,
      channel: english ? "Email" : "邮箱",
      relationshipWarmth: "WARM",
      tags: JSON.stringify([english ? "New contact" : "新建联系人"]),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "CONTACT_CREATED",
    targetType: "Contact",
    targetId: contact.id,
    summary: english ? `Quick-created contact: ${contact.name}` : `快速创建联系人：${contact.name}`,
    payload: parsed.data,
  });

  revalidatePath("/dashboard");
  revalidatePath("/search");
  revalidatePath(`/contacts/${contact.id}`);

  return { ok: true, contactId: contact.id };
}

const quickMeetingSchema = z.object({
  title: z.string().min(2),
  agenda: z.string().min(2),
  startsAt: z.string().min(1),
  companyId: z.string().optional(),
  opportunityId: z.string().optional(),
  contactId: z.string().optional(),
  ownerId: z.string().optional(),
});

export async function quickCreateMeetingAction(input: z.infer<typeof quickMeetingSchema>) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  const parsed = quickMeetingSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? (english ? "Meeting input is incomplete" : "会议信息不完整") };
  }

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(startsAt.getTime() + 45 * 60_000);
  const [ownerId, company, opportunity, contact] = await Promise.all([
    resolveWorkspaceAssignableOwnerId({
      workspaceId: workspace.id,
      requestedOwnerId: parsed.data.ownerId,
      fallbackUserId: user.id,
    }),
    parsed.data.companyId
      ? db.company.findFirst({
          where: { id: parsed.data.companyId, workspaceId: workspace.id },
          select: { id: true },
        })
      : Promise.resolve(null),
    parsed.data.opportunityId
      ? db.opportunity.findFirst({
          where: { id: parsed.data.opportunityId, workspaceId: workspace.id },
          select: { id: true },
        })
      : Promise.resolve(null),
    parsed.data.contactId
      ? db.contact.findFirst({
          where: { id: parsed.data.contactId, workspaceId: workspace.id },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!ownerId) {
    return { ok: false, error: getWorkspaceAssignableOwnerDeniedMessage(english) };
  }

  if (parsed.data.companyId && !company) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "company") };
  }

  if (parsed.data.opportunityId && !opportunity) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "opportunity") };
  }

  if (parsed.data.contactId && !contact) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "contact") };
  }

  const meeting = await db.meeting.create({
    data: {
      workspaceId: workspace.id,
      companyId: company?.id,
      opportunityId: opportunity?.id,
      ownerId,
      title: parsed.data.title,
      agenda: parsed.data.agenda,
      location: english ? "Meeting link pending" : "待确认会议链接",
      status: MeetingStatus.SCHEDULED,
      startsAt,
      endsAt,
      contacts: contact ? { connect: [{ id: contact.id }] } : undefined,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "MEETING_CREATED",
    targetType: "Meeting",
    targetId: meeting.id,
    summary: english ? `Quick-created meeting: ${meeting.title}` : `快速创建会议：${meeting.title}`,
    payload: parsed.data,
  });

  revalidatePath("/dashboard");
  revalidatePath("/search");
  revalidatePath(`/meetings/${meeting.id}`);

  return { ok: true, meetingId: meeting.id };
}

export async function markNotificationReadAction(notificationId: string) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = workspace.defaultLocale === "en-US";

  const notification = await db.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.workspaceId !== workspace.id) {
    return { ok: false, error: english ? "Notification not found" : "通知不存在" };
  }

  await db.notification.update({
    where: { id: notificationId },
    data: {
      readAt: new Date(),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "NOTIFICATION_READ",
    targetType: "Notification",
    targetId: notification.id,
    summary: english ? `Viewed notification: ${notification.title}` : `已查看通知：${notification.title}`,
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");

  return { ok: true };
}
