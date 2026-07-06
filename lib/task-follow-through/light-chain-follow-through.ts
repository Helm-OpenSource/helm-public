import { ActionStatus, CommitmentStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Light-chain follow-through classifier (pure).
//
// The helm-v2 official-write chain already has deadlines, stale-receipt
// detection, and escalation (OfficialFollowThrough). The light task chain
// (ActionItem / Commitment) only had a read-time overdue flag and no active
// sweep — work that stalls there dies silently. This module classifies open
// light-chain items into follow-through findings. It is advice-only input:
// the sweep service turns findings into internal notifications and audit
// entries; nothing is auto-sent externally and no task state is mutated.
// Commitment.overdueFlag stays read-only per the business-advancement
// invariant — this classifier derives overdue-ness from dueDate instead.
// ---------------------------------------------------------------------------

export type LightChainFollowThroughKind =
  | "action_overdue"
  | "action_approval_stalled"
  | "action_execution_stalled"
  | "commitment_overdue";

export type LightChainFollowThroughFinding = {
  kind: LightChainFollowThroughKind;
  subjectType: "action_item" | "commitment";
  subjectId: string;
  title: string;
  ownerUserId: string | null;
  daysOutstanding: number;
  managerAttentionRequired: boolean;
  advice: string;
};

export type LightChainFollowThroughConfig = {
  // After how many days a PENDING_APPROVAL task counts as stuck at the gate.
  approvalStalledAfterDays: number;
  // After how many days an APPROVED-but-unexecuted task counts as stuck.
  executionStalledAfterDays: number;
  // Outstanding days beyond which a finding needs manager attention.
  managerAttentionAfterDays: number;
};

export const DEFAULT_LIGHT_CHAIN_FOLLOW_THROUGH_CONFIG: LightChainFollowThroughConfig = {
  approvalStalledAfterDays: 3,
  executionStalledAfterDays: 3,
  managerAttentionAfterDays: 7,
};

export type LightChainActionItemInput = {
  id: string;
  title: string;
  status: ActionStatus;
  dueDate: Date | null;
  updatedAt: Date;
  ownerId: string | null;
};

export type LightChainCommitmentInput = {
  id: string;
  title: string;
  status: CommitmentStatus;
  dueDate: Date | null;
  ownerUserId: string | null;
};

const OPEN_ACTION_STATUSES: ActionStatus[] = [
  ActionStatus.SUGGESTED,
  ActionStatus.PENDING_APPROVAL,
  ActionStatus.APPROVED,
];

const OPEN_COMMITMENT_STATUSES: CommitmentStatus[] = [
  CommitmentStatus.OPEN,
  CommitmentStatus.IN_PROGRESS,
];

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function classifyLightChainFollowThrough(input: {
  actionItems: LightChainActionItemInput[];
  commitments: LightChainCommitmentInput[];
  now: Date;
  config?: Partial<LightChainFollowThroughConfig>;
}): LightChainFollowThroughFinding[] {
  const config = { ...DEFAULT_LIGHT_CHAIN_FOLLOW_THROUGH_CONFIG, ...input.config };
  const findings: LightChainFollowThroughFinding[] = [];

  for (const item of input.actionItems) {
    if (!OPEN_ACTION_STATUSES.includes(item.status)) continue;

    if (item.dueDate && item.dueDate.getTime() < input.now.getTime()) {
      const daysOutstanding = Math.max(1, daysBetween(item.dueDate, input.now));
      findings.push({
        kind: "action_overdue",
        subjectType: "action_item",
        subjectId: item.id,
        title: item.title,
        ownerUserId: item.ownerId,
        daysOutstanding,
        managerAttentionRequired: daysOutstanding >= config.managerAttentionAfterDays,
        advice: `任务已逾期 ${daysOutstanding} 天，建议负责人确认是否继续、改期或关闭。`,
      });
      continue; // overdue supersedes stalled for the same item
    }

    const idleDays = daysBetween(item.updatedAt, input.now);
    if (item.status === ActionStatus.PENDING_APPROVAL && idleDays >= config.approvalStalledAfterDays) {
      findings.push({
        kind: "action_approval_stalled",
        subjectType: "action_item",
        subjectId: item.id,
        title: item.title,
        ownerUserId: item.ownerId,
        daysOutstanding: idleDays,
        managerAttentionRequired: idleDays >= config.managerAttentionAfterDays,
        advice: `审批已停留 ${idleDays} 天，建议复核人尽快批准、拒绝或转人工。`,
      });
    } else if (item.status === ActionStatus.APPROVED && idleDays >= config.executionStalledAfterDays) {
      findings.push({
        kind: "action_execution_stalled",
        subjectType: "action_item",
        subjectId: item.id,
        title: item.title,
        ownerUserId: item.ownerId,
        daysOutstanding: idleDays,
        managerAttentionRequired: idleDays >= config.managerAttentionAfterDays,
        advice: `已批准 ${idleDays} 天仍未执行，建议标记执行结果或阻断原因。`,
      });
    }
  }

  for (const commitment of input.commitments) {
    if (!OPEN_COMMITMENT_STATUSES.includes(commitment.status)) continue;
    if (!commitment.dueDate || commitment.dueDate.getTime() >= input.now.getTime()) continue;

    const daysOutstanding = Math.max(1, daysBetween(commitment.dueDate, input.now));
    findings.push({
      kind: "commitment_overdue",
      subjectType: "commitment",
      subjectId: commitment.id,
      title: commitment.title,
      ownerUserId: commitment.ownerUserId,
      daysOutstanding,
      managerAttentionRequired: daysOutstanding >= config.managerAttentionAfterDays,
      advice: `承诺已逾期 ${daysOutstanding} 天，建议确认履约状态并给出下一步。`,
    });
  }

  return findings.sort((a, b) => b.daysOutstanding - a.daysOutstanding);
}
