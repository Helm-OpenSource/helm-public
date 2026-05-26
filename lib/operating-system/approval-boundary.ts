import { ActionExecutionMode, type ActionType } from "@prisma/client";
import {
  getOperatingSkillCatalog,
  getOperatingSkillForActionType,
} from "@/lib/operating-system/skill-catalog";
import type { ApprovalBoundaryModel, OperatingSkillId } from "@/lib/operating-system/types";

type ApprovalTaskLike = {
  id: string;
  channel: string | null;
  isHighRisk: boolean;
  autoExecute: boolean;
  status: "PENDING" | "EXECUTED" | "REJECTED" | "WITHDRAWN";
  reasoning: string | null;
  actionItem: {
    actionType: ActionType;
    title: string;
    recommendationLog: {
      policyResult: string;
      score: number;
      supportingFactIds: string | null;
      blockerIds: string | null;
      commitmentIds: string | null;
    } | null;
  };
};

export function buildApprovalBoundaryModel(
  tasks: ApprovalTaskLike[],
  english = false,
): ApprovalBoundaryModel {
  const pending = tasks.filter((task) => task.status === "PENDING");
  const highRiskCount = pending.filter((task) => task.isHighRisk).length;
  const externalCount = pending.filter((task) =>
    /外发|external|email/i.test(task.channel ?? ""),
  ).length;
  const autoEligibleCount = pending.filter(
    (task) =>
      task.actionItem.recommendationLog?.policyResult ===
      ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
  ).length;
  const approvalRequiredCount = pending.filter(
    (task) =>
      task.actionItem.recommendationLog?.policyResult ===
      ActionExecutionMode.REQUIRES_APPROVAL,
  ).length;
  const topSkillIds = Array.from(
    new Set(
      pending
        .map((task) => getOperatingSkillForActionType(task.actionItem.actionType)?.id)
        .filter(Boolean) as OperatingSkillId[],
    ),
  ).slice(0, 3);

  const queueState: ApprovalBoundaryModel["queueState"] =
    (highRiskCount > 0 && externalCount > 0) ||
    highRiskCount >= 3 ||
    externalCount >= 3
      ? "boundary-heavy"
      : pending.length >= 4
        ? "review-heavy"
        : "clear";

  const summaryLine =
    queueState === "boundary-heavy"
      ? english
        ? "The queue is dominated by trust-sensitive or high-risk moves, so approvals are acting as the real operating boundary rather than a passive inbox."
        : "当前队列里以信任敏感或高风险动作居多，审批现在扮演的是经营边界，而不是被动收件箱。"
      : queueState === "review-heavy"
        ? english
          ? "The queue is review-heavy, which means Helm is producing actions faster than the current human review loop can close them."
          : "当前队列更像复核积压，说明 Helm 的动作产出速度已经开始快于人工收口速度。"
        : english
          ? "The queue is under control, so approvals are mostly handling the sharp edges rather than every action."
          : "当前审批队列处于可控范围，说明审批更多是在守住尖锐边界，而不是拦下所有动作。";

  return {
    summaryLine,
    queueState,
    autoEligibleCount,
    approvalRequiredCount,
    highRiskCount,
    externalCount,
    topSkillIds,
    boundaryNotes: [
      english
        ? `${approvalRequiredCount} pending items are explicitly waiting for a human decision instead of silent auto-execution.`
        : `当前有 ${approvalRequiredCount} 条动作明确在等待人工判断，而不是静默自动执行。`,
      english
        ? `${externalCount} pending items still touch external trust, so the review surface remains product-critical.`
        : `当前有 ${externalCount} 条动作触碰对外信任，因此复核面 仍是产品主入口之一。`,
      english
        ? `${autoEligibleCount} items would be auto-eligible under policy, but are still visible here so the team can tighten or loosen boundaries intentionally.`
        : `当前有 ${autoEligibleCount} 条动作理论上已经处于可自动执行阈值，但仍在这里显式可见，方便团队主动收紧或放松边界。`,
    ],
  };
}

export function buildApprovalTaskReasonChain(
  task: ApprovalTaskLike,
  english = false,
) {
  const skill = getOperatingSkillForActionType(task.actionItem.actionType);
  const supportCount = parseCount(task.actionItem.recommendationLog?.supportingFactIds);
  const blockerCount = parseCount(task.actionItem.recommendationLog?.blockerIds);
  const commitmentCount = parseCount(task.actionItem.recommendationLog?.commitmentIds);
  const evidenceSummary =
    supportCount + blockerCount + commitmentCount > 0
      ? english
        ? `${supportCount} facts, ${blockerCount} blockers and ${commitmentCount} commitments are already attached to this review decision.`
        : `当前已连接 ${supportCount} 条事实、${blockerCount} 条阻塞和 ${commitmentCount} 条承诺，供这次复核判断使用。`
      : english
        ? "No structured facts, blockers or commitments are attached yet; use the source context, risk level and human judgement for this review."
        : "当前还没有结构化事实、阻塞或承诺引用；这次复核先以来源上下文、风险等级和人工判断为准。";

  return [
    {
      id: `${task.id}-skill`,
      label: english ? "Source skill" : "动作来源",
      summary: skill
        ? english
          ? `${skill.name} produced this move as a standardized operating action.`
          : `这条动作来自“${skill.name}”能力，已经整理成可复核的操作草稿。`
        : english
          ? "This move still lacks an explicit skill binding."
          : "这条动作还没有明确绑定到一个标准能力。",
    },
    {
      id: `${task.id}-evidence`,
      label: english ? "Evidence coverage" : "证据覆盖",
      summary: evidenceSummary,
    },
    {
      id: `${task.id}-boundary`,
      label: english ? "Boundary" : "边界",
      summary:
        task.actionItem.recommendationLog?.policyResult ===
        ActionExecutionMode.REQUIRES_APPROVAL
          ? english
            ? "Policy already pushed this move behind approval instead of allowing direct execution."
            : "策略已经把这条动作推到了审批后面，而不是允许直接执行。"
          : task.isHighRisk
            ? english
              ? "Risk level keeps this move visible in review even if parts of execution could be automated."
              : "风险等级让这条动作即使部分可自动执行，也必须显式停在复核层。"
            : english
              ? "The boundary is mostly about control clarity instead of raw risk."
              : "这条动作停在这里，更多是为了控制清晰度，而不只是风险本身。",
    },
    {
      id: `${task.id}-decision`,
      label: english ? "Decision request" : "决策请求",
      summary:
        task.reasoning ??
        (english
          ? "The operator still needs to decide whether this move should ship, be edited, or be converted into a manual action."
          : "当前仍需要主人决定这条动作是直接放行、先编辑，还是转成人工动作。"),
    },
  ];
}

export function getApprovalBoundarySkillSummary(
  skillIds: OperatingSkillId[],
  english = false,
) {
  const catalog = getOperatingSkillCatalog();
  return skillIds
    .map((skillId) => catalog.find((item) => item.id === skillId))
    .filter(Boolean)
    .map((skill) =>
      english
        ? `${skill!.name}: ${skill!.summary}`
        : `${skill!.name}：${skill!.summary}`,
    );
}

function parseCount(value: string | null | undefined) {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}
