import { describe, expect, it } from "vitest";
import { RevenueBeneficiaryType, SettlementBatchStatus, SettlementLineStatus } from "@prisma/client";
import {
  beneficiarySupportsPayoutProfile,
  buildSettlementBatchCsv,
  buildSettlementBatchKey,
  canMarkSettlementLinePaid,
  canReverseSettlementLine,
  resolveSettlementPeriodWindow,
} from "@/lib/billing/manual-settlement";
import {
  canApproveSettlementBatch,
  canCloseSettlementBatch,
  canExportSettlementBatch,
} from "@/lib/billing/settlement-posture";

describe("manual settlement helpers", () => {
  it("supports payout profiles only for payable beneficiary classes", () => {
    expect(beneficiarySupportsPayoutProfile(RevenueBeneficiaryType.WORKER_PUBLISHER)).toBe(true);
    expect(beneficiarySupportsPayoutProfile(RevenueBeneficiaryType.SALES_REFERRAL)).toBe(true);
    expect(beneficiarySupportsPayoutProfile(RevenueBeneficiaryType.CUSTOM_SERVICES)).toBe(true);
    expect(beneficiarySupportsPayoutProfile(RevenueBeneficiaryType.PLATFORM)).toBe(false);
  });

  it("derives a settlement month window from YYYY-MM", () => {
    const period = resolveSettlementPeriodWindow("2026-04");

    expect(period.periodLabel).toBe("2026-04");
    expect(period.periodStart.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(period.periodEnd.toISOString()).toBe("2026-04-30T23:59:59.999Z");
    expect(buildSettlementBatchKey(period.periodLabel)).toBe("settlement_2026_04");
  });

  it("renders a CSV export for off-platform settlement", () => {
    const csv = buildSettlementBatchCsv({
      batchKey: "settlement_2026_04",
      periodLabel: "2026-04",
      currency: "CNY",
      rows: [
        {
          beneficiaryLabel: "Publisher Alpha",
          beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
          sourceType: "ADD_ON_WORKER",
          amountCents: 9_900,
          currency: "CNY",
          status: SettlementLineStatus.EXPORTED,
          notes: "Needs April off-platform transfer",
          reference: "worker_addon_2026_04",
        },
      ],
    });

    expect(csv).toContain("batch_key,period,beneficiary");
    expect(csv).toContain("settlement_2026_04");
    expect(csv).toContain("Publisher Alpha");
    expect(csv).toContain("EXPORTED");
  });

  it("only allows paid posture after export", () => {
    expect(canMarkSettlementLinePaid(SettlementLineStatus.PENDING)).toBe(false);
    expect(canMarkSettlementLinePaid(SettlementLineStatus.APPROVED)).toBe(false);
    expect(canMarkSettlementLinePaid(SettlementLineStatus.EXPORTED)).toBe(true);
    expect(canMarkSettlementLinePaid(SettlementLineStatus.PAID)).toBe(false);
    expect(canMarkSettlementLinePaid(SettlementLineStatus.REVERSED)).toBe(false);
  });

  it("keeps reversal posture manual and explicit", () => {
    expect(canReverseSettlementLine(SettlementLineStatus.PENDING)).toBe(false);
    expect(canReverseSettlementLine(SettlementLineStatus.APPROVED)).toBe(false);
    expect(canReverseSettlementLine(SettlementLineStatus.EXPORTED)).toBe(true);
    expect(canReverseSettlementLine(SettlementLineStatus.PAID)).toBe(true);
    expect(canReverseSettlementLine(SettlementLineStatus.REVERSED)).toBe(false);
  });

  it("keeps batch transitions on the documented one-way flow", () => {
    expect(canApproveSettlementBatch(SettlementBatchStatus.DRAFT)).toBe(true);
    expect(canApproveSettlementBatch(SettlementBatchStatus.APPROVED)).toBe(false);
    expect(canApproveSettlementBatch(SettlementBatchStatus.EXPORTED)).toBe(false);
    expect(canApproveSettlementBatch(SettlementBatchStatus.CLOSED)).toBe(false);

    expect(canExportSettlementBatch(SettlementBatchStatus.DRAFT)).toBe(false);
    expect(canExportSettlementBatch(SettlementBatchStatus.APPROVED)).toBe(true);
    expect(canExportSettlementBatch(SettlementBatchStatus.EXPORTED)).toBe(false);
    expect(canExportSettlementBatch(SettlementBatchStatus.CLOSED)).toBe(false);

    expect(
      canCloseSettlementBatch({
        status: SettlementBatchStatus.EXPORTED,
        lineStatuses: [SettlementLineStatus.PAID, SettlementLineStatus.REVERSED],
      }),
    ).toBe(true);
    expect(
      canCloseSettlementBatch({
        status: SettlementBatchStatus.APPROVED,
        lineStatuses: [SettlementLineStatus.PAID, SettlementLineStatus.REVERSED],
      }),
    ).toBe(false);
    expect(
      canCloseSettlementBatch({
        status: SettlementBatchStatus.EXPORTED,
        lineStatuses: [SettlementLineStatus.PAID, SettlementLineStatus.EXPORTED],
      }),
    ).toBe(false);
  });
});
