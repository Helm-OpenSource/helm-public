/**
 * 实施变更包（Agent-ready Change Packet）只读展示的**纯双语文案 + 语义色调**。
 *
 * 抽成纯模块以便单测,并把"呈现≠执行"的边界收在一处:effectLevel 的色调只表达
 * **副作用等级**(信息性),绝不表达"可执行/已执行"。文案强调"准备与监督,不代执行"。
 */

import type {
  AgentReadyChangeEffectLevel,
  AgentReadyRollbackStrategy,
  OperationSuggestionCategory,
  OperationSuggestionReadiness,
} from "@/lib/shell/operation-suggestion";

type Bi = { zh: string; en: string };

export function t(copy: Bi, english: boolean): string {
  return english ? copy.en : copy.zh;
}

export const CATEGORY_COPY: Record<OperationSuggestionCategory, Bi> = {
  initialization: { zh: "初始化", en: "Initialization" },
  connector_setup: { zh: "连接器接入", en: "Connector setup" },
  data_seed: { zh: "数据播种", en: "Data seed" },
  migration: { zh: "一次性迁移", en: "Migration" },
  one_off_config: { zh: "一次性配置", en: "One-off config" },
};

export const READINESS_COPY: Record<OperationSuggestionReadiness, Bi> = {
  ready: { zh: "可交通用 Agent", en: "Ready for a general agent" },
  blocked_precondition: { zh: "有未满足前置", en: "Blocked · precondition" },
  pending_source: { zh: "来源接入中", en: "Source pending" },
};

/** 副作用等级(信息性色调,非执行态)。 */
export const EFFECT_LEVEL_COPY: Record<
  AgentReadyChangeEffectLevel,
  Bi & { tone: "neutral" | "caution" | "danger" }
> = {
  read_only: { zh: "只读", en: "Read-only", tone: "neutral" },
  configuration_change: { zh: "配置变更", en: "Configuration change", tone: "caution" },
  external_side_effect: { zh: "外部副作用", en: "External side effect", tone: "danger" },
};

export const ROLLBACK_STRATEGY_COPY: Record<AgentReadyRollbackStrategy, Bi> = {
  not_applicable: { zh: "不适用", en: "Not applicable" },
  restore_previous_state: { zh: "恢复到先前状态", en: "Restore previous state" },
  compensating_action: { zh: "补偿动作", en: "Compensating action" },
  manual_recovery: { zh: "人工恢复", en: "Manual recovery" },
};

export function rollbackStrategyLabel(
  strategy: AgentReadyRollbackStrategy,
  english: boolean,
): string {
  const copy = ROLLBACK_STRATEGY_COPY[strategy];
  return copy ? t(copy, english) : strategy;
}

/** 全局边界横幅:Helm 准备与监督,不代执行。 */
export const BOUNDARY_NOTE: Bi = {
  zh: "Helm 准备并监督实施:描述目标、边界、预演、审批、回滚与应返回的证据。Helm 不代执行——由你选择的通用 Agent（如 Claude Code / CodeX / 悟空 / WorkBuddy）执行,结果回流为证据。",
  en: "Helm prepares and supervises the change: it describes the goal, boundary, dry-run, approvals, rollback, and the receipts to return. Helm does not execute — a general agent you choose (e.g. Claude Code / CodeX / 悟空 / WorkBuddy) runs it, and results return as evidence.",
};

export const SECTION_COPY = {
  title: { zh: "实施队列 · 变更包", en: "Implementation queue · change packets" } satisfies Bi,
  subtitle: {
    zh: "不频繁/一次性操作作为结构化变更包,交通用 Agent 执行(准备与监督,不自动执行)。",
    en: "Infrequent / one-off operations as structured change packets handed to a general agent (prepare & supervise, no auto-execution).",
  } satisfies Bi,
  empty: {
    zh: "当前没有实施变更包。真实变更包由已接入的 Overlay provider 生成(如初始化/连接器接入);未接入时诚实留空,不造数。",
    en: "No implementation change packets right now. Real packets come from a registered overlay provider (e.g. initialization / connector setup); honestly empty until one is wired.",
  } satisfies Bi,
  fields: {
    goal: { zh: "目标状态", en: "Goal state" } satisfies Bi,
    currentState: { zh: "当前诊断", en: "Current state" } satisfies Bi,
    prerequisites: { zh: "前置条件", en: "Prerequisites" } satisfies Bi,
    requiredPermissions: { zh: "所需权限(最小集)", en: "Required permissions (least set)" } satisfies Bi,
    proposedChanges: { zh: "拟变更", en: "Proposed changes" } satisfies Bi,
    forbiddenActions: { zh: "明确禁止", en: "Forbidden actions" } satisfies Bi,
    dryRun: { zh: "预演", en: "Dry-run" } satisfies Bi,
    approvalPolicy: { zh: "审批", en: "Approval policy" } satisfies Bi,
    rollback: { zh: "回滚", en: "Rollback" } satisfies Bi,
    expectedReceipts: { zh: "应返回证据", en: "Expected receipts" } satisfies Bi,
    verification: { zh: "验证", en: "Verification" } satisfies Bi,
    procedure: { zh: "步骤", en: "Procedure" } satisfies Bi,
    expectedResult: { zh: "预期结果", en: "Expected result" } satisfies Bi,
    approver: { zh: "审批人角色", en: "Approver role" } satisfies Bi,
    checkpoints: { zh: "确认检查点", en: "Checkpoints" } satisfies Bi,
    required: { zh: "必需", en: "Required" } satisfies Bi,
    optional: { zh: "非必需", en: "Optional" } satisfies Bi,
    separationOfDuties: { zh: "需职责分离(禁自批)", en: "Separation of duties (no self-approve)" } satisfies Bi,
  },
};
