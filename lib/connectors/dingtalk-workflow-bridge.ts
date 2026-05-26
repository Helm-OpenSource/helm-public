import {
  ActionType,
  ActorType,
  SourceType,
  type RiskLevel,
} from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { createGovernedAction } from "@/lib/policies/engine";
import { classifyDingTalkSignal } from "@/lib/connectors/signal-classification";
import { trimText } from "@/lib/utils";

type DingTalkBridgeScope =
  | "CALENDAR"
  | "MEETINGS"
  | "TODO"
  | "PROJECTS"
  | "MANAGEMENT"
  | "WORK"
  | "MESSAGE_NOTIFICATIONS";

export type DingTalkWorkflowBridgeSignal = {
  scope: DingTalkBridgeScope;
  sourceId: string;
  sourceType: string;
  label: string;
  summary: string;
  opportunityId: string | null;
  meetingId: string | null;
  companyId: string | null;
  objectLinkState: "matched" | "unmatched";
  objectLinkReason: string | null;
  workflowCandidate: {
    actionType: ActionType;
    title: string;
    description: string;
    riskLevel: RiskLevel;
    governanceMode: "REQUIRES_APPROVAL" | "SUGGEST_ONLY";
  };
  extractedFields?: {
    owner?: string | null;
    creator?: string | null;
    dept?: string | null;
    status?: string | null;
    priority?: string | null;
    time?: string | null;
  } | null;
};

export type DingTalkWorkflowBridgeResult = {
  totalSignals: number;
  matchedObjectCount: number;
  unmatchedCount: number;
  actionCreatedCount: number;
  approvalEnqueuedCount: number;
  dedupSkippedCount: number;
  skippedCount: number;
};

function resolveActionType(scope: DingTalkBridgeScope, summary: string) {
  if (scope === "TODO") {
    return ActionType.CREATE_TASK;
  }
  if (scope === "PROJECTS") {
    return /阶段|stage/i.test(summary)
      ? ActionType.UPDATE_OPPORTUNITY_STAGE
      : ActionType.CREATE_TASK;
  }
  if (scope === "WORK") {
    return /下周|计划|下一步|需协调|阻塞|风险|next plan|need help/i.test(summary)
      ? ActionType.CREATE_TASK
      : ActionType.DRAFT_INTERNAL_NOTE;
  }
  if (scope === "CALENDAR" || scope === "MEETINGS") {
    return ActionType.CREATE_TASK;
  }
  if (scope === "MANAGEMENT") {
    return ActionType.CREATE_TASK;
  }
  return ActionType.DRAFT_INTERNAL_NOTE;
}

function resolveRiskLevel(scope: DingTalkBridgeScope): RiskLevel {
  if (scope === "PROJECTS" || scope === "WORK" || scope === "MANAGEMENT") {
    return "HIGH";
  }
  return "MEDIUM";
}

function resolveGovernanceMode(riskLevel: RiskLevel) {
  return riskLevel === "HIGH" || riskLevel === "CRITICAL"
    ? "REQUIRES_APPROVAL"
    : "SUGGEST_ONLY";
}

function buildCandidate(signal: Omit<DingTalkWorkflowBridgeSignal, "workflowCandidate">) {
  const actionType = resolveActionType(signal.scope, signal.summary);
  const riskLevel = resolveRiskLevel(signal.scope);
  const governanceMode = resolveGovernanceMode(riskLevel);
  const title = trimText(
    `[DingTalk] ${signal.label}`,
    120,
  );
  const description = trimText(
    `${signal.summary}\n来源：${signal.scope} / ${signal.sourceType} / ${signal.sourceId}`,
    480,
  );
  return {
    actionType,
    title,
    description,
    riskLevel,
    governanceMode,
  } as const;
}

function stableSourceKey(signal: DingTalkWorkflowBridgeSignal) {
  return `dingtalk-mcp:${signal.scope}:${signal.sourceType}:${signal.sourceId}`;
}

export async function bridgeDingTalkSignalsToWorkflow(input: {
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  english: boolean;
  sourcePage: string;
  autoCreateActions: boolean;
  signals: Omit<DingTalkWorkflowBridgeSignal, "workflowCandidate">[];
}) {
  const result: DingTalkWorkflowBridgeResult = {
    totalSignals: input.signals.length,
    matchedObjectCount: 0,
    unmatchedCount: 0,
    actionCreatedCount: 0,
    approvalEnqueuedCount: 0,
    dedupSkippedCount: 0,
    skippedCount: 0,
  };

  for (const rawSignal of input.signals) {
    const signal: DingTalkWorkflowBridgeSignal = {
      ...rawSignal,
      workflowCandidate: buildCandidate(rawSignal),
    };
    const signalKey = stableSourceKey(signal);
    const hasObject = Boolean(
      signal.opportunityId || signal.meetingId || signal.companyId,
    );

    if (hasObject) {
      result.matchedObjectCount += 1;
      await writeAuditLog({
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorName,
        actorType: ActorType.SYSTEM,
        actionType: "DINGTALK_SIGNAL_LINKED",
        targetType: "ConnectorIngestionRecord",
        targetId: signalKey,
        sourcePage: input.sourcePage,
        relatedObjectType: signal.opportunityId
          ? "Opportunity"
          : signal.meetingId
            ? "Meeting"
            : signal.companyId
              ? "Company"
              : null,
        relatedObjectId:
          signal.opportunityId ?? signal.meetingId ?? signal.companyId ?? null,
        summary: input.english
          ? `DingTalk signal linked to Helm object: ${signal.scope} / ${signal.label}`
          : `钉钉信号已关联 Helm 对象：${signal.scope} / ${signal.label}`,
        payload: {
          sourceKey: signalKey,
          sourceType: signal.sourceType,
          sourceId: signal.sourceId,
          scope: signal.scope,
          objectLinkReason: signal.objectLinkReason,
          extractedFields: signal.extractedFields ?? null,
        },
      });
    } else {
      result.unmatchedCount += 1;
    }

    if (!input.autoCreateActions) {
      result.skippedCount += 1;
      await writeAuditLog({
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorName,
        actorType: ActorType.SYSTEM,
        actionType: "DINGTALK_SIGNAL_CONVERSION_SKIPPED",
        targetType: "ConnectorIngestionRecord",
        targetId: signalKey,
        sourcePage: input.sourcePage,
        summary: input.english
          ? "DingTalk signal conversion skipped by conservative bridge config."
          : "桥接配置为保守模式，已跳过钉钉信号自动转动作。",
        payload: {
          sourceKey: signalKey,
          autoCreateActions: false,
          hasObject,
          objectLinkReason: signal.objectLinkReason,
          candidate: signal.workflowCandidate,
        },
      });
      continue;
    }

    if (!hasObject) {
      result.skippedCount += 1;
      await writeAuditLog({
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorName,
        actorType: ActorType.SYSTEM,
        actionType: "DINGTALK_SIGNAL_CONVERSION_SKIPPED",
        targetType: "ConnectorIngestionRecord",
        targetId: signalKey,
        sourcePage: input.sourcePage,
        summary: input.english
          ? "DingTalk signal conversion skipped due to unmatched object."
          : "钉钉信号未命中对象，已跳过流转转换。",
        payload: {
          sourceKey: signalKey,
          autoCreateActions: true,
          hasObject: false,
          objectLinkReason: signal.objectLinkReason,
          candidate: signal.workflowCandidate,
        },
      });
      continue;
    }

    const existing = await db.actionItem.findFirst({
      where: {
        workspaceId: input.workspaceId,
        sourceId: signalKey,
      },
      select: { id: true },
    });
    if (existing) {
      result.dedupSkippedCount += 1;
      continue;
    }

    const conversion = await createGovernedAction({
      workspaceId: input.workspaceId,
      actorName: input.actorName,
      actorUserId: input.actorUserId ?? null,
      actorType: ActorType.SYSTEM,
      english: input.english,
      actionType: signal.workflowCandidate.actionType,
      title: signal.workflowCandidate.title,
      description: signal.workflowCandidate.description,
      aiReason: input.english
        ? `Converted from DingTalk ${signal.scope} signal under review-first governance.`
        : `由钉钉 ${signal.scope} 信号转换，遵循复核优先 治理边界。`,
      draftContent:
        signal.workflowCandidate.actionType === ActionType.DRAFT_INTERNAL_NOTE
          ? signal.summary
          : undefined,
      riskLevel: signal.workflowCandidate.riskLevel,
      meetingId: signal.meetingId ?? undefined,
      opportunityId: signal.opportunityId ?? undefined,
      ownerId: undefined,
      sourceType: SourceType.SYSTEM_INFERENCE,
      sourceId: signalKey,
      metadata: {
        sourceProvider: "DINGTALK_MCP",
        sourceScope: signal.scope,
        sourceType: signal.sourceType,
        sourceId: signal.sourceId,
        classification: classifyDingTalkSignal({
          scope: signal.scope,
          sourceType: signal.sourceType,
        }),
        objectLinkReason: signal.objectLinkReason,
        governanceModeHint: signal.workflowCandidate.governanceMode,
        extractedFields: signal.extractedFields ?? null,
      },
      resultPreview: input.english
        ? "This item was converted from DingTalk read-only signal and remains review-first."
        : "该动作由钉钉只读信号转换，仍保持复核优先。",
    });

    result.actionCreatedCount += 1;
    if (conversion.requiresApproval) {
      result.approvalEnqueuedCount += 1;
    }

    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      actor: input.actorName,
      actorType: ActorType.SYSTEM,
      actionType: "DINGTALK_SIGNAL_CONVERTED_TO_ACTION",
      targetType: "ActionItem",
      targetId: conversion.actionItemId,
      sourcePage: input.sourcePage,
      relatedObjectType: signal.opportunityId
        ? "Opportunity"
        : signal.meetingId
          ? "Meeting"
          : signal.companyId
            ? "Company"
            : null,
      relatedObjectId:
        signal.opportunityId ?? signal.meetingId ?? signal.companyId ?? null,
      summary: input.english
        ? "DingTalk signal converted to governed action."
        : "钉钉信号已转换为受治理动作。",
      payload: {
        sourceKey: signalKey,
        conversion,
        candidate: signal.workflowCandidate,
      },
    });

    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId ?? null,
      eventName: "dingtalk_signal_converted_to_action",
      eventCategory: "connector",
      targetType: "ActionItem",
      targetId: conversion.actionItemId,
      sourcePage: input.sourcePage,
      metadata: {
        sourceProvider: "DINGTALK_MCP",
        sourceScope: signal.scope,
        sourceId: signal.sourceId,
        requiresApproval: conversion.requiresApproval,
      },
    });
  }

  return result;
}
