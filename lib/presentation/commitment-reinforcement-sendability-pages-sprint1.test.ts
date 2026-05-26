import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("commitment reinforcement / sendability decision-first pages sprint 1", () => {
  it("keeps the sprint 1 docs present", () => {
    const requiredDocs = [
      "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_DETAIL_CONTRACT_REPORT.md",
      "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_PAGES_REPORT.md",
      "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_STRUCTURE_REPORT.md",
      "docs/reviews/COMMITMENT_REINFORCEMENT_SENDABILITY_ALIGNMENT_REPORT.md",
      "docs/product/COMMITMENT_REINFORCEMENT_SENDABILITY_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
    ];

    for (const relativePath of requiredDocs) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps README and docs index pointed at the reinforcement/sendability reports", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "COMMITMENT_REINFORCEMENT_SENDABILITY_DETAIL_CONTRACT_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_PAGES_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_STRUCTURE_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_ALIGNMENT_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps reinforcement/sendability routes, contract and page markers aligned", () => {
    const reinforcementRoute = read("app/(workspace)/reinforcements/[id]/page.tsx");
    const sendabilityRoute = read("app/(workspace)/sendability/[id]/page.tsx");
    const detailView = read(
      "features/commitment-reinforcement-sendability/detail-view.tsx",
    );
    const detailModel = read(
      "features/commitment-reinforcement-sendability/detail-model.ts",
    );
    const contract = read(
      "lib/presentation/commitment-reinforcement-sendability-detail-contract.ts",
    );
    const externalExpressionView = read(
      "features/customer-facing-offer-external-proposal/detail-view.tsx",
    );

    for (const snippet of [
      "CommitmentReinforcementSendabilityDetailView",
      "buildCommitmentReinforcementPageContract",
      "buildProposalPackageCommercialDetail",
    ]) {
      expect(reinforcementRoute).toContain(snippet);
    }

    for (const snippet of [
      "CommitmentReinforcementSendabilityDetailView",
      "buildSendabilityPageContract",
      "buildProposalPackageCommercialDetail",
    ]) {
      expect(sendabilityRoute).toContain(snippet);
    }

    for (const snippet of [
      "data-commitment-reinforcement-sendability-page",
      "data-commitment-reinforcement-page",
      "data-sendability-page",
      'data-page-layer="frontstage"',
      'data-page-layer="midstage"',
      'data-page-layer="backstage"',
      'data-page-layer="evidence"',
      'data-frontstage-block="current-summary"',
      'data-frontstage-block="decision-request"',
      'data-frontstage-block="next-action"',
      'data-frontstage-block="boundary"',
      "ReviewSnapshotBlock",
      "WhyItMattersBlock",
      "BoundaryNote",
      "EvidenceDrawer",
    ]) {
      expect(detailView).toContain(snippet);
    }

    for (const snippet of [
      "reinforcementPageJudgement",
      "reinforcementPageStrengthMode",
      "sendabilityPageJudgement",
      "sendabilityPageMode",
      "commitmentReinforcementSendabilityEvidenceGroupIds",
      "customer-visible-reinforcement",
      "reinforcement-after-review",
      "reinforcement-blocked",
      "boundary-only-reinforcement",
      "safe-with-risk-note",
      "review-before-send",
      "not-safe-to-send",
      "internal-only",
    ]) {
      expect(contract).toContain(snippet);
    }

    for (const snippet of [
      "recommendation、仅讨论 和仅边界加固仍然不等于承诺。",
      "reinforcement_trace",
      "review-before-send",
      "sendability gate",
    ]) {
      expect(detailModel).toContain(snippet);
    }

    for (const snippet of ["/reinforcements/", "/sendability/"]) {
      expect(externalExpressionView).toContain(snippet);
    }
  });

  it("keeps checks and delivery assets aligned to the reinforcement/sendability pages", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const pilotReadiness = read("scripts/pilot-readiness-check.ts");
    const demoScript = read("docs/product/demo-script.md");
    const manualAcceptance = read("docs/pilot/manual-acceptance-paths.md");
    const deliveryBoundary = read("docs/pilot/delivery-boundary.md");
    const principles = read("docs/product/product-principles.md");

    for (const snippet of [
      "COMMITMENT_REINFORCEMENT_SENDABILITY_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
      "COMMITMENT_REINFORCEMENT_SENDABILITY_DETAIL_CONTRACT_REPORT.md",
    ]) {
      expect(selfCheck).toContain(snippet);
      expect(pilotReadiness).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "commitment_reinforcement_sendability_pages_keep_strength_and_sendability_boundaries",
    );
    expect(demoScript).toContain(
      "Commitment Reinforcement / Sendability Decision-first Pages",
    );
    expect(manualAcceptance).toContain(
      "路径 L：Commitment Reinforcement / Sendability Decision-first Pages",
    );
    expect(deliveryBoundary).toContain(
      "commitment reinforcement / sendability detail",
    );
    expect(principles).toContain(
      "commitment reinforcement / sendability 详情页",
    );
  });
});
