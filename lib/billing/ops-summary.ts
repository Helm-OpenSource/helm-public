import {
  AccessState,
  MembershipStatus,
  RevenueLedgerStatus,
  RevenueRuleCadence,
  RevenueRuleValueType,
  RevenueSourceType,
  SettlementLineStatus,
  UsageType,
  WorkerEntitlementStatus,
  WorkerEntitlementType,
} from "@prisma/client";
import { getLifecycleBoundarySummary } from "@/lib/billing/lifecycle-boundary";
import { getAdditionalBillableSeatCount } from "@/lib/billing/payment";

export type BillingMembershipLike = {
  status: MembershipStatus;
};

export type BillingWorkerEntitlementLike = {
  workerKey: string;
  entitlementType: WorkerEntitlementType;
  status: WorkerEntitlementStatus;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  internalLimit: number | null;
};

export type BillingUsageSummaryLike = {
  usageType: UsageType;
  quantity: number;
};

export type MembershipLifecycleSummary = {
  activeSeatCount: number;
  invitedSeatCount: number;
  inactiveSeatCount: number;
  includedAdminSeats: number;
  paidIncludedSeatCount: number;
  paidIncludedSeatUsage: number;
  additionalBillableSeats: number;
  trialCollaboratorSeats: number;
  trialCollaboratorSeatsUsed: number;
  trialCollaboratorSeatsRemaining: number;
  trialSeatCapacity: number;
  trialSeatPressureCount: number;
};

export type WorkerEntitlementOpsSummary = {
  includedActiveCount: number;
  addOnMonthlyActiveCount: number;
  addOnPerUseActiveCount: number;
  addOnMonthlyReservedCount: number;
  addOnPerUseReservedCount: number;
  commercialActiveCount: number;
  commercialPathCount: number;
  inactiveEntitlementCount: number;
  futureAddOnReservedCount: number;
  internalLimitCount: number;
  windowedEntitlementCount: number;
};

export type InternalUsageOpsSummary = {
  totalUsageCount: number;
  highCostProcessingCount: number;
  exportCount: number;
  syncCount: number;
  premiumWorkerCount: number;
};

export type RevenueRuleOpsLike = {
  sourceType: RevenueSourceType;
  cadence: RevenueRuleCadence;
  valueType: RevenueRuleValueType;
  reverseOnCancel: boolean;
};

export type RevenueAttributionOpsLike = {
  sourceType: RevenueSourceType;
  attributedAmountCents: number;
  status: RevenueLedgerStatus;
};

export type PayoutOpsLike = {
  payableAmountCents: number;
  status: RevenueLedgerStatus;
};

export type RevenueRuleOpsSummary = {
  totalRuleCount: number;
  recurringRuleCount: number;
  oneTimeRuleCount: number;
  percentRuleCount: number;
  fixedAmountRuleCount: number;
  reversalBackedRuleCount: number;
  sourceTypeCount: number;
};

export type RevenueAttributionOpsSummary = {
  sourceTypeCount: number;
  beneficiaryPendingAmountCents: number;
  pendingCount: number;
  approvedCount: number;
  paidCount: number;
  reversedCount: number;
  pendingPayableAmountCents: number;
  approvedPayableAmountCents: number;
  paidPayableAmountCents: number;
  reversedPayableAmountCents: number;
};

export type SettlementLineOpsLike = {
  sourceType: RevenueSourceType;
  amountCents: number;
  status: SettlementLineStatus;
  hasPayoutProfile: boolean;
  beneficiaryKey: string;
};

export type SettlementLineOpsSummary = {
  totalLineCount: number;
  beneficiaryCount: number;
  sourceTypeCount: number;
  pendingCount: number;
  approvedCount: number;
  exportedCount: number;
  paidCount: number;
  reversedCount: number;
  pendingAmountCents: number;
  approvedAmountCents: number;
  exportedAmountCents: number;
  paidAmountCents: number;
  reversedAmountCents: number;
  missingProfileCount: number;
};

const HIGH_COST_USAGE_TYPES = new Set<UsageType>([
  UsageType.MEETING_PROCESSING,
  UsageType.CAPTURE_PROCESSING,
  UsageType.CRM_IMPORT,
  UsageType.RECOMMENDATION_GENERATION,
  UsageType.BRIEFING_GENERATION,
  UsageType.PREMIUM_WORKER_INVOCATION,
]);

export function buildMembershipLifecycleSummary(input: {
  memberships: BillingMembershipLike[];
  includedAdminSeats: number;
  trialCollaboratorSeats: number;
}) : MembershipLifecycleSummary {
  const activeSeatCount = input.memberships.filter((membership) => membership.status === MembershipStatus.ACTIVE).length;
  const invitedSeatCount = input.memberships.filter((membership) => membership.status === MembershipStatus.INVITED).length;
  const inactiveSeatCount = input.memberships.filter((membership) => membership.status === MembershipStatus.INACTIVE).length;
  const paidIncludedSeatCount = input.includedAdminSeats;
  const paidIncludedSeatUsage = Math.min(activeSeatCount, paidIncludedSeatCount);
  const additionalBillableSeats = getAdditionalBillableSeatCount(activeSeatCount, paidIncludedSeatCount);
  const trialCollaboratorSeatsUsed = Math.max(Math.min(activeSeatCount - paidIncludedSeatCount, input.trialCollaboratorSeats), 0);
  const trialCollaboratorSeatsRemaining = Math.max(input.trialCollaboratorSeats - trialCollaboratorSeatsUsed, 0);
  const trialSeatCapacity = paidIncludedSeatCount + input.trialCollaboratorSeats;
  const trialSeatPressureCount = Math.max(activeSeatCount - trialSeatCapacity, 0);

  return {
    activeSeatCount,
    invitedSeatCount,
    inactiveSeatCount,
    includedAdminSeats: input.includedAdminSeats,
    paidIncludedSeatCount,
    paidIncludedSeatUsage,
    additionalBillableSeats,
    trialCollaboratorSeats: input.trialCollaboratorSeats,
    trialCollaboratorSeatsUsed,
    trialCollaboratorSeatsRemaining,
    trialSeatCapacity,
    trialSeatPressureCount,
  };
}

export function buildWorkerEntitlementOpsSummary(
  entitlements: BillingWorkerEntitlementLike[],
): WorkerEntitlementOpsSummary {
  return entitlements.reduce<WorkerEntitlementOpsSummary>(
    (summary, entitlement) => {
      if (entitlement.entitlementType === WorkerEntitlementType.INCLUDED && entitlement.status === WorkerEntitlementStatus.ACTIVE) {
        summary.includedActiveCount += 1;
      }

      if (entitlement.entitlementType === WorkerEntitlementType.ADD_ON_MONTHLY && entitlement.status === WorkerEntitlementStatus.ACTIVE) {
        summary.addOnMonthlyActiveCount += 1;
        summary.commercialActiveCount += 1;
      }

      if (entitlement.entitlementType === WorkerEntitlementType.ADD_ON_PER_USE && entitlement.status === WorkerEntitlementStatus.ACTIVE) {
        summary.addOnPerUseActiveCount += 1;
        summary.commercialActiveCount += 1;
      }

      if (entitlement.entitlementType !== WorkerEntitlementType.INCLUDED) {
        summary.commercialPathCount += 1;
      }

      if (entitlement.status !== WorkerEntitlementStatus.ACTIVE) {
        summary.inactiveEntitlementCount += 1;
      }

      if (
        entitlement.entitlementType === WorkerEntitlementType.ADD_ON_MONTHLY &&
        entitlement.status === WorkerEntitlementStatus.INACTIVE
      ) {
        summary.addOnMonthlyReservedCount += 1;
      }

      if (
        entitlement.entitlementType === WorkerEntitlementType.ADD_ON_PER_USE &&
        entitlement.status === WorkerEntitlementStatus.INACTIVE
      ) {
        summary.addOnPerUseReservedCount += 1;
      }

      if (
        entitlement.entitlementType !== WorkerEntitlementType.INCLUDED &&
        entitlement.status === WorkerEntitlementStatus.INACTIVE
      ) {
        summary.futureAddOnReservedCount += 1;
      }

      if (entitlement.internalLimit !== null) {
        summary.internalLimitCount += 1;
      }

      if (entitlement.effectiveTo !== null) {
        summary.windowedEntitlementCount += 1;
      }

      return summary;
    },
    {
      includedActiveCount: 0,
      addOnMonthlyActiveCount: 0,
      addOnPerUseActiveCount: 0,
      addOnMonthlyReservedCount: 0,
      addOnPerUseReservedCount: 0,
      commercialActiveCount: 0,
      commercialPathCount: 0,
      inactiveEntitlementCount: 0,
      futureAddOnReservedCount: 0,
      internalLimitCount: 0,
      windowedEntitlementCount: 0,
    },
  );
}

export function buildInternalUsageOpsSummary(rows: BillingUsageSummaryLike[]): InternalUsageOpsSummary {
  return rows.reduce<InternalUsageOpsSummary>(
    (summary, row) => {
      summary.totalUsageCount += row.quantity;

      if (HIGH_COST_USAGE_TYPES.has(row.usageType)) {
        summary.highCostProcessingCount += row.quantity;
      }

      if (row.usageType === UsageType.MEETING_MEMORY_EXPORT) {
        summary.exportCount += row.quantity;
      }

      if (row.usageType === UsageType.CONNECTOR_SYNC) {
        summary.syncCount += row.quantity;
      }

      if (row.usageType === UsageType.PREMIUM_WORKER_INVOCATION) {
        summary.premiumWorkerCount += row.quantity;
      }

      return summary;
    },
    {
      totalUsageCount: 0,
      highCostProcessingCount: 0,
      exportCount: 0,
      syncCount: 0,
      premiumWorkerCount: 0,
    },
  );
}

export function buildRevenueRuleOpsSummary(rules: RevenueRuleOpsLike[]): RevenueRuleOpsSummary {
  const distinctSources = new Set<RevenueSourceType>();

  return rules.reduce<RevenueRuleOpsSummary>(
    (summary, rule) => {
      summary.totalRuleCount += 1;
      distinctSources.add(rule.sourceType);

      if (rule.cadence === RevenueRuleCadence.RECURRING) {
        summary.recurringRuleCount += 1;
      } else {
        summary.oneTimeRuleCount += 1;
      }

      if (rule.valueType === RevenueRuleValueType.FIXED_PERCENT) {
        summary.percentRuleCount += 1;
      } else {
        summary.fixedAmountRuleCount += 1;
      }

      if (rule.reverseOnCancel) {
        summary.reversalBackedRuleCount += 1;
      }

      summary.sourceTypeCount = distinctSources.size;
      return summary;
    },
    {
      totalRuleCount: 0,
      recurringRuleCount: 0,
      oneTimeRuleCount: 0,
      percentRuleCount: 0,
      fixedAmountRuleCount: 0,
      reversalBackedRuleCount: 0,
      sourceTypeCount: 0,
    },
  );
}

export function buildRevenueAttributionOpsSummary(
  attributions: RevenueAttributionOpsLike[],
  payouts: PayoutOpsLike[],
): RevenueAttributionOpsSummary {
  const distinctSources = new Set<RevenueSourceType>();
  const summary: RevenueAttributionOpsSummary = {
    sourceTypeCount: 0,
    beneficiaryPendingAmountCents: 0,
    pendingCount: 0,
    approvedCount: 0,
    paidCount: 0,
    reversedCount: 0,
    pendingPayableAmountCents: 0,
    approvedPayableAmountCents: 0,
    paidPayableAmountCents: 0,
    reversedPayableAmountCents: 0,
  };

  for (const attribution of attributions) {
    distinctSources.add(attribution.sourceType);

    if (attribution.status === RevenueLedgerStatus.PENDING) {
      summary.pendingCount += 1;
      summary.beneficiaryPendingAmountCents += attribution.attributedAmountCents;
    } else if (attribution.status === RevenueLedgerStatus.APPROVED) {
      summary.approvedCount += 1;
    } else if (attribution.status === RevenueLedgerStatus.PAID) {
      summary.paidCount += 1;
    } else if (attribution.status === RevenueLedgerStatus.REVERSED) {
      summary.reversedCount += 1;
    }
  }

  for (const payout of payouts) {
    if (payout.status === RevenueLedgerStatus.PENDING) {
      summary.pendingPayableAmountCents += payout.payableAmountCents;
    } else if (payout.status === RevenueLedgerStatus.APPROVED) {
      summary.approvedPayableAmountCents += payout.payableAmountCents;
    } else if (payout.status === RevenueLedgerStatus.PAID) {
      summary.paidPayableAmountCents += payout.payableAmountCents;
    } else if (payout.status === RevenueLedgerStatus.REVERSED) {
      summary.reversedPayableAmountCents += payout.payableAmountCents;
    }
  }

  summary.sourceTypeCount = distinctSources.size;
  return summary;
}

export function buildSettlementLineOpsSummary(lines: SettlementLineOpsLike[]): SettlementLineOpsSummary {
  const distinctSources = new Set<RevenueSourceType>();
  const distinctBeneficiaries = new Set<string>();

  return lines.reduce<SettlementLineOpsSummary>(
    (summary, line) => {
      summary.totalLineCount += 1;
      distinctSources.add(line.sourceType);
      distinctBeneficiaries.add(line.beneficiaryKey);

      if (!line.hasPayoutProfile) {
        summary.missingProfileCount += 1;
      }

      if (line.status === SettlementLineStatus.PENDING) {
        summary.pendingCount += 1;
        summary.pendingAmountCents += line.amountCents;
      } else if (line.status === SettlementLineStatus.APPROVED) {
        summary.approvedCount += 1;
        summary.approvedAmountCents += line.amountCents;
      } else if (line.status === SettlementLineStatus.EXPORTED) {
        summary.exportedCount += 1;
        summary.exportedAmountCents += line.amountCents;
      } else if (line.status === SettlementLineStatus.PAID) {
        summary.paidCount += 1;
        summary.paidAmountCents += line.amountCents;
      } else if (line.status === SettlementLineStatus.REVERSED) {
        summary.reversedCount += 1;
        summary.reversedAmountCents += line.amountCents;
      }

      summary.sourceTypeCount = distinctSources.size;
      summary.beneficiaryCount = distinctBeneficiaries.size;
      return summary;
    },
    {
      totalLineCount: 0,
      beneficiaryCount: 0,
      sourceTypeCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      exportedCount: 0,
      paidCount: 0,
      reversedCount: 0,
      pendingAmountCents: 0,
      approvedAmountCents: 0,
      exportedAmountCents: 0,
      paidAmountCents: 0,
      reversedAmountCents: 0,
      missingProfileCount: 0,
    },
  );
}

export function getLifecycleOperationBoundaryNote(input: {
  accessState: AccessState;
  english: boolean;
}) {
  return getLifecycleBoundarySummary(input.accessState, input.english).note;
}
