import { SettlementBatchStatus, SettlementLineStatus } from "@prisma/client";

export type SettlementBatchFeedbackKind = "created" | "approved" | "exported" | "closed";
export type SettlementLineFeedbackKind = "marked_paid" | "reversed";

type SettlementFeedback = {
  summary: string;
  operatorMessage: string;
  result: string;
  payload: Record<string, string | number | null>;
};

export function buildSettlementBatchActionFeedback(input: {
  kind: SettlementBatchFeedbackKind;
  batchId: string;
  batchKey: string;
  periodLabel: string;
  status: SettlementBatchStatus;
  lineCount?: number;
  actorName: string;
  english: boolean;
  sourcePage: string;
}): SettlementFeedback {
  const verb =
    input.kind === "created"
      ? input.english
        ? "Created"
        : "已创建"
      : input.kind === "approved"
        ? input.english
          ? "Approved"
          : "已批准"
        : input.kind === "exported"
          ? input.english
            ? "Exported"
            : "已导出"
          : input.english
            ? "Closed"
            : "已关闭";

  const operatorMessage =
    input.kind === "created"
      ? input.english
        ? "Settlement batch created"
        : "结算批次已创建"
      : input.kind === "approved"
        ? input.english
          ? "Settlement batch approved"
          : "结算批次已批准"
        : input.kind === "exported"
          ? input.english
            ? "Settlement batch exported"
            : "结算批次已导出"
          : input.english
            ? "Settlement batch closed"
            : "结算批次已关闭";

  return {
    summary: input.english ? `${verb} settlement batch ${input.batchKey}` : `${verb}结算批次：${input.batchKey}`,
    operatorMessage,
    result: input.status,
    payload: {
      sourcePage: input.sourcePage,
      actorName: input.actorName,
      result: input.status,
      settlementTarget: "batch",
      settlementAction: input.kind,
      batchId: input.batchId,
      batchKey: input.batchKey,
      periodLabel: input.periodLabel,
      lineCount: input.lineCount ?? null,
    },
  };
}

export function buildSettlementLineActionFeedback(input: {
  kind: SettlementLineFeedbackKind;
  lineId: string;
  lineStatus: SettlementLineStatus;
  actorName: string;
  english: boolean;
  sourcePage: string;
  notes?: string | null;
  reason?: string | null;
}): SettlementFeedback {
  const operatorMessage =
    input.kind === "marked_paid"
      ? input.english
        ? "Settlement line marked paid"
        : "结算条目已标记为已支付"
      : input.english
        ? "Settlement line reversed"
        : "结算条目已冲回";

  return {
    summary:
      input.kind === "marked_paid"
        ? input.english
          ? "Marked settlement line as paid"
          : "已将结算条目标记为已支付"
        : input.english
          ? "Reversed settlement line"
          : "已冲回结算条目",
    operatorMessage,
    result: input.lineStatus,
    payload: {
      sourcePage: input.sourcePage,
      actorName: input.actorName,
      result: input.lineStatus,
      settlementTarget: "line",
      settlementAction: input.kind,
      lineId: input.lineId,
      notes: input.notes ?? null,
      reason: input.reason ?? null,
    },
  };
}
