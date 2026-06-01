import { afterEach, describe, expect, it } from "vitest";
import { OpportunityStage, OpportunityType, RiskLevel, WorkspaceStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  confirmMeetingFactsRuntime,
  getMeetingRuntimeSummary,
  ingestMeetingEndedRuntime,
} from "@/lib/helm-v2/meeting-action-pack-runtime";
import { getMeetingOpportunityJudgeRuntimeSummary } from "@/lib/helm-v2/opportunity-judge-runtime";

const runMysqlIntegration = process.env.HELM_RUN_MYSQL_TESTS === "1";
const describeMysqlIntegration = runMysqlIntegration ? describe : describe.skip;

const cleanupWorkspaceIds: string[] = [];

async function createRuntimeFixture() {
  const suffix = randomUUID().slice(0, 8);
  const workspace = await db.workspace.create({
    data: {
      name: `Helm v2 Test ${suffix}`,
      slug: `helm-v2-test-${suffix}`,
      status: WorkspaceStatus.ACTIVE,
      description: "Workspace for Helm v2 meeting runtime tests.",
    },
  });
  cleanupWorkspaceIds.push(workspace.id);

  const user = await db.user.create({
    data: {
      email: `helm-v2-${suffix}@example.com`,
      name: `Helm V2 Tester ${suffix}`,
    },
  });

  const company = await db.company.create({
    data: {
      workspaceId: workspace.id,
      name: `Northwind ${suffix}`,
    },
  });

  const opportunity = await db.opportunity.create({
    data: {
      workspaceId: workspace.id,
      companyId: company.id,
      ownerId: user.id,
      title: `Northwind Expansion ${suffix}`,
      type: OpportunityType.CLIENT,
      stage: OpportunityStage.CONTACTED,
      riskLevel: RiskLevel.MEDIUM,
      nextAction: "确认客户内部采购窗口",
    },
  });

  const meeting = await db.meeting.create({
    data: {
      workspaceId: workspace.id,
      companyId: company.id,
      opportunityId: opportunity.id,
      ownerId: user.id,
      title: `Northwind 采购推进会 ${suffix}`,
      agenda: "确认采购窗口、ROI 资料与联合评审节奏",
      startsAt: new Date("2026-04-02T10:00:00.000Z"),
      endsAt: new Date("2026-04-02T11:00:00.000Z"),
    },
  });

  await db.meetingNote.create({
    data: {
      workspaceId: workspace.id,
      meetingId: meeting.id,
      meetingGoal: "确认采购推进窗口，并决定会后 follow-up 的唯一 owner。",
      riskAlerts: "如果会后 24 小时内没有结构化 follow-up，这个采购窗口会迅速冷下来。\n客户还没有确认预算 owner。",
      summary: "客户已经进入采购推进窗口，关键动作是 24 小时内发出 ROI + 联合评审 follow-up。",
      keyDecisions: "先由我们起草 ROI follow-up，再安排下周联合评审。\n当前不形成任何正式价格承诺。",
      confirmations: "会后先发一封结构化 follow-up 邮件。\n下周安排联合评审时间建议。",
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

describeMysqlIntegration("Helm v2 meeting action-pack runtime", () => {
  it("persists the meeting-ended ingest into runtime tables and waits on human confirm", async () => {
    const fixture = await createRuntimeFixture();

    const result = await ingestMeetingEndedRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    expect(result.reused).toBe(false);

    const summary = await getMeetingRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    expect(summary?.latestMeetingEndedEvent?.status).toBe("COMPLETED");
    expect(summary?.factsArtifact?.facts.length).toBeGreaterThan(0);
    expect(summary?.actionPack?.markdown).toContain("action pack");
    expect(summary?.approvalRequest?.status).toBe("PENDING");
    expect(summary?.artifactReview?.status).toBe("PENDING");
    expect(summary?.promotedMemory).toHaveLength(0);
  });

  it("confirms facts, promotes memory, and hands off into downstream opportunity judgement", async () => {
    const fixture = await createRuntimeFixture();

    await ingestMeetingEndedRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const confirmResult = await confirmMeetingFactsRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "confirm",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    expect(confirmResult.ok).toBe(true);
    expect(confirmResult.opportunityJudgeTriggered).toBe(true);

    const [summary, opportunityJudgeRuntime, refreshedOpportunity] = await Promise.all([
      getMeetingRuntimeSummary(fixture.workspace.id, fixture.meeting.id),
      getMeetingOpportunityJudgeRuntimeSummary(fixture.workspace.id, fixture.meeting.id),
      db.opportunity.findUniqueOrThrow({
        where: { id: fixture.opportunity.id },
      }),
    ]);

    expect(summary?.artifactReview?.status).toBe("CONFIRMED");
    expect(summary?.promotedMemory.length).toBeGreaterThan(0);
    expect(summary?.latestMeetingFactsEvent?.status).toBe("COMPLETED");
    expect(opportunityJudgeRuntime?.bundle?.reviewStatus).toBe("pending_review");
    expect(refreshedOpportunity.stage).toBe(OpportunityStage.CONTACTED);
    expect(refreshedOpportunity.shadowStage).toBeNull();
    expect(refreshedOpportunity.shadowNextAction).toBeNull();
  });
});
