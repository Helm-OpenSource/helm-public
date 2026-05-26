import { describe, expect, it } from "vitest";
import {
  ParticipantPortalAccessStatus,
  PayoutProfileStatus,
  RevenueBeneficiaryType,
  RevenueSourceType,
  SettlementLineStatus,
} from "@prisma/client";
import { buildSettlementExceptionSummary } from "@/lib/billing/settlement-exceptions";

describe("settlement exception summary", () => {
  it("surfaces payout-profile, participant, and exported-line exceptions", () => {
    const summary = buildSettlementExceptionSummary({
      currentBatch: {
        batchKey: "settlement_2026_04",
        lines: [
          {
            id: "line_1",
            beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
            beneficiaryLabel: "Worker Alpha",
            sourceType: RevenueSourceType.ADD_ON_WORKER,
            status: SettlementLineStatus.APPROVED,
            exportedAt: null,
            paidAt: null,
            reversedAt: null,
            notes: null,
            payoutLedger: {
              workerPublisherProfileId: "worker_1",
              salesReferralId: null,
              customEngagementId: null,
              revenueAttributionLedger: {
                reversalReason: null,
              },
            },
            beneficiaryPayoutProfile: null,
          },
          {
            id: "line_2",
            beneficiaryType: RevenueBeneficiaryType.SALES_REFERRAL,
            beneficiaryLabel: "Referral Beta",
            sourceType: RevenueSourceType.SALES_REFERRAL,
            status: SettlementLineStatus.APPROVED,
            exportedAt: null,
            paidAt: null,
            reversedAt: null,
            notes: null,
            payoutLedger: {
              workerPublisherProfileId: null,
              salesReferralId: "ref_1",
              customEngagementId: null,
              revenueAttributionLedger: {
                reversalReason: null,
              },
            },
            beneficiaryPayoutProfile: {
              id: "profile_1",
              status: PayoutProfileStatus.INACTIVE,
              workerPublisherProfileId: null,
              salesReferralId: "ref_1",
              customEngagementId: null,
            },
          },
        ],
      },
      settlementBatches: [
        {
          batchKey: "settlement_2026_04",
          lines: [
            {
              id: "line_3",
              beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
              beneficiaryLabel: "Custom Gamma",
              sourceType: RevenueSourceType.CUSTOM_IMPLEMENTATION,
              status: SettlementLineStatus.EXPORTED,
              exportedAt: new Date("2026-04-01T00:00:00.000Z"),
              paidAt: null,
              reversedAt: null,
              notes: null,
              payoutLedger: {
                workerPublisherProfileId: null,
                salesReferralId: null,
                customEngagementId: "custom_1",
                revenueAttributionLedger: {
                  reversalReason: null,
                },
              },
              beneficiaryPayoutProfile: {
                id: "profile_2",
                status: PayoutProfileStatus.ACTIVE,
                workerPublisherProfileId: null,
                salesReferralId: null,
                customEngagementId: "custom_1",
              },
            },
          ],
        },
      ],
      payoutProfiles: [],
      participantPortalAccesses: [
        {
          status: ParticipantPortalAccessStatus.SUSPENDED,
          workerPublisherProfileId: "worker_1",
          salesReferralId: null,
          customEngagementId: null,
        },
        {
          status: ParticipantPortalAccessStatus.ARCHIVED,
          workerPublisherProfileId: null,
          salesReferralId: "ref_1",
          customEngagementId: null,
        },
      ],
      now: new Date("2026-04-10T00:00:00.000Z"),
    });

    expect(summary.openExceptionCount).toBe(5);
    expect(summary.payoutProfileExceptionCount).toBe(2);
    expect(summary.participantAccessExceptionCount).toBe(2);
    expect(summary.exportedUnsettledCount).toBe(1);
    expect(summary.nextMoves).toEqual([
      "ADD_OR_REACTIVATE_PAYOUT_PROFILE",
      "RESTORE_PARTICIPANT_ACCESS",
      "COMPLETE_EXPORTED_LINES",
    ]);
  });

  it("keeps recent reversal evidence readable without inventing new exceptions", () => {
    const summary = buildSettlementExceptionSummary({
      currentBatch: null,
      settlementBatches: [
        {
          batchKey: "settlement_2026_03",
          lines: [
            {
              id: "line_1",
              beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
              beneficiaryLabel: "Worker Alpha",
              sourceType: RevenueSourceType.ADD_ON_WORKER,
              status: SettlementLineStatus.REVERSED,
              exportedAt: new Date("2026-03-10T00:00:00.000Z"),
              paidAt: null,
              reversedAt: new Date("2026-03-12T00:00:00.000Z"),
              notes: "Seeded reversal evidence.",
              payoutLedger: {
                workerPublisherProfileId: "worker_1",
                salesReferralId: null,
                customEngagementId: null,
                revenueAttributionLedger: {
                  reversalReason: "Refund requested by operator.",
                },
              },
              beneficiaryPayoutProfile: {
                id: "profile_1",
                status: PayoutProfileStatus.ACTIVE,
                workerPublisherProfileId: "worker_1",
                salesReferralId: null,
                customEngagementId: null,
              },
            },
          ],
        },
      ],
      payoutProfiles: [],
      participantPortalAccesses: [],
    });

    expect(summary.openExceptionCount).toBe(0);
    expect(summary.reversalCount).toBe(1);
    expect(summary.recentReversals[0]?.reversalReason).toBe("Refund requested by operator.");
    expect(summary.nextMoves).toEqual([]);
  });
});
