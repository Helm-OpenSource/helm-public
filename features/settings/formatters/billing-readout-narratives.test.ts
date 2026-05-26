import { describe, expect, it } from "vitest";
import {
  buildPaidWithoutExportOperatorReadout,
  buildPayoutRailReadinessNarrative,
  buildSettlementExceptionNarrative,
  buildSettlementOpsProofNarrative,
} from "@/features/settings/formatters/billing-readout-narratives";

describe("billing readout narratives", () => {
  it("keeps paid-without-export audit explicit in proof-pack narrative", () => {
    const narrative = buildSettlementOpsProofNarrative({
      english: true,
      requiredBeneficiaryCount: 3,
      paidWithoutExportCount: 2,
    });

    expect(narrative).toContain("2 paid line(s)");
    expect(narrative).toContain("export-evidence audit");
  });

  it("keeps paid-without-export watchpoint explicit in readiness narrative", () => {
    const narrative = buildPayoutRailReadinessNarrative({
      english: true,
      status: "CONDITIONAL_GO",
      paidWithoutExportCount: 1,
      watchpoints: ["PAID_WITHOUT_EXPORT_ANOMALIES"],
    });

    expect(narrative).toContain("1 paid line(s)");
    expect(narrative).toContain("Audit those lines before treating them as completion proof");
  });

  it("keeps paid-without-export audit explicit in exception narrative", () => {
    const narrative = buildSettlementExceptionNarrative({
      english: true,
      openExceptionCount: 4,
      paidWithoutExportCount: 1,
      reversalCount: 0,
    });

    expect(narrative).toContain("4 open settlement exceptions");
    expect(narrative).toContain("1 paid line(s) that still lack export evidence");
  });

  it("keeps one shared paid-without-export next move across readouts", () => {
    expect(
      buildPaidWithoutExportOperatorReadout({
        english: true,
        paidWithoutExportCount: 2,
        scope: "proof",
      }),
    ).toContain("2 paid line(s)");
    expect(
      buildPaidWithoutExportOperatorReadout({
        english: true,
        paidWithoutExportCount: 2,
        scope: "readiness",
      }),
    ).toContain("credible rail-readiness evidence");
    expect(
      buildPaidWithoutExportOperatorReadout({
        english: true,
        paidWithoutExportCount: 2,
        scope: "exception",
      }),
    ).toContain("proof, readiness, and exception readouts stay aligned");
  });
});
