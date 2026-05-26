import { SettlementBatchStatus, SettlementLineStatus } from "@prisma/client";

export function canApproveSettlementBatch(status: SettlementBatchStatus) {
  return status === SettlementBatchStatus.DRAFT;
}

export function canExportSettlementBatch(status: SettlementBatchStatus) {
  return status === SettlementBatchStatus.APPROVED;
}

export function canCloseSettlementBatch(input: {
  status: SettlementBatchStatus;
  lineStatuses: SettlementLineStatus[];
}) {
  return (
    input.status === SettlementBatchStatus.EXPORTED &&
    input.lineStatuses.length > 0 &&
    input.lineStatuses.every(
      (status) => status === SettlementLineStatus.PAID || status === SettlementLineStatus.REVERSED,
    )
  );
}

export function canMarkSettlementLinePaid(status: SettlementLineStatus) {
  return status === SettlementLineStatus.EXPORTED;
}

export function canReverseSettlementLine(status: SettlementLineStatus) {
  return status === SettlementLineStatus.EXPORTED || status === SettlementLineStatus.PAID;
}
