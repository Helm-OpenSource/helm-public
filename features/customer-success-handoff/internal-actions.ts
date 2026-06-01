import { ActionType, type RiskLevel } from "@prisma/client";
import type {
  AgentAttentionState,
  AgentAuthorityState,
} from "@/lib/presentation/agent-primitives";
import { safeParseJson } from "@/lib/utils";
import type {
  CustomerSuccessFallbackMode,
  CustomerSuccessHandoffStage,
  CustomerSuccessSendabilityMode,
} from "@/lib/presentation/customer-success-handoff-surface-contract";

export const customerSuccessInternalActionKeys = [
  "internal-followup-note",
  "internal-escalation-note",
  "internal-review-reminder",
  "internal-coordination-update",
] as const;

export type CustomerSuccessInternalActionKey =
  (typeof customerSuccessInternalActionKeys)[number];

export type CustomerSuccessInternalActionState =
  | "helm-prepared"
  | "user-reviewed"
  | "user-backed"
  | "user-approved-to-execute"
  | "executed-internally";

// Keep this as action-level provenance/execution state only for internal-only work.

export type CustomerSuccessAuthorityState = AgentAuthorityState;

export type CustomerSuccessAttentionState = AgentAttentionState;

export type CustomerSuccessInternalActionKind =
  | "follow-up-note"
  | "escalation-note"
  | "review-reminder"
  | "coordination-update";

export type CustomerSuccessInternalActionMetadata = {
  customerSuccessInternalActionKey: CustomerSuccessInternalActionKey;
  customerSuccessInternalActionKind: CustomerSuccessInternalActionKind;
  approvedById?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  executedByName?: string | null;
  executedTriggerUserId?: string | null;
  executedTriggerUserName?: string | null;
  executedAt?: string | null;
  resultSummary?: string | null;
};

export type CustomerSuccessInternalActionSpec = {
  key: CustomerSuccessInternalActionKey;
  kind: CustomerSuccessInternalActionKind;
  actionType: ActionType;
  title: string;
  summary: string;
  description: string;
  draftContent: string;
  resultSummary: string;
};

export function isCustomerSuccessInternalActionKey(
  value: string,
): value is CustomerSuccessInternalActionKey {
  return (
    customerSuccessInternalActionKeys as readonly string[]
  ).includes(value);
}

export function parseCustomerSuccessInternalActionMetadata(
  value?: string | null,
): CustomerSuccessInternalActionMetadata | null {
  const parsed = safeParseJson<Record<string, unknown> | null>(value, null);
  if (!parsed) return null;
  const actionKey = parsed.customerSuccessInternalActionKey;
  if (typeof actionKey !== "string" || !isCustomerSuccessInternalActionKey(actionKey)) {
    return null;
  }

  return {
    customerSuccessInternalActionKey: actionKey,
    customerSuccessInternalActionKind:
      typeof parsed.customerSuccessInternalActionKind === "string"
        ? (parsed.customerSuccessInternalActionKind as CustomerSuccessInternalActionKind)
        : "follow-up-note",
    approvedById:
      typeof parsed.approvedById === "string" ? parsed.approvedById : null,
    approvedByName:
      typeof parsed.approvedByName === "string" ? parsed.approvedByName : null,
    approvedAt:
      typeof parsed.approvedAt === "string" ? parsed.approvedAt : null,
    executedByName:
      typeof parsed.executedByName === "string" ? parsed.executedByName : null,
    executedTriggerUserId:
      typeof parsed.executedTriggerUserId === "string"
        ? parsed.executedTriggerUserId
        : null,
    executedTriggerUserName:
      typeof parsed.executedTriggerUserName === "string"
        ? parsed.executedTriggerUserName
        : null,
    executedAt:
      typeof parsed.executedAt === "string" ? parsed.executedAt : null,
    resultSummary:
      typeof parsed.resultSummary === "string" ? parsed.resultSummary : null,
  };
}

export function buildCustomerSuccessInternalActionSpecs({
  title,
  stageKey,
  authorityState,
  attentionState,
  sendabilityMode,
  fallbackMode,
  riskLevel,
  judgement,
  reason,
  decisionRequest,
  nextAction,
  boundarySummary,
  english,
}: {
  title: string;
  stageKey: CustomerSuccessHandoffStage;
  authorityState: CustomerSuccessAuthorityState;
  attentionState: CustomerSuccessAttentionState;
  sendabilityMode: CustomerSuccessSendabilityMode;
  fallbackMode: CustomerSuccessFallbackMode;
  riskLevel: RiskLevel;
  judgement: string;
  reason: string;
  decisionRequest: string;
  nextAction: string;
  boundarySummary: string;
  english: boolean;
}): CustomerSuccessInternalActionSpec[] {
  const followUpNote: CustomerSuccessInternalActionSpec = {
    key: "internal-followup-note",
    kind: "follow-up-note",
    actionType: ActionType.DRAFT_INTERNAL_NOTE,
    title: english ? `${title} internal follow-up note` : `${title} 内部跟进备注`,
    summary: english
      ? "Record the current customer success judgement, boundary and next action as an internal-only follow-up note."
      : "把当前客户成功判断、边界和下一步动作记录成一条仅内部可见的跟进备注。",
    description: english
      ? "Create or refresh an internal follow-up note so the next bounded move stays visible without implying commitment."
      : "创建或刷新一条内部跟进备注，让下一条有边界的动作保持可见，但不暗示承诺。",
    draftContent: english
      ? [
          `Current judgement: ${judgement}`,
          `Reason: ${reason}`,
          `Decision request: ${decisionRequest}`,
          `Next action: ${nextAction}`,
          `Boundary: ${boundarySummary}`,
        ].join("\n")
      : [
          `当前判断：${judgement}`,
          `当前原因：${reason}`,
          `待拍板事项：${decisionRequest}`,
          `下一步动作：${nextAction}`,
          `当前边界：${boundarySummary}`,
        ].join("\n"),
    resultSummary: english
      ? "Internal follow-up note recorded on the current customer success line."
      : "已把内部跟进备注记录到当前客户成功线上。",
  };

  const specs: CustomerSuccessInternalActionSpec[] = [followUpNote];

  if (
    stageKey === "escalation-follow-through" ||
    attentionState === "blocked" ||
    fallbackMode === "blocked-by-boundary"
  ) {
    specs.push({
      key: "internal-escalation-note",
      kind: "escalation-note",
      actionType: ActionType.DRAFT_INTERNAL_NOTE,
      title: english ? `${title} escalation note` : `${title} 升级备注`,
      summary: english
        ? "Record the current escalation boundary, widened ownership pressure and decision pressure as an internal-only note."
        : "把当前升级边界、扩大后的接手压力和拍板压力记录成一条仅内部可见的备注。",
      description: english
        ? "Create or refresh an internal escalation note so the widened pressure stays explicit before any stronger outward wording appears."
        : "创建或刷新一条内部升级备注，让扩大后的压力在任何更强对外措辞出现前保持显式可见。",
      draftContent: english
        ? [
            `Escalation posture: ${stageKey}`,
            `Current reason: ${reason}`,
            `Risk posture: ${riskLevel}`,
            `Decision request: ${decisionRequest}`,
            `Boundary: ${boundarySummary}`,
          ].join("\n")
        : [
            `升级状态：${stageKey}`,
            `当前原因：${reason}`,
            `当前风险：${riskLevel}`,
            `待拍板事项：${decisionRequest}`,
            `当前边界：${boundarySummary}`,
          ].join("\n"),
      resultSummary: english
        ? "Escalation note recorded internally with explicit boundary and risk posture."
        : "已在内部记录升级备注，并附上明确边界与风险状态。",
    });
  }

  if (
    attentionState === "waiting" ||
    attentionState === "review-before-send" ||
    sendabilityMode === "review-before-send"
  ) {
    specs.push({
      key: "internal-review-reminder",
      kind: "review-reminder",
      actionType: ActionType.CREATE_TASK,
      title: english ? `${title} internal review reminder` : `${title} 内部复核提醒`,
      summary: english
        ? "Create a thin internal reminder artifact so review or dependency pressure does not disappear behind the handoff."
        : "创建一条简洁的内部提醒，避免复核或依赖压力再次藏回交接后面。",
      description: english
        ? "Create an internal reminder cue for the next review-sensitive move. Internal visibility only."
        : "为下一条复核敏感动作创建内部提醒，仅用于内部可见。",
      draftContent: english
        ? `Reminder: ${decisionRequest}\nBoundary: ${boundarySummary}`
        : `提醒：${decisionRequest}\n边界：${boundarySummary}`,
      resultSummary: english
        ? "Internal reminder artifact recorded for follow-through visibility."
        : "已记录内部提醒，用于保持后续推进可见。",
    });
  } else {
    specs.push({
      key: "internal-coordination-update",
      kind: "coordination-update",
      actionType: ActionType.DRAFT_INTERNAL_NOTE,
      title: english ? `${title} coordination update` : `${title} 协调更新`,
      summary: english
        ? "Append a concise internal coordination update so collaborators can inherit the next bounded move without restating the whole account."
        : "追加一条简洁的内部协调更新，让协作者能继承下一条有边界的动作，而不必重讲整条账户线。",
      description: english
        ? "Append an internal coordination update to the current customer success line."
        : "为当前客户成功线路追加一条内部协调更新。",
      draftContent: english
        ? [
            `Current line: ${stageKey}`,
            `Authority: ${authorityState}`,
            `Attention: ${attentionState}`,
            `Decision request: ${decisionRequest}`,
            `Next action: ${nextAction}`,
          ].join("\n")
        : [
          `当前线路：${stageKey}`,
          `授权边界：${authorityState}`,
          `注意状态：${attentionState}`,
          `待拍板事项：${decisionRequest}`,
          `下一步动作：${nextAction}`,
        ].join("\n"),
      resultSummary: english
        ? "Internal coordination update recorded for the current customer success line."
        : "已为当前客户成功线路记录内部协调更新。",
    });
  }

  return specs;
}
