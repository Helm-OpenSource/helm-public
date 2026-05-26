import type { DashboardPageData } from "@/features/dashboard/page-loader";
import type { DailyOperatingBrief } from "@/features/dashboard/daily-brief";
import type { DashboardRiskSignal } from "@/features/dashboard/risk-signals";
import type { createWorkerSkillResourcePageSupport } from "@/lib/worker-skill-resource/presentation";
import { createPageReportingProtocol } from "@/lib/presentation/reporting-protocol";

type WorkerSkillResourcePageSupport = ReturnType<
  typeof createWorkerSkillResourcePageSupport
>;

export type DashboardHeaderBriefing = {
  label: string;
  headline: string;
  summary: string;
  takeawaysLabel: string;
  takeaways: string[];
  operatorLabel: string;
  operatorPrompt: string;
  decisionsLabel: string;
  decisions: string[];
};

export function buildDashboardHeaderBriefing({
  data,
  dailyBrief,
  riskSignals,
  english,
}: {
  data: DashboardPageData["data"];
  dailyBrief: DailyOperatingBrief;
  riskSignals: DashboardRiskSignal[];
  english: boolean;
}): DashboardHeaderBriefing {
  return {
    label: english ? "AI operating brief" : "AI 经营推进汇报",
    headline: dailyBrief.title,
    summary: dailyBrief.summary,
    takeawaysLabel: english ? "What I see" : "我现在看到的情况",
    takeaways: [
      english
        ? `${data.completionSummary.pendingApprovals} actions are still waiting for approval review, so trust-boundary work is not fully closed yet.`
        : `当前仍有 ${data.completionSummary.pendingApprovals} 条动作仍待复核，说明信任边界相关事项还没完全收口。`,
      english
        ? `${data.completionSummary.followUpDueCount} opportunities and ${data.completionSummary.highRiskCount} high-risk items are shaping today's momentum.`
        : `今天的推进节奏主要由 ${data.completionSummary.followUpDueCount} 条待跟进机会和 ${data.completionSummary.highRiskCount} 条高风险事项决定。`,
      english
        ? `${data.completionSummary.meetingsToday} meetings are already on the calendar, so the best moves today should connect decisions to real follow-through.`
        : `今天已经排了 ${data.completionSummary.meetingsToday} 场会议，所以最好的动作应该把判断尽快接到真实执行上。`,
    ],
    operatorLabel: english ? "Handle now" : "现在处理",
    operatorPrompt: riskSignals.length
      ? english
        ? `First handle the approval queue, then clear the highest-risk item, then use today's meetings to keep momentum real.`
        : "先处理审批队列，再清掉最危险的一条事项，然后用今天的会议把推进节奏接住。"
      : english
        ? "Start with the system-ranked top move, then review today's meetings and the inbox so the momentum does not drift back into notes."
        : "先处理系统排在最前面的动作，再看今日会议和收件箱，避免节奏重新退回纪要层。",
    decisionsLabel: english ? "You decide" : "你现在要决定",
    decisions: [
      english
        ? "Which item should be treated as the one thing to move first today."
        : "今天到底先把哪一件事当成唯一主动作来推进。",
      english
        ? "Whether the top item needs approval, owner alignment or a meeting before it can move."
        : "排在最前面的事项到底是先过审批、先对齐负责人，还是先开会。",
      english
        ? "Which lower-priority items can wait without hurting momentum."
        : "哪些次级事项今天可以暂缓，而不会伤到整体节奏。",
    ],
  };
}

export function buildDashboardReportingProtocol({
  data,
  dailyBrief,
  todayFocus,
  headerBriefing,
  dashboardContractSupport,
  english,
}: {
  data: DashboardPageData["data"];
  dailyBrief: DailyOperatingBrief;
  todayFocus: DashboardPageData["todayFocus"];
  headerBriefing: DashboardHeaderBriefing;
  dashboardContractSupport: WorkerSkillResourcePageSupport;
  english: boolean;
}) {
  return createPageReportingProtocol({
    pageJudgement: dailyBrief.title,
    pageJudgementReason: dailyBrief.summary,
    pageWhyItMatters: headerBriefing.takeaways.slice(0, 3),
    pageActionSummary: [
      english
        ? `The top ${Math.min(todayFocus.topPriorities.length, 3)} moves are already ranked, so you do not need to scan the whole workspace before acting.`
        : `当前最值得推进的 ${Math.min(todayFocus.topPriorities.length, 3)} 条动作已经排好，你不需要先扫完整个工作台。`,
      english
        ? `${data.completionSummary.pendingApprovals} risky or trust-sensitive actions are already routed into approvals, so they will not slip past the boundary silently.`
        : `当前有 ${data.completionSummary.pendingApprovals} 条高风险或信任敏感动作已经被路由进复核与边界，不会悄悄越界执行。`,
      english
        ? `${data.completionSummary.meetingsToday} meetings and ${data.dataIngressSummary.waitingOnUsThreadCount} waiting threads are already folded into the same operating view.`
        : `今天的 ${data.completionSummary.meetingsToday} 场会议和 ${data.dataIngressSummary.waitingOnUsThreadCount} 条待我方线程，已经一起纳入同一个经营视角。`,
    ],
    pageDecisionRequest: [
      english
        ? "Choose the one move that should become today’s true first action."
        : "决定今天真正的第一主动作到底是哪一条。",
      english
        ? "Decide whether the first item should leave the judgement layer as a meeting, approval or direct follow-up."
        : "决定第一条事项要以会议、审批还是直接跟进的方式离开判断层。",
      english
        ? "Decide which secondary items can stay visible without taking attention away from the first move."
        : "决定哪些次级事项只需保持可见，不必继续分散今天的注意力。",
    ],
    pageNextAction: [
      {
        label: english ? "Open today’s move order" : "打开今日推进顺序",
        href: "#today-priorities",
      },
      {
        label: english ? "Review approval boundary" : "查看复核边界",
        href: "#must-approve",
        variant: "secondary",
      },
      {
        label: english ? "Read evidence and replay" : "读证据与回放",
        href: "#daily-brief",
        variant: "ghost",
      },
    ],
    pageBoundarySummary: [
      english
        ? "External and high-risk actions still stay behind approval, recommendation and audit boundaries."
        : "对外和高风险动作仍然停在审批、推荐和审计边界之后。",
      english
        ? "This is still a controlled-trial operating front end, not an autonomous execution console."
        : "当前仍是受控试点经营前台，不是自主执行控制台。",
    ],
    pageEvidenceSummary: dashboardContractSupport.pageEvidenceSummary,
    pageWorkerSummary: dashboardContractSupport.pageWorkerSummary,
    pageWorkerAssignments: dashboardContractSupport.pageWorkerAssignments,
    pageEscalationHint:
      data.completionSummary.pendingApprovals > 0
        ? english
          ? "Use the approval queue when the top move touches external trust, policy or high-risk execution."
          : "如果最前面的动作触碰对外信任、策略或高风险执行，就先走审批队列。"
        : english
          ? "If the ranked top move still feels ambiguous, drill into memory and meeting replay before inventing a new action."
          : "如果排在最前面的动作仍然模糊，就先下钻记忆和会议回放，不要急着重新发明动作。",
    pagePrioritySignal: dailyBrief.riskLine,
    pageEvidenceLinks: dashboardContractSupport.pageEvidenceLinks,
    pageEvidenceGroups: dashboardContractSupport.pageEvidenceGroups,
  });
}
