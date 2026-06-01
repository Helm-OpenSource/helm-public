import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildSelfCheckConsolidationAudit } from "../scripts/self-check-consolidation-audit";

const root = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("self-check consolidation slice 6", () => {
  const refactoredSelfCheck = readRepoFile("scripts/helm-self-check-refactored.ts");
  const selfCheckConfig = readRepoFile("scripts/self-check/config.ts");
  const decisionFirstBoundaryCheck = readRepoFile("scripts/decision-first-boundary-check.ts");
  const detailContracts = [
    "lib/presentation/proposal-package-detail-contract.ts",
    "lib/presentation/customer-facing-offer-external-proposal-detail-contract.ts",
    "lib/presentation/commitment-reinforcement-sendability-detail-contract.ts",
  ].map(readRepoFile).join("\n");
  const legacySelfCheck = readRepoFile("scripts/helm-self-check.ts");
  const migratedSources = [refactoredSelfCheck, selfCheckConfig].join("\n");

  it("keeps the three migrated legacy guard names as explicit refactored runCheck calls", () => {
    for (const guardName of [
      "proposal_package_pages_and_contract",
      "customer_facing_offer_external_proposal_pages_and_contract",
      "commitment_reinforcement_sendability_pages_and_contract",
    ]) {
      expect(refactoredSelfCheck).toContain(`runCheck("${guardName}"`);
    }
  });

  it("represents the current-main detail-page boundary markers from decision-first-boundary-check", () => {
    for (const marker of [
      "proposal_package_pages_keep_judgement_boundary_and_evidence",
      "customer_facing_offer_external_proposal_pages_keep_sendability_boundary_and_evidence",
      "commitment_reinforcement_sendability_pages_keep_strength_and_sendability_boundaries",
      "recommendation 仍不等于承诺",
      "方案包措辞仍只是商业整形产物",
      "recommendation、仅讨论",
      "recommendation、仅讨论 和仅边界加固仍然不等于承诺。",
      "sendability_trace",
      "reinforcement_trace",
      "sendability gate",
    ]) {
      expect(decisionFirstBoundaryCheck).toContain(marker);
    }

    for (const migratedMarker of [
      "recommendation 仍不等于承诺",
      "方案包措辞仍只是商业整形产物",
      "proposalPackageEvidenceGroupIds",
      "customerFacingOfferExternalProposalEvidenceGroupIds",
      "commitmentReinforcementSendabilityEvidenceGroupIds",
      "recommendation、仅讨论",
      "recommendation、仅讨论 和仅边界加固仍然不等于承诺。",
      "sendability_trace",
      "reinforcement_trace",
      "sendability gate",
    ]) {
      expect(migratedSources).toContain(migratedMarker);
    }
  });

  it("keeps current-main evidence group contract markers in the migrated guards", () => {
    for (const evidenceGroupMarker of [
      "proposalPackageEvidenceGroupIds",
      "customerFacingOfferExternalProposalEvidenceGroupIds",
      "commitmentReinforcementSendabilityEvidenceGroupIds",
    ]) {
      expect(detailContracts).toContain(evidenceGroupMarker);
      expect(migratedSources).toContain(evidenceGroupMarker);
    }
  });

  it("does not reintroduce stale legacy snippet requirements when current-main wording differs", () => {
    for (const staleLegacySnippet of [
      "recommendation 仍不等于 commitment",
      "package wording 仍只是商业整形产物",
      "recommendation、discussion-only",
      "recommendation、discussion-only 和 boundary-only reinforcement 仍然不等于 commitment。",
    ]) {
      expect(legacySelfCheck).toContain(staleLegacySnippet);
      expect(migratedSources).not.toContain(staleLegacySnippet);
    }
  });

  it("keeps consolidation audit expected-failing with the current follow-up coverage gap", () => {
    const audit = buildSelfCheckConsolidationAudit(root);

    expect(audit.mechanicalIntegrityOk).toBe(true);
    expect(audit.ok).toBe(false);
    expect(audit.coverageGap.legacyMinusRefactoredRunCheckCount).toBe(157);
    expect(audit.coverageGap.legacyMinusRefactoredRunCheckCount).toBeLessThan(167);
    expect(audit.blockerRules).toEqual([
      "refactored_self_check_coverage_below_default_switch_floor",
      "legacy_refactored_coverage_gap_must_be_migrated",
    ]);
  });
});
