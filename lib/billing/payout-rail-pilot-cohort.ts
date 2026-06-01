import {
  ParticipantPortalAccessStatus,
  PayoutProfileStatus,
  RevenueBeneficiaryType,
  RevenueLedgerStatus,
  SettlementBatchStatus,
  SettlementLineStatus,
} from "@prisma/client";
import type { PaymentRegion } from "@/lib/billing/payment-providers";
import type { PayoutRailReadinessSummary } from "@/lib/billing/payout-rail-readiness";
import type { SettlementExceptionSummary } from "@/lib/billing/settlement-exceptions";
import {
  hasExportBackedSettlementCompletionEvidence,
  hasExportBackedSettlementReversalEvidence,
} from "@/lib/billing/settlement-evidence";

const PILOT_BENEFICIARY_TYPES = [
  RevenueBeneficiaryType.WORKER_PUBLISHER,
  RevenueBeneficiaryType.CUSTOM_SERVICES,
  RevenueBeneficiaryType.SALES_REFERRAL,
] as const;

export type PayoutRailPilotCohortStatus =
  | "HOLD_MANUAL"
  | "READY_TO_SELECT_COHORT"
  | "READY_FOR_OPERATOR_DRY_RUN";

export type PayoutRailPilotChecklistKey =
  | "READINESS_GATE_GREEN"
  | "CN_ONLY_SCOPE"
  | "SINGLE_BENEFICIARY_CLASS"
  | "SINGLE_PAYOUT_METHOD"
  | "SINGLE_CURRENCY"
  | "FULL_PAYOUT_PROFILE_COVERAGE"
  | "FULL_PARTICIPANT_ACCESS_COVERAGE"
  | "TWO_SETTLEMENT_CYCLES"
  | "COMPLETION_AND_REVERSAL_EVIDENCE"
  | "NO_OPEN_EXCEPTIONS";

export type PayoutRailPilotNextMove =
  | "KEEP_MANUAL_SETTLEMENT"
  | "CHOOSE_ONE_BENEFICIARY_CLASS"
  | "NORMALIZE_PAYOUT_METHOD_SCOPE"
  | "CAPTURE_SECOND_SETTLEMENT_CYCLE"
  | "CLEAR_OPEN_EXCEPTIONS"
  | "RUN_OFF_PLATFORM_DRY_RUN";

export type PayoutRailPilotCandidate = {
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryCount: number;
  payoutEntryCount: number;
  coveredByActivePayoutProfileCount: number;
  missingPayoutProfileCount: number;
  coveredByParticipantAccessCount: number;
  missingParticipantAccessCount: number;
  payoutMethodLabels: string[];
  currencyLabels: string[];
  exportedOrClosedBatchCount: number;
  manualCompletionCount: number;
  reversalCount: number;
  openExceptionCount: number;
  qualifiesForDryRun: boolean;
};

export type PayoutRailPilotCohortSummary = {
  status: PayoutRailPilotCohortStatus;
  eligibleCohortCount: number;
  readyCohortCount: number;
  recommendedBeneficiaryType: RevenueBeneficiaryType | null;
  recommendedPayoutMethodLabel: string | null;
  recommendedCurrency: string | null;
  candidateCohorts: PayoutRailPilotCandidate[];
  checklist: Array<{
    key: PayoutRailPilotChecklistKey;
    passed: boolean;
  }>;
  nextMoves: PayoutRailPilotNextMove[];
  dryRunExportFields: string[];
  noGoTriggers: string[];
};

type PayoutEntryLike = {
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryLabel: string;
  status: RevenueLedgerStatus;
  currency: string;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
};

type PayoutProfileLike = {
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryReference: string;
  status: PayoutProfileStatus;
  payoutMethodLabel: string;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
};

type ParticipantPortalAccessLike = {
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryReference: string;
  status: ParticipantPortalAccessStatus;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
};

type SettlementBatchLike = {
  status: SettlementBatchStatus;
  currency: string;
  lines: Array<{
    beneficiaryType: RevenueBeneficiaryType;
    status: SettlementLineStatus;
    currency: string;
    exportedAt?: Date | null;
  }>;
};

function isPilotBeneficiaryType(type: RevenueBeneficiaryType) {
  return PILOT_BENEFICIARY_TYPES.includes(type as (typeof PILOT_BENEFICIARY_TYPES)[number]);
}

function getBeneficiaryReference(input: {
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryLabel: string;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
}) {
  if (input.beneficiaryType === RevenueBeneficiaryType.WORKER_PUBLISHER) {
    return input.workerPublisherProfileId ?? input.beneficiaryLabel;
  }

  if (input.beneficiaryType === RevenueBeneficiaryType.SALES_REFERRAL) {
    return input.salesReferralId ?? input.beneficiaryLabel;
  }

  if (input.beneficiaryType === RevenueBeneficiaryType.CUSTOM_SERVICES) {
    return input.customEngagementId ?? input.beneficiaryLabel;
  }

  return input.beneficiaryLabel;
}

function sortByPilotPriority(a: PayoutRailPilotCandidate, b: PayoutRailPilotCandidate) {
  if (a.qualifiesForDryRun !== b.qualifiesForDryRun) {
    return a.qualifiesForDryRun ? -1 : 1;
  }

  if (a.openExceptionCount !== b.openExceptionCount) {
    return a.openExceptionCount - b.openExceptionCount;
  }

  if (a.missingPayoutProfileCount !== b.missingPayoutProfileCount) {
    return a.missingPayoutProfileCount - b.missingPayoutProfileCount;
  }

  if (a.missingParticipantAccessCount !== b.missingParticipantAccessCount) {
    return a.missingParticipantAccessCount - b.missingParticipantAccessCount;
  }

  if (a.exportedOrClosedBatchCount !== b.exportedOrClosedBatchCount) {
    return b.exportedOrClosedBatchCount - a.exportedOrClosedBatchCount;
  }

  if (a.manualCompletionCount !== b.manualCompletionCount) {
    return b.manualCompletionCount - a.manualCompletionCount;
  }

  return b.beneficiaryCount - a.beneficiaryCount;
}

export function buildPayoutRailPilotCohortSummary(input: {
  paymentRegion: PaymentRegion;
  payoutRailReadiness: PayoutRailReadinessSummary;
  settlementExceptionSummary: SettlementExceptionSummary;
  payoutEntries: PayoutEntryLike[];
  payoutProfiles: PayoutProfileLike[];
  participantPortalAccesses: ParticipantPortalAccessLike[];
  settlementBatches: SettlementBatchLike[];
}): PayoutRailPilotCohortSummary {
  const candidateMaps = new Map<
    RevenueBeneficiaryType,
    {
      beneficiaryKeys: Set<string>;
      payoutEntryCount: number;
      activePayoutProfileKeys: Set<string>;
      payoutMethodLabels: Set<string>;
      participantAccessKeys: Set<string>;
      currencyLabels: Set<string>;
      exportedOrClosedBatchKeys: Set<string>;
      manualCompletionCount: number;
      reversalCount: number;
      openExceptionCount: number;
    }
  >();

  for (const type of PILOT_BENEFICIARY_TYPES) {
    candidateMaps.set(type, {
      beneficiaryKeys: new Set<string>(),
      payoutEntryCount: 0,
      activePayoutProfileKeys: new Set<string>(),
      payoutMethodLabels: new Set<string>(),
      participantAccessKeys: new Set<string>(),
      currencyLabels: new Set<string>(),
      exportedOrClosedBatchKeys: new Set<string>(),
      manualCompletionCount: 0,
      reversalCount: 0,
      openExceptionCount: 0,
    });
  }

  for (const entry of input.payoutEntries) {
    if (!isPilotBeneficiaryType(entry.beneficiaryType) || entry.status === RevenueLedgerStatus.REVERSED) {
      continue;
    }

    const candidate = candidateMaps.get(entry.beneficiaryType);
    if (!candidate) continue;

    candidate.payoutEntryCount += 1;
    candidate.currencyLabels.add(entry.currency);
    candidate.beneficiaryKeys.add(getBeneficiaryReference(entry));
  }

  for (const profile of input.payoutProfiles) {
    if (!isPilotBeneficiaryType(profile.beneficiaryType) || profile.status !== PayoutProfileStatus.ACTIVE) {
      continue;
    }

    const candidate = candidateMaps.get(profile.beneficiaryType);
    if (!candidate) continue;

    candidate.activePayoutProfileKeys.add(profile.beneficiaryReference);
    candidate.payoutMethodLabels.add(profile.payoutMethodLabel);
  }

  for (const access of input.participantPortalAccesses) {
    if (
      !isPilotBeneficiaryType(access.beneficiaryType) ||
      (access.status !== ParticipantPortalAccessStatus.INVITED &&
        access.status !== ParticipantPortalAccessStatus.ACTIVE)
    ) {
      continue;
    }

    const candidate = candidateMaps.get(access.beneficiaryType);
    if (!candidate) continue;

    candidate.participantAccessKeys.add(access.beneficiaryReference);
  }

  input.settlementBatches.forEach((batch, batchIndex) => {
    const batchKey = `${batch.status}:${batchIndex}`;
    const exportedOrClosed =
      batch.status === SettlementBatchStatus.EXPORTED || batch.status === SettlementBatchStatus.CLOSED;

    for (const line of batch.lines) {
      if (!isPilotBeneficiaryType(line.beneficiaryType)) {
        continue;
      }

      const candidate = candidateMaps.get(line.beneficiaryType);
      if (!candidate) continue;

      candidate.currencyLabels.add(line.currency || batch.currency);

      if (exportedOrClosed) {
        candidate.exportedOrClosedBatchKeys.add(batchKey);
      }

      if (hasExportBackedSettlementCompletionEvidence(line)) {
        candidate.manualCompletionCount += 1;
      }

      if (hasExportBackedSettlementReversalEvidence(line)) {
        candidate.reversalCount += 1;
      }
    }
  });

  for (const exception of input.settlementExceptionSummary.openExceptions) {
    if (!isPilotBeneficiaryType(exception.beneficiaryType)) {
      continue;
    }

    const candidate = candidateMaps.get(exception.beneficiaryType);
    if (!candidate) continue;

    candidate.openExceptionCount += 1;
  }

  const candidateCohorts = Array.from(candidateMaps.entries())
    .map(([beneficiaryType, candidate]): PayoutRailPilotCandidate => {
      const beneficiaryCount = candidate.beneficiaryKeys.size;
      const coveredByActivePayoutProfileCount = Array.from(candidate.beneficiaryKeys).filter((key) =>
        candidate.activePayoutProfileKeys.has(key),
      ).length;
      const coveredByParticipantAccessCount = Array.from(candidate.beneficiaryKeys).filter((key) =>
        candidate.participantAccessKeys.has(key),
      ).length;
      const payoutMethodLabels = Array.from(candidate.payoutMethodLabels).sort();
      const currencyLabels = Array.from(candidate.currencyLabels).sort();
      const qualifiesForDryRun =
        input.payoutRailReadiness.status === "READY_FOR_NARROW_PILOT" &&
        input.paymentRegion === "CN" &&
        beneficiaryCount > 0 &&
        payoutMethodLabels.length === 1 &&
        currencyLabels.length === 1 &&
        currencyLabels[0] === "CNY" &&
        coveredByActivePayoutProfileCount === beneficiaryCount &&
        coveredByParticipantAccessCount === beneficiaryCount &&
        candidate.exportedOrClosedBatchKeys.size >= 2 &&
        candidate.manualCompletionCount > 0 &&
        candidate.reversalCount > 0 &&
        candidate.openExceptionCount === 0;

      return {
        beneficiaryType,
        beneficiaryCount,
        payoutEntryCount: candidate.payoutEntryCount,
        coveredByActivePayoutProfileCount,
        missingPayoutProfileCount: Math.max(beneficiaryCount - coveredByActivePayoutProfileCount, 0),
        coveredByParticipantAccessCount,
        missingParticipantAccessCount: Math.max(
          beneficiaryCount - coveredByParticipantAccessCount,
          0,
        ),
        payoutMethodLabels,
        currencyLabels,
        exportedOrClosedBatchCount: candidate.exportedOrClosedBatchKeys.size,
        manualCompletionCount: candidate.manualCompletionCount,
        reversalCount: candidate.reversalCount,
        openExceptionCount: candidate.openExceptionCount,
        qualifiesForDryRun,
      };
    })
    .filter((candidate) => candidate.beneficiaryCount > 0)
    .sort(sortByPilotPriority);

  const readyCandidates = candidateCohorts.filter((candidate) => candidate.qualifiesForDryRun);
  const recommendedCandidate = candidateCohorts[0] ?? null;

  const status: PayoutRailPilotCohortStatus =
    input.payoutRailReadiness.status !== "READY_FOR_NARROW_PILOT" || readyCandidates.length === 0
      ? "HOLD_MANUAL"
      : readyCandidates.length === 1
        ? "READY_FOR_OPERATOR_DRY_RUN"
        : "READY_TO_SELECT_COHORT";

  const checklist = [
    {
      key: "READINESS_GATE_GREEN" as const,
      passed: input.payoutRailReadiness.status === "READY_FOR_NARROW_PILOT",
    },
    {
      key: "CN_ONLY_SCOPE" as const,
      passed: input.paymentRegion === "CN",
    },
    {
      key: "SINGLE_BENEFICIARY_CLASS" as const,
      passed: readyCandidates.length === 1,
    },
    {
      key: "SINGLE_PAYOUT_METHOD" as const,
      passed: Boolean(recommendedCandidate && recommendedCandidate.payoutMethodLabels.length === 1),
    },
    {
      key: "SINGLE_CURRENCY" as const,
      passed: Boolean(
        recommendedCandidate &&
          recommendedCandidate.currencyLabels.length === 1 &&
          recommendedCandidate.currencyLabels[0] === "CNY",
      ),
    },
    {
      key: "FULL_PAYOUT_PROFILE_COVERAGE" as const,
      passed: Boolean(recommendedCandidate && recommendedCandidate.missingPayoutProfileCount === 0),
    },
    {
      key: "FULL_PARTICIPANT_ACCESS_COVERAGE" as const,
      passed: Boolean(recommendedCandidate && recommendedCandidate.missingParticipantAccessCount === 0),
    },
    {
      key: "TWO_SETTLEMENT_CYCLES" as const,
      passed: Boolean(recommendedCandidate && recommendedCandidate.exportedOrClosedBatchCount >= 2),
    },
    {
      key: "COMPLETION_AND_REVERSAL_EVIDENCE" as const,
      passed: Boolean(
        recommendedCandidate &&
          recommendedCandidate.manualCompletionCount > 0 &&
          recommendedCandidate.reversalCount > 0,
      ),
    },
    {
      key: "NO_OPEN_EXCEPTIONS" as const,
      passed: Boolean(recommendedCandidate && recommendedCandidate.openExceptionCount === 0),
    },
  ];

  const nextMoves: PayoutRailPilotNextMove[] = [];

  if (status === "HOLD_MANUAL") {
    nextMoves.push("KEEP_MANUAL_SETTLEMENT");
  }

  if (readyCandidates.length > 1) {
    nextMoves.push("CHOOSE_ONE_BENEFICIARY_CLASS");
  }

  if (recommendedCandidate && recommendedCandidate.payoutMethodLabels.length > 1) {
    nextMoves.push("NORMALIZE_PAYOUT_METHOD_SCOPE");
  }

  if (recommendedCandidate && recommendedCandidate.exportedOrClosedBatchCount < 2) {
    nextMoves.push("CAPTURE_SECOND_SETTLEMENT_CYCLE");
  }

  if (recommendedCandidate && recommendedCandidate.openExceptionCount > 0) {
    nextMoves.push("CLEAR_OPEN_EXCEPTIONS");
  }

  if (status === "READY_FOR_OPERATOR_DRY_RUN") {
    nextMoves.push("RUN_OFF_PLATFORM_DRY_RUN");
  }

  return {
    status,
    eligibleCohortCount: candidateCohorts.length,
    readyCohortCount: readyCandidates.length,
    recommendedBeneficiaryType: recommendedCandidate?.beneficiaryType ?? null,
    recommendedPayoutMethodLabel:
      recommendedCandidate?.payoutMethodLabels.length === 1
        ? recommendedCandidate.payoutMethodLabels[0]
        : null,
    recommendedCurrency:
      recommendedCandidate?.currencyLabels.length === 1 ? recommendedCandidate.currencyLabels[0] : null,
    candidateCohorts,
    checklist,
    nextMoves,
    dryRunExportFields: [
      "beneficiary",
      "beneficiary type",
      "source type",
      "amount",
      "status",
      "notes/reference",
    ],
    noGoTriggers: [
      "profile mismatch against exported lines",
      "beneficiary scope confusion across classes",
      "exports that cannot be reconciled back into settlement posture",
      "reversal ambiguity that can no longer be handled manually",
    ],
  };
}
