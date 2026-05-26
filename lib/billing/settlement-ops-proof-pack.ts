import {
  ParticipantPortalAccessStatus,
  PayoutProfileStatus,
  RevenueBeneficiaryType,
  RevenueLedgerStatus,
  SettlementBatchStatus,
  SettlementLineStatus,
} from "@prisma/client";
import { beneficiarySupportsPayoutProfile } from "@/lib/billing/manual-settlement";
import {
  hasExportBackedSettlementCompletionEvidence,
  hasPaidWithoutExportSettlementAnomaly,
} from "@/lib/billing/settlement-evidence";

export type SettlementOpsNextMove =
  | "ADD_ACTIVE_PAYOUT_PROFILES"
  | "ISSUE_PARTICIPANT_ACCESS"
  | "CREATE_FIRST_SETTLEMENT_BATCH"
  | "EXPORT_FIRST_SETTLEMENT_BATCH"
  | "CAPTURE_MANUAL_COMPLETION_EVIDENCE"
  | "AUDIT_PAID_WITHOUT_EXPORT";

export type SettlementOpsBeneficiaryCoverage = {
  key: string;
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryLabel: string;
  hasActivePayoutProfile: boolean;
  hasInvitedOrActiveParticipantAccess: boolean;
};

export type SettlementOpsProofPackSummary = {
  requiredBeneficiaryCount: number;
  coveredByActivePayoutProfileCount: number;
  missingPayoutProfileCount: number;
  coveredByParticipantAccessCount: number;
  missingParticipantAccessCount: number;
  settlementBatchCount: number;
  exportedOrClosedBatchCount: number;
  manualCompletionCount: number;
  paidWithoutExportCount: number;
  missingPayoutProfileBeneficiaries: SettlementOpsBeneficiaryCoverage[];
  missingParticipantAccessBeneficiaries: SettlementOpsBeneficiaryCoverage[];
  nextMoves: SettlementOpsNextMove[];
};

type PayoutEntryLike = {
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryLabel: string;
  status: RevenueLedgerStatus;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
};

type PayoutProfileLike = {
  status: PayoutProfileStatus;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
};

type ParticipantPortalAccessLike = {
  status: ParticipantPortalAccessStatus;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
};

type SettlementBatchLike = {
  status: SettlementBatchStatus;
  lines: Array<{
    status: SettlementLineStatus;
    exportedAt?: Date | null;
  }>;
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

function getCoverageKey(input: {
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryLabel: string;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
}) {
  const reference = getBeneficiaryReferenceKey(input);
  return `${input.beneficiaryType}:${reference ?? input.beneficiaryLabel}`;
}

export function buildSettlementOpsProofPackSummary(input: {
  payoutEntries: PayoutEntryLike[];
  payoutProfiles: PayoutProfileLike[];
  participantPortalAccesses: ParticipantPortalAccessLike[];
  settlementBatches: SettlementBatchLike[];
}): SettlementOpsProofPackSummary {
  const requiredBeneficiaries = new Map<string, SettlementOpsBeneficiaryCoverage>();

  for (const entry of input.payoutEntries) {
    if (!beneficiarySupportsPayoutProfile(entry.beneficiaryType)) {
      continue;
    }

    if (entry.status === RevenueLedgerStatus.REVERSED) {
      continue;
    }

    const key = getCoverageKey(entry);

    requiredBeneficiaries.set(key, {
      key,
      beneficiaryType: entry.beneficiaryType,
      beneficiaryLabel: entry.beneficiaryLabel,
      hasActivePayoutProfile: false,
      hasInvitedOrActiveParticipantAccess: false,
    });
  }

  const payoutProfileKeys = new Set(
    input.payoutProfiles
      .filter((profile) => profile.status === PayoutProfileStatus.ACTIVE)
      .map((profile) =>
        getCoverageKey({
          beneficiaryType:
            profile.workerPublisherProfileId !== null
              ? RevenueBeneficiaryType.WORKER_PUBLISHER
              : profile.salesReferralId !== null
                ? RevenueBeneficiaryType.SALES_REFERRAL
                : RevenueBeneficiaryType.CUSTOM_SERVICES,
          beneficiaryLabel: "",
          workerPublisherProfileId: profile.workerPublisherProfileId,
          salesReferralId: profile.salesReferralId,
          customEngagementId: profile.customEngagementId,
        }),
      ),
  );

  const participantAccessKeys = new Set(
    input.participantPortalAccesses
      .filter(
        (access) =>
          access.status === ParticipantPortalAccessStatus.INVITED ||
          access.status === ParticipantPortalAccessStatus.ACTIVE,
      )
      .map((access) =>
        getCoverageKey({
          beneficiaryType:
            access.workerPublisherProfileId !== null
              ? RevenueBeneficiaryType.WORKER_PUBLISHER
              : access.salesReferralId !== null
                ? RevenueBeneficiaryType.SALES_REFERRAL
                : RevenueBeneficiaryType.CUSTOM_SERVICES,
          beneficiaryLabel: "",
          workerPublisherProfileId: access.workerPublisherProfileId,
          salesReferralId: access.salesReferralId,
          customEngagementId: access.customEngagementId,
        }),
      ),
  );

  for (const [key, beneficiary] of requiredBeneficiaries) {
    beneficiary.hasActivePayoutProfile = payoutProfileKeys.has(key);
    beneficiary.hasInvitedOrActiveParticipantAccess = participantAccessKeys.has(key);
  }

  const coverage = Array.from(requiredBeneficiaries.values());
  const missingPayoutProfileBeneficiaries = coverage.filter(
    (beneficiary) => !beneficiary.hasActivePayoutProfile,
  );
  const missingParticipantAccessBeneficiaries = coverage.filter(
    (beneficiary) => !beneficiary.hasInvitedOrActiveParticipantAccess,
  );

  const exportedOrClosedBatchCount = input.settlementBatches.filter(
    (batch) =>
      batch.status === SettlementBatchStatus.EXPORTED || batch.status === SettlementBatchStatus.CLOSED,
  ).length;
  const manualCompletionCount = input.settlementBatches
    .flatMap((batch) => batch.lines)
    .filter((line) => hasExportBackedSettlementCompletionEvidence(line)).length;
  const paidWithoutExportCount = input.settlementBatches
    .flatMap((batch) => batch.lines)
    .filter((line) => hasPaidWithoutExportSettlementAnomaly(line)).length;

  const nextMoves: SettlementOpsNextMove[] = [];

  if (missingPayoutProfileBeneficiaries.length > 0) {
    nextMoves.push("ADD_ACTIVE_PAYOUT_PROFILES");
  }

  if (missingParticipantAccessBeneficiaries.length > 0) {
    nextMoves.push("ISSUE_PARTICIPANT_ACCESS");
  }

  if (input.settlementBatches.length === 0) {
    nextMoves.push("CREATE_FIRST_SETTLEMENT_BATCH");
  }

  if (input.settlementBatches.length > 0 && exportedOrClosedBatchCount === 0) {
    nextMoves.push("EXPORT_FIRST_SETTLEMENT_BATCH");
  }

  if (manualCompletionCount === 0) {
    nextMoves.push("CAPTURE_MANUAL_COMPLETION_EVIDENCE");
  }

  if (paidWithoutExportCount > 0) {
    nextMoves.push("AUDIT_PAID_WITHOUT_EXPORT");
  }

  return {
    requiredBeneficiaryCount: coverage.length,
    coveredByActivePayoutProfileCount: coverage.filter((beneficiary) => beneficiary.hasActivePayoutProfile)
      .length,
    missingPayoutProfileCount: missingPayoutProfileBeneficiaries.length,
    coveredByParticipantAccessCount: coverage.filter(
      (beneficiary) => beneficiary.hasInvitedOrActiveParticipantAccess,
    ).length,
    missingParticipantAccessCount: missingParticipantAccessBeneficiaries.length,
    settlementBatchCount: input.settlementBatches.length,
    exportedOrClosedBatchCount,
    manualCompletionCount,
    paidWithoutExportCount,
    missingPayoutProfileBeneficiaries,
    missingParticipantAccessBeneficiaries,
    nextMoves,
  };
}
