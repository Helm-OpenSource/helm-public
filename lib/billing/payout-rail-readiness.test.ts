import { describe, expect, it } from "vitest";
import {
  ParticipantPortalAccessStatus,
  PayoutProfileStatus,
  RevenueBeneficiaryType,
  SettlementBatchStatus,
  SettlementLineStatus,
} from "@prisma/client";
import { buildPayoutRailReadinessSummary } from "@/lib/billing/payout-rail-readiness";

describe("payout rail readiness gate", () => {
  it("stays not ready when active profiles or settlement evidence are missing", () => {
    const summary = buildPayoutRailReadinessSummary({
      payoutProfiles: [],
      settlementBatches: [],
      currentBatch: null,
      participantPortalAccesses: [],
    });

    expect(summary.status).toBe("NOT_READY");
    expect(summary.blockers).toContain("NO_ACTIVE_PAYOUT_PROFILES");
    expect(summary.blockers).toContain("NO_SETTLEMENT_BATCH_HISTORY");
    expect(summary.blockers).toContain("NO_EXPORTED_OR_CLOSED_BATCH_HISTORY");
    expect(summary.watchpoints).toContain("NO_MANUAL_COMPLETION_EVIDENCE");
    expect(summary.watchpoints).toContain("NO_INVITED_OR_ACTIVE_PARTICIPANTS");
    expect(summary.paidWithoutExportCount).toBe(0);
  });

  it("stays conditional when the foundation exists but completion proof is still thin", () => {
    const summary = buildPayoutRailReadinessSummary({
      payoutProfiles: [{ status: PayoutProfileStatus.ACTIVE }],
      settlementBatches: [
        {
          status: SettlementBatchStatus.EXPORTED,
          lines: [
            {
              status: SettlementLineStatus.EXPORTED,
              exportedAt: new Date("2026-04-01T00:00:00.000Z"),
              beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
              beneficiaryPayoutProfile: { status: PayoutProfileStatus.ACTIVE },
            },
          ],
        },
      ],
      currentBatch: {
        lines: [
          {
            status: SettlementLineStatus.EXPORTED,
            exportedAt: new Date("2026-04-01T00:00:00.000Z"),
            beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
            beneficiaryPayoutProfile: { status: PayoutProfileStatus.ACTIVE },
          },
        ],
      },
      participantPortalAccesses: [{ status: ParticipantPortalAccessStatus.ACTIVE }],
    });

    expect(summary.status).toBe("CONDITIONAL_GO");
    expect(summary.blockers).toHaveLength(0);
    expect(summary.watchpoints).toContain("NO_MANUAL_COMPLETION_EVIDENCE");
    expect(summary.watchpoints).toContain("NO_REVERSAL_EVIDENCE");
    expect(summary.paidWithoutExportCount).toBe(0);
  });

  it("becomes ready for a narrow pilot after profiles, settlement practice and participant posture all exist", () => {
    const summary = buildPayoutRailReadinessSummary({
      payoutProfiles: [{ status: PayoutProfileStatus.ACTIVE }],
      settlementBatches: [
        {
          status: SettlementBatchStatus.CLOSED,
          lines: [
            {
              status: SettlementLineStatus.PAID,
              exportedAt: new Date("2026-04-01T00:00:00.000Z"),
              beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
              beneficiaryPayoutProfile: { status: PayoutProfileStatus.ACTIVE },
            },
            {
              status: SettlementLineStatus.REVERSED,
              exportedAt: new Date("2026-04-01T00:00:00.000Z"),
              beneficiaryType: RevenueBeneficiaryType.SALES_REFERRAL,
              beneficiaryPayoutProfile: { status: PayoutProfileStatus.ACTIVE },
            },
          ],
        },
      ],
      currentBatch: {
        lines: [
          {
            status: SettlementLineStatus.PAID,
            exportedAt: new Date("2026-04-01T00:00:00.000Z"),
            beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
            beneficiaryPayoutProfile: { status: PayoutProfileStatus.ACTIVE },
          },
        ],
      },
      participantPortalAccesses: [{ status: ParticipantPortalAccessStatus.INVITED }],
    });

    expect(summary.status).toBe("READY_FOR_NARROW_PILOT");
    expect(summary.blockers).toHaveLength(0);
    expect(summary.watchpoints).toHaveLength(0);
    expect(summary.manualCompletionCount).toBe(2);
    expect(summary.paidWithoutExportCount).toBe(0);
    expect(summary.reversalCount).toBe(1);
  });

  it("drops back to not ready when the current batch still lacks payout profiles", () => {
    const summary = buildPayoutRailReadinessSummary({
      payoutProfiles: [{ status: PayoutProfileStatus.ACTIVE }],
      settlementBatches: [
        {
          status: SettlementBatchStatus.EXPORTED,
          lines: [
            {
              status: SettlementLineStatus.EXPORTED,
              exportedAt: new Date("2026-04-01T00:00:00.000Z"),
              beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
              beneficiaryPayoutProfile: null,
            },
          ],
        },
      ],
      currentBatch: {
        lines: [
          {
            status: SettlementLineStatus.EXPORTED,
            exportedAt: new Date("2026-04-01T00:00:00.000Z"),
            beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
            beneficiaryPayoutProfile: null,
          },
        ],
      },
      participantPortalAccesses: [{ status: ParticipantPortalAccessStatus.ACTIVE }],
    });

    expect(summary.status).toBe("NOT_READY");
    expect(summary.blockers).toContain("CURRENT_BATCH_MISSING_PAYOUT_PROFILES");
    expect(summary.currentBatchMissingProfileCount).toBe(1);
  });

  it("keeps paid lines without export evidence out of readiness proof", () => {
    const summary = buildPayoutRailReadinessSummary({
      payoutProfiles: [{ status: PayoutProfileStatus.ACTIVE }],
      settlementBatches: [
        {
          status: SettlementBatchStatus.CLOSED,
          lines: [
            {
              status: SettlementLineStatus.PAID,
              exportedAt: null,
              beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
              beneficiaryPayoutProfile: { status: PayoutProfileStatus.ACTIVE },
            },
          ],
        },
      ],
      currentBatch: null,
      participantPortalAccesses: [{ status: ParticipantPortalAccessStatus.ACTIVE }],
    });

    expect(summary.status).toBe("CONDITIONAL_GO");
    expect(summary.manualCompletionCount).toBe(0);
    expect(summary.paidWithoutExportCount).toBe(1);
    expect(summary.watchpoints).toContain("NO_MANUAL_COMPLETION_EVIDENCE");
    expect(summary.watchpoints).toContain("PAID_WITHOUT_EXPORT_ANOMALIES");
    expect(summary.watchpoints).toContain("NO_REVERSAL_EVIDENCE");
  });
});
