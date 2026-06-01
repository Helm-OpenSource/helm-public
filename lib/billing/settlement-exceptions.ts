import {
  ParticipantPortalAccessStatus,
  PayoutProfileStatus,
  RevenueBeneficiaryType,
  RevenueSourceType,
  SettlementLineStatus,
} from "@prisma/client";
import { beneficiarySupportsPayoutProfile } from "@/lib/billing/manual-settlement";

export type SettlementExceptionType =
  | "MISSING_PAYOUT_PROFILE"
  | "INACTIVE_PAYOUT_PROFILE"
  | "SUSPENDED_PARTICIPANT_ACCESS"
  | "ARCHIVED_PARTICIPANT_ACCESS"
  | "EXPORTED_NOT_SETTLED"
  | "PAID_WITHOUT_EXPORT";

export type SettlementExceptionNextMove =
  | "ADD_OR_REACTIVATE_PAYOUT_PROFILE"
  | "RESTORE_PARTICIPANT_ACCESS"
  | "COMPLETE_EXPORTED_LINES"
  | "AUDIT_PAID_WITHOUT_EXPORT";

export type SettlementExceptionEntry = {
  key: string;
  type: SettlementExceptionType;
  batchKey: string | null;
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryLabel: string;
  sourceType: RevenueSourceType | null;
  lineStatus: SettlementLineStatus | null;
  detail: string;
  daysOpen: number | null;
};

export type SettlementReversalEntry = {
  key: string;
  batchKey: string | null;
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryLabel: string;
  sourceType: RevenueSourceType;
  reversedAt: Date | null;
  reversalReason: string | null;
  notes: string | null;
};

export type SettlementExceptionSummary = {
  openExceptionCount: number;
  payoutProfileExceptionCount: number;
  participantAccessExceptionCount: number;
  exportedUnsettledCount: number;
  paidWithoutExportCount: number;
  reversalCount: number;
  openExceptions: SettlementExceptionEntry[];
  recentReversals: SettlementReversalEntry[];
  nextMoves: SettlementExceptionNextMove[];
};

type ParticipantPortalAccessLike = {
  status: ParticipantPortalAccessStatus;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
};

type PayoutProfileLike = {
  id: string;
  status: PayoutProfileStatus;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
};

type SettlementBatchLineLike = {
  id: string;
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryLabel: string;
  sourceType: RevenueSourceType;
  status: SettlementLineStatus;
  exportedAt: Date | null;
  paidAt: Date | null;
  reversedAt: Date | null;
  notes: string | null;
  payoutLedger: {
    workerPublisherProfileId: string | null;
    salesReferralId: string | null;
    customEngagementId: string | null;
    revenueAttributionLedger: {
      reversalReason: string | null;
    };
  };
  beneficiaryPayoutProfile: PayoutProfileLike | null;
};

type SettlementBatchLike = {
  batchKey: string;
  lines: SettlementBatchLineLike[];
};

function getBeneficiaryReferenceKey(input: {
  beneficiaryType: RevenueBeneficiaryType;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
}) {
  if (input.beneficiaryType === RevenueBeneficiaryType.WORKER_PUBLISHER) {
    return input.workerPublisherProfileId;
  }

  if (input.beneficiaryType === RevenueBeneficiaryType.SALES_REFERRAL) {
    return input.salesReferralId;
  }

  if (input.beneficiaryType === RevenueBeneficiaryType.CUSTOM_SERVICES) {
    return input.customEngagementId;
  }

  return null;
}

function buildBeneficiaryKey(input: {
  beneficiaryType: RevenueBeneficiaryType;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
}) {
  return `${input.beneficiaryType}:${getBeneficiaryReferenceKey(input) ?? "unknown"}`;
}

function daysSince(input: Date, now: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((now.getTime() - input.getTime()) / msPerDay));
}

export function buildSettlementExceptionSummary(input: {
  currentBatch: SettlementBatchLike | null;
  settlementBatches: SettlementBatchLike[];
  payoutProfiles: PayoutProfileLike[];
  participantPortalAccesses: ParticipantPortalAccessLike[];
  now?: Date;
}): SettlementExceptionSummary {
  const now = input.now ?? new Date();
  const openExceptions: SettlementExceptionEntry[] = [];
  const recentReversals: SettlementReversalEntry[] = [];

  const participantAccessLookup = new Map(
    input.participantPortalAccesses.map((access) => [
      buildBeneficiaryKey({
        beneficiaryType:
          access.workerPublisherProfileId !== null
            ? RevenueBeneficiaryType.WORKER_PUBLISHER
            : access.salesReferralId !== null
              ? RevenueBeneficiaryType.SALES_REFERRAL
              : RevenueBeneficiaryType.CUSTOM_SERVICES,
        workerPublisherProfileId: access.workerPublisherProfileId,
        salesReferralId: access.salesReferralId,
        customEngagementId: access.customEngagementId,
      }),
      access,
    ]),
  );

  if (input.currentBatch) {
    for (const line of input.currentBatch.lines) {
      const beneficiaryKey = buildBeneficiaryKey({
        beneficiaryType: line.beneficiaryType,
        workerPublisherProfileId: line.payoutLedger.workerPublisherProfileId,
        salesReferralId: line.payoutLedger.salesReferralId,
        customEngagementId: line.payoutLedger.customEngagementId,
      });
      const participantAccess = participantAccessLookup.get(beneficiaryKey);

      if (beneficiarySupportsPayoutProfile(line.beneficiaryType) && !line.beneficiaryPayoutProfile) {
        openExceptions.push({
          key: `${line.id}:missing-profile`,
          type: "MISSING_PAYOUT_PROFILE",
          batchKey: input.currentBatch.batchKey,
          beneficiaryType: line.beneficiaryType,
          beneficiaryLabel: line.beneficiaryLabel,
          sourceType: line.sourceType,
          lineStatus: line.status,
          detail: "Current batch line does not have a linked payout profile.",
          daysOpen: null,
        });
      } else if (line.beneficiaryPayoutProfile && line.beneficiaryPayoutProfile.status !== PayoutProfileStatus.ACTIVE) {
        openExceptions.push({
          key: `${line.id}:inactive-profile`,
          type: "INACTIVE_PAYOUT_PROFILE",
          batchKey: input.currentBatch.batchKey,
          beneficiaryType: line.beneficiaryType,
          beneficiaryLabel: line.beneficiaryLabel,
          sourceType: line.sourceType,
          lineStatus: line.status,
          detail: "Linked payout profile is not active for the current batch line.",
          daysOpen: null,
        });
      }

      if (participantAccess?.status === ParticipantPortalAccessStatus.SUSPENDED) {
        openExceptions.push({
          key: `${line.id}:suspended-access`,
          type: "SUSPENDED_PARTICIPANT_ACCESS",
          batchKey: input.currentBatch.batchKey,
          beneficiaryType: line.beneficiaryType,
          beneficiaryLabel: line.beneficiaryLabel,
          sourceType: line.sourceType,
          lineStatus: line.status,
          detail: "Beneficiary participant access is suspended and should be reviewed before settlement continues.",
          daysOpen: participantAccess.status === ParticipantPortalAccessStatus.SUSPENDED && line.exportedAt
            ? daysSince(line.exportedAt, now)
            : null,
        });
      }

      if (participantAccess?.status === ParticipantPortalAccessStatus.ARCHIVED) {
        openExceptions.push({
          key: `${line.id}:archived-access`,
          type: "ARCHIVED_PARTICIPANT_ACCESS",
          batchKey: input.currentBatch.batchKey,
          beneficiaryType: line.beneficiaryType,
          beneficiaryLabel: line.beneficiaryLabel,
          sourceType: line.sourceType,
          lineStatus: line.status,
          detail: "Beneficiary participant access is archived and should be restored or reissued before settlement continues.",
          daysOpen: null,
        });
      }
    }
  }

  for (const batch of input.settlementBatches) {
    for (const line of batch.lines) {
      if (line.status === SettlementLineStatus.EXPORTED) {
        openExceptions.push({
          key: `${line.id}:exported-open`,
          type: "EXPORTED_NOT_SETTLED",
          batchKey: batch.batchKey,
          beneficiaryType: line.beneficiaryType,
          beneficiaryLabel: line.beneficiaryLabel,
          sourceType: line.sourceType,
          lineStatus: line.status,
          detail: "Exported line still needs a manual paid or reversed update.",
          daysOpen: line.exportedAt ? daysSince(line.exportedAt, now) : null,
        });
      }

      if (line.status === SettlementLineStatus.PAID && !line.exportedAt) {
        openExceptions.push({
          key: `${line.id}:paid-without-export`,
          type: "PAID_WITHOUT_EXPORT",
          batchKey: batch.batchKey,
          beneficiaryType: line.beneficiaryType,
          beneficiaryLabel: line.beneficiaryLabel,
          sourceType: line.sourceType,
          lineStatus: line.status,
          detail: "Paid line has no exported evidence and should be audited.",
          daysOpen: line.paidAt ? daysSince(line.paidAt, now) : null,
        });
      }

      if (line.status === SettlementLineStatus.REVERSED) {
        recentReversals.push({
          key: `${line.id}:reversal`,
          batchKey: batch.batchKey,
          beneficiaryType: line.beneficiaryType,
          beneficiaryLabel: line.beneficiaryLabel,
          sourceType: line.sourceType,
          reversedAt: line.reversedAt,
          reversalReason: line.payoutLedger.revenueAttributionLedger.reversalReason,
          notes: line.notes,
        });
      }
    }
  }

  recentReversals.sort((left, right) => {
    const leftTime = left.reversedAt?.getTime() ?? 0;
    const rightTime = right.reversedAt?.getTime() ?? 0;
    return rightTime - leftTime;
  });

  const payoutProfileExceptionCount = openExceptions.filter(
    (item) => item.type === "MISSING_PAYOUT_PROFILE" || item.type === "INACTIVE_PAYOUT_PROFILE",
  ).length;
  const participantAccessExceptionCount = openExceptions.filter(
    (item) =>
      item.type === "SUSPENDED_PARTICIPANT_ACCESS" || item.type === "ARCHIVED_PARTICIPANT_ACCESS",
  ).length;
  const exportedUnsettledCount = openExceptions.filter(
    (item) => item.type === "EXPORTED_NOT_SETTLED",
  ).length;
  const paidWithoutExportCount = openExceptions.filter(
    (item) => item.type === "PAID_WITHOUT_EXPORT",
  ).length;

  const nextMoves: SettlementExceptionNextMove[] = [];

  if (payoutProfileExceptionCount > 0) {
    nextMoves.push("ADD_OR_REACTIVATE_PAYOUT_PROFILE");
  }

  if (participantAccessExceptionCount > 0) {
    nextMoves.push("RESTORE_PARTICIPANT_ACCESS");
  }

  if (exportedUnsettledCount > 0) {
    nextMoves.push("COMPLETE_EXPORTED_LINES");
  }

  if (paidWithoutExportCount > 0) {
    nextMoves.push("AUDIT_PAID_WITHOUT_EXPORT");
  }

  return {
    openExceptionCount: openExceptions.length,
    payoutProfileExceptionCount,
    participantAccessExceptionCount,
    exportedUnsettledCount,
    paidWithoutExportCount,
    reversalCount: recentReversals.length,
    openExceptions,
    recentReversals,
    nextMoves,
  };
}
