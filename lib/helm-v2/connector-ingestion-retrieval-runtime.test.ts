import { afterEach, describe, expect, it } from "vitest";
import {
  MemoryItemKind,
  MemoryItemPromotionRule,
  MemoryItemRetention,
  MemoryItemScope,
  MemoryItemSensitivity,
  MemoryItemStatus,
  MemoryItemVerification,
  OpportunityStage,
  OpportunityType,
  RiskLevel,
  WorkspaceStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  getMeetingConnectorIngestionRetrievalSummary,
  syncMeetingConnectorIngestionRetrievalRuntime,
} from "@/lib/helm-v2/connector-ingestion-retrieval-runtime";
import { ingestMeetingEndedRuntime } from "@/lib/helm-v2/meeting-action-pack-runtime";

const cleanupWorkspaceIds: string[] = [];

async function createSprint7Fixture() {
  const suffix = randomUUID().slice(0, 8);
  const workspace = await db.workspace.create({
    data: {
      name: `Helm v2 Sprint 7 ${suffix}`,
      slug: `helm-v2-sprint7-${suffix}`,
      status: WorkspaceStatus.ACTIVE,
      description: "Workspace for Helm v2 Sprint 7 ingestion and retrieval runtime tests.",
    },
  });
  cleanupWorkspaceIds.push(workspace.id);

  const user = await db.user.create({
    data: {
      email: `helm-v2-sprint7-${suffix}@example.com`,
      name: `Helm V2 Sprint 7 Tester ${suffix}`,
    },
  });

  const company = await db.company.create({
    data: {
      workspaceId: workspace.id,
      name: `Contoso ${suffix}`,
    },
  });

  const opportunity = await db.opportunity.create({
    data: {
      workspaceId: workspace.id,
      companyId: company.id,
      ownerId: user.id,
      title: `Contoso Expansion ${suffix}`,
      type: OpportunityType.CLIENT,
      stage: OpportunityStage.ADVANCING,
      riskLevel: RiskLevel.MEDIUM,
      nextAction: "整理 ROI follow-up 和确认采购窗口",
    },
  });

  const meeting = await db.meeting.create({
    data: {
      workspaceId: workspace.id,
      companyId: company.id,
      opportunityId: opportunity.id,
      ownerId: user.id,
      title: `Contoso planning sync ${suffix}`,
      agenda: "确认 ROI follow-up、采购窗口和依赖项",
      startsAt: new Date("2026-04-09T02:00:00.000Z"),
      endsAt: new Date("2026-04-09T03:00:00.000Z"),
    },
  });

  await db.meetingNote.create({
    data: {
      workspaceId: workspace.id,
      meetingId: meeting.id,
      meetingGoal: "确认采购窗口和下一步 ROI follow-up。",
      riskAlerts: "预算 owner 仍未完全确认；任何价格或交付日期都不能提前承诺。",
      summary: "客户接受我们先发 ROI follow-up，本周补预算 owner，再约采购评审。",
      keyDecisions: "先发 ROI follow-up，并准备采购评审时间建议。",
      confirmations: "销售 owner 在 24 小时内发跟进草稿，manager 复核后再推进。",
      liveTranscript: "客户说先把 ROI summary 发过来，我们再确认预算 owner 和 procurement review 时间。",
    },
  });

  await db.emailThread.create({
    data: {
      workspaceId: workspace.id,
      companyId: company.id,
      opportunityId: opportunity.id,
      subject: `Contoso procurement follow-up ${suffix}`,
      counterpart: "buyer@contoso.example",
      summary: "客户在等 ROI summary 和采购评审时间建议。",
      status: "OPEN",
      waitingOn: "ROI summary",
    },
  });

  await db.memoryEntry.create({
    data: {
      workspaceId: workspace.id,
      meetingId: meeting.id,
      opportunityId: opportunity.id,
      entityType: "MEETING",
      memoryType: "NOTE",
      title: "人工补充：预算 owner 需要由客户 CFO 拉进来",
      content: "销售 owner 手工补充：预算 owner 尚未明确，但 CFO 可能需要进入下一轮。",
      source: "human",
    },
  });

  await db.memoryItem.create({
    data: {
      workspaceId: workspace.id,
      meetingId: meeting.id,
      opportunityId: opportunity.id,
      kind: MemoryItemKind.CHECKPOINT,
      scope: MemoryItemScope.OBJECT,
      namespace: "opportunity",
      status: MemoryItemStatus.PROMOTED,
      verification: MemoryItemVerification.HUMAN_CONFIRMED,
      sensitivity: MemoryItemSensitivity.INTERNAL,
      retention: MemoryItemRetention.PERMANENT,
      promotionRule: MemoryItemPromotionRule.HUMAN_CONFIRMED,
      writer: "human",
      summary: "旧 checkpoint：上月认为客户已经锁定预算 owner。",
      payload: JSON.stringify({ outdated: true }),
      createdAt: new Date("2025-12-01T00:00:00.000Z"),
    },
  });

  return {
    workspace,
    user,
    company,
    opportunity,
    meeting,
  };
}

afterEach(async () => {
  while (cleanupWorkspaceIds.length > 0) {
    const workspaceId = cleanupWorkspaceIds.pop();
    if (!workspaceId) continue;
    await db.workspace.delete({
      where: { id: workspaceId },
    }).catch(() => null);
  }
});

describe("Helm v2 richer connector ingestion and retrieval runtime", () => {
  it("records richer source posture and retrieval traces without promoting untrusted content directly", async () => {
    const fixture = await createSprint7Fixture();

    await ingestMeetingEndedRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    await syncMeetingConnectorIngestionRetrievalRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
    });

    const summary = await getMeetingConnectorIngestionRetrievalSummary(fixture.workspace.id, fixture.meeting.id);

    expect(summary).toBeTruthy();
    expect(summary?.sources.map((item) => item.ingestionSourceType)).toEqual(
      expect.arrayContaining(["calendar_event", "meeting_transcript", "meeting_note", "crm_snapshot", "email_thread", "human_edit", "agent_inference"]),
    );
    expect(summary?.sources.find((item) => item.ingestionSourceType === "meeting_transcript")?.ingestionPromotionEligibility).toBe("draft_only");
    expect(summary?.sources.find((item) => item.ingestionSourceType === "crm_snapshot")?.systemOfRecord).toBe(true);
    expect(summary?.traces.some((trace) => trace.loadedRefs.some((item) => item.key === "policy-summary"))).toBe(true);
    expect(summary?.traces.some((trace) => trace.loadedRefs.some((item) => item.key === "workspace-summary"))).toBe(true);
    expect(summary?.traces.some((trace) => trace.skippedRefs.some((item) => item.key === "historical-meetings"))).toBe(true);
    expect(summary?.traces.some((trace) => trace.skippedRefs.some((item) => item.key.startsWith("memory:")))).toBe(true);
  });
});
