import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("proposal / package decision-first pages sprint 1", () => {
  it("keeps the sprint 1 docs present", () => {
    const requiredDocs = [
      "docs/product/PROPOSAL_PACKAGE_DETAIL_REPORTING_CONTRACT_REPORT.md",
      "docs/product/PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_REPORT.md",
      "docs/product/PROPOSAL_PACKAGE_BOUNDARY_EVIDENCE_STRUCTURE_REPORT.md",
      "docs/reviews/PROPOSAL_PACKAGE_PAGES_ALIGNMENT_REPORT.md",
      "docs/product/PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
    ];

    for (const relativePath of requiredDocs) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps README and docs index pointed at the proposal/package reports", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "PROPOSAL_PACKAGE_DETAIL_REPORTING_CONTRACT_REPORT.md",
      "PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_REPORT.md",
      "PROPOSAL_PACKAGE_BOUNDARY_EVIDENCE_STRUCTURE_REPORT.md",
      "PROPOSAL_PACKAGE_PAGES_ALIGNMENT_REPORT.md",
      "PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps proposal/package routes, contract and page markers aligned", () => {
    const proposalRoute = read("app/(workspace)/proposals/[id]/page.tsx");
    const packageRoute = read("app/(workspace)/packages/[id]/page.tsx");
    const detailView = read(
      "features/proposal-package/proposal-package-detail-view.tsx",
    );
    const detailModel = read("features/proposal-package/detail-model.ts");
    const contract = read(
      "lib/presentation/proposal-package-detail-contract.ts",
    );
    const opportunities = read("features/opportunities/opportunities-client.tsx");

    for (const snippet of [
      "ProposalPackageDetailView",
      "buildProposalPackageCommercialDetail",
      "buildProposalPageContract",
    ]) {
      expect(proposalRoute).toContain(snippet);
    }

    for (const snippet of [
      "ProposalPackageDetailView",
      "buildProposalPackageCommercialDetail",
      "buildPackagePageContract",
    ]) {
      expect(packageRoute).toContain(snippet);
    }

    for (const snippet of [
      "data-proposal-package-page",
      "data-proposal-page",
      "data-package-page",
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
      "proposalPageJudgement",
      "proposalPageBoundarySummary",
      "packagePageJudgement",
      "packagePageBoundarySummary",
      "proposalPackageEvidenceGroupIds",
      "customer_safe_review",
      "non_commitment_window",
    ]) {
      expect(contract).toContain(snippet);
    }

    for (const snippet of [
      "recommendation 仍不等于承诺",
      "方案包措辞仍只是商业整形产物",
      "boundary_trace",
      "historical_changes",
    ]) {
      expect(detailModel).toContain(snippet);
    }

    expect(opportunities).toContain("sales-delivery-package-window");
    expect(opportunities).toContain("/proposals/");
    expect(opportunities).toContain("/packages/");
  });

  it("keeps checks and delivery assets aligned to the proposal/package pages", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const pilotReadiness = read("scripts/pilot-readiness-check.ts");
    const demoScript = read("docs/product/demo-script.md");
    const manualAcceptance = read("docs/pilot/manual-acceptance-paths.md");
    const deliveryBoundary = read("docs/pilot/delivery-boundary.md");

    for (const snippet of [
      "PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
      "PROPOSAL_PACKAGE_DETAIL_REPORTING_CONTRACT_REPORT.md",
    ]) {
      expect(selfCheck).toContain(snippet);
      expect(pilotReadiness).toContain(snippet);
    }

    expect(boundaryCheck).toContain("proposal_package_pages_keep_judgement_boundary_and_evidence");
    expect(demoScript).toContain("Proposal / Package Decision-first Pages");
    expect(manualAcceptance).toContain("路径 J：Proposal / Package Decision-first Pages");
    expect(deliveryBoundary).toContain("proposal / package detail");
  });
});
