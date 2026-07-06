import { ActionStatus, ActorType, CommitmentStatus, NotificationType } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  classifyLightChainFollowThrough,
  type LightChainFollowThroughConfig,
  type LightChainFollowThroughFinding,
} from "@/lib/task-follow-through/light-chain-follow-through";

// Advice-only sweep over the light task chain. For each finding it creates an
// INTERNAL reminder notification (deduplicated per subject per day through a
// unique dedupe key, so concurrent sweeps cannot double-notify) and one audit
// entry per sweep. Boundaries: no external send, no task-state mutation, no
// write to Commitment.overdueFlag (read-only invariant).

// Per-workspace query ceiling. A sweep is an advice surface, not an exhaustive
// report: when a workspace exceeds this, the sweep processes the first page
// and marks the audit entry as truncated instead of silently claiming
// full coverage.
export const LIGHT_CHAIN_SWEEP_MAX_ITEMS = 500;

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

function buildFindingDedupeKey(finding: LightChainFollowThroughFinding, now: Date): string {
  const dayStamp = now.toISOString().slice(0, 10);
  return `follow-through:${finding.subjectType}:${finding.subjectId}:${dayStamp}`;
}

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
  truncated: boolean;
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
      orderBy: { updatedAt: "asc" },
      take: LIGHT_CHAIN_SWEEP_MAX_ITEMS,
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
      orderBy: { dueDate: "asc" },
      take: LIGHT_CHAIN_SWEEP_MAX_ITEMS,
    }),
  ]);

  const truncated =
    actionItems.length >= LIGHT_CHAIN_SWEEP_MAX_ITEMS ||
    commitments.length >= LIGHT_CHAIN_SWEEP_MAX_ITEMS;

  const findings = classifyLightChainFollowThrough({
    actionItems,
    commitments,
    now,
    config: input.config,
  });

  let notificationsCreated = 0;
  let notificationsDeduplicated = 0;

  for (const finding of findings) {
    // Atomic dedupe: the unique (workspaceId, dedupeKey) index is the only
    // arbiter — concurrent sweeps or multiple instances resolve to exactly
    // one reminder per subject per day.
    try {
      await db.notification.create({
        data: {
          workspaceId: input.workspaceId,
          userId: finding.ownerUserId ?? undefined,
          type: NotificationType.REMINDER,
          title: findingTitle(finding),
          body: finding.advice,
          url: findingUrl(finding),
          dedupeKey: buildFindingDedupeKey(finding, now),
        },
      });
      notificationsCreated += 1;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        notificationsDeduplicated += 1;
        continue;
      }
      throw error;
    }
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
        truncated,
        maxItemsPerQuery: LIGHT_CHAIN_SWEEP_MAX_ITEMS,
        boundary: "advice-only sweep: internal notifications and audit only; no external send, no task-state mutation",
      },
    });
  }

  return {
    workspaceId: input.workspaceId,
    findings,
    notificationsCreated,
    notificationsDeduplicated,
    truncated,
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

  // Failure isolation: one workspace's error must not starve the rest of the
  // fleet of their reminders. Failures are logged, audited best-effort, and
  // the sweep continues.
  const results: LightChainFollowThroughSweepResult[] = [];
  for (const workspace of workspaces) {
    try {
      results.push(
        await runLightChainFollowThroughSweepForWorkspace({
          workspaceId: workspace.id,
          now: input?.now,
          config: input?.config,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[light-chain-follow-through] workspace ${workspace.id} sweep failed: ${message}`);
      try {
        await writeAuditLog({
          workspaceId: workspace.id,
          actor: "Helm Follow-Through",
          actorType: ActorType.SYSTEM,
          actionType: "LIGHT_CHAIN_FOLLOW_THROUGH_SWEEP_FAILED",
          targetType: "Workspace",
          targetId: workspace.id,
          summary: "轻量任务链催办扫描失败，本工作区本轮跳过",
          payload: { error: message },
        });
      } catch {
        // best-effort audit; the console line above is the fallback signal
      }
    }
  }
  return results;
}
