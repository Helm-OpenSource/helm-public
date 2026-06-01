import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildSelfCheckConsolidationAudit } from "../scripts/self-check-consolidation-audit";

const refactoredSelfCheckSource = readFileSync(
  "scripts/helm-self-check-refactored.ts",
  "utf8",
);

const migratedBusinessLoopGapGuardNames = [
  "business_loop_operating_gap_wiring_is_indexed",
  "business_loop_gap_aggregation_is_indexed",
  "business_loop_gap_readout_is_indexed",
  "business_loop_gap_surface_expansion_is_indexed",
  "business_loop_gap_operator_surface_expansion_is_indexed",
  "business_loop_gap_opportunity_surface_is_indexed",
  "business_loop_gap_customer_success_queue_is_indexed",
  "business_loop_gap_readout_helper_is_indexed",
  "business_loop_gap_readout_guard_is_enforced",
] as const;

describe("business-loop gap self-check consolidation", () => {
  it("keeps the migrated legacy business-loop gap guard family in the refactored default", () => {
    for (const guardName of migratedBusinessLoopGapGuardNames) {
      expect(refactoredSelfCheckSource).toContain(`runCheck("${guardName}"`);
    }
  });

  it("keeps the business-loop readout helper guard from regressing to page-local primaryGap mapping", () => {
    expect(refactoredSelfCheckSource).toContain("businessLoopGapReadoutGuardedSurfaces");
    expect(refactoredSelfCheckSource).toContain("buildBusinessLoopGapReadout");
    expect(refactoredSelfCheckSource).toContain('!surface.includes("buildBusinessLoopGapReadout")');
    expect(refactoredSelfCheckSource).toContain("businessLoopGapSummary.primaryGap");
  });

  it("increases refactored coverage while keeping the consolidation audit as a blocker", () => {
    const audit = buildSelfCheckConsolidationAudit();

    expect(audit.refactored.runCheckCount).toBeGreaterThan(24);
    expect(audit.coverageGap.legacyMinusRefactoredRunCheckCount).toBeLessThan(190);
    expect(audit.ok).toBe(false);
    expect(audit.blockerRules).toContain("refactored_self_check_coverage_below_default_switch_floor");
    expect(audit.blockerRules).toContain("legacy_refactored_coverage_gap_must_be_migrated");
  });
});
