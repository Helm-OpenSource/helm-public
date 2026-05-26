import { describe, expect, it } from "vitest";
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
import {
  buildInternalUsageOpsSummary,
  buildMembershipLifecycleSummary,
  buildRevenueAttributionOpsSummary,
  buildRevenueRuleOpsSummary,
  buildSettlementLineOpsSummary,
  buildWorkerEntitlementOpsSummary,
  getLifecycleOperationBoundaryNote,
} from "@/lib/billing/ops-summary";

describe("billing ops summary helpers", () => {
  it("keeps invited and inactive members out of active seat counts", () => {
    const summary = buildMembershipLifecycleSummary({
      memberships: [
        { status: MembershipStatus.ACTIVE },
        { status: MembershipStatus.ACTIVE },
        { status: MembershipStatus.INVITED },
        { status: MembershipStatus.INACTIVE },
      ],
      includedAdminSeats: 1,
      trialCollaboratorSeats: 2,
    });

    expect(summary.activeSeatCount).toBe(2);
    expect(summary.invitedSeatCount).toBe(1);
    expect(summary.inactiveSeatCount).toBe(1);
    expect(summary.additionalBillableSeats).toBe(1);
    expect(summary.trialCollaboratorSeatsUsed).toBe(1);
    expect(summary.trialCollaboratorSeatsRemaining).toBe(1);
  });

  it("shows trial seat pressure only after the trial collaborator window is exceeded", () => {
    const summary = buildMembershipLifecycleSummary({
      memberships: [
        { status: MembershipStatus.ACTIVE },
        { status: MembershipStatus.ACTIVE },
        { status: MembershipStatus.ACTIVE },
        { status: MembershipStatus.ACTIVE },
        { status: MembershipStatus.ACTIVE },
      ],
      includedAdminSeats: 1,
      trialCollaboratorSeats: 2,
    });

    expect(summary.trialSeatCapacity).toBe(3);
    expect(summary.trialSeatPressureCount).toBe(2);
    expect(summary.additionalBillableSeats).toBe(4);
  });

  it("summarizes included, active add-on and reserved worker entitlements separately", () => {
    const summary = buildWorkerEntitlementOpsSummary([
      {
        workerKey: "meeting_os_worker",
        entitlementType: WorkerEntitlementType.INCLUDED,
        status: WorkerEntitlementStatus.ACTIVE,
        effectiveFrom: new Date("2026-03-01T00:00:00.000Z"),
        effectiveTo: null,
        internalLimit: null,
      },
      {
        workerKey: "deal_desk_worker",
        entitlementType: WorkerEntitlementType.ADD_ON_MONTHLY,
        status: WorkerEntitlementStatus.INACTIVE,
        effectiveFrom: new Date("2026-03-01T00:00:00.000Z"),
        effectiveTo: null,
        internalLimit: null,
      },
      {
        workerKey: "specialist_review_worker",
        entitlementType: WorkerEntitlementType.ADD_ON_PER_USE,
        status: WorkerEntitlementStatus.ACTIVE,
        effectiveFrom: new Date("2026-03-01T00:00:00.000Z"),
        effectiveTo: new Date("2026-06-01T00:00:00.000Z"),
        internalLimit: 12,
      },
    ]);

    expect(summary.includedActiveCount).toBe(1);
    expect(summary.addOnMonthlyActiveCount).toBe(0);
    expect(summary.addOnPerUseActiveCount).toBe(1);
    expect(summary.addOnMonthlyReservedCount).toBe(1);
    expect(summary.addOnPerUseReservedCount).toBe(0);
    expect(summary.commercialActiveCount).toBe(1);
    expect(summary.commercialPathCount).toBe(2);
    expect(summary.futureAddOnReservedCount).toBe(1);
    expect(summary.internalLimitCount).toBe(1);
    expect(summary.windowedEntitlementCount).toBe(1);
  });

  it("keeps internal usage in product-safe categories", () => {
    const summary = buildInternalUsageOpsSummary([
      { usageType: UsageType.MEETING_PROCESSING, quantity: 3 },
      { usageType: UsageType.CONNECTOR_SYNC, quantity: 2 },
      { usageType: UsageType.MEETING_MEMORY_EXPORT, quantity: 1 },
      { usageType: UsageType.PREMIUM_WORKER_INVOCATION, quantity: 4 },
    ]);

    expect(summary.totalUsageCount).toBe(10);
    expect(summary.highCostProcessingCount).toBe(7);
    expect(summary.syncCount).toBe(2);
    expect(summary.exportCount).toBe(1);
    expect(summary.premiumWorkerCount).toBe(4);
  });

  it("keeps lifecycle boundary notes honest about grace and read-only restrictions", () => {
    expect(
      getLifecycleOperationBoundaryNote({
        accessState: AccessState.GRACE,
        english: true,
      }),
    ).toContain("viewing, export and restore-oriented settings actions open");

    expect(
      getLifecycleOperationBoundaryNote({
        accessState: AccessState.READ_ONLY,
        english: false,
      }),
    ).toContain("查看、导出和以恢复为目标的设置动作");
  });

  it("summarizes revenue rules and payable posture without implying payout rails", () => {
    const ruleSummary = buildRevenueRuleOpsSummary([
      {
        sourceType: RevenueSourceType.ORGANIZATION_BASE_FEE,
        cadence: RevenueRuleCadence.RECURRING,
        valueType: RevenueRuleValueType.FIXED_PERCENT,
        reverseOnCancel: true,
      },
      {
        sourceType: RevenueSourceType.CUSTOM_IMPLEMENTATION,
        cadence: RevenueRuleCadence.ONE_TIME,
        valueType: RevenueRuleValueType.FIXED_AMOUNT,
        reverseOnCancel: true,
      },
    ]);

    const attributionSummary = buildRevenueAttributionOpsSummary(
      [
        {
          sourceType: RevenueSourceType.ORGANIZATION_BASE_FEE,
          attributedAmountCents: 19_900,
          status: RevenueLedgerStatus.PENDING,
        },
        {
          sourceType: RevenueSourceType.CUSTOM_IMPLEMENTATION,
          attributedAmountCents: 8_000,
          status: RevenueLedgerStatus.REVERSED,
        },
      ],
      [
        {
          payableAmountCents: 19_900,
          status: RevenueLedgerStatus.PENDING,
        },
        {
          payableAmountCents: 8_000,
          status: RevenueLedgerStatus.REVERSED,
        },
      ],
    );

    expect(ruleSummary.totalRuleCount).toBe(2);
    expect(ruleSummary.recurringRuleCount).toBe(1);
    expect(ruleSummary.oneTimeRuleCount).toBe(1);
    expect(ruleSummary.percentRuleCount).toBe(1);
    expect(ruleSummary.fixedAmountRuleCount).toBe(1);
    expect(ruleSummary.reversalBackedRuleCount).toBe(2);

    expect(attributionSummary.pendingCount).toBe(1);
    expect(attributionSummary.reversedCount).toBe(1);
    expect(attributionSummary.pendingPayableAmountCents).toBe(19_900);
    expect(attributionSummary.reversedPayableAmountCents).toBe(8_000);
    expect(attributionSummary.sourceTypeCount).toBe(2);
  });

  it("summarizes manual settlement line posture and missing payout profiles", () => {
    const summary = buildSettlementLineOpsSummary([
      {
        sourceType: RevenueSourceType.ADD_ON_WORKER,
        amountCents: 9_900,
        status: SettlementLineStatus.PENDING,
        hasPayoutProfile: true,
        beneficiaryKey: "WORKER_PUBLISHER:publisher_alpha",
      },
      {
        sourceType: RevenueSourceType.SALES_REFERRAL,
        amountCents: 5_000,
        status: SettlementLineStatus.EXPORTED,
        hasPayoutProfile: false,
        beneficiaryKey: "SALES_REFERRAL:referral_beta",
      },
      {
        sourceType: RevenueSourceType.CUSTOM_IMPLEMENTATION,
        amountCents: 12_000,
        status: SettlementLineStatus.PAID,
        hasPayoutProfile: true,
        beneficiaryKey: "CUSTOM_SERVICES:engagement_gamma",
      },
    ]);

    expect(summary.totalLineCount).toBe(3);
    expect(summary.beneficiaryCount).toBe(3);
    expect(summary.sourceTypeCount).toBe(3);
    expect(summary.pendingCount).toBe(1);
    expect(summary.exportedCount).toBe(1);
    expect(summary.paidCount).toBe(1);
    expect(summary.pendingAmountCents).toBe(9_900);
    expect(summary.exportedAmountCents).toBe(5_000);
    expect(summary.paidAmountCents).toBe(12_000);
    expect(summary.missingProfileCount).toBe(1);
  });
});
