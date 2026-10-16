import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  opportunity: { findMany: vi.fn() },
  approvalTask: { findMany: vi.fn() },
  actionItem: { findMany: vi.fn() },
  emailThread: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock(
  "@/features/business-advancement/runtime/thin-read-model-adapter",
  () => ({
    resolveThinReadModelAdvancementCandidatesWithFallback: vi.fn(async () => null),
  }),
);
vi.mock("@/lib/tenant-resources/workspace-operating-impact-query", () => ({
  getWorkspaceTenantResourceOperatingImpactReadout: vi.fn(async () => ({
    impactItems: [],
  })),
}));

import { getMobileCommandReadModel } from "./mobile-command-read-model";

const now = new Date("2026-10-15T12:00:00.000Z");
const cannedReasons =
  /客户已多次催问|客户已发送后续消息|竞争对手可能已在接触|续约已逾期|customer sent a follow-up/;

beforeEach(() => {
  dbMock.opportunity.findMany.mockImplementation(
    async (args: { where: { dueDate?: { lt?: Date } } }) =>
      args.where.dueDate?.lt
        ? [
            {
              id: "opp-overdue",
              title: "年度续费",
              stage: "ADVANCING",
              riskLevel: "MEDIUM",
              dueDate: new Date("2026-10-12T12:00:00.000Z"),
              updatedAt: new Date("2026-10-10T12:00:00.000Z"),
              createdAt: new Date("2026-09-01T12:00:00.000Z"),
              company: { name: "示例客户" },
              owner: { name: "示例负责人" },
            },
          ]
        : [
            {
              id: "opp-risk",
              title: "扩容试点",
              stage: "WAITING_THEM",
              riskLevel: "CRITICAL",
              dueDate: null,
              updatedAt: new Date("2026-10-05T12:00:00.000Z"),
              createdAt: new Date("2026-09-01T12:00:00.000Z"),
              company: null,
              owner: null,
            },
          ],
  );
  dbMock.approvalTask.findMany.mockResolvedValue([]);
  dbMock.actionItem.findMany.mockResolvedValue([
    {
      id: "action-1",
      title: "发送会议纪要",
      meetingId: "meeting-1",
      dueDate: new Date("2026-10-16T12:00:00.000Z"),
      meeting: { title: "季度复盘" },
      opportunity: null,
      contact: null,
      owner: { name: "示例负责人" },
    },
  ]);
  dbMock.emailThread.findMany.mockResolvedValue([
    {
      id: "thread-1",
      subject: "续费报价确认",
      counterpart: "示例联系人",
      updatedAt: new Date("2026-10-14T12:00:00.000Z"),
      company: { name: "示例客户" },
      contact: null,
    },
  ]);
});

describe("getMobileCommandReadModel record facts", () => {
  it("builds titles and reasons from stage, owner, due date and thread subject", async () => {
    const model = await getMobileCommandReadModel({
      workspaceId: "workspace-1",
      now,
      limit: 10,
    });
    const byId = new Map(model.mustPushItems.map((item) => [item.id, item]));

    const overdue = byId.get("overdue-opp-opp-overdue");
    expect(overdue?.title).toBe("示例客户 · 年度续费 已逾期 3 天");
    expect(overdue?.reason).toBe("阶段 待推进 · 负责人 示例负责人 · 截止 10月12日");

    const stalled = byId.get("stalled-opp-opp-risk");
    expect(stalled?.title).toBe("扩容试点 10 天未更新");
    expect(stalled?.reason).toBe("风险 关键风险 · 阶段 等待对方 · 负责人 未指派");

    const followUp = byId.get("meeting-followup-action-1");
    expect(followUp?.reason).toBe("动作 发送会议纪要 · 负责人 示例负责人 · 截止 10月16日");

    const waiting = byId.get("waiting-thread-thread-1");
    expect(waiting?.reason).toBe("线程 续费报价确认 · 来自 示例联系人 · 更新于 10月14日");

    for (const item of model.mustPushItems) {
      expect(item.reason).not.toMatch(cannedReasons);
      expect(item.title).not.toMatch(cannedReasons);
    }
  });

  it("uses the same record facts in English", async () => {
    const model = await getMobileCommandReadModel({
      workspaceId: "workspace-1",
      now,
      limit: 10,
      english: true,
    });
    const waiting = model.mustPushItems.find(
      (item) => item.id === "waiting-thread-thread-1",
    );
    const overdue = model.mustPushItems.find(
      (item) => item.id === "overdue-opp-opp-overdue",
    );

    expect(waiting?.reason).toBe("Thread 续费报价确认 · From 示例联系人 · Updated Oct 14");
    expect(overdue?.reason).toBe("Stage Advancing · Owner 示例负责人 · Due Oct 12");
    for (const item of model.mustPushItems) {
      expect(item.reason).not.toMatch(cannedReasons);
    }
  });
});
