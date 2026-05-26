import {
  ParticipantPortalAccessStatus,
  PayoutProfileStatus,
  RevenueBeneficiaryType,
  SettlementBatchStatus,
  SettlementLineStatus,
} from "@prisma/client";
import { beneficiarySupportsPayoutProfile } from "@/lib/billing/manual-settlement";
import {
  hasExportBackedSettlementCompletionEvidence,
  hasExportBackedSettlementReversalEvidence,
  hasPaidWithoutExportSettlementAnomaly,
} from "@/lib/billing/settlement-evidence";

export type PayoutRailReadinessStatus = "NOT_READY" | "CONDITIONAL_GO" | "READY_FOR_NARROW_PILOT";

export type PayoutRailReadinessBlocker =
  | "NO_ACTIVE_PAYOUT_PROFILES"
  | "NO_SETTLEMENT_BATCH_HISTORY"
  | "NO_EXPORTED_OR_CLOSED_BATCH_HISTORY"
  | "CURRENT_BATCH_MISSING_PAYOUT_PROFILES";

export type PayoutRailReadinessWatchpoint =
  | "NO_MANUAL_COMPLETION_EVIDENCE"
  | "NO_INVITED_OR_ACTIVE_PARTICIPANTS"
  | "NO_REVERSAL_EVIDENCE"
  | "PAID_WITHOUT_EXPORT_ANOMALIES";

export type PayoutRailReadinessSummary = {
  status: PayoutRailReadinessStatus;
  activePayoutProfileCount: number;
  settlementBatchCount: number;
  exportedBatchCount: number;
  closedBatchCount: number;
  exportedOrClosedBatchCount: number;
  manualCompletionCount: number;
  paidWithoutExportCount: number;
  reversalCount: number;
  invitedParticipantCount: number;
  activeParticipantCount: number;
  invitedOrActiveParticipantCount: number;
  currentBatchLineCount: number;
  currentBatchMissingProfileCount: number;
  blockers: PayoutRailReadinessBlocker[];
  watchpoints: PayoutRailReadinessWatchpoint[];
};

type PayoutProfileLike = {
  status: PayoutProfileStatus;
};

type SettlementLineLike = {
  status: SettlementLineStatus;
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryPayoutProfile: { status: PayoutProfileStatus } | null;
  exportedAt?: Date | null;
};

type SettlementBatchLike = {
  status: SettlementBatchStatus;
  lines: SettlementLineLike[];
};

type ParticipantPortalAccessLike = {
  status: ParticipantPortalAccessStatus;
};

export function buildPayoutRailReadinessSummary(input: {
  payoutProfiles: PayoutProfileLike[];
  settlementBatches: SettlementBatchLike[];
  currentBatch: { lines: SettlementLineLike[] } | null;
  participantPortalAccesses: ParticipantPortalAccessLike[];
}): PayoutRailReadinessSummary {
  const activePayoutProfileCount = input.payoutProfiles.filter(
    (profile) => profile.status === PayoutProfileStatus.ACTIVE,
  ).length;
  const settlementBatchCount = input.settlementBatches.length;
  const exportedBatchCount = input.settlementBatches.filter(
    (batch) => batch.status === SettlementBatchStatus.EXPORTED,
  ).length;
  const closedBatchCount = input.settlementBatches.filter(
    (batch) => batch.status === SettlementBatchStatus.CLOSED,
  ).length;
  const exportedOrClosedBatchCount = exportedBatchCount + closedBatchCount;
  const allSettlementLines = input.settlementBatches.flatMap((batch) => batch.lines);
  const manualCompletionCount = allSettlementLines.filter((line) =>
    hasExportBackedSettlementCompletionEvidence(line),
  ).length;
  const paidWithoutExportCount = allSettlementLines.filter((line) =>
    hasPaidWithoutExportSettlementAnomaly(line),
  ).length;
  const reversalCount = allSettlementLines.filter((line) =>
    hasExportBackedSettlementReversalEvidence(line),
  ).length;
  const invitedParticipantCount = input.participantPortalAccesses.filter(
    (access) => access.status === ParticipantPortalAccessStatus.INVITED,
  ).length;
  const activeParticipantCount = input.participantPortalAccesses.filter(
    (access) => access.status === ParticipantPortalAccessStatus.ACTIVE,
  ).length;
  const invitedOrActiveParticipantCount = invitedParticipantCount + activeParticipantCount;
  const currentBatchLineCount = input.currentBatch?.lines.length ?? 0;
  const currentBatchMissingProfileCount =
    input.currentBatch?.lines.filter(
      (line) =>
        beneficiarySupportsPayoutProfile(line.beneficiaryType) &&
        (!line.beneficiaryPayoutProfile ||
          line.beneficiaryPayoutProfile.status !== PayoutProfileStatus.ACTIVE),
    ).length ?? 0;

  const blockers: PayoutRailReadinessBlocker[] = [];
  const watchpoints: PayoutRailReadinessWatchpoint[] = [];

  if (activePayoutProfileCount === 0) {
    blockers.push("NO_ACTIVE_PAYOUT_PROFILES");
  }

  if (settlementBatchCount === 0) {
    blockers.push("NO_SETTLEMENT_BATCH_HISTORY");
  }

  if (exportedOrClosedBatchCount === 0) {
    blockers.push("NO_EXPORTED_OR_CLOSED_BATCH_HISTORY");
  }

  if (currentBatchMissingProfileCount > 0) {
    blockers.push("CURRENT_BATCH_MISSING_PAYOUT_PROFILES");
  }

  if (manualCompletionCount === 0) {
    watchpoints.push("NO_MANUAL_COMPLETION_EVIDENCE");
  }

  if (invitedOrActiveParticipantCount === 0) {
    watchpoints.push("NO_INVITED_OR_ACTIVE_PARTICIPANTS");
  }

  if (reversalCount === 0) {
    watchpoints.push("NO_REVERSAL_EVIDENCE");
  }

  if (paidWithoutExportCount > 0) {
    watchpoints.push("PAID_WITHOUT_EXPORT_ANOMALIES");
  }

  const status: PayoutRailReadinessStatus =
    blockers.length > 0
      ? "NOT_READY"
      : watchpoints.includes("NO_MANUAL_COMPLETION_EVIDENCE") ||
          watchpoints.includes("NO_INVITED_OR_ACTIVE_PARTICIPANTS") ||
          watchpoints.includes("PAID_WITHOUT_EXPORT_ANOMALIES")
        ? "CONDITIONAL_GO"
        : "READY_FOR_NARROW_PILOT";

  return {
    status,
    activePayoutProfileCount,
    settlementBatchCount,
    exportedBatchCount,
    closedBatchCount,
    exportedOrClosedBatchCount,
    manualCompletionCount,
    paidWithoutExportCount,
    reversalCount,
    invitedParticipantCount,
    activeParticipantCount,
    invitedOrActiveParticipantCount,
    currentBatchLineCount,
    currentBatchMissingProfileCount,
    blockers,
    watchpoints,
  };
}
