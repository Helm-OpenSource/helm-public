import { ActionStatus, CommitmentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { classifyLightChainFollowThrough } from "@/lib/task-follow-through/light-chain-follow-through";

const NOW = new Date("2026-07-06T09:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("classifyLightChainFollowThrough", () => {
  it("classifies overdue actions and escalates long-outstanding ones", () => {
    const findings = classifyLightChainFollowThrough({
      actionItems: [
        {
          id: "a-1",
          title: "跟进门店培训",
          status: ActionStatus.PENDING_APPROVAL,
          dueDate: daysAgo(2),
          updatedAt: daysAgo(2),
          ownerId: "user-1",
        },
        {
          id: "a-2",
          title: "复盘活动效果",
          status: ActionStatus.APPROVED,
          dueDate: daysAgo(10),
          updatedAt: daysAgo(10),
          ownerId: null,
        },
      ],
      commitments: [],
      now: NOW,
    });

    expect(findings).toHaveLength(2);
    // sorted by daysOutstanding desc
    expect(findings[0]).toMatchObject({
      subjectId: "a-2",
      kind: "action_overdue",
      daysOutstanding: 10,
      managerAttentionRequired: true,
    });
    expect(findings[1]).toMatchObject({
      subjectId: "a-1",
      kind: "action_overdue",
      managerAttentionRequired: false,
    });
  });

  it("detects approval-stalled and execution-stalled items without due dates", () => {
    const findings = classifyLightChainFollowThrough({
      actionItems: [
        {
          id: "a-1",
          title: "待审批建议",
          status: ActionStatus.PENDING_APPROVAL,
          dueDate: null,
          updatedAt: daysAgo(4),
          ownerId: null,
        },
        {
          id: "a-2",
          title: "已批准未执行",
          status: ActionStatus.APPROVED,
          dueDate: null,
          updatedAt: daysAgo(5),
          ownerId: null,
        },
        {
          id: "a-3",
          title: "刚更新的任务",
          status: ActionStatus.PENDING_APPROVAL,
          dueDate: null,
          updatedAt: daysAgo(1),
          ownerId: null,
        },
      ],
      commitments: [],
      now: NOW,
    });

    expect(findings.map((finding) => finding.kind).sort()).toEqual([
      "action_approval_stalled",
      "action_execution_stalled",
    ]);
  });

  it("classifies overdue commitments without touching overdueFlag semantics", () => {
    const findings = classifyLightChainFollowThrough({
      actionItems: [],
      commitments: [
        {
          id: "c-1",
          title: "本周交付培训材料",
          status: CommitmentStatus.OPEN,
          dueDate: daysAgo(3),
          ownerUserId: "user-9",
        },
        {
          id: "c-2",
          title: "已履约承诺",
          status: CommitmentStatus.FULFILLED,
          dueDate: daysAgo(3),
          ownerUserId: null,
        },
      ],
      now: NOW,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      kind: "commitment_overdue",
      subjectId: "c-1",
      ownerUserId: "user-9",
      daysOutstanding: 3,
    });
  });

  it("ignores terminal action statuses", () => {
    const findings = classifyLightChainFollowThrough({
      actionItems: [
        {
          id: "a-1",
          title: "已执行",
          status: ActionStatus.EXECUTED,
          dueDate: daysAgo(5),
          updatedAt: daysAgo(5),
          ownerId: null,
        },
        {
          id: "a-2",
          title: "已阻断",
          status: ActionStatus.BLOCKED,
          dueDate: daysAgo(5),
          updatedAt: daysAgo(5),
          ownerId: null,
        },
      ],
      commitments: [],
      now: NOW,
    });

    expect(findings).toHaveLength(0);
  });
});
