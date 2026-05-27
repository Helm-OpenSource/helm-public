import { afterEach, expect, it } from "vitest";
import { OpportunityStage, OpportunityType, RiskLevel, WorkspaceStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { confirmMeetingFactsRuntime, ingestMeetingEndedRuntime } from "@/lib/helm-v2/meeting-action-pack-runtime";
import {
  getMeetingDraftCommsRuntimeSummary,
  reviewDraftCommsRuntime,
  runDraftCommsHandoffRuntime,
} from "@/lib/helm-v2/draft-comms-handoff-runtime";
import { describeMySqlRuntime } from "@/lib/test/mysql-runtime-suite";

const cleanupWorkspaceIds: string[] = [];

async function createSprint3Fixture() {
  const suffix = randomUUID().slice(0, 8);
  const workspace = await db.workspace.create({
    data: {
      name: `Helm v2 Sprint3 ${suffix}`,
      slug: `helm-v2-sprint3-${suffix}`,
      status: WorkspaceStatus.ACTIVE,
      description: "Workspace for Helm v2 Sprint 3 runtime tests.",
    },
  });
  cleanupWorkspaceIds.push(workspace.id);

  const user = await db.user.create({
    data: {
      email: `helm-v2-sprint3-${suffix}@example.com`,
      name: `Helm V2 Sprint3 ${suffix}`,
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

async function confirmFixtureMeeting(input: Awaited<ReturnType<typeof createSprint3Fixture>>) {
  await ingestMeetingEndedRuntime({
    workspaceId: input.workspace.id,
    meetingId: input.meeting.id,
    actorName: input.user.name,
    actorUserId: input.user.id,
    sourcePage: `/meetings/${input.meeting.id}`,
    force: true,
  });

  await confirmMeetingFactsRuntime({
    workspaceId: input.workspace.id,
    meetingId: input.meeting.id,
    reviewerId: input.user.id,
    reviewerName: input.user.name,
    mode: "confirm",
    sourcePage: `/meetings/${input.meeting.id}`,
  });
}

describeMySqlRuntime("Helm v2 draft-only comms runtime", () => {
  it("persists proposal composer, comms scheduler, risk guard, and review-before-send bundles", async () => {
    const fixture = await createSprint3Fixture();
    await confirmFixtureMeeting(fixture);

    const result = await runDraftCommsHandoffRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    expect(result.reused).toBe(false);

    const summary = await getMeetingDraftCommsRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    expect(summary?.latestFollowupRequestedEvent?.status).toBe("COMPLETED");
    expect(summary?.proposalComposerRun?.status).toBe("COMPLETED");
    expect(summary?.commsSchedulerRun?.status).toBe("COMPLETED");
    expect(summary?.riskGuardRun?.status).toBe("COMPLETED");
    expect(summary?.customerFollowupDraft?.markdown).toContain("会后 follow-up");
    expect(summary?.emailDraft?.body).toContain("这组对外 draft 仍然只是 review-before-send handoff");
    expect(summary?.approvalRequest?.status).toBe("PENDING");
    expect(summary?.artifactReview?.status).toBe("PENDING");
    expect(summary?.bundle?.noSendAuthority).toBe(true);
  });

  it("supports fallback wording and explicit boundary blocking in the draft-only review path", async () => {
    const fixture = await createSprint3Fixture();
    await confirmFixtureMeeting(fixture);

    await runDraftCommsHandoffRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const fallback = await reviewDraftCommsRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "fallback_non_commitment",
      edits: {
        reviewNotes: "改回 non-commitment wording。",
      },
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    expect(fallback.ok).toBe(true);
    expect(fallback.approvedForNextStepHandoff).toBe(true);

    const summary = await getMeetingDraftCommsRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    expect(summary?.artifactReview?.status).toBe("CONFIRMED");
    expect(summary?.bundle?.reviewStatus).toBe("fallback_non_commitment");
    expect(summary?.sanitizedArtifact?.markdown).toContain("正式范围承诺");

    const blockedFixture = await createSprint3Fixture();
    await confirmFixtureMeeting(blockedFixture);
    await runDraftCommsHandoffRuntime({
      workspaceId: blockedFixture.workspace.id,
      meetingId: blockedFixture.meeting.id,
      actorName: blockedFixture.user.name,
      actorUserId: blockedFixture.user.id,
      sourcePage: `/meetings/${blockedFixture.meeting.id}`,
      force: true,
    });

    const blocked = await reviewDraftCommsRuntime({
      workspaceId: blockedFixture.workspace.id,
      meetingId: blockedFixture.meeting.id,
      reviewerId: blockedFixture.user.id,
      reviewerName: blockedFixture.user.name,
      mode: "block_boundary",
      edits: {
        reviewNotes: "这条 wording 先按 boundary block 处理。",
      },
      sourcePage: `/meetings/${blockedFixture.meeting.id}`,
    });

    expect(blocked.ok).toBe(true);
    expect(blocked.blockedByBoundary).toBe(true);

    const blockedSummary = await getMeetingDraftCommsRuntimeSummary(blockedFixture.workspace.id, blockedFixture.meeting.id);
    expect(blockedSummary?.artifactReview?.status).toBe("REJECTED");
    expect(blockedSummary?.bundle?.reviewStatus).toBe("blocked_by_boundary");
  });
});
