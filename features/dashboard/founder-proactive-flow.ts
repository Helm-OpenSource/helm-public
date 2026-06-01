import type { DashboardPageData } from "@/features/dashboard/page-loader";
import type { DailyOperatingBrief } from "@/features/dashboard/daily-brief";
import type { DashboardRiskSignal } from "@/features/dashboard/risk-signals";
import {
  createActiveReportProtocol,
  createProactiveCollaborationProtocol,
  createProactiveFlow,
} from "@/lib/presentation/proactive-mechanism";
import { buildTopPriorityHref } from "@/features/dashboard/href-helpers";

export function buildFounderProactiveFlow({
  data,
  dailyBrief,
  todayFocus,
  riskSignals,
  user,
  english,
}: {
  data: DashboardPageData["data"];
  dailyBrief: DailyOperatingBrief;
  todayFocus: DashboardPageData["todayFocus"];
  riskSignals: DashboardRiskSignal[];
  user: DashboardPageData["user"];
  english: boolean;
}) {
  const dashboardTopMove = todayFocus.topPriorities[0] ?? null;
  const dashboardRiskSignal = riskSignals[0] ?? null;

  return createProactiveFlow({
    flowId: "founder-risk-escalation",
    flowTitle: english ? "Founder decision request" : "创始人决策请求",
    triggerCondition: dashboardRiskSignal
      ? english
        ? `A live operating signal has crossed the front page: ${dashboardRiskSignal.title}. It can no longer stay buried in the object layer.`
        : `前台已经出现需要升级的经营变化：${dashboardRiskSignal.title}。这条变化已经不能继续埋在对象层里。`
      : english
        ? "Today’s top recommendation, pending approvals and meeting load have together formed a periodic operating brief that deserves a founder-level decision."
        : "今日排序第一的建议、待复核动作和会议负载已经共同形成了一份需要创始人拍板的周期性经营简报。",
    activeReport: createActiveReportProtocol({
      activeReportType: "periodic",
      activeReportSummary: dailyBrief.title,
      activeReportReason: dailyBrief.summary,
      activeReportPriority:
        dashboardRiskSignal || data.completionSummary.pendingApprovals > 0
          ? "urgent"
          : "operating",
      activeReportBoundary: [
        english
          ? "High-risk and external moves still stop at approval, policy and audit boundaries."
          : "高风险和对外动作仍然停在审批、策略和审计边界后面。",
        english
          ? "This is an operating suggestion layer, not a founderless autonomous command plane."
          : "这里仍是经营建议层，不是脱离创始人的自主指挥台。",
      ],
      activeReportDecisionRequest: english
        ? "Decide what should become today’s one true first move, and whether it should leave the judgement layer as approval, meeting or follow-up."
        : "决定今天哪一条事项应该成为唯一第一动作，以及它该以审批、会议还是跟进的方式离开判断层。",
      activeReportWorkerSummary: [
        english
          ? "Recommendation worker keeps today’s move order ranked."
          : "排序助手会持续维护今日推进顺序。",
        english
          ? "Approval worker keeps risky and trust-sensitive actions inside review."
          : "复核助手会持续把高风险和信任敏感动作留在复核里。",
        english
          ? "Conversation worker keeps meetings and inbox signals folded into the same judgement."
          : "会话助手会持续把会议和收件箱信号并入同一个判断面。",
      ],
      activeReportEvidenceSummary: [
        english
          ? `${todayFocus.topPriorities.length} ranked recommendations, ${data.completionSummary.pendingApprovals} pending approvals and ${riskSignals.length} live risk signals are already part of the same report.`
          : `当前同一份汇报里已经包含 ${todayFocus.topPriorities.length} 条排序建议、${data.completionSummary.pendingApprovals} 条待复核和 ${riskSignals.length} 条实时风险信号。`,
        english
          ? "Memory, blockers, commitments and today’s meetings remain drillable through replay and memory."
          : "记忆、阻塞、承诺和今日会议仍然可以继续下钻到回放和经营记忆。",
      ],
      activeReportAudience: ["founder", "operator"],
      activeReportDeliveryMode: "home-brief",
      activeReportPreparationSummary: [
        english
          ? `The first ${Math.min(todayFocus.topPriorities.length, 3)} moves are pre-ranked before you open the page.`
          : `在你打开页面前，前 ${Math.min(todayFocus.topPriorities.length, 3)} 条最值得推进的动作就已经排好。`,
        english
          ? `${data.completionSummary.pendingApprovals} trust-sensitive items are routed into approvals instead of silently slipping into execution.`
          : `当前 ${data.completionSummary.pendingApprovals} 条信任敏感事项会继续被路由进审批，而不是悄悄滑入执行。`,
        english
          ? `${data.completionSummary.meetingsToday} meetings and ${data.dataIngressSummary.waitingOnUsThreadCount} waiting threads are connected to the same operating view.`
          : `今日 ${data.completionSummary.meetingsToday} 场会议和 ${data.dataIngressSummary.waitingOnUsThreadCount} 条待我方线程已经接进同一个经营视图。`,
      ],
    }),
    collaboration: createProactiveCollaborationProtocol({
      collaborationMode: "helm_reminds_human_leads",
      collaborationRequest: english
        ? "Founder, lead the first move now. The field is already compressed into one working judgement, but it still needs your explicit operating priority."
        : "创始人现在需要主导第一拍。当前全场已经压成一个经营判断，但还需要你明确今天的第一优先级。",
      collaborationSummary: english
        ? "Risk, the first move and the trust boundary are already in one place, so you can lead the decision quickly without rebuilding the analysis."
        : "风险、第一动作和信任边界已经收在一起，所以你可以不必重做分析，就直接快速主导决策。",
      collaborationReason: english
        ? "The front page can already see a momentum shift, but only the founder can decide which line becomes the first operating commitment for today."
        : "首页已经能看到经营节奏变化，但只有创始人能决定今天到底把哪条线当成第一经营承诺。",
      collaborationBoundary: [
        english
          ? "This layer can prepare the decision, but recommendation cannot become founder commitment without explicit approval."
          : "这里可以先准备决策，但建议不能在没有明确批准的前提下变成创始人承诺。",
      ],
      collaborationOwner: english
        ? `${user.name} (founder owner)`
        : `${user.name}（创始人负责人）`,
      collaborationWorkerAssignment: [
        english
          ? "Recommendation worker: keep the move order fresh as signals change."
          : "排序助手：随着信号变化持续刷新推进顺序。",
        english
          ? "Approval worker: keep risky external moves behind review."
          : "复核助手：把高风险外发动作继续挡在复核后面。",
      ],
      collaborationEscalationHint: english
        ? "If the first move touches external trust or high-risk execution, route it into approvals before the team acts."
        : "如果第一动作触碰对外信任或高风险执行，就先把它送进审批，再让团队行动。",
      collaborationDecisionRequest: english
        ? "Confirm whether the top move is a meeting, approval or follow-up first."
        : "确认排在最前面的事项到底更适合开会、审批，还是继续跟进。",
      collaborationNextStep: [
        english ? "Set today’s first move." : "确认今天的第一动作。",
        english
          ? "Decide whether the next two items still deserve airtime today."
          : "决定后面两条事项今天是否还值得占用注意力。",
      ],
    }),
    helmCanDo: [
      english
        ? "Rank today’s move order and keep refreshing it as signals change."
        : "持续刷新今日推进顺序，并把变化主动推到前台。",
      english
        ? "Prepare approval routing, meeting context and evidence links before you read raw objects."
        : "在你读原始对象前，先准备好审批路由、会议上下文和证据链接。",
    ],
    helmSuggestsOnly: [
      english
        ? "Which line should become the founder’s explicit operating commitment for today."
        : "今天到底哪条线应该成为创始人的明确经营承诺。",
    ],
    humanDecisionRequired: [
      english
        ? "Choose the first move and the owner-visible priority order."
        : "选择第一动作以及对团队可见的优先级顺序。",
    ],
    humanLeadRequired: [
      english
        ? "Any high-risk external follow-up or commitment-shaping move."
        : "任何高风险的外部跟进或承诺口径调整。",
    ],
    nextActions: [
      {
        label: english ? "Open today’s move order" : "打开今日推进顺序",
        href: "#today-priorities",
      },
      {
        label: english ? "Open approvals" : "打开复核与边界",
        href: "/approvals",
        variant: "secondary" as const,
      },
      {
        label: english ? "Open evidence" : "打开证据",
        href: dashboardTopMove ? buildTopPriorityHref(dashboardTopMove) : "/memory",
        variant: "ghost" as const,
      },
    ],
    evidenceLinks: [
      {
        label: english ? "Replay memory" : "回看记忆",
        href: "/memory",
      },
      {
        label: english ? "Review approvals" : "查看审批队列",
        href: "/approvals",
      },
    ],
  });
}
