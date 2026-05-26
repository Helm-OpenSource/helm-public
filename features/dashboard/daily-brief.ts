import type { DashboardPageData } from "@/features/dashboard/page-loader";

export type DailyOperatingBrief = {
  title: string;
  summary: string;
  riskLine: string;
  personalizationHint: string;
};

export function buildDailyOperatingBrief(
  todayFocus: DashboardPageData["todayFocus"],
  pendingApprovals: number,
  english: boolean,
): DailyOperatingBrief {
  const topItem = todayFocus.topPriorities[0];
  const secondItem = todayFocus.topPriorities[1];
  const overdueCommitment = todayFocus.overdueCommitments[0];
  const stalledOpportunity = todayFocus.stalledOpportunities[0];

  return {
    title: topItem
      ? english
        ? `The system says "${topItem.objectLabel}" deserves the first push today.`
        : `系统判断今天先推进“${topItem.objectLabel}”最值。`
      : english
        ? "The system did not identify a new top-priority item for today."
        : "系统今天没有识别到新的高优先事项。",
    summary: topItem
      ? english
        ? `Main reason: ${topItem.explanation}${secondItem ? ` Then keep "${secondItem.objectLabel}" in view so momentum does not keep slowing down.` : ""}`
        : `主因是 ${topItem.explanation}${secondItem ? ` 其次建议盯住“${secondItem.objectLabel}”以免节奏继续掉速。` : ""}`
      : english
        ? "You can shift time back to approvals, inbox cleanup or filling missing object memory."
        : "可以把时间转回处理审批、清理收件箱或补齐对象记忆。",
    riskLine: overdueCommitment
      ? english
        ? `The clearest current risk is the overdue commitment "${overdueCommitment.title}". If it stays untouched, it will keep being pushed upward in today’s recommendation order.`
        : `当前最明显的风险来自逾期承诺“${overdueCommitment.title}”。如果继续不处理，今天的推荐顺序会持续被它拉高。`
      : stalledOpportunity
        ? english
          ? `The clearest current risk is the long-stalled opportunity "${stalledOpportunity.title}", which has started to distort overall momentum judgement.`
          : `当前最明显的风险来自长时间未推进机会“${stalledOpportunity.title}”，它已经开始影响整体推进判断。`
        : english
          ? "There is no new red risk yet, but the system is still watching cooling relationships, overdue commitments and high-severity blockers."
          : "当前没有新的红色风险，但系统仍会继续盯住掉温关系、逾期承诺和高严重度阻塞。",
    personalizationHint:
      pendingApprovals > 0
        ? english
          ? "You usually inspect the control boundary before approving critical actions, so the dashboard moves pending approvals and the main recommendation to the top."
          : "你通常会先看清边界再批准关键动作，因此首页把待复核事项和主推荐放到了最前。"
        : english
          ? "The system keeps adjusting later ranking and phrasing based on how you approve, reject or edit recommendations."
          : "后续排序和动作表达会根据你对判断建议的批准、拒绝和编辑结果持续调整。",
  };
}
