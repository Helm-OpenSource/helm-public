import { describe, expect, it } from "vitest";

import {
  buildSelfCheckConsolidationAudit,
  formatSelfCheckConsolidationAudit,
  testOnly,
} from "../scripts/self-check-consolidation-audit";

const packageJson = JSON.stringify({
  scripts: {
    "self-check": "tsx scripts/helm-self-check-refactored.ts",
  },
});

const modernMarkers = [
  "no runtime/API/UI/schema/connector",
  "Tenant Resource Integration Governance",
  "Intelligence Growth P0 offline gate",
  "safeWriteAuditLog",
  "Bundle manifest read-only validator passes",
].join("\n");

function runChecks(count: number): string {
  return Array.from({ length: count }, (_, index) => `runCheck("check_${index}", () => "ok");`).join("\n");
}

describe("self-check consolidation audit", () => {
  it("keeps package self-check pointed at the refactored gate", () => {
    const audit = buildSelfCheckConsolidationAudit();

    expect(audit.defaultCommand).toBe("node --import tsx scripts/helm-self-check-refactored.ts");
    expect(audit.defaultUsesRefactored).toBe(true);
  });

  it("keeps the legacy self-check as a wide non-wrapper source of migration coverage", () => {
    const audit = buildSelfCheckConsolidationAudit();

    expect(audit.legacy.runCheckCount).toBeGreaterThanOrEqual(200);
    expect(audit.legacy.isWide).toBe(true);
    expect(audit.legacy.isWrapper).toBe(false);
  });

  it("records that refactored self-check is narrower than legacy and must not become the final switch yet", () => {
    const audit = buildSelfCheckConsolidationAudit();

    expect(audit.refactored.runCheckCount).toBeLessThan(audit.legacy.runCheckCount);
    expect(audit.coverageGap.refactoredIsNarrowerThanLegacy).toBe(true);
    expect(audit.coverageGap.legacyMinusRefactoredRunCheckCount).toBeGreaterThan(0);
    expect(audit.migrationDecision).toBe("migrate_legacy_guards_before_default_switch");
    expect(audit.blockerRules).toContain("legacy_refactored_coverage_gap_must_be_migrated");
  });

  it("requires modern guard markers to remain visible in the refactored self-check", () => {
    const audit = buildSelfCheckConsolidationAudit();

    expect(audit.refactored.hasModernGuardMarkers).toBe(true);
    expect(audit.refactored.missingModernGuardMarkers).toEqual([]);
  });

  it("fails the consolidation audit until legacy coverage is migrated into the default self-check", () => {
    const audit = buildSelfCheckConsolidationAudit();
    const output = formatSelfCheckConsolidationAudit(audit);

    expect(audit.mechanicalIntegrityOk).toBe(true);
    expect(audit.ok).toBe(false);
    expect(audit.failedRules).toContain("refactored_self_check_coverage_below_default_switch_floor");
    expect(output).toContain("status: FAIL");
    expect(output).toContain("mechanical integrity: PASS");
    expect(output).toContain("migration decision: migrate_legacy_guards_before_default_switch");
  });

  it("fails when the legacy wide guard is wrapperized", () => {
    const audit = testOnly.buildSelfCheckConsolidationAuditFromInput({
      packageJson,
      legacySource: `${runChecks(215)}\nhelmSelfCheckRefactored();`,
      refactoredSource: `${modernMarkers}\n${runChecks(215)}`,
    });

    expect(audit.ok).toBe(false);
    expect(audit.mechanicalIntegrityOk).toBe(false);
    expect(audit.failedRules).toContain("legacy_self_check_must_not_be_wrapperized");
  });

  it("counts executable runCheck calls instead of comments or strings", () => {
    const audit = testOnly.buildSelfCheckConsolidationAuditFromInput({
      packageJson,
      legacySource: `${runChecks(199)}\n// runCheck("commented", () => "ok");\nconst fake = "runCheck(";`,
      refactoredSource: `${modernMarkers}\n${runChecks(215)}`,
    });

    expect(audit.legacy.runCheckCount).toBe(199);
    expect(audit.ok).toBe(false);
    expect(audit.failedRules).toContain("legacy_self_check_must_remain_wide");
  });

  it("fails when the refactored default reaches parity but loses a modern marker", () => {
    const audit = testOnly.buildSelfCheckConsolidationAuditFromInput({
      packageJson,
      legacySource: runChecks(215),
      refactoredSource: `${modernMarkers.replace("safeWriteAuditLog", "")}\n${runChecks(215)}`,
    });

    expect(audit.ok).toBe(false);
    expect(audit.failedRules).toContain("refactored_self_check_missing_modern_guard_markers");
  });

  it("passes only after the refactored default reaches the migration coverage floor", () => {
    const audit = testOnly.buildSelfCheckConsolidationAuditFromInput({
      packageJson,
      legacySource: runChecks(215),
      refactoredSource: `${modernMarkers}\n${runChecks(215)}`,
    });

    expect(audit.ok).toBe(true);
    expect(audit.mechanicalIntegrityOk).toBe(true);
    expect(audit.failedRules).toEqual([]);
  });
});
