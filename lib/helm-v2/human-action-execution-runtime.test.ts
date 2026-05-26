import { afterEach, describe, expect, it } from "vitest";
import { ArtifactBundleStatus, OpportunityStage, OpportunityType, RiskLevel, WorkspaceStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { reviewDraftCommsRuntime, runDraftCommsHandoffRuntime } from "@/lib/helm-v2/draft-comms-handoff-runtime";
import {
  acknowledgeHumanActionExecution,
  getMeetingHumanActionExecutionSummary,
  syncMeetingHumanActionExecutionRuntime,
} from "@/lib/helm-v2/human-action-execution-runtime";
import { confirmMeetingFactsRuntime, ingestMeetingEndedRuntime } from "@/lib/helm-v2/meeting-action-pack-runtime";
import { reviewOpportunityJudgeRuntime, runOpportunityJudgeRuntime } from "@/lib/helm-v2/opportunity-judge-runtime";

const cleanupWorkspaceIds: string[] = [];

async function createSprint5Fixture() {
  const suffix = randomUUID().slice(0, 8);
  const workspace = await db.workspace.create({
    data: {
      name: `Helm v2 Sprint5 ${suffix}`,
      slug: `helm-v2-sprint5-${suffix}`,
      status: WorkspaceStatus.ACTIVE,
      description: "Workspace for Helm v2 Sprint 5 runtime tests.",
    },
  });
  cleanupWorkspaceIds.push(workspace.id);

  const user = await db.user.create({
    data: {
      email: `helm-v2-sprint5-${suffix}@example.com`,
      name: `Helm V2 Sprint5 ${suffix}`,
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
      nextAction: "确认客户预算 owner 和下周联合评审窗口",
    },
  });

  const meeting = await db.meeting.create({
    data: {
      workspaceId: workspace.id,
      companyId: company.id,
      opportunityId: opportunity.id,
      ownerId: user.id,
      title: `Northwind follow-through ${suffix}`,
      agenda: "确认 ROI follow-up、联合评审时间建议和 CRM pipeline next step",
      startsAt: new Date("2026-04-09T02:00:00.000Z"),
      endsAt: new Date("2026-04-09T03:00:00.000Z"),
    },
  });

  await db.meetingNote.create({
    data: {
      workspaceId: workspace.id,
      meetingId: meeting.id,
      meetingGoal: "确认 follow-up 由谁人工执行，并保留 non-commitment 边界。",
      riskAlerts: "客户预算 owner 仍未明确；如本周不跟进，联合评审窗口会继续下滑。",
      summary: "客户接受我们会后先发 ROI follow-up，再发时间建议。",
      keyDecisions: "当前先发 non-commitment follow-up，不形成正式价格或交付日期承诺。",
      confirmations: "owner 在 24 小时内人工发 follow-up；manager 复核后继续推进。",
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

async function runApprovedSprint5Sources(fixture: Awaited<ReturnType<typeof createSprint5Fixture>>) {
  await ingestMeetingEndedRuntime({
    workspaceId: fixture.workspace.id,
    meetingId: fixture.meeting.id,
    actorName: fixture.user.name,
    actorUserId: fixture.user.id,
    sourcePage: `/meetings/${fixture.meeting.id}`,
    force: true,
  });

  await confirmMeetingFactsRuntime({
    workspaceId: fixture.workspace.id,
    meetingId: fixture.meeting.id,
    reviewerId: fixture.user.id,
    reviewerName: fixture.user.name,
    mode: "confirm",
    sourcePage: `/meetings/${fixture.meeting.id}`,
  });

  await runDraftCommsHandoffRuntime({
    workspaceId: fixture.workspace.id,
    meetingId: fixture.meeting.id,
    actorName: fixture.user.name,
    actorUserId: fixture.user.id,
    sourcePage: `/meetings/${fixture.meeting.id}`,
    force: true,
  });

  await reviewDraftCommsRuntime({
    workspaceId: fixture.workspace.id,
    meetingId: fixture.meeting.id,
    reviewerId: fixture.user.id,
    reviewerName: fixture.user.name,
    mode: "approve",
    edits: {
      reviewNotes: "approved for manual execution",
    },
    sourcePage: `/meetings/${fixture.meeting.id}`,
  });

  await runOpportunityJudgeRuntime({
    workspaceId: fixture.workspace.id,
    meetingId: fixture.meeting.id,
    actorName: fixture.user.name,
    actorUserId: fixture.user.id,
    sourcePage: `/meetings/${fixture.meeting.id}`,
    force: true,
  });

  await reviewOpportunityJudgeRuntime({
    workspaceId: fixture.workspace.id,
    meetingId: fixture.meeting.id,
    reviewerId: fixture.user.id,
    reviewerName: fixture.user.name,
    mode: "confirm",
    sourcePage: `/meetings/${fixture.meeting.id}`,
  });
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

describe("Helm v2 human action execution runtime", () => {
  it("creates manual execution actions from approved draft comms and approved shadow judgement, then records proof write-back", async () => {
    const fixture = await createSprint5Fixture();
    await runApprovedSprint5Sources(fixture);

    const syncResult = await syncMeetingHumanActionExecutionRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    expect(syncResult.ok).toBe(true);
    expect(syncResult.actionCount).toBeGreaterThanOrEqual(5);

    const summary = await getMeetingHumanActionExecutionSummary(fixture.workspace.id, fixture.meeting.id);
    expect(summary?.approvedSources.draftCommsApproved).toBe(true);
    expect(summary?.approvedSources.opportunityJudgementApproved).toBe(true);

    const actionTypes = summary?.actions.map((item) => item.actionType) ?? [];
    expect(actionTypes).toEqual(
      expect.arrayContaining([
        "manual_email_send",
        "manual_calendar_send",
        "manual_internal_collab",
        "manual_exec_brief_share",
        "manual_crm_step",
      ]),
    );

    const emailExecution = summary?.actions.find((item) => item.actionType === "manual_email_send");
    expect(emailExecution).toBeTruthy();

    const ackResult = await acknowledgeHumanActionExecution({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      executionId: emailExecution!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "mark_sent_manually",
      note: "已人工发出 ROI follow-up 邮件。",
      externalReference: "manual-email-001",
      whatWasNotDone: "没有自动形成正式价格、合同或交付日期承诺。",
      followThroughStatus: "waiting_customer_reply",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    expect(ackResult.ok).toBe(true);
    expect(ackResult.status).toBe("EXECUTED");
    expect(ackResult.acknowledgementStatus).toBe("ACKNOWLEDGED");
    expect(ackResult.writebackSummary).toContain("已人工发送");

    const [afterSummary, meetingRow, opportunityRow, checkpoint] = await Promise.all([
      getMeetingHumanActionExecutionSummary(fixture.workspace.id, fixture.meeting.id),
      db.meeting.findUniqueOrThrow({
        where: { id: fixture.meeting.id },
        select: { postMeetingSummary: true },
      }),
      db.opportunity.findUniqueOrThrow({
        where: { id: fixture.opportunity.id },
        select: { stage: true, shadowStage: true, nextStepSummary: true },
      }),
      db.memoryItem.findFirst({
        where: {
          workspaceId: fixture.workspace.id,
          meetingId: fixture.meeting.id,
          writer: "human-action-execution",
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    expect(afterSummary?.bundle?.executedCount).toBeGreaterThanOrEqual(1);
    expect(meetingRow.postMeetingSummary).toContain("人工发送");
    expect(opportunityRow.stage).toBe(OpportunityStage.CONTACTED);
    expect(opportunityRow.shadowStage).toBe(OpportunityStage.ADVANCING);
    expect(opportunityRow.nextStepSummary).toContain("人工发送");
    expect(checkpoint?.kind).toBe("CHECKPOINT");
    expect(checkpoint?.summary).toContain("人工发送");
  });

  it("supports manual handoff execution and writes a handoff checkpoint without opening auto execution", async () => {
    const fixture = await createSprint5Fixture();
    await runApprovedSprint5Sources(fixture);

    await db.artifactBundle.create({
      data: {
        workspaceId: fixture.workspace.id,
        meetingId: fixture.meeting.id,
        opportunityId: fixture.opportunity.id,
        companyId: fixture.company.id,
        artifactType: "handoff_pack.md",
        title: "Delivery handoff pack",
        status: ArtifactBundleStatus.CONFIRMED,
        summary: "交付目标、open risks、first-14-day summary。",
        artifactsJson: JSON.stringify({
          markdown: "交付 handoff 已 ready；仍需人工完成交接。",
          summary: "交付目标、open risks、first-14-day summary。",
        }),
        evidenceRefs: JSON.stringify([`meeting:${fixture.meeting.id}`, `opportunity:${fixture.opportunity.id}`]),
        sourceProvenance: JSON.stringify([
          {
            type: "human_confirmed_handoff",
            id: fixture.meeting.id,
            trust: "HUMAN_CONFIRMED",
          },
        ]),
      },
    });

    await syncMeetingHumanActionExecutionRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const summary = await getMeetingHumanActionExecutionSummary(fixture.workspace.id, fixture.meeting.id);
    const handoffExecution = summary?.actions.find((item) => item.actionType === "manual_handoff_delivery");

    expect(handoffExecution).toBeTruthy();
    expect(handoffExecution?.executionWritebackTarget).toContain("role_handoff_summary");

    const ack = await acknowledgeHumanActionExecution({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      executionId: handoffExecution!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "mark_handoff_done",
      note: "已人工把 handoff pack 发给 delivery owner。",
      followThroughStatus: "delivery_ack_pending",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    expect(ack.ok).toBe(true);

    const handoffCheckpoint = await db.memoryItem.findFirst({
      where: {
        workspaceId: fixture.workspace.id,
        meetingId: fixture.meeting.id,
        writer: "human-action-execution",
        kind: "HANDOFF",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(handoffCheckpoint?.summary).toContain("人工完成 handoff");
    expect(handoffCheckpoint?.payload).toContain("executionOnly");
  });
});
