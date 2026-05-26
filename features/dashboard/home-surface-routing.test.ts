import { describe, expect, it } from "vitest";
import type { GoalDrivenHomeModel } from "@/lib/operating-system/goal-driven-home";
import type {
  WorkspaceFirstLoopItem,
  WorkspaceFirstLoopModel,
  WorkspaceFirstLoopPrimaryAction,
  WorkspaceFirstLoopReturnReadback,
} from "@/lib/operating-system/first-loop";
import type { DashboardHomeWorkEntryModel } from "@/features/dashboard/home-work-entry";
import { buildDashboardHomeSurfaceRouting } from "@/features/dashboard/home-surface-routing";
import type { DashboardSetupFirstLoopHandoffModel } from "@/features/dashboard/setup-first-loop-handoff";

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
    topJudgements: [{ label: "ACME expansion", href: "/opportunities/opp-1", hint: "Read the opportunity detail." }],
    immediateActions: [{ label: "Move 1", href: "/opportunities/opp-1", hint: "Route into the opportunity detail." }],
    topChains: [],
    topBlockers: [],
    topDecisionRequests: [{ label: "Decision 1", href: "/approvals", hint: "Review a held draft." }],
    helmDid: [{ label: "Prepared context", href: "/memory", hint: "Replay the stable state." }],
    roleHandoffs: [],
    actionTemplates: [],
    retroFeedback: [],
    evidenceEntries: [{ label: "Meeting replay", href: "/memory", hint: "Use memory replay." }],
    note: "Goal-driven note",
    ...input,
  };
}

function buildWorkEntry(input?: Partial<DashboardHomeWorkEntryModel>): DashboardHomeWorkEntryModel {
  return {
    state: "returning-active",
    title: "Home work entry",
    summary: "Current ranked work.",
    topWorkItems: [
      {
        id: "top-1",
        title: "Open ACME expansion",
        subject: "ACME expansion",
        statusLabel: "Top work item",
        nextStep: "Open the current opportunity detail.",
        boundary: "Recommendation only — does not commit anything externally.",
        href: "/opportunities/opp-1",
        ctaLabel: "Open detail",
      },
    ],
    reviewItems: [
      {
        id: "review-1",
        title: "Approve renewal follow-up",
        subject: "Beta renewal",
        statusLabel: "Needs your review",
        nextStep: "Read the held draft before changing execution posture.",
        boundary: "This draft is held behind the approval boundary.",
        href: "/approvals?approvalId=approval-1#approval-preview",
        ctaLabel: "Open approvals",
      },
    ],
    reviewItemsArePrimary: false,
    assignmentItems: [],
    resumeItem: {
      id: "resume-1",
      title: "Resume saved anchor",
      subject: "ACME expansion",
      statusLabel: "Resume / continue",
      nextStep: "Resume the saved work.",
      boundary: "Recommendation only — does not commit anything externally.",
      href: "/dashboard?resume=1",
      ctaLabel: "Resume",
    },
    blockerItems: [],
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
      summary: "Open the first real meeting now.",
      href: "/meetings/seed",
      ctaLabel: "Open first signal",
    },
    returnReadback: buildReturnReadback("derived", "/dashboard"),
    showSeparateSignalAction: true,
  };
}

describe("buildDashboardHomeSurfaceRouting", () => {
  it("splits home, approvals and memory into explicit next surfaces", () => {
    const model = buildDashboardHomeSurfaceRouting({
      english: true,
      workEntry: buildWorkEntry(),
      firstLoopModel: buildFirstLoopModel(),
      goalDrivenHome: buildGoalDrivenHome(),
      setupFirstLoopHandoff: null,
    });

    expect(model.cards.map((card) => card.surface)).toEqual([
      "detail",
      "approvals",
      "memory",
    ]);
    expect(model.cards[0]).toMatchObject({
      href: "/opportunities/opp-1?entry=home-surface-detail&focus=Open+ACME+expansion",
      ctaLabel: "Open detail",
    });
    expect(model.cards[1]).toMatchObject({
      href:
        "/approvals?approvalId=approval-1&entry=home-surface-approvals&focus=Approve+renewal+follow-up#approval-preview",
      ctaLabel: "Open approvals",
    });
    expect(model.cards[2]).toMatchObject({
      href:
        "/memory?entry=home-surface-memory&focus=Meeting+replay#memory-work-timeline",
      ctaLabel: "Open memory",
    });
  });

  it("prefers the first setup/live signal as the detail destination before generic dashboard resume links", () => {
    const model = buildDashboardHomeSurfaceRouting({
      english: true,
      workEntry: buildWorkEntry({
        topWorkItems: [
          {
            id: "top-1",
            title: "Resume anchor",
            subject: "Saved anchor",
            statusLabel: "Top work item",
            nextStep: "Resume the current anchor from dashboard.",
            boundary: "Recommendation only — does not commit anything externally.",
            href: "/dashboard?resume=1",
            ctaLabel: "Resume",
          },
        ],
      }),
      firstLoopModel: buildFirstLoopModel({
        firstSignal: buildLoopItem("signal", "First meeting", "done", "/meetings/meeting-1"),
      }),
      goalDrivenHome: buildGoalDrivenHome({
        topJudgements: [],
        immediateActions: [],
      }),
      setupFirstLoopHandoff: buildSetupHandoff(),
    });

    expect(model.cards[0]).toMatchObject({
      href: "/meetings/seed?entry=home-surface-detail&focus=First+live+signal",
      focus: "First live signal",
    });
  });

  it("prefers opportunity workspaces over thinner detail pages when multiple detail-like routes are available", () => {
    const model = buildDashboardHomeSurfaceRouting({
      english: true,
      workEntry: buildWorkEntry({
        topWorkItems: [
          {
            id: "top-1",
            title: "Open key contact",
            subject: "Key contact",
            statusLabel: "Top work item",
            nextStep: "Read the contact detail first.",
            boundary: "Recommendation only — does not commit anything externally.",
            href: "/contacts/contact-1?entry=ignore-me",
            ctaLabel: "Open contact",
          },
          {
            id: "top-2",
            title: "Open ACME expansion",
            subject: "ACME expansion",
            statusLabel: "Top work item",
            nextStep: "Read the active opportunity workspace.",
            boundary: "Recommendation only — does not commit anything externally.",
            href: "/opportunities?opportunityId=opp-1",
            ctaLabel: "Open opportunity",
          },
        ],
      }),
      firstLoopModel: buildFirstLoopModel({
        firstSignal: buildLoopItem("signal", "First meeting", "done", "/meetings/meeting-1"),
      }),
      goalDrivenHome: buildGoalDrivenHome({
        topJudgements: [
          { label: "Warm contact", href: "/contacts/contact-1", hint: "Relationship detail." },
          { label: "ACME expansion", href: "/opportunities?opportunityId=opp-1", hint: "Opportunity workspace." },
        ],
      }),
      setupFirstLoopHandoff: null,
    });

    expect(model.cards[0]).toMatchObject({
      href: "/opportunities?opportunityId=opp-1&entry=home-surface-detail&focus=Open+ACME+expansion",
      focus: "Open ACME expansion",
    });
  });

  it("keeps Chinese surface routing labels in business language rather than internal route names", () => {
    const model = buildDashboardHomeSurfaceRouting({
      english: false,
      workEntry: buildWorkEntry({
        topWorkItems: [
          {
            id: "top-1",
            title: "打开 ACME 扩展",
            subject: "ACME 扩展",
            statusLabel: "当前最重要事项",
            nextStep: "打开机会详情。",
            boundary: "Recommendation only — does not commit anything externally.",
            href: "/opportunities/opp-1",
            ctaLabel: "打开详情",
          },
        ],
        reviewItems: [
          {
            id: "review-1",
            title: "复核续费跟进",
            subject: "Beta 续费",
            statusLabel: "待你复核",
            nextStep: "先看被拦截的草稿。",
            boundary: "这条草稿停在审批边界后面。",
            href: "/approvals?approvalId=approval-1#approval-preview",
            ctaLabel: "打开复核",
          },
        ],
      }),
      firstLoopModel: buildFirstLoopModel({
        reviewCheckpoint: buildLoopItem("review", "复核队列", "watch", "/approvals"),
        memoryWriteBack: buildLoopItem("write-back", "写回记忆", "watch", "/memory"),
      }),
      goalDrivenHome: buildGoalDrivenHome({
        evidenceEntries: [{ label: "会议回放", href: "/memory", hint: "回看稳定上下文。" }],
        helmDid: [{ label: "已整理上下文", href: "/memory", hint: "回放稳定状态。" }],
      }),
      setupFirstLoopHandoff: null,
    });

    const visibleText = [
      model.title,
      model.summary,
      ...model.cards.flatMap((card) => [
        card.title,
        card.focus,
        card.summary,
        card.boundary ?? "",
        card.ctaLabel,
      ]),
    ].join("\n");

    expect(visibleText).toContain("复核与边界");
    expect(visibleText).toContain("经营记忆");
    expect(visibleText).not.toMatch(/\b(Home|Detail|Approvals|Memory|review|decision trace)\b/);
  });
});
