import { ActionStatus, RiskLevel } from "@prisma/client";
import { advanceBiReportBusinessSignalStatus } from "@/lib/bi-report-skill/business-signal";
import type {
  BiReportBusinessHandoffDecisionRecord,
  BiReportBusinessSignalRecord,
  BiReportBusinessSignalStatus,
  BiReportSeverity,
} from "@/lib/bi-report-skill/types";
import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";

export type BiReportActionItemSourceKind = "bi_handoff" | "bi_signal_direct";

export type BiReportOperatingClosureMetadata = {
  sourceProvider: "bi_report";
  sourceKind: BiReportActionItemSourceKind;
  sourceType: string;
  sourceId: string;
  biReportSignalId: string;
  biReportSignalKey: string;
  biReportSkillKey: string;
  biReportSignalType: string;
  handoffDecisionId?: string;
  handoffTargetType?: string;
};

export type BiReportOperatingClosureSla = {
  slaPolicy: string;
  slaDueAt: string;
  slaReason: string;
  policyHours: number;
  urgencyScore: number;
  anchorAt: string;
};

export type BiReportOperatingClosureOutcome = {
  receiptStage: "plan" | "result";
  outcome:
    | "approved_pending_execution"
    | "executed"
    | "rejected_not_executed";
  executedAt?: string;
  executedBy?: string;
  executionLogId?: string;
  approvalTaskId?: string;
  decisionReason?: string | null;
  updatedAt: string;
};

export type BiReportActionItemClosureMetadata = {
  operating_closure: {
    source: BiReportOperatingClosureMetadata;
    sla: BiReportOperatingClosureSla;
    outcome?: BiReportOperatingClosureOutcome;
  };
  biReportSignalId: string;
  biReportSignalKey: string;
  biReportSkillKey: string;
  biReportSignalType: string;
  handoffDecisionId?: string;
  handoffTargetType?: string;
  slaPolicy: string;
  slaDueAt: string;
  slaReason: string;
  urgencyScore: number;
};

export function resolveBiReportSlaPolicyHours(input: {
  severity?: BiReportSeverity;
  riskLevel?: RiskLevel;
}): number {
  if (input.severity === "CRITICAL" || input.riskLevel === RiskLevel.CRITICAL) {
    return 24;
  }
  if (input.severity === "ALERT" || input.riskLevel === RiskLevel.HIGH) {
    return 48;
  }
  if (input.severity === "WARN" || input.riskLevel === RiskLevel.MEDIUM) {
    return 72;
  }
  return 168;
}

export function mapSeverityToUrgencyScore(severity: BiReportSeverity): number {
  if (severity === "CRITICAL") return 90;
  if (severity === "ALERT") return 75;
  if (severity === "WARN") return 60;
  if (severity === "WATCH") return 40;
  return 20;
}

export function computeBiReportActionItemSla(input: {
  severity: BiReportSeverity;
  riskLevel?: RiskLevel;
  anchorAt?: Date;
}): { dueDate: Date; sla: BiReportOperatingClosureSla } {
  const anchorAt = input.anchorAt ?? new Date();
  const policyHours = resolveBiReportSlaPolicyHours({
    severity: input.severity,
    riskLevel: input.riskLevel,
  });
  const dueDate = new Date(anchorAt.getTime() + policyHours * 60 * 60 * 1000);
  const slaPolicy = `bi_report_risk_sla_${policyHours}h`;

  return {
    dueDate,
    sla: {
      slaPolicy,
      slaDueAt: dueDate.toISOString(),
      slaReason:
        input.severity === "CRITICAL"
          ? "CRITICAL 信号默认 24 小时 SLA"
          : input.severity === "ALERT"
            ? "ALERT 信号默认 48 小时 SLA"
            : input.severity === "WARN"
              ? "WARN 信号默认 72 小时 SLA"
              : "低优先级信号默认 7 天 SLA",
      policyHours,
      urgencyScore: mapSeverityToUrgencyScore(input.severity),
      anchorAt: anchorAt.toISOString(),
    },
  };
}

export function buildBiReportHandoffActionItemMetadata(input: {
  signal: BiReportBusinessSignalRecord;
  decision: BiReportBusinessHandoffDecisionRecord;
  sourceId: string;
  handoffTargetType: string;
  riskLevel: RiskLevel;
  anchorAt?: Date;
}): { dueDate: Date; metadata: BiReportActionItemClosureMetadata } {
  const { dueDate, sla } = computeBiReportActionItemSla({
    severity: input.signal.severity,
    riskLevel: input.riskLevel,
    anchorAt: input.anchorAt,
  });

  const source: BiReportOperatingClosureMetadata = {
    sourceProvider: "bi_report",
    sourceKind: "bi_handoff",
    sourceType: "bi_report_handoff",
    sourceId: input.sourceId,
    biReportSignalId: input.signal.id,
    biReportSignalKey: input.signal.signalKey,
    biReportSkillKey: input.signal.skillKey,
    biReportSignalType: input.signal.signalType,
    handoffDecisionId: input.decision.id,
    handoffTargetType: input.handoffTargetType,
  };

  return {
    dueDate,
    metadata: buildClosureMetadataRecord({ source, sla }),
  };
}

export function buildBiReportDirectSignalActionItemMetadata(input: {
  signal: BiReportBusinessSignalRecord;
  sourceId: string;
  anchorAt?: Date;
}): { dueDate: Date; metadata: BiReportActionItemClosureMetadata } {
  const riskLevel = mapBiReportSeverityToRiskLevel(input.signal.severity);
  const { dueDate, sla } = computeBiReportActionItemSla({
    severity: input.signal.severity,
    riskLevel,
    anchorAt: input.anchorAt,
  });

  const source: BiReportOperatingClosureMetadata = {
    sourceProvider: "bi_report",
    sourceKind: "bi_signal_direct",
    sourceType: "bi_report_business_signal",
    sourceId: input.sourceId,
    biReportSignalId: input.signal.id,
    biReportSignalKey: input.signal.signalKey,
    biReportSkillKey: input.signal.skillKey,
    biReportSignalType: input.signal.signalType,
  };

  return {
    dueDate,
    metadata: buildClosureMetadataRecord({ source, sla }),
  };
}

function buildClosureMetadataRecord(input: {
  source: BiReportOperatingClosureMetadata;
  sla: BiReportOperatingClosureSla;
  outcome?: BiReportOperatingClosureOutcome;
}): BiReportActionItemClosureMetadata {
  return {
    operating_closure: {
      source: input.source,
      sla: input.sla,
      outcome: input.outcome,
    },
    biReportSignalId: input.source.biReportSignalId,
    biReportSignalKey: input.source.biReportSignalKey,
    biReportSkillKey: input.source.biReportSkillKey,
    biReportSignalType: input.source.biReportSignalType,
    handoffDecisionId: input.source.handoffDecisionId,
    handoffTargetType: input.source.handoffTargetType,
    slaPolicy: input.sla.slaPolicy,
    slaDueAt: input.sla.slaDueAt,
    slaReason: input.sla.slaReason,
    urgencyScore: input.sla.urgencyScore,
  };
}

export type BiReportActionItemMetadataPatch = {
  operating_closure?: Partial<{
    source: Partial<BiReportOperatingClosureMetadata>;
    sla: Partial<BiReportOperatingClosureSla>;
    outcome: BiReportOperatingClosureOutcome;
  }>;
  biReportSignalId?: string;
  biReportSignalKey?: string;
  biReportSkillKey?: string;
  biReportSignalType?: string;
  handoffDecisionId?: string;
  handoffTargetType?: string;
  slaPolicy?: string;
  slaDueAt?: string;
  slaReason?: string;
  urgencyScore?: number;
  executedAt?: string;
  executedBy?: string;
  outcome?: BiReportOperatingClosureOutcome["outcome"];
};

export function mergeBiReportActionItemMetadata(
  existingMetadata: string | null | undefined,
  patch: BiReportActionItemMetadataPatch,
): string {
  const base = safeParseJson<Record<string, unknown>>(existingMetadata, {});
  const baseClosure = safeParseJson<{
    source?: Partial<BiReportOperatingClosureMetadata>;
    sla?: Partial<BiReportOperatingClosureSla>;
    outcome?: BiReportOperatingClosureOutcome;
  }>(JSON.stringify(base.operating_closure ?? {}), {});
  const patchClosure = patch.operating_closure ?? {};
  const mergedClosure = {
    ...baseClosure,
    ...patchClosure,
    source: {
      ...(baseClosure.source ?? {}),
      ...(patchClosure.source ?? {}),
    },
    sla: {
      ...(baseClosure.sla ?? {}),
      ...(patchClosure.sla ?? {}),
    },
    outcome: patchClosure.outcome ?? baseClosure.outcome,
  };

  const merged: Record<string, unknown> = {
    ...base,
    ...patch,
    operating_closure: mergedClosure,
  };

  if (mergedClosure.source && typeof mergedClosure.source === "object") {
    const source = mergedClosure.source as BiReportOperatingClosureMetadata;
    merged.biReportSignalId = source.biReportSignalId;
    merged.biReportSignalKey = source.biReportSignalKey;
    merged.biReportSkillKey = source.biReportSkillKey;
    merged.handoffDecisionId = source.handoffDecisionId;
    merged.handoffTargetType = source.handoffTargetType;
  }
  if (mergedClosure.sla && typeof mergedClosure.sla === "object") {
    const sla = mergedClosure.sla as BiReportOperatingClosureSla;
    merged.slaPolicy = sla.slaPolicy;
    merged.slaDueAt = sla.slaDueAt;
    merged.slaReason = sla.slaReason;
    merged.urgencyScore = sla.urgencyScore;
  }
  if (mergedClosure.outcome && typeof mergedClosure.outcome === "object") {
    const outcome = mergedClosure.outcome as BiReportOperatingClosureOutcome;
    merged.executedAt = outcome.executedAt;
    merged.executedBy = outcome.executedBy;
    merged.outcome = outcome.outcome;
  }

  return JSON.stringify(merged);
}

export function mapBiReportSeverityToRiskLevel(severity: BiReportSeverity): RiskLevel {
  if (severity === "CRITICAL") return RiskLevel.CRITICAL;
  if (severity === "ALERT") return RiskLevel.HIGH;
  if (severity === "WARN") return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

export async function applyBiReportHandoffReceiptToActionItem(input: {
  workspaceId: string;
  actionItemId: string;
  approvalTaskId: string;
  authorUserId: string | null;
  decisionReason?: string | null;
  receiptStage: "plan" | "result";
  outcome: BiReportOperatingClosureOutcome["outcome"];
  executionLogId?: string;
  signalId: string;
  signalStatus: BiReportBusinessSignalStatus;
  actionStatus?: ActionStatus;
  executionStatus?: string;
  executedAt?: Date;
}): Promise<void> {
  const actionItem = await db.actionItem.findFirst({
    where: {
      id: input.actionItemId,
      workspaceId: input.workspaceId,
    },
    select: {
      id: true,
      metadata: true,
      status: true,
      executionStatus: true,
      executedAt: true,
    },
  });

  if (!actionItem) {
    return;
  }

  const now = new Date();
  const outcomePatch: BiReportOperatingClosureOutcome = {
    receiptStage: input.receiptStage,
    outcome: input.outcome,
    executedAt: input.executedAt?.toISOString() ?? undefined,
    executedBy: input.authorUserId ?? undefined,
    executionLogId: input.executionLogId,
    approvalTaskId: input.approvalTaskId,
    decisionReason: input.decisionReason ?? null,
    updatedAt: now.toISOString(),
  };

  const metadata = mergeBiReportActionItemMetadata(actionItem.metadata, {
    operating_closure: {
      outcome: outcomePatch,
    },
    executedAt: outcomePatch.executedAt,
    executedBy: outcomePatch.executedBy,
    outcome: outcomePatch.outcome,
  });

  await db.actionItem.update({
    where: { id: actionItem.id },
    data: {
      metadata,
      ...(input.actionStatus ? { status: input.actionStatus } : {}),
      ...(input.executionStatus ? { executionStatus: input.executionStatus } : {}),
      ...(input.executedAt ? { executedAt: input.executedAt } : {}),
    },
  });

  await advanceBiReportBusinessSignalStatus({
    workspaceId: input.workspaceId,
    id: input.signalId,
    status: input.signalStatus,
  });
}
