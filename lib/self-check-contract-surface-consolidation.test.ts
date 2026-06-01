import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildSelfCheckConsolidationAudit } from "../scripts/self-check-consolidation-audit";

const legacySelfCheckSource = readFileSync("scripts/helm-self-check.ts", "utf8");
const refactoredSelfCheckSource = readFileSync(
  "scripts/helm-self-check-refactored.ts",
  "utf8",
);

const migratedContractSurfaceGuardNames = [
  "worker_skill_resource_contract_schema",
  "page_header_briefing",
] as const;

const workerSkillResourceContractSnippets = [
  "workerSkillResourceContractPrinciples",
  "controlPlaneGovernedChecks",
  "effectModes",
  "workerContractSchema",
  "skillContractSchema",
  "resourceBindingContractSchema",
  "resourceContractSchema",
  "workerSkillResourceContractBundleSchema",
  "workerSkillResourceSprint1Blueprint",
  "workerSkillResourceSprint2Blueprint",
  "optionalSkills",
  "applicableRoles",
  "requiresApproval",
  "fallbackBindings",
  "objection-handling-skill",
  "proposal-shaping-skill",
  "review-note-skill",
  "risk-clarification-skill",
  "customer-facing skills must require review",
  "customer-facing skills must stay non-commitment-only",
  "approval-required skills must also require review",
  "Sprint 1 does not permit autonomous customer-visible send skills",
] as const;

const pageHeaderBriefingSnippets = [
  "takeaways",
  "decisions",
  "我现在看到的重点",
  "现在要确认",
] as const;

describe("contract surface self-check consolidation", () => {
  it("keeps the two migrated legacy static snippet guards in the refactored default", () => {
    for (const guardName of migratedContractSurfaceGuardNames) {
      expect(refactoredSelfCheckSource).toContain(`runCheck("${guardName}"`);
    }
  });

  it("keeps worker/skill/resource contract snippets equivalent to legacy", () => {
    expect(legacySelfCheckSource).toContain('runCheck("worker_skill_resource_contract_schema"');
    expect(refactoredSelfCheckSource).toContain('trackedFiles: ["lib/worker-skill-resource/contract.ts"]');

    for (const snippet of workerSkillResourceContractSnippets) {
      expect(legacySelfCheckSource).toContain(snippet);
      expect(refactoredSelfCheckSource).toContain(snippet);
    }
  });

  it("keeps page header briefing snippets equivalent to legacy", () => {
    expect(legacySelfCheckSource).toContain('runCheck("page_header_briefing"');
    expect(refactoredSelfCheckSource).toContain('trackedFiles: ["components/shared/page-header.tsx"]');

    for (const snippet of pageHeaderBriefingSnippets) {
      expect(legacySelfCheckSource).toContain(snippet);
      expect(refactoredSelfCheckSource).toContain(snippet);
    }
  });

  it("increases refactored coverage while keeping the consolidation audit as a blocker", () => {
    const audit = buildSelfCheckConsolidationAudit();

    expect(audit.refactored.runCheckCount).toBeGreaterThanOrEqual(45);
    expect(audit.coverageGap.legacyMinusRefactoredRunCheckCount).toBeLessThan(171);
    expect(audit.ok).toBe(false);
    expect(audit.mechanicalIntegrityOk).toBe(true);
    expect(audit.blockerRules).toContain("refactored_self_check_coverage_below_default_switch_floor");
    expect(audit.blockerRules).toContain("legacy_refactored_coverage_gap_must_be_migrated");
  });
});
