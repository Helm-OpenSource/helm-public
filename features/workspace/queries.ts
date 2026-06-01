import { endOfDay, startOfDay } from "date-fns";
import { db } from "@/lib/db";

export async function getWorkspaceLayoutData(workspaceId: string, userId: string) {
  const dayStart = startOfDay(new Date());
  const dayEnd = endOfDay(new Date());

  const [
    membership,
    pendingApprovals,
    notifications,
    pendingTasks,
    todayMeetings,
    highRiskOpportunities,
    companies,
    contacts,
    opportunities,
    meetings,
    memberships,
  ] = await Promise.all([
    db.membership.findFirst({
      where: { workspaceId, userId },
    }),
    db.approvalTask.count({
      where: {
        workspaceId,
        status: "PENDING",
      },
    }),
    db.notification.findMany({
      where: {
        workspaceId,
        OR: [{ userId }, { userId: null }],
        readAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.approvalTask.findMany({
      where: {
        workspaceId,
        status: "PENDING",
      },
      include: {
        actionItem: true,
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    db.meeting.findMany({
      where: {
        workspaceId,
        startsAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: { startsAt: "asc" },
      take: 4,
    }),
    db.opportunity.findMany({
      where: {
        workspaceId,
        riskLevel: {
          in: ["HIGH", "CRITICAL"],
        },
        stage: {
          notIn: ["DONE", "LOST"],
        },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 4,
    }),
    db.company.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    }),
    db.contact.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { name: "asc" },
      take: 100,
    }),
    db.opportunity.findMany({
      where: {
        workspaceId,
        stage: {
          notIn: ["DONE", "LOST"],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.meeting.findMany({
      where: { workspaceId },
      select: {
        id: true,
        title: true,
        startsAt: true,
      },
      orderBy: { startsAt: "desc" },
      take: 40,
    }),
    db.membership.findMany({
      where: { workspaceId },
      select: {
        id: true,
        role: true,
        userId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const membershipUserIds = Array.from(
    new Set(memberships.map((membershipItem) => membershipItem.userId)),
  );
  const membershipUsers = membershipUserIds.length
    ? await db.user.findMany({
        where: {
          id: {
            in: membershipUserIds,
          },
        },
      })
    : [];
  const membershipUserMap = new Map(
    membershipUsers.map((membershipUser) => [membershipUser.id, membershipUser]),
  );

  const alerts = [
    ...pendingTasks.map((task) => ({
      id: `approval-${task.id}`,
      type: "approval" as const,
      title: `待审批：${task.actionItem.title}`,
      body: task.reasoning ?? task.actionItem.description ?? "有一条需要你确认的动作。",
      url: "/approvals",
      createdAt: task.createdAt,
    })),
    ...highRiskOpportunities.map((opportunity) => ({
      id: `risk-${opportunity.id}`,
      type: "risk" as const,
      title: `高风险机会：${opportunity.title}`,
      body: opportunity.nextAction ?? "需要尽快确认下一步动作。",
      url: `/opportunities?opportunityId=${opportunity.id}`,
      createdAt: opportunity.updatedAt,
    })),
    ...todayMeetings.map((meeting) => ({
      id: `meeting-${meeting.id}`,
      type: "meeting" as const,
      title: `今日会议：${meeting.title}`,
      body: meeting.agenda ?? "会前简报已准备好。",
      url: `/meetings/${meeting.id}`,
      createdAt: meeting.startsAt,
    })),
    ...notifications.map((notification) => ({
      id: `notification-${notification.id}`,
      type: "notification" as const,
      title: notification.title,
      body: notification.body,
      url: notification.url ?? "/settings",
      createdAt: notification.createdAt,
    })),
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 10);

  return {
    membership,
    pendingApprovals,
    notificationCount: alerts.length,
    alerts,
    quickCreateData: {
      companies,
      contacts,
      opportunities,
      meetings,
      memberships: memberships
        .map((membershipItem) => {
          const membershipUser = membershipUserMap.get(membershipItem.userId);
          if (!membershipUser) {
            return null;
          }

          return {
            id: membershipItem.id,
            role: membershipItem.role,
            user: membershipUser,
          };
        })
        .filter((membershipItem): membershipItem is NonNullable<typeof membershipItem> =>
          Boolean(membershipItem),
        ),
    },
  };
}
