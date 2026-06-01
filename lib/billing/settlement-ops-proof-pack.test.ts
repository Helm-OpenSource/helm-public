import { describe, expect, it } from "vitest";
import {
  ParticipantPortalAccessStatus,
  PayoutProfileStatus,
  RevenueBeneficiaryType,
  RevenueLedgerStatus,
  SettlementBatchStatus,
  SettlementLineStatus,
} from "@prisma/client";
import { buildSettlementOpsProofPackSummary } from "@/lib/billing/settlement-ops-proof-pack";

describe("settlement ops proof pack summary", () => {
  it("highlights missing profile, participant, and settlement evidence blockers", () => {
    const summary = buildSettlementOpsProofPackSummary({
      payoutEntries: [
        {
          beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
          beneficiaryLabel: "Worker Alpha",
          status: RevenueLedgerStatus.PENDING,
          workerPublisherProfileId: "worker_1",
          salesReferralId: null,
          customEngagementId: null,
        },
      ],
      payoutProfiles: [],
      participantPortalAccesses: [],
      settlementBatches: [],
    });

    expect(summary.requiredBeneficiaryCount).toBe(1);
    expect(summary.missingPayoutProfileCount).toBe(1);
    expect(summary.missingParticipantAccessCount).toBe(1);
    expect(summary.paidWithoutExportCount).toBe(0);
    expect(summary.nextMoves).toEqual([
      "ADD_ACTIVE_PAYOUT_PROFILES",
      "ISSUE_PARTICIPANT_ACCESS",
      "CREATE_FIRST_SETTLEMENT_BATCH",
      "CAPTURE_MANUAL_COMPLETION_EVIDENCE",
    ]);
  });

  it("shows exported evidence and manual completion once the proof pack exists", () => {
    const summary = buildSettlementOpsProofPackSummary({
      payoutEntries: [
        {
          beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
          beneficiaryLabel: "Worker Alpha",
          status: RevenueLedgerStatus.APPROVED,
          workerPublisherProfileId: "worker_1",
          salesReferralId: null,
          customEngagementId: null,
        },
        {
          beneficiaryType: RevenueBeneficiaryType.SALES_REFERRAL,
          beneficiaryLabel: "Referral Beta",
          status: RevenueLedgerStatus.PAID,
          workerPublisherProfileId: null,
          salesReferralId: "ref_1",
          customEngagementId: null,
        },
      ],
      payoutProfiles: [
        {
          status: PayoutProfileStatus.ACTIVE,
          workerPublisherProfileId: "worker_1",
          salesReferralId: null,
          customEngagementId: null,
        },
        {
          status: PayoutProfileStatus.ACTIVE,
          workerPublisherProfileId: null,
          salesReferralId: "ref_1",
          customEngagementId: null,
        },
      ],
      participantPortalAccesses: [
        {
          status: ParticipantPortalAccessStatus.INVITED,
          workerPublisherProfileId: "worker_1",
          salesReferralId: null,
          customEngagementId: null,
        },
      ],
      settlementBatches: [
        {
          status: SettlementBatchStatus.CLOSED,
          lines: [
            { status: SettlementLineStatus.PAID, exportedAt: new Date("2026-04-01T00:00:00.000Z") },
            { status: SettlementLineStatus.REVERSED, exportedAt: new Date("2026-04-01T00:00:00.000Z") },
          ],
        },
      ],
    });

    expect(summary.missingPayoutProfileCount).toBe(0);
    expect(summary.coveredByActivePayoutProfileCount).toBe(2);
    expect(summary.coveredByParticipantAccessCount).toBe(1);
    expect(summary.exportedOrClosedBatchCount).toBe(1);
    expect(summary.manualCompletionCount).toBe(2);
    expect(summary.paidWithoutExportCount).toBe(0);
    expect(summary.nextMoves).toEqual(["ISSUE_PARTICIPANT_ACCESS"]);
  });

  it("does not count paid lines without export evidence as completion proof", () => {
    const summary = buildSettlementOpsProofPackSummary({
      payoutEntries: [
        {
          beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
          beneficiaryLabel: "Worker Alpha",
          status: RevenueLedgerStatus.PAID,
          workerPublisherProfileId: "worker_1",
          salesReferralId: null,
          customEngagementId: null,
        },
      ],
      payoutProfiles: [
        {
          status: PayoutProfileStatus.ACTIVE,
          workerPublisherProfileId: "worker_1",
          salesReferralId: null,
          customEngagementId: null,
        },
      ],
      participantPortalAccesses: [
        {
          status: ParticipantPortalAccessStatus.ACTIVE,
          workerPublisherProfileId: "worker_1",
          salesReferralId: null,
          customEngagementId: null,
        },
      ],
      settlementBatches: [
        {
          status: SettlementBatchStatus.CLOSED,
          lines: [{ status: SettlementLineStatus.PAID, exportedAt: null }],
        },
      ],
    });

    expect(summary.manualCompletionCount).toBe(0);
    expect(summary.paidWithoutExportCount).toBe(1);
    expect(summary.nextMoves).toContain("CAPTURE_MANUAL_COMPLETION_EVIDENCE");
    expect(summary.nextMoves).toContain("AUDIT_PAID_WITHOUT_EXPORT");
  });
});
