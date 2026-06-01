import { SettlementLineStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  hasExportBackedSettlementCompletionEvidence,
  hasExportBackedSettlementReversalEvidence,
  hasPaidWithoutExportSettlementAnomaly,
} from "@/lib/billing/settlement-evidence";

describe("settlement evidence helpers", () => {
  it("only counts export-backed paid or reversed lines as manual completion evidence", () => {
    expect(
      hasExportBackedSettlementCompletionEvidence({
        status: SettlementLineStatus.PAID,
        exportedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    ).toBe(true);
    expect(
      hasExportBackedSettlementCompletionEvidence({
        status: SettlementLineStatus.REVERSED,
        exportedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    ).toBe(true);
    expect(
      hasExportBackedSettlementCompletionEvidence({
        status: SettlementLineStatus.PAID,
        exportedAt: null,
      }),
    ).toBe(false);
    expect(
      hasExportBackedSettlementCompletionEvidence({
        status: SettlementLineStatus.EXPORTED,
        exportedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("only counts export-backed reversed lines as reversal evidence", () => {
    expect(
      hasExportBackedSettlementReversalEvidence({
        status: SettlementLineStatus.REVERSED,
        exportedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    ).toBe(true);
    expect(
      hasExportBackedSettlementReversalEvidence({
        status: SettlementLineStatus.REVERSED,
        exportedAt: null,
      }),
    ).toBe(false);
  });

  it("keeps paid-without-export anomalies explicit", () => {
    expect(
      hasPaidWithoutExportSettlementAnomaly({
        status: SettlementLineStatus.PAID,
        exportedAt: null,
      }),
    ).toBe(true);
    expect(
      hasPaidWithoutExportSettlementAnomaly({
        status: SettlementLineStatus.PAID,
        exportedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    ).toBe(false);
    expect(
      hasPaidWithoutExportSettlementAnomaly({
        status: SettlementLineStatus.REVERSED,
        exportedAt: null,
      }),
    ).toBe(false);
  });
});
