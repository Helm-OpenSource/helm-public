import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildSelfCheckConsolidationAudit } from "../scripts/self-check-consolidation-audit";

const root = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("self-check consolidation slice 8", () => {
  const refactoredSelfCheck = readRepoFile("scripts/helm-self-check-refactored.ts");
  const selfCheckConfig = readRepoFile("scripts/self-check/config.ts");
  const decisionFirstBoundaryCheck = readRepoFile("scripts/decision-first-boundary-check.ts");
  const legacySelfCheck = readRepoFile("scripts/helm-self-check.ts");
  const migratedSources = [refactoredSelfCheck, selfCheckConfig].join("\n");

  it("keeps the three migrated conversation / external narrative guard names as explicit refactored runCheck calls", () => {
    for (const guardName of [
      "conversation_external_narrative_pages_and_contract",
      "conversation_external_narrative_detail_chain_assets",
      "conversation_external_narrative_baseline_freeze_assets",
    ]) {
      expect(refactoredSelfCheck).toContain(`runCheck("${guardName}"`);
    }
  });

  it("represents current-main conversation / external narrative route and boundary markers", () => {
    for (const currentMainMarker of [
      "conversation_external_narrative_pages_keep_scene_level_and_non_commitment_boundaries",
      "ConversationDetailView",
      "buildConversationDetailPageContract",
      "buildProposalPackageCommercialDetail",
      "ExternalNarrativeDetailView",
      "buildExternalNarrativeDetailPageContract",
      "对话 guidance 可以改变重点、节奏和场景适配，但它仍然不能悄悄把仅讨论措辞变成承诺。",
      "对外叙事可以提高清晰度和信心，但它仍然不能悄悄把建议硬化成承诺。",
    ]) {
      expect(decisionFirstBoundaryCheck).toContain(currentMainMarker);
      expect(migratedSources).toContain(currentMainMarker);
    }
  });

  it("represents current-main honest baseline-freeze markers", () => {
    for (const honestFreezeMarker of [
      "conversation_external_narrative_baseline_freeze_keeps_honest_boundary",
      "第一轮局部落地",
      "不是完整 messaging platform",
      "不是完整 sales enablement / battlecard / CRM 平台",
      "不是完整 commercial conversation engine",
      "package / offer -> conversation",
      "external proposal / reinforcement -> external narrative",
      "conversation <-> external narrative",
      "recommendation、review、boundary、decision request",
    ]) {
      expect(decisionFirstBoundaryCheck).toContain(honestFreezeMarker);
      expect(migratedSources).toContain(honestFreezeMarker);
    }
  });

  it("does not reintroduce stale legacy wording requirements", () => {
    for (const staleLegacySnippet of [
      "discussion-safe wording",
      "变成 commitment",
      "external narrative 可以提高清晰度和信心",
      "recommendation 硬化成 commitment",
    ]) {
      expect(legacySelfCheck).toContain(staleLegacySnippet);
      expect(migratedSources).not.toContain(staleLegacySnippet);
    }
  });

  it("does not migrate variants, inbox/followup, or customer-success guard names in this slice", () => {
    for (const guardName of [
      "package_variants_reinforcement_variants_pages_and_contract",
      "package_variants_reinforcement_variants_baseline_freeze_assets",
      "package_stage_variants_strengthening_pages_and_contract",
      "package_stage_strengthening_baseline_freeze_assets",
      "founder_sales_delivery_conversation_variants_pages_and_contract",
      "founder_sales_delivery_conversation_variants_assets",
      "founder_qa_variants_pages_and_contract",
      "founder_qa_variants_assets",
      "sales_objection_followup_variants_pages_and_contract",
      "sales_objection_followup_variants_assets",
      "delivery_walkthrough_review_variants_pages_and_contract",
      "delivery_walkthrough_review_variants_assets",
      "external_narrative_fallback_variants_pages_and_contract",
      "external_narrative_fallback_variants_assets",
      "inbox_followup_review_request_pages",
      "inbox_followup_review_request_assets",
      "customer_success_handoff_surface_pages",
      "customer_success_handoff_surface_assets",
      "customer_success_handoff_baseline_freeze_assets",
      "customer_success_handoff_v1_1_assets",
      "customer_success_deeper_polish_assets",
    ]) {
      expect(legacySelfCheck).toContain(`runCheck("${guardName}"`);
      expect(refactoredSelfCheck).not.toContain(`runCheck("${guardName}"`);
    }
  });

  it("keeps consolidation audit expected-failing while reducing the coverage gap by three", () => {
    const audit = buildSelfCheckConsolidationAudit(root);

    expect(audit.mechanicalIntegrityOk).toBe(true);
    expect(audit.ok).toBe(false);
    expect(audit.coverageGap.legacyMinusRefactoredRunCheckCount).toBe(145);
    expect(audit.coverageGap.legacyMinusRefactoredRunCheckCount).toBeLessThan(159);
    expect(audit.blockerRules).toEqual([
      "refactored_self_check_coverage_below_default_switch_floor",
      "legacy_refactored_coverage_gap_must_be_migrated",
    ]);
  });
});
