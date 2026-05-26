import { ActionType, ObjectType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  applyMeetingMemoryReviewOnlyOverrides,
  buildApprovalBoundaryModel,
  buildApprovalTaskReasonChain,
  buildDashboardArbitrationModel,
  buildMeetingMemoryExportPayload,
  buildMeetingMemoryBundle,
  buildMeetingMemoryGovernanceSummary,
  buildMeetingMemoryItemGovernanceSummary,
  buildMeetingMemoryLoopSummary,
  buildMeetingMemorySourceUseLedger,
  buildMeetingTemplateSummary,
  buildMeetingWorkspaceLightSummary,
  buildMemoryObjectStateSnapshots,
  buildPilotReadinessModel,
  buildWorkspaceEventSignals,
  createOperatingSkillInvocation,
  getOperatingSkillForActionType,
} from "@/lib/operating-system";

describe("operating system model", () => {
  it("maps high-frequency actions into a stable skill catalog", () => {
    const skill = getOperatingSkillForActionType(ActionType.DRAFT_EXTERNAL_EMAIL);
    const invocation = createOperatingSkillInvocation({
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      objectLabel: "Acme 采购评估同步会",
      policyResult: "REQUIRES_APPROVAL",
    });

    expect(skill?.id).toBe("external-followup-draft");
    expect(invocation?.boundaryMode).toBe("approval");
  });

  it("builds object-state snapshots from memory-like inputs", () => {
    const snapshots = buildMemoryObjectStateSnapshots({
      memoryEntries: [
        { entityType: "OPPORTUNITY" },
        { entityType: "OPPORTUNITY" },
        { entityType: "CONTACT" },
      ],
      memoryFacts: [
        { objectType: "OPPORTUNITY" },
        { objectType: "MEETING" },
      ],
      commitments: [
        { overdueFlag: true, relatedOpportunity: { title: "Acme" } },
        { overdueFlag: false, relatedContact: { name: "Grace" } },
      ],
      blockers: [
        { severity: 80, relatedOpportunity: { title: "Acme" } },
      ],
      corrections: [{ id: "1" }],
      auditLogs: [{ id: "1" }, { id: "2" }],
    });

    const opportunity = snapshots.find((item) => item.objectType === ObjectType.OPPORTUNITY);
    expect(opportunity?.status).toBe("blocked");
    expect(opportunity?.suggestedSkillIds).toContain("opportunity-push");
  });

  it("keeps meeting-derived memory explainable before promotion", () => {
    const bundle = buildMeetingMemoryBundle(
      {
        meeting: {
          id: "meeting-1",
          title: "Acme 采购评估同步会",
          keyDecisions: "先同步采购节奏\n预算确认后发正式方案",
          openQuestions: "谁来完成内部预算确认",
        },
        memoryFacts: [
          {
            id: "fact-1",
            objectType: "MEETING",
            objectId: "meeting-1",
            title: "客户采购节奏将在本周内确认",
            content: "客户表示本周会给出采购节奏。",
            sourceType: "MEETING_NOTE",
            sourceId: "meeting-1",
          },
        ],
        commitments: [
          {
            id: "commitment-1",
            title: "补充预算确认",
            commitmentText: "周三前完成内部预算确认",
            status: "OPEN",
            overdueFlag: false,
            relatedOpportunity: { id: "opp-1", title: "Acme 采购评估同步会" },
          },
        ],
        blockers: [
          {
            id: "blocker-1",
            title: "采购节奏未锁定",
            blockerType: "PROCESS",
            blockerText: "正式方案需要等采购节奏明确后才能发。",
            severity: 82,
            status: "OPEN",
            relatedOpportunity: { id: "opp-1", title: "Acme 采购评估同步会" },
          },
        ],
        corrections: [
          {
            id: "correction-1",
            reason: "预算确认后发正式方案并非本周承诺",
            memoryFact: { title: "预算确认后发正式方案" },
          },
        ],
        affectedObjects: [
          {
            id: "opp-1",
            objectType: ObjectType.OPPORTUNITY,
            label: "Acme 采购评估同步会",
          },
        ],
      },
      false,
    );

    expect(bundle.promotedCount).toBeGreaterThan(0);
    expect(bundle.pendingReviewCount).toBeGreaterThan(0);
    expect(bundle.conflictCount).toBeGreaterThan(0);
    expect(bundle.decisions[1]?.lifecycle).toBe("conflict");
  });

  it("summarizes meeting-memory lifecycle for loop consumption", () => {
    const bundle = buildMeetingMemoryBundle(
      {
        meeting: {
          id: "meeting-2",
          title: "Beacon 招聘校准会",
          keyDecisions: "先确认下周候选人面试安排",
          openQuestions: "是否需要追加一轮业务面",
        },
        memoryFacts: [],
        commitments: [
          {
            id: "commitment-2",
            title: "确认面试安排",
            commitmentText: "今天内确认候选人面试安排",
            status: "OPEN",
            overdueFlag: true,
            relatedOpportunity: { id: "opp-2", title: "Beacon 招聘项目" },
          },
        ],
        blockers: [],
        corrections: [],
        affectedObjects: [
          {
            id: "opp-2",
            objectType: ObjectType.OPPORTUNITY,
            label: "Beacon 招聘项目",
          },
        ],
      },
      false,
    );

    const summary = buildMeetingMemoryLoopSummary(bundle, false);

    expect(summary.dominantState).toBe("pending-review");
    expect(summary.blockingLifecycle).toBe("pending-review");
    expect(summary.affectedObjectsLine).toContain("Beacon 招聘项目");
  });

  it("keeps meeting-memory governance readable for ownership and review posture", () => {
    const bundle = buildMeetingMemoryBundle(
      {
        meeting: {
          id: "meeting-3",
          title: "Helio shortlist 评估会",
          keyDecisions: "先锁定 Maya 面试安排",
          openQuestions: "是否需要追加业务轮",
        },
        memoryFacts: [
          {
            id: "fact-3",
            objectType: "MEETING",
            objectId: "meeting-3",
            title: "Maya 需要先确认时间窗口",
            content: "会中确认 Maya 需要先锁定时间窗口再继续推进。",
            sourceType: "MEETING_NOTE",
            sourceId: "meeting-3",
          },
        ],
        commitments: [
          {
            id: "commitment-3",
            title: "锁定 Maya 面试安排",
            commitmentText: "今天内完成 Maya 面试安排确认",
            status: "OPEN",
            overdueFlag: true,
            relatedOpportunity: { id: "opp-3", title: "Helio shortlist 项目" },
          },
        ],
        blockers: [],
        corrections: [
          {
            id: "correction-3",
            reason: "是否追加业务轮仍未定",
            memoryFact: { title: "先锁定 Maya 面试安排" },
          },
        ],
        affectedObjects: [
          {
            id: "opp-3",
            objectType: ObjectType.OPPORTUNITY,
            label: "Helio shortlist 项目",
          },
        ],
      },
      false,
    );

    const governance = buildMeetingMemoryGovernanceSummary(bundle, false);
    const promotedItem = bundle.facts[0];
    const pendingItem = bundle.commitments[0];
    const promotedGovernance = buildMeetingMemoryItemGovernanceSummary(
      promotedItem,
      bundle.meetingId,
      false,
    );
    const pendingGovernance = buildMeetingMemoryItemGovernanceSummary(
      pendingItem,
      bundle.meetingId,
      false,
    );

    expect(governance.visibilityCue).toBe("review-only");
    expect(governance.reviewState).toBe("conflict");
    expect(governance.sourceClassLabels.length).toBeGreaterThan(0);
    expect(
      [
        governance.reviewSummary,
        governance.eligibilitySummary,
        promotedGovernance.sourceSummary,
        pendingGovernance.eligibilitySummary,
      ].join("\n"),
    ).not.toMatch(/review-only|review-first|operating memory|operating context|wording|wedge/);
    expect(promotedGovernance.visibilityCue).toBe("promoted-to-object-state");
    expect(pendingGovernance.visibilityCue).toBe("review-only");
    expect(pendingGovernance.sourceClass).toBe(
      "blockers-commitments-decisions",
    );
  });

  it("keeps meeting ingress source pointers readable across calendar thread and object context", () => {
    const bundle = buildMeetingMemoryBundle(
      {
        meeting: {
          id: "meeting-4",
          title: "Acme 会后推进会",
          summary: "确认会后推进顺序",
          startsAt: new Date("2026-03-30T09:00:00Z"),
          location: "线上会议室",
          attendeeNames: ["Maya", "Lena"],
        },
        memoryFacts: [
          {
            id: "fact-4",
            objectType: "EMAIL_THREAD",
            objectId: "thread-1",
            title: "客户线程仍待收口",
            content: "客户在邮件线程里还在等待下一步明确答复。",
            sourceType: "EMAIL_THREAD",
            sourceId: "thread-1",
          },
        ],
        commitments: [
          {
            id: "commitment-4",
            title: "确认会后推进顺序",
            commitmentText: "今天内确认会后推进顺序",
            status: "OPEN",
            overdueFlag: false,
            relatedOpportunity: { id: "opp-4", title: "Acme 机会" },
          },
        ],
        blockers: [],
        corrections: [],
        affectedObjects: [
          {
            id: "opp-4",
            objectType: ObjectType.OPPORTUNITY,
            label: "Acme 机会",
          },
        ],
      },
      false,
    );

    expect(bundle.sourcePointers.some((item) => item.id === "calendar:meeting-4")).toBe(
      true,
    );
    expect(bundle.sourcePointers.some((item) => item.id === "thread:meeting-4")).toBe(
      true,
    );
    expect(bundle.sourcePointers.some((item) => item.id === "objects:meeting-4")).toBe(
      true,
    );
  });

  it("keeps meeting templates and workspace visibility readable without widening scope", () => {
    const template = buildMeetingTemplateSummary(
      {
        title: "Helio shortlist 面试校准会",
        summary: "确认候选人面试推进顺序",
        opportunityType: "RECRUITING",
        attendeeCount: 3,
        hasOpenFollowThrough: true,
      },
      false,
    );
    const bundle = buildMeetingMemoryBundle(
      {
        meeting: {
          id: "meeting-5",
          title: "Helio shortlist 面试校准会",
        },
        memoryFacts: [
          {
            id: "fact-5",
            objectType: "MEETING",
            objectId: "meeting-5",
            title: "候选人希望尽快确认时间",
            content: "候选人希望尽快确认下一轮时间。",
            sourceType: "MEETING_NOTE",
            sourceId: "meeting-5",
          },
        ],
        commitments: [
          {
            id: "commitment-5",
            title: "锁定面试时间",
            commitmentText: "今天内确认面试安排",
            status: "OPEN",
            overdueFlag: true,
            relatedOpportunity: { id: "opp-5", title: "Helio shortlist 项目" },
          },
        ],
        blockers: [],
        corrections: [
          {
            id: "correction-5",
            reason: "是否追加业务轮仍待确认",
            memoryFact: { title: "锁定面试时间" },
          },
        ],
        affectedObjects: [
          {
            id: "opp-5",
            objectType: ObjectType.OPPORTUNITY,
            label: "Helio shortlist 项目",
          },
        ],
      },
      false,
    );
    const workspaceLight = buildMeetingWorkspaceLightSummary(bundle, false);

    expect(template.templateId).toBe("interview");
    expect(workspaceLight.visibilityCue).toBe("review-only");
    expect(workspaceLight.reviewOnlyCount).toBeGreaterThan(0);
    expect(workspaceLight.summary).toContain("复核");
    expect(workspaceLight.summary).not.toContain("review");
  });

  it("turns workspace pressure into event signals and arbitration cues", () => {
    const eventSignals = buildWorkspaceEventSignals({
      pendingApprovals: 5,
      followUpDueCount: 4,
      highRiskCount: 3,
      meetingsToday: 2,
      waitingOnUsThreadCount: 6,
      importedSignalCount: 12,
      recentCorrectionsCount: 2,
    });

    const arbitration = buildDashboardArbitrationModel({
      topRecommendations: [
        {
          recommendationId: "rec-1",
          objectType: ObjectType.OPPORTUNITY,
          objectId: "opp-1",
          objectLabel: "Acme 采购评估同步会",
          actionType: ActionType.UPDATE_OPPORTUNITY_STAGE,
          title: "创建《Acme 采购评估同步会》后续会议",
          description: "",
          score: 82,
          urgencyScore: 82,
          impactScore: 80,
          confidenceScore: 75,
          personalizationScore: 70,
          policyFitScore: 72,
          riskScore: 68,
          policyResult: "REQUIRES_APPROVAL",
          supportingFactIds: [],
          blockerIds: [],
          commitmentIds: [],
          explanation: "because",
          appliedPolicyRules: [],
          status: "ACTIVE",
          createdAt: new Date(),
          recommendationPayload: null,
        },
      ],
      pendingApprovals: 5,
      highRiskCount: 3,
      waitingOnUsThreadCount: 6,
      meetingsToday: 2,
      eventSignals,
    });

    expect(eventSignals[0]?.kind).toBe("approval-backlog");
    expect(arbitration.recommendedSkillIds).toContain("opportunity-push");
  });

  it("summarizes approval boundary and pilot readiness", () => {
    const boundary = buildApprovalBoundaryModel([
      {
        id: "task-1",
        channel: "外发动作",
        isHighRisk: true,
        autoExecute: false,
        status: "PENDING",
        reasoning: "需要先 review 对外发出的内容。",
        actionItem: {
          actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
          title: "发送 Acme 跟进邮件",
          recommendationLog: {
            policyResult: "REQUIRES_APPROVAL",
            score: 80,
            supportingFactIds: JSON.stringify(["fact-1", "fact-2"]),
            blockerIds: JSON.stringify(["blocker-1"]),
            commitmentIds: JSON.stringify(["commitment-1"]),
          },
        },
      },
    ]);

    const readiness = buildPilotReadinessModel({
      recommendationQuality: {
        goldenSummary: { passRate: 76 },
        acceptanceRate: 48,
      },
      memoryQuality: {
        goldenSummary: { passRate: 72 },
        correctionRate: 18,
      },
      llmOverview: {
        fallbackCount: 2,
        totalCalls: 20,
      },
      captureOverview: {
        failedSessions: 1,
        totalSessions: 10,
        averageConfidence: 0.81,
      },
      crmSources: [{ id: "crm-1" }],
      importJobs: [{ failedRecords: 0, warningRecords: 1 }],
      identityReviewCount: 3,
      pendingApprovals: 4,
      recentAuditCount: 32,
    });

    expect(boundary.queueState).toBe("boundary-heavy");
    expect(boundary.topSkillIds).toContain("external-followup-draft");
    expect(readiness.stage).toBe("scalable");
    expect(readiness.gates).toHaveLength(4);
  });

  it("keeps approval reason-chain drawer copy user-facing in Chinese", () => {
    const reasonChain = buildApprovalTaskReasonChain(
      {
        id: "task-1",
        channel: "外发动作",
        isHighRisk: true,
        autoExecute: false,
        status: "PENDING",
        reasoning: "Lena 已表明合作意愿，及时收口可避免热度流失。",
        actionItem: {
          actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
          title: "发送 Atlas 合作 brief",
          recommendationLog: {
            policyResult: "REQUIRES_APPROVAL",
            score: 80,
            supportingFactIds: JSON.stringify(["fact-1", "fact-2"]),
            blockerIds: JSON.stringify(["blocker-1"]),
            commitmentIds: JSON.stringify(["commitment-1"]),
          },
        },
      },
      false,
    );

    const rendered = reasonChain
      .map((item) => `${item.label} ${item.summary}`)
      .join(" ");

    expect(reasonChain[0]?.label).toBe("动作来源");
    expect(rendered).toContain("可复核的操作草稿");
    expect(rendered).toContain("2 条事实、1 条阻塞和 1 条承诺");
    expect(rendered).not.toMatch(/Skill|operating action|facts|blockers|commitments|review 判断/i);
  });

  it("keeps zero-evidence approval reason-chain copy from looking like a broken data link", () => {
    const reasonChain = buildApprovalTaskReasonChain(
      {
        id: "task-2",
        channel: "外发动作",
        isHighRisk: true,
        autoExecute: false,
        status: "PENDING",
        reasoning: "采购推进窗口短，建议今天处理。",
        actionItem: {
          actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
          title: "发送华东智造会后 ROI 材料",
          recommendationLog: null,
        },
      },
      false,
    );

    const evidence = reasonChain.find((item) => item.label === "证据覆盖");

    expect(evidence?.summary).toContain("还没有结构化事实、阻塞或承诺引用");
    expect(evidence?.summary).toContain("来源上下文、风险等级和人工判断");
    expect(evidence?.summary).not.toContain("0 条事实、0 条阻塞和 0 条承诺");
  });

  it("keeps manual meeting-memory review holds and export posture explicit", () => {
    const bundle = buildMeetingMemoryBundle(
      {
        meeting: {
          id: "meeting-6",
          title: "Acme 会后推进会",
          keyDecisions: "先确认对外方案边界",
        },
        memoryFacts: [
          {
            id: "fact-6",
            objectType: "MEETING",
            objectId: "meeting-6",
            title: "客户希望本周内明确方案边界",
            content: "客户希望本周内明确方案边界和内部评估顺序。",
            sourceType: "MEETING_NOTE",
            sourceId: "meeting-6",
          },
        ],
        commitments: [
          {
            id: "commitment-6",
            title: "确认内部方案边界",
            commitmentText: "先确认内部方案边界，再决定是否进入外部 review。",
            status: "OPEN",
            overdueFlag: false,
            relatedOpportunity: { id: "opp-6", title: "Acme 方案推进" },
          },
        ],
        blockers: [],
        corrections: [],
        affectedObjects: [
          {
            id: "opp-6",
            objectType: ObjectType.OPPORTUNITY,
            label: "Acme 方案推进",
          },
        ],
      },
      false,
    );

    const promotedItem = bundle.items.find((item) => item.lifecycle === "promoted");

    expect(promotedItem).toBeTruthy();

    const overridden = applyMeetingMemoryReviewOnlyOverrides(
      bundle,
      [promotedItem!.id],
      false,
    );
    const overriddenItem = overridden.items.find((item) => item.id === promotedItem!.id);
    const ledger = buildMeetingMemorySourceUseLedger(overridden, false);
    const payload = buildMeetingMemoryExportPayload(overridden, false);

    expect(overriddenItem?.lifecycle).toBe("pending-review");
    expect(overriddenItem?.sourcePointer.id).toBe(promotedItem?.sourcePointer.id);
    expect(overriddenItem?.reasonChainSummary).toContain("人工治理");
    expect(ledger.entries.some((entry) => entry.id === promotedItem?.id)).toBe(true);
    expect(
      payload.items.find((item) => item.id === promotedItem?.id)?.reviewState,
    ).toBe("pending-review");
  });
});
