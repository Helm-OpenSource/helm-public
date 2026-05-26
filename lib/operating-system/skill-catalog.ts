import {
  ActionType,
  ObjectType,
  type ActionExecutionMode,
} from "@prisma/client";
import type {
  OperatingBoundaryMode,
  OperatingSkillDefinition,
  OperatingSkillId,
  OperatingSkillInvocation,
} from "@/lib/operating-system/types";

const SKILL_CATALOG: OperatingSkillDefinition[] = [
  {
    id: "meeting-briefing",
    name: "会前简报",
    summary: "把会议上下文、未完成承诺、关键阻塞和对象状态压成会前判断。",
    category: "memory",
    reads: ["meeting", "memoryFacts", "commitments", "blockers", "emailThreads"],
    writes: ["briefingSnapshot"],
    defaultBoundary: "auto",
    primaryActionTypes: [ActionType.DRAFT_INTERNAL_NOTE],
    primaryObjectTypes: [ObjectType.MEETING, ObjectType.OPPORTUNITY],
    defaultSurface: "meetings",
  },
  {
    id: "meeting-follow-through",
    name: "会后动作提炼",
    summary: "把会议讨论转成下一步动作、责任人、时间窗口和后续审批入口。",
    category: "execution",
    reads: ["meetingNote", "memoryFacts", "commitments", "blockers"],
    writes: ["actionItems", "approvalTasks", "auditLogs"],
    defaultBoundary: "approval",
    primaryActionTypes: [ActionType.CREATE_TASK, ActionType.ASSIGN_OWNER],
    primaryObjectTypes: [ObjectType.MEETING, ObjectType.OPPORTUNITY],
    defaultSurface: "meetings",
  },
  {
    id: "external-followup-draft",
    name: "外部跟进草稿",
    summary: "把关系上下文、阻塞和承诺转成对外跟进草稿。",
    category: "execution",
    reads: ["contact", "company", "opportunity", "memoryFacts", "emailThreads"],
    writes: ["draftContent", "approvalTasks", "auditLogs"],
    defaultBoundary: "approval",
    primaryActionTypes: [
      ActionType.DRAFT_EXTERNAL_EMAIL,
      ActionType.GENERATE_REPLY_DRAFT,
    ],
    primaryObjectTypes: [
      ObjectType.CONTACT,
      ObjectType.COMPANY,
      ObjectType.OPPORTUNITY,
    ],
    defaultSurface: "approvals",
  },
  {
    id: "approval-review",
    name: "审批判断",
    summary: "把信任边界、高风险动作和执行模式变成人可以审的控制台判断。",
    category: "governance",
    reads: ["actionItems", "recommendationLogs", "policyRules", "memoryFacts"],
    writes: ["approvalTasks", "auditLogs", "policyFeedback"],
    defaultBoundary: "manual",
    primaryActionTypes: [
      ActionType.DRAFT_EXTERNAL_EMAIL,
      ActionType.GENERATE_REPLY_DRAFT,
      ActionType.UPDATE_OPPORTUNITY_STAGE,
      ActionType.CREATE_TASK,
    ],
    primaryObjectTypes: [
      ObjectType.APPROVAL_TASK,
      ObjectType.OPPORTUNITY,
      ObjectType.MEETING,
    ],
    defaultSurface: "approvals",
  },
  {
    id: "opportunity-push",
    name: "机会推进判断",
    summary: "结合阶段、风险、承诺和对象上下文，判断今天最该推进哪条机会。",
    category: "execution",
    reads: ["opportunity", "memoryFacts", "commitments", "blockers", "meetings"],
    writes: ["recommendationLogs", "actionItems", "auditLogs"],
    defaultBoundary: "auto",
    primaryActionTypes: [
      ActionType.UPDATE_OPPORTUNITY_STAGE,
      ActionType.CREATE_TASK,
      ActionType.CHANGE_DUE_DATE,
    ],
    primaryObjectTypes: [ObjectType.OPPORTUNITY, ObjectType.COMPANY],
    defaultSurface: "dashboard",
  },
  {
    id: "relationship-revival",
    name: "关系恢复动作",
    summary: "当联系人掉速或线程等待我方时，优先生成低阻力恢复动作。",
    category: "execution",
    reads: ["contact", "emailThreads", "memoryFacts", "meetings"],
    writes: ["recommendationLogs", "draftContent", "auditLogs"],
    defaultBoundary: "approval",
    primaryActionTypes: [
      ActionType.DRAFT_EXTERNAL_EMAIL,
      ActionType.CREATE_MEETING,
      ActionType.SCHEDULE_INTERVIEW,
    ],
    primaryObjectTypes: [ObjectType.CONTACT, ObjectType.COMPANY],
    defaultSurface: "dashboard",
  },
  {
    id: "memory-correction",
    name: "记忆修正",
    summary: "让错误事实、失效承诺和阻塞状态被及时修正，并回写解释链。",
    category: "memory",
    reads: ["memoryEntries", "memoryFacts", "commitments", "blockers"],
    writes: ["memoryCorrections", "auditLogs", "recommendationRefresh"],
    defaultBoundary: "manual",
    primaryActionTypes: [ActionType.DRAFT_INTERNAL_NOTE],
    primaryObjectTypes: [
      ObjectType.CONTACT,
      ObjectType.COMPANY,
      ObjectType.OPPORTUNITY,
      ObjectType.MEETING,
    ],
    defaultSurface: "memory",
  },
  {
    id: "pilot-readiness-diagnostics",
    name: "试点 就绪度 诊断",
    summary: "把判断建议、记忆、辅助服务、采集、客户关系接入和复核边界压成是否可放量的判断。",
    category: "diagnostics",
    reads: ["recommendationQuality", "memoryQuality", "llmOverview", "captureOverview", "crmSources", "approvalTasks"],
    writes: ["diagnosticsReadiness"],
    defaultBoundary: "manual",
    primaryActionTypes: [ActionType.DRAFT_INTERNAL_NOTE],
    primaryObjectTypes: ["WORKSPACE"],
    defaultSurface: "diagnostics",
  },
];

export function getOperatingSkillCatalog() {
  return SKILL_CATALOG;
}

export function getOperatingSkillById(skillId: OperatingSkillId) {
  return SKILL_CATALOG.find((item) => item.id === skillId) ?? null;
}

export function getOperatingSkillsForSurface(
  surface: OperatingSkillDefinition["defaultSurface"],
) {
  return SKILL_CATALOG.filter((item) => item.defaultSurface === surface);
}

export function getOperatingSkillForActionType(actionType: ActionType) {
  const matches = SKILL_CATALOG.filter((item) =>
    item.primaryActionTypes.includes(actionType),
  );

  if (!matches.length) return null;

  return matches.find((item) => item.category !== "governance") ?? matches[0];
}

export function resolveBoundaryModeFromPolicyResult(
  policyResult?: ActionExecutionMode | string | null,
): OperatingBoundaryMode {
  if (policyResult === "AUTO_WITHIN_THRESHOLD") return "auto";
  if (policyResult === "REQUIRES_APPROVAL") return "approval";
  return "manual";
}

export function createOperatingSkillInvocation(input: {
  actionType: ActionType;
  objectLabel: string;
  policyResult?: ActionExecutionMode | string | null;
}): OperatingSkillInvocation | null {
  const skill = getOperatingSkillForActionType(input.actionType);

  if (!skill) return null;

  return {
    skillId: skill.id,
    inputSummary: `${skill.reads.slice(0, 3).join("、")} 已经围绕 ${input.objectLabel} 就位`,
    outputSummary: `${skill.writes.slice(0, 3).join("、")} 会成为这一步的直接产物`,
    boundaryMode: resolveBoundaryModeFromPolicyResult(input.policyResult) ?? skill.defaultBoundary,
    policyResult: input.policyResult ?? null,
  };
}
