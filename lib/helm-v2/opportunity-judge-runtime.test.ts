import { afterEach, expect, it } from "vitest";
import { OpportunityStage, OpportunityType, RiskLevel, WorkspaceStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { confirmMeetingFactsRuntime, ingestMeetingEndedRuntime } from "@/lib/helm-v2/meeting-action-pack-runtime";
import { getMeetingOpportunityJudgeRuntimeSummary, reviewOpportunityJudgeRuntime } from "@/lib/helm-v2/opportunity-judge-runtime";
import { describeMySqlRuntime } from "@/lib/test/mysql-runtime-suite";

const cleanupWorkspaceIds: string[] = [];

async function createOpportunityJudgeFixture() {
  const suffix = randomUUID().slice(0, 8);
  const workspace = await db.workspace.create({
    data: {
      name: `Helm v2 Opportunity Judge ${suffix}`,
      slug: `helm-v2-opportunity-judge-${suffix}`,
      status: WorkspaceStatus.ACTIVE,
      description: "Workspace for Helm v2 Opportunity Judge runtime tests.",
    },
  });
  cleanupWorkspaceIds.push(workspace.id);

  const user = await db.user.create({
    data: {
      email: `helm-v2-opportunity-judge-${suffix}@example.com`,
      name: `Helm V2 Judge Tester ${suffix}`,
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
      stage: OpportunityStage.CONTACTED,
      riskLevel: RiskLevel.MEDIUM,
      nextAction: "确认客户预算 owner 和联合评审窗口",
    },
  });

  const meeting = await db.meeting.create({
    data: {
      workspaceId: workspace.id,
      companyId: company.id,
      opportunityId: opportunity.id,
      ownerId: user.id,
      title: `Contoso ROI 采购推进会 ${suffix}`,
      agenda: "确认 ROI follow-up、联合评审时间和预算 owner",
      startsAt: new Date("2026-04-03T02:00:00.000Z"),
      endsAt: new Date("2026-04-03T03:00:00.000Z"),
    },
  });

  await db.meetingNote.create({
    data: {
      workspaceId: workspace.id,
      meetingId: meeting.id,
      meetingGoal: "确认客户是否进入联合评审，并明确预算 owner。",
      riskAlerts: "预算 owner 仍未明确；如本周不收口，联合评审会继续延后。",
      summary: "客户接受我们先发 ROI follow-up，本周补预算 owner，再确定联合评审时间。",
      keyDecisions: "先发 ROI follow-up，联合评审暂定下周。当前不承诺正式价格或交付日期。",
      confirmations: "销售 owner 在 24 小时内发跟进草稿，manager 复核后再继续推进。",
    },
  });

  return {
    workspace,
    user,
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

describeMySqlRuntime("Helm v2 opportunity judge runtime", () => {
  it("requires separate review before shadow consume and still keeps official stage unchanged", async () => {
    const fixture = await createOpportunityJudgeFixture();

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

    const beforeReview = await getMeetingOpportunityJudgeRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const beforeOpportunity = await db.opportunity.findUniqueOrThrow({
      where: { id: fixture.opportunity.id },
    });

    expect(beforeReview?.bundle?.reviewStatus).toBe("pending_review");
    expect(beforeOpportunity.stage).toBe(OpportunityStage.CONTACTED);
    expect(beforeOpportunity.shadowStage).toBeNull();

    const reviewResult = await reviewOpportunityJudgeRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "confirm",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    expect(reviewResult.ok).toBe(true);
    expect(reviewResult.shadowConsumed).toBe(true);

    const [afterReview, afterOpportunity] = await Promise.all([
      getMeetingOpportunityJudgeRuntimeSummary(fixture.workspace.id, fixture.meeting.id),
      db.opportunity.findUniqueOrThrow({
        where: { id: fixture.opportunity.id },
      }),
    ]);

    expect(afterOpportunity.stage).toBe(OpportunityStage.CONTACTED);
    expect(afterOpportunity.shadowStage).toBe(OpportunityStage.ADVANCING);
    expect(afterOpportunity.shadowNextAction).toBeTruthy();
    expect(afterReview?.artifactReview?.status).toBe("CONFIRMED");
    expect(afterReview?.bundle?.status).toBe("CONSUMED");
    expect(afterReview?.currentShadow).not.toBeNull();
    expect(afterReview?.currentShadow?.stage).toBe(OpportunityStage.ADVANCING);
  });
});
