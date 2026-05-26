import type { ActionExecutionMode, ActionType, ObjectType } from "@prisma/client";
import {
  createOperatingSkillInvocation,
  getOperatingSkillById,
  getOperatingSkillForActionType,
} from "@/lib/operating-system/skill-catalog";
import type {
  OperatingEventSignal,
  OperatingObjectState,
  RecommendationOperatingContext,
} from "@/lib/operating-system/types";

export function buildRecommendationOperatingContext(input: {
  actionType: ActionType;
  objectType: ObjectType;
  objectLabel: string;
  policyResult?: ActionExecutionMode | string | null;
  objectState: OperatingObjectState | null;
  eventSignals: OperatingEventSignal[];
  english?: boolean;
}): RecommendationOperatingContext {
  const english = input.english ?? false;
  const primarySkill = getOperatingSkillForActionType(input.actionType);
  const invocation = createOperatingSkillInvocation({
    actionType: input.actionType,
    objectLabel: input.objectLabel,
    policyResult: input.policyResult,
  });

  const stateLine = input.objectState
    ? english
      ? `${input.objectState.label} is currently in ${input.objectState.status} state: ${input.objectState.summary}`
      : `${input.objectState.label} 当前处于${statusLabel(
          input.objectState.status,
        )}状态：${input.objectState.summary}`
    : english
      ? `${input.objectLabel} does not yet have a stabilized object-state summary, so the recommendation is still relying more heavily on local evidence.`
      : `${input.objectLabel} 还没有稳定的对象状态摘要，所以这条判断建议仍更依赖局部证据。`;

  const skillLine = primarySkill
    ? english
      ? `${primarySkill.name} is the operating skill behind this move, and it reads ${primarySkill.reads.slice(0, 3).join(", ")} before writing ${primarySkill.writes.slice(0, 2).join(", ")}.`
      : `这一步背后的 operating skill 是“${primarySkill.name}”，它会先读取 ${primarySkill.reads
          .slice(0, 3)
          .join("、")}，再写出 ${primarySkill.writes.slice(0, 2).join("、")}。`
    : english
      ? "This recommendation is still missing an explicit skill binding and should not be treated as a fully standardized action yet."
      : "这条判断建议还没有明确技能绑定，暂时不能算完全标准化动作。";

  const topSignal = input.eventSignals[0] ?? null;
  const eventLine = topSignal
    ? english
      ? `${topSignal.title}: ${topSignal.summary}`
      : `${topSignal.title}：${topSignal.summary}`
    : english
      ? "No dominant event signal is active right now, so the recommendation is being led more by standing context than by a new trigger."
      : "当前没有压倒性的事件信号，所以这条判断建议更多是由长期上下文而不是新触发事件主导。";

  const governanceLine =
    invocation?.boundaryMode === "auto"
      ? english
        ? "The current boundary allows low-risk direct execution, but the action still needs a replayable audit trail."
        : "当前边界允许低风险直接执行，但动作仍需要留下可回放的审计轨迹。"
      : invocation?.boundaryMode === "approval"
        ? english
          ? "The action should leave the judgement layer through approval instead of direct execution."
          : "这条动作应该通过审批离开判断层，而不是直接执行。"
        : english
          ? "This move still requires human judgement or policy clarification before it can leave the reasoning layer."
          : "这一步仍需要人工判断或策略澄清，才能离开推理层。";

  return {
    skill: primarySkill
      ? getOperatingSkillById(primarySkill.id)
      : null,
    skillLine,
    eventLine,
    stateLine,
    governanceLine,
  };
}

function statusLabel(status: OperatingObjectState["status"]) {
  if (status === "healthy") return "稳定";
  if (status === "watch") return "观察";
  return "受阻";
}
