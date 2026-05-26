import { SettlementLineStatus } from "@prisma/client";

type SettlementEvidenceLineLike = {
  status: SettlementLineStatus;
  exportedAt?: Date | null;
};

export function hasExportBackedSettlementCompletionEvidence(line: SettlementEvidenceLineLike) {
  return (
    line.exportedAt != null &&
    (line.status === SettlementLineStatus.PAID || line.status === SettlementLineStatus.REVERSED)
  );
}

export function hasExportBackedSettlementReversalEvidence(line: SettlementEvidenceLineLike) {
  return line.exportedAt != null && line.status === SettlementLineStatus.REVERSED;
}

export function hasPaidWithoutExportSettlementAnomaly(line: SettlementEvidenceLineLike) {
  return line.status === SettlementLineStatus.PAID && line.exportedAt == null;
}
