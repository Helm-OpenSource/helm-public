import { afterEach, describe, expect, it } from "vitest";
import {
  HumanActionExecutionType,
  HumanActionExecutionStatus,
  OfficialWriteApprovalStatus,
  OpportunityStage,
  OpportunityType,
  RiskLevel,
  WorkspaceStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { reviewDraftCommsRuntime, runDraftCommsHandoffRuntime } from "@/lib/helm-v2/draft-comms-handoff-runtime";
import { acknowledgeHumanActionExecution, getMeetingHumanActionExecutionSummary, syncMeetingHumanActionExecutionRuntime } from "@/lib/helm-v2/human-action-execution-runtime";
import { confirmMeetingFactsRuntime, ingestMeetingEndedRuntime } from "@/lib/helm-v2/meeting-action-pack-runtime";
import {
  acknowledgeOfficialWriteIntent,
  attemptOfficialWriteIntent,
  buildLimitedAutoIntentContracts,
  buildOfficialWriteIntentContracts,
  getMeetingOfficialWriteRuntimeSummary,
  reviewLimitedAutoIntent,
  reviewOfficialWriteIntent,
  syncMeetingLimitedAutoIntents,
  syncMeetingOfficialFollowThroughRuntime,
  syncMeetingOfficialWriteIntents,
  updateOfficialFollowThrough,
} from "@/lib/helm-v2/official-system-integration-runtime";
import { reviewOpportunityJudgeRuntime } from "@/lib/helm-v2/opportunity-judge-runtime";

const cleanupWorkspaceIds: string[] = [];

async function createOfficialWriteFixture() {
  const suffix = randomUUID().slice(0, 8);
  const workspace = await db.workspace.create({
    data: {
      name: `Helm v2 Official Write ${suffix}`,
      slug: `helm-v2-official-write-${suffix}`,
      status: WorkspaceStatus.ACTIVE,
      description: "Workspace for Helm v2 official write runtime tests.",
    },
  });
  cleanupWorkspaceIds.push(workspace.id);

  const user = await db.user.create({
    data: {
      email: `helm-v2-official-write-${suffix}@example.com`,
      name: `Helm V2 Official Write Tester ${suffix}`,
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
      nextAction: "确认 ROI follow-up 和预算 owner",
    },
  });

  const meeting = await db.meeting.create({
    data: {
      workspaceId: workspace.id,
      companyId: company.id,
      opportunityId: opportunity.id,
      ownerId: user.id,
      title: `Northwind procurement review ${suffix}`,
      agenda: "锁定 ROI follow-up、预算 owner 和联合评审窗口",
      startsAt: new Date("2026-04-05T02:00:00.000Z"),
      endsAt: new Date("2026-04-05T03:00:00.000Z"),
    },
  });

  await db.meetingNote.create({
    data: {
      workspaceId: workspace.id,
      meetingId: meeting.id,
      meetingGoal: "确认客户是否进入联合评审并明确预算 owner。",
      riskAlerts: "预算 owner 仍未明确；当前不能承诺正式价格或交付日期。",
      summary: "客户接受我们先发 ROI follow-up，本周补预算 owner，再确认联合评审时间。",
      keyDecisions: "先发 ROI follow-up，并准备联合评审时间建议。当前不承诺正式价格或交付日期。",
      confirmations: "销售 owner 在 24 小时内发跟进草稿，manager 复核后再推进。",
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

async function confirmMeetingAndRunShadow(fixture: Awaited<ReturnType<typeof createOfficialWriteFixture>>) {
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

describe("Helm v2 official system integration guarded path", () => {
  it("creates guarded write intents from approved shadow recommendation and only updates official stage after explicit approve + ack success", async () => {
    const fixture = await createOfficialWriteFixture();
    await confirmMeetingAndRunShadow(fixture);

    const beforeOpportunity = await db.opportunity.findUniqueOrThrow({
      where: { id: fixture.opportunity.id },
    });

    expect(beforeOpportunity.stage).toBe(OpportunityStage.CONTACTED);
    expect(beforeOpportunity.shadowStage).toBe(OpportunityStage.ADVANCING);

    const syncResult = await syncMeetingOfficialWriteIntents({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    expect(syncResult.ok).toBe(true);
    expect(syncResult.intentCount).toBeGreaterThanOrEqual(3);

    const beforeAckSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const stageIntent = beforeAckSummary?.intents.find((item) => item.writeActionType === "crm.update_official_stage");
    expect(stageIntent).toBeTruthy();
    expect(beforeAckSummary?.sourceEligibility.approvedShadowRecommendation).toBe(true);

    await reviewOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: stageIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "approve",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await attemptOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: stageIntent!.id,
      actorId: fixture.user.id,
      actorName: fixture.user.name,
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    const stillBeforeAck = await db.opportunity.findUniqueOrThrow({
      where: { id: fixture.opportunity.id },
    });
    expect(stillBeforeAck.stage).toBe(OpportunityStage.CONTACTED);

    await acknowledgeOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: stageIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "ack_success",
      note: "CRM API returned success for official stage update.",
      externalSystemReference: "crm-sync-stage-001",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    const [afterAckSummary, afterOpportunity, checkpoint] = await Promise.all([
      getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id),
      db.opportunity.findUniqueOrThrow({
        where: { id: fixture.opportunity.id },
      }),
      db.memoryItem.findFirst({
        where: {
          workspaceId: fixture.workspace.id,
          meetingId: fixture.meeting.id,
          summary: {
            contains: "Guarded official write acknowledged",
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    expect(afterOpportunity.stage).toBe(OpportunityStage.ADVANCING);
    expect(afterAckSummary?.intents.find((item) => item.id === stageIntent!.id)?.writeAcknowledgementStatus).toBe("SUCCESS");
    expect(afterAckSummary?.latestWriteback.meetingPostMeetingSummary).toContain("Helm v2 guarded official write status");
    expect(checkpoint?.summary).toContain("Guarded official write acknowledged");
  });

  it("derives limited auto intents from approved guarded note writes and only treats acknowledged success as limited auto success", async () => {
    const fixture = await createOfficialWriteFixture();

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
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await syncMeetingHumanActionExecutionRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const executionSummary = await getMeetingHumanActionExecutionSummary(fixture.workspace.id, fixture.meeting.id);
    const primaryAction = executionSummary?.actions.find(
      (item) => item.actionType === "manual_email_send" || item.actionType === "manual_customer_followup",
    );
    expect(primaryAction).toBeTruthy();

    await acknowledgeHumanActionExecution({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      executionId: primaryAction!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "mark_sent_manually",
      note: "The owner sent the reviewed follow-up manually outside Helm.",
      externalReference: "gmail-thread-auto-001",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await syncMeetingOfficialWriteIntents({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const beforeAutoSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const noteIntent = beforeAutoSummary?.intents.find((item) => item.writeActionType === "crm.attach_note");
    expect(noteIntent).toBeTruthy();

    await reviewOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: noteIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "approve",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await syncMeetingLimitedAutoIntents({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const syncedSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const limitedAutoIntent = syncedSummary?.limitedAuto?.intents.find((item) => item.sourceWriteIntentId === noteIntent!.id);
    expect(limitedAutoIntent?.limitedAutoEligibilityStatus).toBe("eligible");

    await reviewLimitedAutoIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      limitedAutoIntentId: limitedAutoIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "approve",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    const afterAutoSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const autoRow = afterAutoSummary?.limitedAuto?.intents.find((item) => item.id === limitedAutoIntent!.id);
    const sourceRow = afterAutoSummary?.intents.find((item) => item.id === noteIntent!.id);

    expect(autoRow?.limitedAutoApprovalStatus).toBe("APPROVED");
    expect(autoRow?.limitedAutoExecutionStatus).toBe("ACKNOWLEDGED_SUCCESS");
    expect(autoRow?.limitedAutoAckStatus).toBe("SUCCESS");
    expect(autoRow?.limitedAutoRollbackStatus).toBe("NOT_SUPPORTED");
    expect(sourceRow?.writeAcknowledgementStatus).toBe("SUCCESS");
    expect(sourceRow?.externalSystemReference).toContain("crm-auto-note");
  });

  it("allows approved official next-action writes onto the constrained limited auto path and only updates official next action after acknowledged success", async () => {
    const fixture = await createOfficialWriteFixture();
    await confirmMeetingAndRunShadow(fixture);

    await syncMeetingOfficialWriteIntents({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const beforeSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const nextActionIntent = beforeSummary?.intents.find((item) => item.writeActionType === "crm.update_next_action");

    expect(nextActionIntent).toBeTruthy();
    expect(nextActionIntent?.actionDefaultPath).toBe("limited_auto");

    await reviewOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: nextActionIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "approve",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await syncMeetingLimitedAutoIntents({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const syncedSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const limitedAutoIntent = syncedSummary?.limitedAuto?.intents.find((item) => item.sourceWriteIntentId === nextActionIntent!.id);
    expect(limitedAutoIntent?.limitedAutoEligibilityStatus).toBe("eligible");

    await reviewLimitedAutoIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      limitedAutoIntentId: limitedAutoIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "approve",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    const [afterSummary, opportunity] = await Promise.all([
      getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id),
      db.opportunity.findUniqueOrThrow({
        where: { id: fixture.opportunity.id },
      }),
    ]);

    const autoRow = afterSummary?.limitedAuto?.intents.find((item) => item.id === limitedAutoIntent!.id);
    const sourceRow = afterSummary?.intents.find((item) => item.id === nextActionIntent!.id);

    expect(autoRow?.limitedAutoExecutionStatus).toBe("ACKNOWLEDGED_SUCCESS");
    expect(autoRow?.receiptStatus).toBe("acknowledged_success");
    expect(sourceRow?.writeAcknowledgementStatus).toBe("SUCCESS");
    expect(opportunity.nextAction).toContain("先发 ROI follow-up");
    expect(sourceRow?.externalSystemReference).toContain("crm-auto-next-action");
  });

  it("creates guarded note intents from acknowledged human execution proof and captures failure without claiming official success", async () => {
    const fixture = await createOfficialWriteFixture();

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
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await syncMeetingHumanActionExecutionRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const executionSummary = await getMeetingHumanActionExecutionSummary(fixture.workspace.id, fixture.meeting.id);
    const primaryAction = executionSummary?.actions.find(
      (item) => item.actionType === "manual_email_send" || item.actionType === "manual_customer_followup",
    );

    expect(primaryAction).toBeTruthy();

    await acknowledgeHumanActionExecution({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      executionId: primaryAction!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "mark_sent_manually",
      note: "The owner sent the reviewed follow-up manually outside Helm.",
      externalReference: "gmail-thread-001",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    const executedRow = await db.humanActionExecution.findUniqueOrThrow({
      where: { id: primaryAction!.id },
    });
    expect(executedRow.status).toBe(HumanActionExecutionStatus.EXECUTED);

    await syncMeetingOfficialWriteIntents({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const beforeAckSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const noteIntent = beforeAckSummary?.intents.find((item) => item.writeActionType === "crm.attach_note");

    expect(noteIntent).toBeTruthy();
    expect(beforeAckSummary?.sourceEligibility.acknowledgedExecutionProofCount).toBeGreaterThanOrEqual(1);

    await reviewOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: noteIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "approve",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await attemptOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: noteIntent!.id,
      actorId: fixture.user.id,
      actorName: fixture.user.name,
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await acknowledgeOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: noteIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "ack_failure",
      note: "The CRM API rejected the note payload; retry will stay manual for now.",
      externalSystemReference: "crm-note-failure-001",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    const afterAckSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const failedIntent = afterAckSummary?.intents.find((item) => item.id === noteIntent!.id);
    const opportunity = await db.opportunity.findUniqueOrThrow({
      where: { id: fixture.opportunity.id },
    });

    expect(failedIntent?.writeAcknowledgementStatus).toBe("FAILURE");
    expect(failedIntent?.writeFailureReason).toContain("CRM API rejected");
    expect(afterAckSummary?.latestWriteback.meetingPostMeetingSummary).toContain("Helm v2 guarded official write status");
    expect(opportunity.stage).toBe(OpportunityStage.CONTACTED);
  });

  it("keeps handoff summary limited auto in manual-only posture and preserves force-manual override", () => {
    const contracts = buildOfficialWriteIntentContracts({
      executionProofSources: [
        {
          id: "exec_handoff_eval",
          meetingId: "mtg_handoff_eval",
          opportunityId: "opp_handoff_eval",
          companyId: "company_handoff_eval",
          actionType: HumanActionExecutionType.MANUAL_HANDOFF_DELIVERY,
          sourceArtifactBundleId: "handoff_bundle_eval",
          sourceArtifactTitle: "delivery handoff pack",
          sourceArtifactSummary: "交付 handoff 已经由 owner 人工共享给 delivery lead。",
          audience: "delivery",
          executionIntent: "人工把 handoff pack 共享给 delivery 团队。",
          executionBoundary: "这是人工执行入口，不是自动执行入口。",
          executionRiskLevel: RiskLevel.HIGH,
          riskReviewSummary: "handoff 仍然需要 explicit approval 和 audit trail。",
          proofNote: "Delivery lead acknowledged receipt manually.",
          externalReference: "delivery-share-eval",
          followThroughStatus: "delivery_ready",
          whatWasNotDone: "没有自动写任何外部系统。",
          evidenceRefs: ["meeting:mtg_handoff_eval", "artifact:handoff_pack_eval"],
          sourceProvenance: [{ type: "handoff_pack", id: "handoff_pack_eval", trust: "HUMAN_CONFIRMED" }],
          boundaryTrace: [
            "execution proof 不等于 external outcome truth",
            "official CRM writeback 仍然没有默认自动执行",
          ],
        },
      ],
    });

    const limitedAutoContracts = buildLimitedAutoIntentContracts({
      officialWriteIntents: contracts.map((item) => ({
        ...item,
        id: item.sourceKey,
        writeApprovalStatus: OfficialWriteApprovalStatus.APPROVED,
      })),
    });

    expect(limitedAutoContracts).toHaveLength(1);
    expect(limitedAutoContracts[0]?.limitedAutoActionType).toBe("crm.attach_handoff_summary");
    expect(limitedAutoContracts[0]?.limitedAutoEligibilityStatus).toBe("eligible_but_manual_only");
    expect(limitedAutoContracts[0]?.manualOnlyReason).toContain("manual-only");
    expect(limitedAutoContracts[0]?.whatAutoPathWillNotDo).toContain("Force manual path remains available");
  });

  it("captures stale receipts as reconciliation-required audit-only outcomes without claiming official success", async () => {
    const fixture = await createOfficialWriteFixture();
    await confirmMeetingAndRunShadow(fixture);

    await syncMeetingOfficialWriteIntents({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const beforeSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const nextActionIntent = beforeSummary?.intents.find((item) => item.writeActionType === "crm.update_next_action");
    expect(nextActionIntent).toBeTruthy();

    await reviewOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: nextActionIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "approve",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await syncMeetingLimitedAutoIntents({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const syncedSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const limitedAutoIntent = syncedSummary?.limitedAuto?.intents.find((item) => item.sourceWriteIntentId === nextActionIntent!.id);
    expect(limitedAutoIntent?.limitedAutoEligibilityStatus).toBe("eligible");

    await reviewLimitedAutoIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      limitedAutoIntentId: limitedAutoIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "approve",
      simulateResult: "stale_receipt",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    const [afterSummary, opportunity] = await Promise.all([
      getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id),
      db.opportunity.findUniqueOrThrow({
        where: { id: fixture.opportunity.id },
      }),
    ]);

    const autoRow = afterSummary?.limitedAuto?.intents.find((item) => item.id === limitedAutoIntent!.id);
    const sourceRow = afterSummary?.intents.find((item) => item.id === nextActionIntent!.id);

    expect(autoRow?.limitedAutoExecutionStatus).toBe("MANUAL_FOLLOW_UP_REQUIRED");
    expect(autoRow?.receiptStatus).toBe("stale_receipt");
    expect(autoRow?.receiptSummaryWritebackMode).toBe("audit_only");
    expect(sourceRow?.writeAcknowledgementStatus).toBe("RECONCILIATION_NOTED");
    expect(sourceRow?.receiptStatus).toBe("stale_receipt");
    expect(sourceRow?.receiptSummaryWritebackMode).toBe("audit_only");
    expect(opportunity.nextAction).toBe("确认 ROI follow-up 和预算 owner");
    expect(sourceRow?.writeAcknowledgementPayload?.receiptStatus).toBe("stale_receipt");
  });

  it("creates failure follow-through after official ack failure and allows audited resolution without claiming official success", async () => {
    const fixture = await createOfficialWriteFixture();

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
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await syncMeetingHumanActionExecutionRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const executionSummary = await getMeetingHumanActionExecutionSummary(fixture.workspace.id, fixture.meeting.id);
    const primaryAction = executionSummary?.actions.find(
      (item) => item.actionType === "manual_email_send" || item.actionType === "manual_customer_followup",
    );
    expect(primaryAction).toBeTruthy();

    await acknowledgeHumanActionExecution({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      executionId: primaryAction!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "mark_sent_manually",
      note: "The owner sent the reviewed follow-up manually outside Helm.",
      externalReference: "gmail-thread-followthrough-001",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await syncMeetingOfficialWriteIntents({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const beforeAckSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const noteIntent = beforeAckSummary?.intents.find((item) => item.writeActionType === "crm.attach_note");
    expect(noteIntent).toBeTruthy();

    await reviewOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: noteIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "approve",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await attemptOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: noteIntent!.id,
      actorId: fixture.user.id,
      actorName: fixture.user.name,
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await acknowledgeOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: noteIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "ack_failure",
      note: "The CRM adapter rejected the note payload and requires manual reconciliation.",
      externalSystemReference: "crm-followthrough-failure-001",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    const failureSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const followThrough = failureSummary?.followThrough?.items.find((item) => item.sourceWriteIntentId === noteIntent!.id);
    expect(followThrough?.followThroughType).toBe("failure_followthrough");
    expect(followThrough?.followThroughStatus).toBe("awaiting_manual_action");
    expect(followThrough?.followThroughResolutionStatus).toBe("open");

    await updateOfficialFollowThrough({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      followThroughId: followThrough!.id,
      actorId: fixture.user.id,
      actorName: fixture.user.name,
      mode: "escalate_manager",
      note: "Manager should confirm whether the CRM note should be retried manually.",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    const resolveResult = await updateOfficialFollowThrough({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      followThroughId: followThrough!.id,
      actorId: fixture.user.id,
      actorName: fixture.user.name,
      mode: "resolve",
      note: "Manual reconciliation completed. The failed official note remains failed and is documented for handoff only.",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    const [resolvedSummary, checkpoint, opportunity] = await Promise.all([
      getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id),
      db.memoryItem.findFirst({
        where: {
          workspaceId: fixture.workspace.id,
          meetingId: fixture.meeting.id,
          summary: {
            contains: "Official follow-through resolved",
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.opportunity.findUniqueOrThrow({
        where: { id: fixture.opportunity.id },
      }),
    ]);

    const resolvedFollowThrough = resolvedSummary?.followThrough?.items.find((item) => item.id === followThrough!.id);
    const failedIntent = resolvedSummary?.intents.find((item) => item.id === noteIntent!.id);

    expect(resolvedFollowThrough?.followThroughStatus).toBe("resolved");
    expect(resolvedFollowThrough?.followThroughResolutionStatus).toBe("resolved");
    expect(resolvedFollowThrough?.resolvedByName).toBe(fixture.user.name);
    expect(resolveResult.checkpointId).toBeTruthy();
    expect(checkpoint?.summary).toContain("Official follow-through resolved");
    expect(failedIntent?.writeAcknowledgementStatus).toBe("FAILURE");
    expect(opportunity.stage).toBe(OpportunityStage.CONTACTED);
    expect(resolvedSummary?.latestWriteback.meetingPostMeetingSummary).toContain("Helm v2 official follow-through");
  });

  it("creates escalation follow-through after force manual limited auto override and preserves manual fallback", async () => {
    const fixture = await createOfficialWriteFixture();
    await confirmMeetingAndRunShadow(fixture);

    await syncMeetingOfficialWriteIntents({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const beforeSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const nextActionIntent = beforeSummary?.intents.find((item) => item.writeActionType === "crm.update_next_action");
    expect(nextActionIntent).toBeTruthy();

    await reviewOfficialWriteIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      intentId: nextActionIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "approve",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await syncMeetingLimitedAutoIntents({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const syncedSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const limitedAutoIntent = syncedSummary?.limitedAuto?.intents.find((item) => item.sourceWriteIntentId === nextActionIntent!.id);
    expect(limitedAutoIntent?.limitedAutoEligibilityStatus).toBe("eligible");

    await reviewLimitedAutoIntent({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      limitedAutoIntentId: limitedAutoIntent!.id,
      reviewerId: fixture.user.id,
      reviewerName: fixture.user.name,
      mode: "force_manual",
      reviewNotes: "Keep this next-action write on the manual path for now.",
      sourcePage: `/meetings/${fixture.meeting.id}`,
    });

    await syncMeetingOfficialFollowThroughRuntime({
      workspaceId: fixture.workspace.id,
      meetingId: fixture.meeting.id,
      actorName: fixture.user.name,
      actorUserId: fixture.user.id,
      sourcePage: `/meetings/${fixture.meeting.id}`,
      force: true,
    });

    const afterSummary = await getMeetingOfficialWriteRuntimeSummary(fixture.workspace.id, fixture.meeting.id);
    const manualOnlyFollowThrough = afterSummary?.followThrough?.items.find(
      (item) => item.sourceLimitedAutoIntentId === limitedAutoIntent!.id,
    );
    const sourceIntent = afterSummary?.intents.find((item) => item.id === nextActionIntent!.id);
    const updatedLimitedAutoIntent = afterSummary?.limitedAuto?.intents.find((item) => item.id === limitedAutoIntent!.id);

    expect(updatedLimitedAutoIntent?.limitedAutoApprovalStatus).toBe("MANUAL_OVERRIDE");
    expect(manualOnlyFollowThrough?.followThroughType).toBe("escalation_followthrough");
    expect(manualOnlyFollowThrough?.exceptionClass).toBe("manual_override_required");
    expect(manualOnlyFollowThrough?.followThroughStatus).toBe("awaiting_manual_action");
    expect(manualOnlyFollowThrough?.manualFallbackRequired).toBe(true);
    expect(manualOnlyFollowThrough?.followThroughBoundary).toContain("Force manual path");
    expect(sourceIntent?.writeAcknowledgementStatus).toBe("PENDING");
  });
});
