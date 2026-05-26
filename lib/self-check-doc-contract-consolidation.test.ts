import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildSelfCheckConsolidationAudit } from "../scripts/self-check-consolidation-audit";

const refactoredSelfCheckSource = readFileSync(
  "scripts/helm-self-check-refactored.ts",
  "utf8",
);

const migratedDocContractGuardNames = [
  "root_agents_contract",
  "codex_docs",
  "codex_skills",
  "product_principles_and_priority_mapping_are_indexed",
] as const;

describe("doc contract self-check consolidation", () => {
  it("keeps the migrated low-risk static doc contract guards in the refactored default", () => {
    for (const guardName of migratedDocContractGuardNames) {
      expect(refactoredSelfCheckSource).toContain(`runCheck("${guardName}"`);
    }
  });

  it("uses config-owned codex docs and skill paths instead of inline large arrays", () => {
    const configSource = readFileSync("scripts/self-check/config.ts", "utf8");

    expect(configSource).toContain("requiredCodexDocs");
    expect(configSource).toContain("requiredSkillFiles");
    expect(refactoredSelfCheckSource).toContain("requiredCodexDocs");
    expect(refactoredSelfCheckSource).toContain("requiredSkillFiles");
  });

  it("increases refactored coverage while keeping the consolidation audit as a blocker", () => {
    const audit = buildSelfCheckConsolidationAudit();

    expect(audit.refactored.runCheckCount).toBeGreaterThanOrEqual(37);
    expect(audit.coverageGap.legacyMinusRefactoredRunCheckCount).toBeLessThan(181);
    expect(audit.ok).toBe(false);
    expect(audit.mechanicalIntegrityOk).toBe(true);
    expect(audit.blockerRules).toContain("refactored_self_check_coverage_below_default_switch_floor");
    expect(audit.blockerRules).toContain("legacy_refactored_coverage_gap_must_be_migrated");
  });
});
