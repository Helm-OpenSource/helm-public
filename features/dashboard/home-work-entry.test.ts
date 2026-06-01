import { describe, expect, it } from "vitest";
import type {
  GoalDrivenHomeModel,
  GoalDrivenHomeLink,
} from "@/lib/operating-system/goal-driven-home";
import type {
  WorkspaceFirstLoopItem,
  WorkspaceFirstLoopModel,
  WorkspaceFirstLoopPrimaryAction,
  WorkspaceFirstLoopReturnReadback,
} from "@/lib/operating-system/first-loop";
import type { DashboardSetupFirstLoopHandoffModel } from "@/features/dashboard/setup-first-loop-handoff";
import {
  buildDashboardHomeWorkEntry,
  getDashboardHomeSecondaryVisibility,
} from "@/features/dashboard/home-work-entry";

function buildLoopItem(
  id: WorkspaceFirstLoopItem["id"],
  label: string,
  status: WorkspaceFirstLoopItem["status"],
  href: string,
  summary = `${label} summary`,
): WorkspaceFirstLoopItem {
  return { id, label, status, href, summary };
}

function buildPrimaryAction(
  stepId: WorkspaceFirstLoopPrimaryAction["stepId"],
  href: string,
  label = `Primary ${stepId}`,
): WorkspaceFirstLoopPrimaryAction {
  return {
    stepId,
    label,
    summary: `${label} summary`,
    href,
    ctaLabel: `Open ${label}`,
  };
}

function buildReturnReadback(
  mode: WorkspaceFirstLoopReturnReadback["mode"],
  href: string,
): WorkspaceFirstLoopReturnReadback {
  return {
    mode,
    label: mode === "explicit" ? "Resume saved anchor" : "Derived return point",
    summary: `Return summary for ${mode}`,
    href,
    ctaLabel: "Resume now",
  };
}

function buildFirstLoopModel(input?: Partial<WorkspaceFirstLoopModel>): WorkspaceFirstLoopModel {
  const roleGoal = buildLoopItem("role-goal", "Role and goal", "done", "/setup");
  const firstSignal = buildLoopItem("signal", "First signal", "done", "/meetings/1");
  const firstSuggestion = buildLoopItem("suggestion", "First suggestion", "done", "/dashboard");
  const reviewCheckpoint = buildLoopItem("review", "Review queue", "watch", "/approvals");
  const followThrough = buildLoopItem("follow-through", "Follow through", "watch", "/operating");
  const memoryWriteBack = buildLoopItem("write-back", "Write-back", "watch", "/memory");
  const nextAnchor = buildLoopItem("anchor", "Return anchor", "watch", "/dashboard");

  return {
    stage: "anchor",
    stageLabel: "Next anchor",
    title: "First loop title",
    summary: "First loop summary",
    progressLabel: "5 / 7 complete",
    boundary: "Keep recommendation and commitment separate.",
    hasExplicitAnchor: true,
    completedCount: 5,
    totalCount: 7,
    primaryAction: buildPrimaryAction("anchor", "/dashboard?resume=1", "Resume anchor"),
    returnReadback: buildReturnReadback("explicit", "/dashboard?resume=1"),
    roleGoal,
    firstSignal,
    firstSuggestion,
    reviewCheckpoint,
    followThrough,
    memoryWriteBack,
    nextAnchor,
    steps: [
      roleGoal,
      firstSignal,
      firstSuggestion,
      reviewCheckpoint,
      followThrough,
      memoryWriteBack,
      nextAnchor,
    ],
    ...input,
  };
}

function buildGoalLink(label: string, href: string, hint = `${label} hint`): GoalDrivenHomeLink {
  return { label, href, hint };
}

function buildGoalDrivenHome(input?: Partial<GoalDrivenHomeModel>): GoalDrivenHomeModel {
  return {
    eyebrow: "Goal-driven home",
    title: "Goal-driven home title",
    description: "Goal-driven home description",
    currentCampaign: {
      title: "Current campaign",
      summary: "Current campaign summary",
      boundary: "Current campaign boundary",
      href: "/operating",
    },
    topJudgements: [
      buildGoalLink("Judgement 1", "/dashboard#j1"),
      buildGoalLink("Judgement 2", "/dashboard#j2"),
      buildGoalLink("Judgement 3", "/dashboard#j3"),
    ],
    immediateActions: [
      buildGoalLink("Move 1", "/opportunities/1"),
      buildGoalLink("Move 2", "/operating/roles/founder"),
      buildGoalLink("Move 3", "/memory"),
    ],
    topChains: [buildGoalLink("Chain 1", "/operating")],
    topBlockers: [
      buildGoalLink("Blocker 1", "/opportunities?preset=high-risk"),
      buildGoalLink("Blocker 2", "/approvals"),
      buildGoalLink("Blocker 3", "/inbox"),
    ],
    topDecisionRequests: [buildGoalLink("Decision 1", "/approvals")],
    helmDid: [buildGoalLink("Helm did 1", "/memory")],
    roleHandoffs: [buildGoalLink("Founder lane", "/operating/roles/founder")],
    actionTemplates: [buildGoalLink("Template 1", "/operating")],
    retroFeedback: [buildGoalLink("Retro 1", "/memory")],
    evidenceEntries: [buildGoalLink("Evidence 1", "/memory")],
    note: "Goal-driven note",
    ...input,
  };
}

function buildSetupHandoff(): DashboardSetupFirstLoopHandoffModel {
  return {
    title: "Setup complete",
    summary: "Open the first live signal now.",
    primaryAction: buildPrimaryAction("review", "/approvals?approvalId=seed", "Review first move"),
    signal: {
      label: "First live signal",
      summary: "First live signal summary",
      href: "/meetings/seed",
      ctaLabel: "Open first signal",
    },
    returnReadback: buildReturnReadback("derived", "/dashboard"),
    showSeparateSignalAction: true,
  };
}

describe("buildDashboardHomeWorkEntry", () => {
  it("keeps homepage disclosure pressure state-aware instead of showing all second-layer blocks at once", () => {
    expect(getDashboardHomeSecondaryVisibility("empty-new")).toEqual({
      showPriorityContext: false,
      showSystemContext: false,
      showSurfaceRouting: false,
    });
    expect(getDashboardHomeSecondaryVisibility("first-loop")).toEqual({
      showPriorityContext: true,
      showSystemContext: false,
      showSurfaceRouting: true,
    });
    expect(getDashboardHomeSecondaryVisibility("review-heavy")).toEqual({
      showPriorityContext: true,
      showSystemContext: false,
      showSurfaceRouting: true,
    });
    expect(getDashboardHomeSecondaryVisibility("returning-active")).toEqual({
      showPriorityContext: true,
      showSystemContext: true,
      showSurfaceRouting: true,
    });
  });

  it("builds the empty/new state from setup handoff and keeps first-loop action first", () => {
    const model = buildDashboardHomeWorkEntry({
      english: true,
      firstLoopModel: buildFirstLoopModel({
        completedCount: 1,
        stage: "signal",
        primaryAction: buildPrimaryAction("review", "/approvals?approvalId=1", "Review first move"),
      }),
      goalDrivenHome: buildGoalDrivenHome(),
      pendingApprovals: [],
      setupFirstLoopHandoff: buildSetupHandoff(),
    });

    expect(model.state).toBe("empty-new");
    expect(model.topWorkItems[0]).toMatchObject({
      title: "Review first move",
      subject: "First live signal",
    });
    expect(model.topWorkItems[0].tracking).toMatchObject({
      sourceArea: "dashboard-work-entry",
      eventKind: "primary-action-opened",
      stepId: "review",
    });
  });

  it("keeps a first-loop review fallback visible even without concrete approval tasks", () => {
    const model = buildDashboardHomeWorkEntry({
      english: true,
      firstLoopModel: buildFirstLoopModel({
        stage: "review",
        primaryAction: buildPrimaryAction("review", "/approvals", "Open review"),
        reviewCheckpoint: buildLoopItem("review", "Review checkpoint", "ready", "/approvals"),
      }),
      goalDrivenHome: buildGoalDrivenHome(),
      pendingApprovals: [],
      setupFirstLoopHandoff: null,
    });

    expect(model.state).toBe("first-loop");
    expect(model.reviewItems[0]).toMatchObject({
      title: "Review checkpoint",
      href: "/approvals",
    });
    expect(model.reviewItems[0].tracking).toMatchObject({
      sourceArea: "dashboard-work-entry",
      stepId: "review",
    });
  });

  it("switches to review-heavy when approval pressure is high and routes review cards into approvals", () => {
    const model = buildDashboardHomeWorkEntry({
      english: true,
      firstLoopModel: buildFirstLoopModel({
        stage: "review",
        primaryAction: buildPrimaryAction("review", "/approvals?approvalId=1", "Review approvals"),
      }),
      goalDrivenHome: buildGoalDrivenHome(),
      pendingApprovals: [
        {
          id: "approval-1",
          status: "PENDING",
          reasoning: "External follow-up still needs trust-boundary review.",
          actionItem: {
            title: "Approve customer follow-up draft",
            opportunity: { id: "opp-1", title: "ACME expansion" },
            contact: null,
            meeting: null,
          },
        },
        {
          id: "approval-2",
          status: "PENDING",
          reasoning: "Pricing step still needs review.",
          actionItem: {
            title: "Approve pricing response",
            opportunity: { id: "opp-2", title: "Beta renewal" },
            contact: null,
            meeting: null,
          },
        },
        {
          id: "approval-3",
          status: "PENDING",
          reasoning: "Escalation language still needs a human decision.",
          actionItem: {
            title: "Approve escalation note",
            opportunity: null,
            contact: { id: "contact-1", name: "Jamie" },
            meeting: null,
          },
        },
      ],
      setupFirstLoopHandoff: null,
    });

    expect(model.state).toBe("review-heavy");
    expect(model.reviewItems).toHaveLength(3);
    expect(model.reviewItemsArePrimary).toBe(true);
    expect(model.topWorkItems.map((item) => item.id)).toEqual(
      model.reviewItems.map((item) => item.id),
    );
    expect(model.reviewItems[0]).toMatchObject({
      title: "Approve customer follow-up draft",
      subject: "ACME expansion",
      href: "/approvals?approvalId=approval-1#approval-preview",
    });
  });

  it("keeps returning/active state resume-first when the saved anchor is the current primary action", () => {
    const model = buildDashboardHomeWorkEntry({
      english: true,
      firstLoopModel: buildFirstLoopModel({
        stage: "anchor",
        completedCount: 6,
        primaryAction: buildPrimaryAction("anchor", "/dashboard?resume=1", "Resume saved anchor"),
        returnReadback: buildReturnReadback("explicit", "/dashboard?resume=1"),
      }),
      goalDrivenHome: buildGoalDrivenHome(),
      pendingApprovals: [],
      setupFirstLoopHandoff: null,
    });

    expect(model.state).toBe("returning-active");
    expect(model.reviewItemsArePrimary).toBe(false);
    expect(model.resumeItem).toMatchObject({
      title: "Resume saved anchor",
      href: "/dashboard?resume=1",
    });
    expect(model.resumeItem.tracking).toMatchObject({
      sourceArea: "dashboard-work-entry",
      eventKind: "anchor-resumed",
      stepId: "anchor",
    });
    expect(model.blockerItems).toHaveLength(2);
  });

  it("surfaces mapped external case-assignment actions in the home work entry without adding a new route", () => {
    const model = buildDashboardHomeWorkEntry({
      english: true,
      firstLoopModel: buildFirstLoopModel(),
      goalDrivenHome: buildGoalDrivenHome(),
      pendingApprovals: [],
      assignmentItems: [
        {
          id: "assignment-1",
          title: "今日待推进事项：测试分案",
          description: "本批分到 2 个案件，建议先处理逾期本金较高的案件。",
        },
      ],
      setupFirstLoopHandoff: null,
    });

    expect(model.assignmentItems).toHaveLength(1);
    expect(model.assignmentItems[0]).toMatchObject({
      title: "今日待推进事项：测试分案",
      statusLabel: "Pending action",
      href: "/dashboard#employee-assignment-actions",
    });
    expect(model.topWorkItems.some((item) => item.id === model.assignmentItems[0]?.id)).toBe(true);
  });

  it("keeps Chinese dashboard work-entry copy free of operator-facing English residue", () => {
    const model = buildDashboardHomeWorkEntry({
      english: false,
      firstLoopModel: buildFirstLoopModel({
        stage: "review",
        primaryAction: {
          stepId: "review",
          label: "打开复核",
          summary: "先处理第一条边界事项。",
          href: "/approvals?approvalId=1",
          ctaLabel: "进入复核",
        },
        firstSignal: buildLoopItem("signal", "第一条真实信号", "done", "/meetings/1", "第一条信号摘要"),
        returnReadback: {
          mode: "explicit",
          label: "回到当前锚点",
          summary: "继续处理保存的工作。",
          href: "/dashboard?resume=1",
          ctaLabel: "继续推进",
        },
      }),
      goalDrivenHome: buildGoalDrivenHome({
        immediateActions: [buildGoalLink("推进客户扩展", "/opportunities/1", "打开机会详情。")],
        topJudgements: [],
        topBlockers: [
          buildGoalLink("预算审批阻塞", "/opportunities?preset=high-risk", "先处理预算审批。"),
        ],
      }),
      pendingApprovals: [
        {
          id: "approval-1",
          status: "PENDING",
          reasoning: "外发前仍需要信任边界复核。",
          actionItem: {
            title: "复核客户跟进草稿",
            opportunity: { id: "opp-1", title: "ACME 扩展" },
            contact: null,
            meeting: null,
          },
        },
        {
          id: "approval-2",
          status: "PENDING",
          reasoning: "报价口径仍需要确认。",
          actionItem: {
            title: "复核报价回复",
            opportunity: { id: "opp-2", title: "Beta 续费" },
            contact: null,
            meeting: null,
          },
        },
        {
          id: "approval-3",
          status: "PENDING",
          reasoning: "升级措辞仍需要人工判断。",
          actionItem: {
            title: "复核升级说明",
            opportunity: null,
            contact: { id: "contact-1", name: "Jamie" },
            meeting: null,
          },
        },
      ],
      setupFirstLoopHandoff: null,
    });

    const visibleText = [
      model.title,
      model.summary,
      ...model.topWorkItems.flatMap((item) => [
        item.title,
        item.subject,
        item.statusLabel,
        item.nextStep,
        item.boundary ?? "",
        item.ctaLabel,
      ]),
      ...model.reviewItems.flatMap((item) => [
        item.title,
        item.subject,
        item.statusLabel,
        item.nextStep,
        item.boundary ?? "",
        item.ctaLabel,
      ]),
      model.resumeItem.title,
      model.resumeItem.subject,
      model.resumeItem.statusLabel,
      model.resumeItem.nextStep,
      model.resumeItem.boundary ?? "",
      model.resumeItem.ctaLabel,
      ...model.blockerItems.flatMap((item) => [
        item.title,
        item.subject,
        item.statusLabel,
        item.nextStep,
        item.ctaLabel,
      ]),
    ].join("\n");

    expect(visibleText).toContain("复核");
    expect(visibleText).not.toMatch(
      /\b(review|resume|feed|workspace|live signal|first loop|top work items|blocker)\b/i,
    );
  });
});
