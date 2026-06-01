import {
  ParticipantPortalAccessStatus,
  PayoutProfileStatus,
  RevenueBeneficiaryType,
  RevenueLedgerStatus,
  RevenueSourceType,
  SettlementBatchStatus,
  SettlementLineStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildPayoutRailReadinessSummary } from "@/lib/billing/payout-rail-readiness";
import { buildSettlementExceptionSummary } from "@/lib/billing/settlement-exceptions";
import { buildPayoutRailPilotCohortSummary } from "@/lib/billing/payout-rail-pilot-cohort";

type SettlementBatchFixture =
  Parameters<typeof buildSettlementExceptionSummary>[0]["settlementBatches"][number] &
  Parameters<typeof buildPayoutRailPilotCohortSummary>[0]["settlementBatches"][number];

describe("buildPayoutRailPilotCohortSummary", () => {
  it("holds manual posture when readiness gate is not green", () => {
    const readiness = buildPayoutRailReadinessSummary({
      payoutProfiles: [],
      settlementBatches: [],
      currentBatch: null,
      participantPortalAccesses: [],
    });
    const exceptions = buildSettlementExceptionSummary({
      currentBatch: null,
      settlementBatches: [],
      payoutProfiles: [],
      participantPortalAccesses: [],
    });

    const summary = buildPayoutRailPilotCohortSummary({
      paymentRegion: "CN",
      payoutRailReadiness: readiness,
      settlementExceptionSummary: exceptions,
      payoutEntries: [
        {
          beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
          beneficiaryLabel: "Atlas Worker",
          status: RevenueLedgerStatus.APPROVED,
          currency: "CNY",
          workerPublisherProfileId: "worker-1",
          salesReferralId: null,
          customEngagementId: null,
        },
      ],
      payoutProfiles: [],
      participantPortalAccesses: [],
      settlementBatches: [],
    });

    expect(summary.status).toBe("HOLD_MANUAL");
    expect(summary.checklist.find((item) => item.key === "READINESS_GATE_GREEN")?.passed).toBe(false);
    expect(summary.nextMoves).toContain("KEEP_MANUAL_SETTLEMENT");
  });

  it("asks operators to choose one beneficiary class when multiple classes qualify", () => {
    const payoutProfiles = [
      {
        id: "profile-worker-1",
        beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
        beneficiaryReference: "worker-1",
        status: PayoutProfileStatus.ACTIVE,
        payoutMethodLabel: "CN Bank Transfer",
        workerPublisherProfileId: "worker-1",
        salesReferralId: null,
        customEngagementId: null,
      },
      {
        id: "profile-ref-1",
        beneficiaryType: RevenueBeneficiaryType.SALES_REFERRAL,
        beneficiaryReference: "ref-1",
        status: PayoutProfileStatus.ACTIVE,
        payoutMethodLabel: "CN Bank Transfer",
        workerPublisherProfileId: null,
        salesReferralId: "ref-1",
        customEngagementId: null,
      },
    ];
    const participantPortalAccesses = [
      {
        beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
        beneficiaryReference: "worker-1",
        status: ParticipantPortalAccessStatus.ACTIVE,
        workerPublisherProfileId: "worker-1",
        salesReferralId: null,
        customEngagementId: null,
      },
      {
        beneficiaryType: RevenueBeneficiaryType.SALES_REFERRAL,
        beneficiaryReference: "ref-1",
        status: ParticipantPortalAccessStatus.ACTIVE,
        workerPublisherProfileId: null,
        salesReferralId: "ref-1",
        customEngagementId: null,
      },
    ];
    const settlementBatches: SettlementBatchFixture[] = [
      {
        batchKey: "batch-exported",
        status: SettlementBatchStatus.EXPORTED,
        currency: "CNY",
        lines: [
          {
            id: "line-worker-paid",
            beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
            beneficiaryLabel: "Atlas Worker",
            sourceType: RevenueSourceType.ADD_ON_WORKER,
            status: SettlementLineStatus.PAID,
            currency: "CNY",
            exportedAt: new Date("2026-03-01T00:00:00Z"),
            paidAt: new Date("2026-03-03T00:00:00Z"),
            reversedAt: null,
            notes: null,
            payoutLedger: {
              workerPublisherProfileId: "worker-1",
              salesReferralId: null,
              customEngagementId: null,
              revenueAttributionLedger: {
                reversalReason: null,
              },
            },
            beneficiaryPayoutProfile: {
              id: "profile-worker-1",
              status: PayoutProfileStatus.ACTIVE,
              workerPublisherProfileId: "worker-1",
              salesReferralId: null,
              customEngagementId: null,
            },
          },
          {
            id: "line-ref-paid",
            beneficiaryType: RevenueBeneficiaryType.SALES_REFERRAL,
            beneficiaryLabel: "North Referral",
            sourceType: RevenueSourceType.SALES_REFERRAL,
            status: SettlementLineStatus.PAID,
            currency: "CNY",
            exportedAt: new Date("2026-03-01T00:00:00Z"),
            paidAt: new Date("2026-03-03T00:00:00Z"),
            reversedAt: null,
            notes: null,
            payoutLedger: {
              workerPublisherProfileId: null,
              salesReferralId: "ref-1",
              customEngagementId: null,
              revenueAttributionLedger: {
                reversalReason: null,
              },
            },
            beneficiaryPayoutProfile: {
              id: "profile-ref-1",
              status: PayoutProfileStatus.ACTIVE,
              workerPublisherProfileId: null,
              salesReferralId: "ref-1",
              customEngagementId: null,
            },
          },
        ],
      },
      {
        batchKey: "batch-closed",
        status: SettlementBatchStatus.CLOSED,
        currency: "CNY",
        lines: [
          {
            id: "line-worker-reversed",
            beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
            beneficiaryLabel: "Atlas Worker",
            sourceType: RevenueSourceType.ADD_ON_WORKER,
            status: SettlementLineStatus.REVERSED,
            currency: "CNY",
            exportedAt: new Date("2026-03-10T00:00:00Z"),
            paidAt: null,
            reversedAt: new Date("2026-03-12T00:00:00Z"),
            notes: "Manual reversal",
            payoutLedger: {
              workerPublisherProfileId: "worker-1",
              salesReferralId: null,
              customEngagementId: null,
              revenueAttributionLedger: {
                reversalReason: "Customer dispute",
              },
            },
            beneficiaryPayoutProfile: {
              id: "profile-worker-1",
              status: PayoutProfileStatus.ACTIVE,
              workerPublisherProfileId: "worker-1",
              salesReferralId: null,
              customEngagementId: null,
            },
          },
          {
            id: "line-ref-reversed",
            beneficiaryType: RevenueBeneficiaryType.SALES_REFERRAL,
            beneficiaryLabel: "North Referral",
            sourceType: RevenueSourceType.SALES_REFERRAL,
            status: SettlementLineStatus.REVERSED,
            currency: "CNY",
            exportedAt: new Date("2026-03-10T00:00:00Z"),
            paidAt: null,
            reversedAt: new Date("2026-03-12T00:00:00Z"),
            notes: "Manual reversal",
            payoutLedger: {
              workerPublisherProfileId: null,
              salesReferralId: "ref-1",
              customEngagementId: null,
              revenueAttributionLedger: {
                reversalReason: "Referral canceled",
              },
            },
            beneficiaryPayoutProfile: {
              id: "profile-ref-1",
              status: PayoutProfileStatus.ACTIVE,
              workerPublisherProfileId: null,
              salesReferralId: "ref-1",
              customEngagementId: null,
            },
          },
        ],
      },
    ];
    const readiness = buildPayoutRailReadinessSummary({
      payoutProfiles,
      settlementBatches,
      currentBatch: null,
      participantPortalAccesses,
    });
    const exceptions = buildSettlementExceptionSummary({
      currentBatch: null,
      settlementBatches,
      payoutProfiles,
      participantPortalAccesses,
    });

    const summary = buildPayoutRailPilotCohortSummary({
      paymentRegion: "CN",
      payoutRailReadiness: readiness,
      settlementExceptionSummary: exceptions,
      payoutEntries: [
        {
          beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
          beneficiaryLabel: "Atlas Worker",
          status: RevenueLedgerStatus.APPROVED,
          currency: "CNY",
          workerPublisherProfileId: "worker-1",
          salesReferralId: null,
          customEngagementId: null,
        },
        {
          beneficiaryType: RevenueBeneficiaryType.SALES_REFERRAL,
          beneficiaryLabel: "North Referral",
          status: RevenueLedgerStatus.APPROVED,
          currency: "CNY",
          workerPublisherProfileId: null,
          salesReferralId: "ref-1",
          customEngagementId: null,
        },
      ],
      payoutProfiles,
      participantPortalAccesses,
      settlementBatches,
    });

    expect(summary.status).toBe("READY_TO_SELECT_COHORT");
    expect(summary.readyCohortCount).toBe(2);
    expect(summary.nextMoves).toContain("CHOOSE_ONE_BENEFICIARY_CLASS");
  });

  it("becomes ready for an operator dry run when exactly one cohort fits the pilot envelope", () => {
    const payoutProfiles = [
      {
        id: "profile-custom-1",
        beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
        beneficiaryReference: "custom-1",
        status: PayoutProfileStatus.ACTIVE,
        payoutMethodLabel: "CN Bank Transfer",
        workerPublisherProfileId: null,
        salesReferralId: null,
        customEngagementId: "custom-1",
      },
    ];
    const participantPortalAccesses = [
      {
        beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
        beneficiaryReference: "custom-1",
        status: ParticipantPortalAccessStatus.ACTIVE,
        workerPublisherProfileId: null,
        salesReferralId: null,
        customEngagementId: "custom-1",
      },
    ];
    const settlementBatches: SettlementBatchFixture[] = [
      {
        batchKey: "batch-exported-custom",
        status: SettlementBatchStatus.EXPORTED,
        currency: "CNY",
        lines: [
          {
            id: "line-custom-paid",
            beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
            beneficiaryLabel: "North Services",
            sourceType: RevenueSourceType.CUSTOM_IMPLEMENTATION,
            status: SettlementLineStatus.PAID,
            currency: "CNY",
            exportedAt: new Date("2026-03-01T00:00:00Z"),
            paidAt: new Date("2026-03-03T00:00:00Z"),
            reversedAt: null,
            notes: null,
            payoutLedger: {
              workerPublisherProfileId: null,
              salesReferralId: null,
              customEngagementId: "custom-1",
              revenueAttributionLedger: {
                reversalReason: null,
              },
            },
            beneficiaryPayoutProfile: {
              id: "profile-custom-1",
              status: PayoutProfileStatus.ACTIVE,
              workerPublisherProfileId: null,
              salesReferralId: null,
              customEngagementId: "custom-1",
            },
          },
        ],
      },
      {
        batchKey: "batch-closed-custom",
        status: SettlementBatchStatus.CLOSED,
        currency: "CNY",
        lines: [
          {
            id: "line-custom-reversed",
            beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
            beneficiaryLabel: "North Services",
            sourceType: RevenueSourceType.CUSTOM_MAINTENANCE,
            status: SettlementLineStatus.REVERSED,
            currency: "CNY",
            exportedAt: new Date("2026-03-10T00:00:00Z"),
            paidAt: null,
            reversedAt: new Date("2026-03-12T00:00:00Z"),
            notes: "Manual reversal",
            payoutLedger: {
              workerPublisherProfileId: null,
              salesReferralId: null,
              customEngagementId: "custom-1",
              revenueAttributionLedger: {
                reversalReason: "Maintenance change",
              },
            },
            beneficiaryPayoutProfile: {
              id: "profile-custom-1",
              status: PayoutProfileStatus.ACTIVE,
              workerPublisherProfileId: null,
              salesReferralId: null,
              customEngagementId: "custom-1",
            },
          },
        ],
      },
    ];
    const readiness = buildPayoutRailReadinessSummary({
      payoutProfiles,
      settlementBatches,
      currentBatch: null,
      participantPortalAccesses,
    });
    const exceptions = buildSettlementExceptionSummary({
      currentBatch: null,
      settlementBatches,
      payoutProfiles,
      participantPortalAccesses,
    });

    const summary = buildPayoutRailPilotCohortSummary({
      paymentRegion: "CN",
      payoutRailReadiness: readiness,
      settlementExceptionSummary: exceptions,
      payoutEntries: [
        {
          beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
          beneficiaryLabel: "North Services",
          status: RevenueLedgerStatus.APPROVED,
          currency: "CNY",
          workerPublisherProfileId: null,
          salesReferralId: null,
          customEngagementId: "custom-1",
        },
      ],
      payoutProfiles,
      participantPortalAccesses,
      settlementBatches,
    });

    expect(summary.status).toBe("READY_FOR_OPERATOR_DRY_RUN");
    expect(summary.readyCohortCount).toBe(1);
    expect(summary.recommendedBeneficiaryType).toBe(RevenueBeneficiaryType.CUSTOM_SERVICES);
    expect(summary.recommendedPayoutMethodLabel).toBe("CN Bank Transfer");
    expect(summary.recommendedCurrency).toBe("CNY");
    expect(summary.nextMoves).toContain("RUN_OFF_PLATFORM_DRY_RUN");
  });

  it("does not treat paid lines without export evidence as pilot completion proof", () => {
    const payoutProfiles = [
      {
        id: "profile-custom-1",
        beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
        beneficiaryReference: "custom-1",
        status: PayoutProfileStatus.ACTIVE,
        payoutMethodLabel: "CN Bank Transfer",
        workerPublisherProfileId: null,
        salesReferralId: null,
        customEngagementId: "custom-1",
      },
    ];
    const participantPortalAccesses = [
      {
        beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
        beneficiaryReference: "custom-1",
        status: ParticipantPortalAccessStatus.ACTIVE,
        workerPublisherProfileId: null,
        salesReferralId: null,
        customEngagementId: "custom-1",
      },
    ];
    const settlementBatches: SettlementBatchFixture[] = [
      {
        batchKey: "batch-closed-custom",
        status: SettlementBatchStatus.CLOSED,
        currency: "CNY",
        lines: [
          {
            id: "line-custom-paid",
            beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
            beneficiaryLabel: "North Services",
            sourceType: RevenueSourceType.CUSTOM_IMPLEMENTATION,
            status: SettlementLineStatus.PAID,
            currency: "CNY",
            exportedAt: null,
            paidAt: new Date("2026-03-03T00:00:00Z"),
            reversedAt: null,
            notes: null,
            payoutLedger: {
              workerPublisherProfileId: null,
              salesReferralId: null,
              customEngagementId: "custom-1",
              revenueAttributionLedger: {
                reversalReason: null,
              },
            },
            beneficiaryPayoutProfile: {
              id: "profile-custom-1",
              status: PayoutProfileStatus.ACTIVE,
              workerPublisherProfileId: null,
              salesReferralId: null,
              customEngagementId: "custom-1",
            },
          },
        ],
      },
    ];
    const readiness = buildPayoutRailReadinessSummary({
      payoutProfiles,
      settlementBatches,
      currentBatch: null,
      participantPortalAccesses,
    });
    const exceptions = buildSettlementExceptionSummary({
      currentBatch: null,
      settlementBatches,
      payoutProfiles,
      participantPortalAccesses,
    });

    const summary = buildPayoutRailPilotCohortSummary({
      paymentRegion: "CN",
      payoutRailReadiness: readiness,
      settlementExceptionSummary: exceptions,
      payoutEntries: [
        {
          beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
          beneficiaryLabel: "North Services",
          status: RevenueLedgerStatus.APPROVED,
          currency: "CNY",
          workerPublisherProfileId: null,
          salesReferralId: null,
          customEngagementId: "custom-1",
        },
      ],
      payoutProfiles,
      participantPortalAccesses,
      settlementBatches,
    });

    expect(summary.candidateCohorts[0]?.manualCompletionCount).toBe(0);
    expect(summary.status).toBe("HOLD_MANUAL");
  });
});
