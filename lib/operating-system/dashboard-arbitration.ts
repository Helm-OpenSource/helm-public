import type { RecommendationOutput } from "@/lib/recommendations/types";
import { getOperatingSkillForActionType } from "@/lib/operating-system/skill-catalog";
import type {
  DashboardArbitrationModel,
  OperatingEventSignal,
} from "@/lib/operating-system/types";

type DashboardArbitrationInput = {
  topRecommendations: Array<
    RecommendationOutput & {
      objectLabel: string;
    }
  >;
  pendingApprovals: number;
  highRiskCount: number;
  waitingOnUsThreadCount: number;
  meetingsToday: number;
  eventSignals: OperatingEventSignal[];
};

export function buildDashboardArbitrationModel(
  input: DashboardArbitrationInput,
  english = false,
): DashboardArbitrationModel {
  const firstMove = input.topRecommendations[0] ?? null;
  const recommendedSkillIds = Array.from(
    new Set(
      input.topRecommendations
        .slice(0, 3)
        .map((item) => getOperatingSkillForActionType(item.actionType)?.id)
        .filter(Boolean),
    ),
  ) as DashboardArbitrationModel["recommendedSkillIds"];

  const boundarySummary =
    input.pendingApprovals > 0
      ? english
        ? `${input.pendingApprovals} actions are still behind approval, so today's first move should not quietly slip into external execution.`
        : `当前仍有 ${input.pendingApprovals} 条动作停在审批后面，所以今天的第一主动作不该悄悄滑进对外执行。`
      : english
        ? "The approval queue is clear enough that today's first move can leave the judgement layer quickly."
        : "审批队列已经足够干净，今天的第一主动作可以比较快地离开判断层。";

  const waitingSummary =
    input.waitingOnUsThreadCount > 0
      ? english
        ? `${input.waitingOnUsThreadCount} threads are waiting on us, so delay now would cost real relationship momentum.`
        : `当前有 ${input.waitingOnUsThreadCount} 条线程在等我方动作，现在继续拖会直接损失关系势能。`
      : input.meetingsToday > 0
        ? english
          ? `${input.meetingsToday} meetings today mean the workspace should turn decisions into follow-through instead of reopening judgement loops.`
          : `今天有 ${input.meetingsToday} 场会议，说明工作台更该把判断接成 follow-through，而不是重新回到判断循环。`
        : english
        ? "No strong waiting queue is visible, so the main job is to keep the top recommendation from drifting back into notes."
        : "当前没有特别强的等待队列，所以重点是别让排序第一的判断建议重新掉回纪要层。";

  return {
    firstMoveSummary: firstMove
      ? english
        ? `${firstMove.title} is the current first move because it is the highest-scoring recommendation already grounded in working memory and policy.`
        : `当前第一主动作是“${firstMove.title}”，因为它是已经被工作记忆和策略共同支撑的最高分判断建议。`
      : english
        ? "No dominant move is visible right now."
        : "当前还没有出现压倒性的第一主动作。",
    whyNow:
      input.eventSignals[0]?.summary ??
      (input.highRiskCount > 0
        ? english
          ? `${input.highRiskCount} live high-risk items mean the front page should arbitrate cross-line pressure instead of acting like a static dashboard.`
          : `当前有 ${input.highRiskCount} 条高风险事项在线，说明首页应该承担跨线仲裁，而不是静态展示。`
        : english
          ? "The current front page is mostly driven by long-running context rather than a fresh event spike."
          : "当前首页主要由持续上下文驱动，而不是某个新的单点事件。"),
    boundarySummary,
    waitingSummary,
    recommendedSkillIds,
    eventSignals: input.eventSignals,
  };
}
