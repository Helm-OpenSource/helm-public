import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildSelfCheckConsolidationAudit } from "../scripts/self-check-consolidation-audit";

const root = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("self-check consolidation slice 7", () => {
  const refactoredSelfCheck = readRepoFile("scripts/helm-self-check-refactored.ts");
  const selfCheckConfig = readRepoFile("scripts/self-check/config.ts");
  const decisionFirstBoundaryCheck = readRepoFile("scripts/decision-first-boundary-check.ts");
  const legacySelfCheck = readRepoFile("scripts/helm-self-check.ts");
  const migratedSources = [refactoredSelfCheck, selfCheckConfig].join("\n");

  it("keeps the five migrated legacy guard names as explicit refactored runCheck calls", () => {
    for (const guardName of [
      "shared_reporting_panel",
      "shared_narrative_components",
      "shared_proactive_panel",
      "page_section_anchor_contract",
      "reporting_protocol_density_limits",
    ]) {
      expect(refactoredSelfCheck).toContain(`runCheck("${guardName}"`);
    }
  });

  it("represents the current-main shared panel and reporting markers from decision-first-boundary-check", () => {
    for (const currentMainGuardName of [
      "shared_reporting_panel_keeps_page_hierarchy_markers",
      "shared_proactive_panel_keeps_page_hierarchy_markers",
      "shared_narrative_components_keep_required_markers",
      "evidence_targets_keep_section_anchor_contract",
      "reporting_protocol_keeps_density_limits",
    ]) {
      expect(decisionFirstBoundaryCheck).toContain(currentMainGuardName);
    }

    for (const marker of [
      "pageWorkerAssignments",
      "pageEvidenceGroups",
      "data-evidence-chip",
      "BoundaryNote",
      "memory-work-timeline",
      "reportingDensityLimits.whyItMattersMin",
      "reportingDensityLimits.whyItMattersMax",
      "reportingDensityLimits.nextActionPrimaryCount",
      "reportingDensityLimits.nextActionSecondaryMax",
    ]) {
      expect(decisionFirstBoundaryCheck).toContain(marker);
      expect(migratedSources).toContain(marker);
    }
  });

  it("uses current-main section-anchor usage markers instead of stale legacy variants", () => {
    for (const currentUsageMarker of [
      ["dashboard", "buildSectionHref"],
      ["opportunities", "scrollToWindowHashTarget"],
      ["approvals", "scrollToWindowHashTarget"],
      ["memory", "MEMORY_PAGE_ANCHORS"],
    ] as const) {
      const [surface, marker] = currentUsageMarker;
      expect(migratedSources).toContain(surface);
      expect(migratedSources).toContain(marker);
    }

    expect(migratedSources).not.toContain('["opportunities", "OPPORTUNITY_PAGE_ANCHORS"]');
    expect(migratedSources).not.toContain('["approvals", "APPROVAL_PAGE_ANCHORS"]');
  });

  it("does not migrate stale variants and package-variants guard names in this slice", () => {
    for (const staleGuardName of [
      "package_variants_reinforcement_variants_pages_and_contract",
      "package_variants_reinforcement_variants_baseline_freeze_assets",
      "package_stage_variants_strengthening_pages_and_contract",
    ]) {
      expect(legacySelfCheck).toContain(`runCheck("${staleGuardName}"`);
      expect(refactoredSelfCheck).not.toContain(`runCheck("${staleGuardName}"`);
    }
  });

  it("keeps consolidation audit expected-failing with the current follow-up coverage gap", () => {
    const audit = buildSelfCheckConsolidationAudit(root);

    expect(audit.mechanicalIntegrityOk).toBe(true);
    expect(audit.ok).toBe(false);
    expect(audit.coverageGap.legacyMinusRefactoredRunCheckCount).toBe(155);
    expect(audit.coverageGap.legacyMinusRefactoredRunCheckCount).toBeLessThan(164);
    expect(audit.blockerRules).toEqual([
      "refactored_self_check_coverage_below_default_switch_floor",
      "legacy_refactored_coverage_gap_must_be_migrated",
    ]);
  });
});
