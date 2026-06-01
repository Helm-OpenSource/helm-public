import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildSelfCheckConsolidationAudit } from "../scripts/self-check-consolidation-audit";

const legacySelfCheckSource = readFileSync("scripts/helm-self-check.ts", "utf8");
const refactoredSelfCheckSource = readFileSync(
  "scripts/helm-self-check-refactored.ts",
  "utf8",
);
const dashboardRouteSource = readFileSync("app/(workspace)/dashboard/page.tsx", "utf8");
const dashboardViewModelSource = readFileSync("features/dashboard/view-model.ts", "utf8");

const migratedPageSupportGuardNames = [
  "worker_skill_resource_page_support",
  "shared_proactive_component_markers",
] as const;

const workerSkillResourcePageSupportSnippets = [
  "createWorkerSkillResourcePageSupport",
  "createEvidencePayloadGroups",
  "workerSkillResourceSprint2Blueprint",
  '"dashboard"',
  '"opportunities"',
  '"approvals"',
  "founder-risk-clarification",
  "sales-followup-draft",
  "sales-objection-response",
  "proposal-shaping-review",
  "review-note-preparation",
  "buildWorkerAssignments",
  "buildEvidenceGroups",
  "evidencePayloadGroupOrder",
  "replay_payload",
  "audit_payload",
  "memory_payload",
  "handoff_payload",
  "pageWorkerAssignments",
  "pageEvidenceGroups",
] as const;

const workerSkillResourcePageSupportPageMarkers = [
  ["features/dashboard/view-model.ts", 'pageId: "dashboard"'],
  ["features/opportunities/opportunities-client.tsx", 'pageId: "opportunities"'],
  ["features/approvals/approvals-client.tsx", 'pageId: "approvals"'],
] as const;

const proactivePanelSnippets = [
  "data-active-reporting",
  "data-active-report-summary",
  "data-worker-assignment",
  'data-page-layer="frontstage"',
  'data-page-layer="midstage"',
  'data-page-layer="backstage"',
] as const;

const proactiveSharedComponentSnippets = [
  "data-collaboration-request",
  "data-active-evidence",
] as const;

const detailContractGuardNames = [
  "proposal_package_pages_and_contract",
  "customer_facing_offer_external_proposal_pages_and_contract",
  "commitment_reinforcement_sendability_pages_and_contract",
] as const;

describe("page support self-check consolidation", () => {
  it("keeps the two migrated legacy static snippet guards in the refactored default", () => {
    for (const guardName of migratedPageSupportGuardNames) {
      expect(refactoredSelfCheckSource).toContain(`runCheck("${guardName}"`);
    }
  });

  it("migrates worker/skill/resource page support snippets with the current dashboard owner", () => {
    expect(legacySelfCheckSource).toContain('runCheck("worker_skill_resource_page_support"');
    expect(refactoredSelfCheckSource).toContain(
      'trackedFiles: ["lib/worker-skill-resource/presentation.ts"]',
    );

    for (const snippet of workerSkillResourcePageSupportSnippets) {
      expect(legacySelfCheckSource).toContain(snippet);
      expect(refactoredSelfCheckSource).toContain(snippet);
    }

    expect(legacySelfCheckSource).toContain("app/(workspace)/dashboard/page.tsx");
    expect(dashboardRouteSource).not.toContain("createWorkerSkillResourcePageSupport");
    expect(dashboardViewModelSource).toContain("createWorkerSkillResourcePageSupport");
    expect(dashboardViewModelSource).toContain('pageId: "dashboard"');

    for (const [file, pageId] of workerSkillResourcePageSupportPageMarkers) {
      expect(refactoredSelfCheckSource).toContain(file);
      expect(legacySelfCheckSource).toContain(pageId);
      expect(refactoredSelfCheckSource).toContain(pageId);
    }
  });

  it("keeps shared proactive component marker snippets equivalent to legacy", () => {
    expect(legacySelfCheckSource).toContain('runCheck("shared_proactive_component_markers"');
    expect(refactoredSelfCheckSource).toContain(
      'trackedFiles: ["components/shared/proactive-mechanism-panel.tsx"]',
    );
    expect(refactoredSelfCheckSource).toContain(
      'trackedFiles: ["components/shared/narrative-components.tsx"]',
    );

    for (const snippet of proactivePanelSnippets) {
      expect(legacySelfCheckSource).toContain(snippet);
      expect(refactoredSelfCheckSource).toContain(snippet);
    }

    for (const snippet of proactiveSharedComponentSnippets) {
      expect(legacySelfCheckSource).toContain(snippet);
      expect(refactoredSelfCheckSource).toContain(snippet);
    }
  });

  it("keeps follow-up detail contract guards migrated", () => {
    for (const guardName of detailContractGuardNames) {
      expect(legacySelfCheckSource).toContain(`runCheck("${guardName}"`);
      expect(refactoredSelfCheckSource).toContain(`runCheck("${guardName}"`);
    }
  });

  it("increases refactored coverage while keeping the consolidation audit as a blocker", () => {
    const audit = buildSelfCheckConsolidationAudit();

    expect(audit.refactored.runCheckCount).toBeGreaterThanOrEqual(47);
    expect(audit.coverageGap.legacyMinusRefactoredRunCheckCount).toBeLessThan(169);
    expect(audit.ok).toBe(false);
    expect(audit.mechanicalIntegrityOk).toBe(true);
    expect(audit.blockerRules).toContain("refactored_self_check_coverage_below_default_switch_floor");
    expect(audit.blockerRules).toContain("legacy_refactored_coverage_gap_must_be_migrated");
  });
});
