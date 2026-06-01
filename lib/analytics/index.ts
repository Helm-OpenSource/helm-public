import { startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { getCurrentUser, getCurrentWorkspaceSession, getSessionId } from "@/lib/auth/session";

type SnapshotCounterKey =
  | "loginCount"
  | "dashboardViewCount"
  | "meetingViewCount"
  | "actionItemsGenerated"
  | "approvalsSubmitted"
  | "approvalsApproved"
  | "approvalsRejected"
  | "opportunityStageChanges"
  | "followupDraftsGenerated"
  | "policyChanges";

type AnalyticsEventInput = {
  workspaceId: string;
  userId?: string | null;
  eventName: string;
  eventCategory: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  sessionId?: string | null;
  sourcePage?: string | null;
  createdAt?: Date;
};

const snapshotEventMap: Partial<Record<string, SnapshotCounterKey>> = {
  daily_login: "loginCount",
  dashboard_opened: "dashboardViewCount",
  meeting_opened: "meetingViewCount",
  action_items_generated: "actionItemsGenerated",
  approval_submitted: "approvalsSubmitted",
  approval_approved: "approvalsApproved",
  approval_rejected: "approvalsRejected",
  opportunity_stage_changed: "opportunityStageChanges",
  followup_draft_generated: "followupDraftsGenerated",
  policy_rule_changed: "policyChanges",
};

function buildSnapshotCreate(workspaceId: string, userId: string, date: Date, counter?: SnapshotCounterKey) {
  return {
    workspaceId,
    userId,
    date,
    loginCount: counter === "loginCount" ? 1 : 0,
    dashboardViewCount: counter === "dashboardViewCount" ? 1 : 0,
    meetingViewCount: counter === "meetingViewCount" ? 1 : 0,
    actionItemsGenerated: counter === "actionItemsGenerated" ? 1 : 0,
    approvalsSubmitted: counter === "approvalsSubmitted" ? 1 : 0,
    approvalsApproved: counter === "approvalsApproved" ? 1 : 0,
    approvalsRejected: counter === "approvalsRejected" ? 1 : 0,
    opportunityStageChanges: counter === "opportunityStageChanges" ? 1 : 0,
    followupDraftsGenerated: counter === "followupDraftsGenerated" ? 1 : 0,
    policyChanges: counter === "policyChanges" ? 1 : 0,
  };
}

function buildSnapshotUpdate(counter?: SnapshotCounterKey) {
  if (!counter) {
    return {};
  }

  return {
    [counter]: {
      increment: 1,
    },
  };
}

export async function logEvent(input: AnalyticsEventInput) {
  try {
    const createdAt = input.createdAt ?? new Date();
    const counter = input.userId ? snapshotEventMap[input.eventName] : undefined;

    await runWithWriteConflictRetry(() =>
      db.eventLog.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.userId ?? undefined,
          eventName: input.eventName,
          eventCategory: input.eventCategory,
          targetType: input.targetType ?? undefined,
          targetId: input.targetId ?? undefined,
          metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
          sessionId: input.sessionId ?? undefined,
          sourcePage: input.sourcePage ?? undefined,
          createdAt,
        },
      }),
    );

    if (!input.userId) {
      return;
    }

    const date = startOfDay(createdAt);

    // dailyUsageSnapshot is one of the WORKING-CONTEXT §7 #2 1020 hot spots:
    // many concurrent event writes target the same (workspace, user, date)
    // row. The retry helper absorbs MySQL 1020 / Prisma P2034 before they
    // become silent drops in the outer catch.
    await runWithWriteConflictRetry(() =>
      db.dailyUsageSnapshot.upsert({
        where: {
          workspaceId_userId_date: {
            workspaceId: input.workspaceId,
            userId: input.userId as string,
            date,
          },
        },
        create: buildSnapshotCreate(input.workspaceId, input.userId as string, date, counter),
        update: buildSnapshotUpdate(counter),
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("readonly database")) {
      console.warn("analytics.logEvent skipped: sqlite is readonly for current process");
      return;
    }
    console.error("analytics.logEvent failed", error);
  }
}

export async function logCurrentWorkspaceEvent(
  input: Omit<AnalyticsEventInput, "workspaceId" | "userId" | "sessionId">,
) {
  const user = await getCurrentUser();
  const session = user ? await getCurrentWorkspaceSession().catch(() => null) : null;
  const workspace = session?.workspace;

  if (!user || !workspace) {
    return;
  }

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    sessionId: await getSessionId(),
    ...input,
  });
}

export async function logPageViewEvent(input: {
  eventName: string;
  sourcePage: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await logCurrentWorkspaceEvent({
    eventName: input.eventName,
    eventCategory: "page_view",
    targetType: input.targetType ?? "Page",
    targetId: input.targetId ?? input.sourcePage,
    metadata: input.metadata,
    sourcePage: input.sourcePage,
  });
}
