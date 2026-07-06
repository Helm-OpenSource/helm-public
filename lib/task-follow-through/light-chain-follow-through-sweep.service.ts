import { ActionStatus, ActorType, CommitmentStatus, NotificationType } from "@prisma/client";
import { subDays } from "date-fns";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  classifyLightChainFollowThrough,
  type LightChainFollowThroughConfig,
  type LightChainFollowThroughFinding,
} from "@/lib/task-follow-through/light-chain-follow-through";

// Advice-only sweep over the light task chain. For each finding it creates an
// INTERNAL reminder notification (deduplicated per subject per 24h) and one
// audit entry per sweep. Boundaries: no external send, no task-state
// mutation, no write to Commitment.overdueFlag (read-only invariant).

const NOTIFICATION_DEDUPE_HOURS = 24;

function findingUrl(finding: LightChainFollowThroughFinding): string {
  return finding.subjectType === "action_item"
    ? `/approvals?followThrough=action-item:${finding.subjectId}`
    : `/dashboard?followThrough=commitment:${finding.subjectId}`;
}

function findingTitle(finding: LightChainFollowThroughFinding): string {
  const attention = finding.managerAttentionRequired ? "【需管理关注】" : "";
  switch (finding.kind) {
    case "action_overdue":
      return `${attention}任务逾期：${finding.title}`;
    case "action_approval_stalled":
      return `${attention}审批停留：${finding.title}`;
    case "action_execution_stalled":
      return `${attention}执行停留：${finding.title}`;
    case "commitment_overdue":
      return `${attention}承诺逾期：${finding.title}`;
  }
}

export type LightChainFollowThroughSweepResult = {
  workspaceId: string;
  findings: LightChainFollowThroughFinding[];
  notificationsCreated: number;
  notificationsDeduplicated: number;
};

export async function runLightChainFollowThroughSweepForWorkspace(input: {
  workspaceId: string;
  now?: Date;
  config?: Partial<LightChainFollowThroughConfig>;
}): Promise<LightChainFollowThroughSweepResult> {
  const now = input.now ?? new Date();

  const [actionItems, commitments] = await Promise.all([
    db.actionItem.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: {
          in: [ActionStatus.SUGGESTED, ActionStatus.PENDING_APPROVAL, ActionStatus.APPROVED],
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        updatedAt: true,
        ownerId: true,
      },
    }),
    db.commitment.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: { in: [CommitmentStatus.OPEN, CommitmentStatus.IN_PROGRESS] },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        ownerUserId: true,
      },
    }),
  ]);

  const findings = classifyLightChainFollowThrough({
    actionItems,
    commitments,
    now,
    config: input.config,
  });

  let notificationsCreated = 0;
  let notificationsDeduplicated = 0;

  for (const finding of findings) {
    const url = findingUrl(finding);
    const existing = await db.notification.findFirst({
      where: {
        workspaceId: input.workspaceId,
        url,
        createdAt: { gte: subDays(now, NOTIFICATION_DEDUPE_HOURS / 24) },
      },
      select: { id: true },
    });
    if (existing) {
      notificationsDeduplicated += 1;
      continue;
    }

    await db.notification.create({
      data: {
        workspaceId: input.workspaceId,
        userId: finding.ownerUserId ?? undefined,
        type: NotificationType.REMINDER,
        title: findingTitle(finding),
        body: finding.advice,
        url,
      },
    });
    notificationsCreated += 1;
  }

  if (findings.length > 0) {
    await writeAuditLog({
      workspaceId: input.workspaceId,
      actor: "Helm Follow-Through",
      actorType: ActorType.SYSTEM,
      actionType: "LIGHT_CHAIN_FOLLOW_THROUGH_SWEEP",
      targetType: "Workspace",
      targetId: input.workspaceId,
      summary: `轻量任务链催办扫描：${findings.length} 项待跟进（新提醒 ${notificationsCreated}，去重 ${notificationsDeduplicated}）`,
      payload: {
        findingCounts: findings.reduce<Record<string, number>>((acc, finding) => {
          acc[finding.kind] = (acc[finding.kind] ?? 0) + 1;
          return acc;
        }, {}),
        managerAttentionCount: findings.filter((finding) => finding.managerAttentionRequired).length,
        notificationsCreated,
        notificationsDeduplicated,
        boundary: "advice-only sweep: internal notifications and audit only; no external send, no task-state mutation",
      },
    });
  }

  return {
    workspaceId: input.workspaceId,
    findings,
    notificationsCreated,
    notificationsDeduplicated,
  };
}

// Sweep every workspace that has any open light-chain work. Used by the cron
// wrapper; also callable manually from scripts.
export async function runLightChainFollowThroughSweep(input?: {
  now?: Date;
  config?: Partial<LightChainFollowThroughConfig>;
}): Promise<LightChainFollowThroughSweepResult[]> {
  const workspaces = await db.workspace.findMany({
    where: {
      OR: [
        {
          actionItems: {
            some: {
              status: {
                in: [ActionStatus.SUGGESTED, ActionStatus.PENDING_APPROVAL, ActionStatus.APPROVED],
              },
            },
          },
        },
        {
          commitments: {
            some: {
              status: { in: [CommitmentStatus.OPEN, CommitmentStatus.IN_PROGRESS] },
              dueDate: { not: null },
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  const results: LightChainFollowThroughSweepResult[] = [];
  for (const workspace of workspaces) {
    results.push(
      await runLightChainFollowThroughSweepForWorkspace({
        workspaceId: workspace.id,
        now: input?.now,
        config: input?.config,
      }),
    );
  }
  return results;
}
