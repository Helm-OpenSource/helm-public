import type { DashboardPageData } from "@/features/dashboard/page-loader";
import { buildDailyOperatingBrief } from "@/features/dashboard/daily-brief";
import { buildRiskSignals } from "@/features/dashboard/risk-signals";
import { buildDashboardPayloadEvidenceGroups } from "@/features/dashboard/evidence-groups";
import {
  buildDashboardHeaderBriefing,
  buildDashboardReportingProtocol,
} from "@/features/dashboard/header-briefing";
import { buildFounderProactiveFlow } from "@/features/dashboard/founder-proactive-flow";
import {
  buildDashboardHomeWorkEntry,
  getDashboardHomeSecondaryVisibility,
} from "@/features/dashboard/home-work-entry";
import { buildDashboardHomeSurfaceRouting } from "@/features/dashboard/home-surface-routing";
import { buildDashboardSetupFirstLoopHandoff } from "@/features/dashboard/setup-first-loop-handoff";
import {
  buildGoalDrivenHomeModel,
  buildWorkspaceOperatingFoundationSummary,
} from "@/lib/operating-system";
import { createWorkerSkillResourcePageSupport } from "@/lib/worker-skill-resource/presentation";

export type DashboardViewModel = ReturnType<typeof buildDashboardViewModelInternal>;

function buildDashboardViewModelInternal(input: {
  pageData: DashboardPageData;
  entry: string | undefined;
}) {
  const {
    data,
    english,
    operatingHome,
    businessLoopGapReadout,
    firstLoopModel,
    todayFocus,
    user,
    workspace,
    membership,
    accessState,
    locale,
  } = input.pageData;

  const setupFirstLoopHandoff = buildDashboardSetupFirstLoopHandoff({
    entry: input.entry,
    english,
    firstLoopModel,
  });

  const dailyBrief = buildDailyOperatingBrief(
    todayFocus,
    data.completionSummary.pendingApprovals,
    english,
  );

  const riskSignals = buildRiskSignals(todayFocus, data, english);

  const operatingFoundationSummary = buildWorkspaceOperatingFoundationSummary({
    locale,
    workspaceName: workspace.name,
    membershipRole: membership.role,
    accessState,
    profileType: workspace.profileType,
    focusAreasJson: workspace.focusAreas,
    topJudgements: todayFocus.topPriorities
      .slice(0, 3)
      .map((item) => `${item.objectLabel}：${item.explanation}`),
    topPriorityHref: "/operating",
    currentPage: "dashboard",
  });

  const goalDrivenHome = buildGoalDrivenHomeModel({
    english,
    foundationSummary: operatingFoundationSummary,
    dailyBriefTitle: dailyBrief.title,
    dailyBriefSummary: dailyBrief.summary,
    topJudgements: todayFocus.topPriorities.slice(0, 3).map((item) => ({
      label: item.objectLabel,
      hint: item.explanation,
      href:
        item.objectType === "OPPORTUNITY" && item.objectId
          ? `/opportunities?opportunityId=${item.objectId}`
          : item.objectType === "CONTACT" && item.objectId
            ? `/contacts/${item.objectId}`
            : item.objectType === "MEETING" && item.objectId
              ? `/meetings/${item.objectId}`
              : "/dashboard#today-priorities",
    })),
    topChains: operatingHome.topChains.slice(0, 3).map((item) => ({
      label: item.label,
      hint: item.hint,
      href: item.href ?? "/operating",
    })),
    topDecisionRequests: operatingHome.topDecisions.slice(0, 3).map((item) => ({
      label: item.label,
      hint: item.hint,
      href: item.href ?? "/approvals",
    })),
    roleHandoffs: operatingHome.roleSurfaces.slice(0, 6).map((surface) => ({
      label: surface.title,
      hint: surface.summary,
      href: surface.href,
    })),
    highRiskOpportunity: data.highRiskOpportunities[0]
      ? {
          label: english
            ? `Highest-risk chain: ${data.highRiskOpportunities[0].title}`
            : `当前最高风险链：${data.highRiskOpportunities[0].title}`,
          hint:
            data.highRiskOpportunities[0].blockers[0]?.blockerText ??
            (english
              ? "A blocker is already pulling this chain upward in today’s judgement."
              : "当前卡点已经把这条链拉回今天的主判断。"),
          href: `/opportunities?opportunityId=${data.highRiskOpportunities[0].id}`,
        }
      : null,
    pendingApprovals: data.completionSummary.pendingApprovals,
    waitingOnUsThreadCount: data.dataIngressSummary.waitingOnUsThreadCount,
    followUpDueCount: data.completionSummary.followUpDueCount,
    meetingsToday: data.completionSummary.meetingsToday,
    importedSignalCount: data.dataIngressSummary.importedSignalCount,
    executedToday: data.completionSummary.executedToday,
  });

  const dashboardHomeWorkEntry = buildDashboardHomeWorkEntry({
    english,
    firstLoopModel,
    goalDrivenHome,
    pendingApprovals: data.pendingApprovals,
    assignmentItems: data.externalAssignmentActionItems,
    setupFirstLoopHandoff,
  });

  const dashboardHomeSecondaryVisibility = getDashboardHomeSecondaryVisibility(
    dashboardHomeWorkEntry.state,
  );

  const dashboardHomeSurfaceRouting = buildDashboardHomeSurfaceRouting({
    english,
    workEntry: dashboardHomeWorkEntry,
    firstLoopModel,
    goalDrivenHome,
    setupFirstLoopHandoff,
  });

  const dashboardContractSupport = createWorkerSkillResourcePageSupport({
    pageId: "dashboard",
    english,
    supplementalEvidenceGroups: buildDashboardPayloadEvidenceGroups({
      data,
      english,
    }),
    supplementalEvidenceSummary: [
      english
        ? `${todayFocus.topPriorities.length} ranked recommendations, ${data.completionSummary.pendingApprovals} pending approvals and ${riskSignals.length} live risk signals are already feeding today’s judgement.`
        : `当前判断已经吃进了 ${todayFocus.topPriorities.length} 条排序 recommendation、${data.completionSummary.pendingApprovals} 条待复核和 ${riskSignals.length} 条实时风险信号。`,
      english
        ? "Memory, blockers, commitments, inbox signals and today’s meetings are already linked into the same front page."
        : "记忆、阻塞、承诺、收件箱信号和今日会议已经被联到同一个首页里。",
    ],
    supplementalLinks: [
      {
        label: english ? "Open memory timeline" : "打开记忆时间线",
        href: "/memory",
      },
      {
        label: english ? "Open approvals" : "打开复核与边界",
        href: "/approvals",
      },
      {
        label: english ? "Open weekly report" : "打开周报",
        href: "/reports",
      },
    ],
  });

  const headerBriefing = buildDashboardHeaderBriefing({
    data,
    dailyBrief,
    riskSignals,
    english,
  });

  const dashboardProtocol = buildDashboardReportingProtocol({
    data,
    dailyBrief,
    todayFocus,
    headerBriefing,
    dashboardContractSupport,
    english,
  });

  const founderProactiveFlow = buildFounderProactiveFlow({
    data,
    dailyBrief,
    todayFocus,
    riskSignals,
    user,
    english,
  });

  return {
    operatingFoundationSummary,
    goalDrivenHome,
    dashboardHomeWorkEntry,
    dashboardHomeSecondaryVisibility,
    dashboardHomeSurfaceRouting,
    dashboardProtocol,
    founderProactiveFlow,
    businessLoopGapReadout,
    firstLoopModel,
  };
}

export function buildDashboardViewModel(input: {
  pageData: DashboardPageData;
  entry: string | undefined;
}) {
  return buildDashboardViewModelInternal(input);
}
