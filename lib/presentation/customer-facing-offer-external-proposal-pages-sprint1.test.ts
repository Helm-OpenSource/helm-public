import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("customer-facing offer / external proposal decision-first pages sprint 1", () => {
  it("keeps the sprint 1 docs present", () => {
    const requiredDocs = [
      "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DETAIL_CONTRACT_REPORT.md",
      "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_PAGES_REPORT.md",
      "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_BOUNDARY_STRUCTURE_REPORT.md",
      "docs/reviews/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_ALIGNMENT_REPORT.md",
      "docs/product/CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
    ];

    for (const relativePath of requiredDocs) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps README and docs index pointed at the external expression reports", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DETAIL_CONTRACT_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_PAGES_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_BOUNDARY_STRUCTURE_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_ALIGNMENT_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps offer/external proposal routes, contract and page markers aligned", () => {
    const offerRoute = read("app/(workspace)/offers/[id]/page.tsx");
    const externalProposalRoute = read(
      "app/(workspace)/external-proposals/[id]/page.tsx",
    );
    const detailView = read(
      "features/customer-facing-offer-external-proposal/detail-view.tsx",
    );
    const detailModel = read(
      "features/customer-facing-offer-external-proposal/detail-model.ts",
    );
    const contract = read(
      "lib/presentation/customer-facing-offer-external-proposal-detail-contract.ts",
    );
    const proposalPackageView = read(
      "features/proposal-package/proposal-package-detail-view.tsx",
    );

    for (const snippet of [
      "CustomerFacingOfferExternalProposalDetailView",
      "buildCustomerFacingOfferPageContract",
      "buildProposalPackageCommercialDetail",
    ]) {
      expect(offerRoute).toContain(snippet);
    }

    for (const snippet of [
      "CustomerFacingOfferExternalProposalDetailView",
      "buildExternalProposalPageContract",
      "buildProposalPackageCommercialDetail",
    ]) {
      expect(externalProposalRoute).toContain(snippet);
    }

    for (const snippet of [
      "data-customer-facing-offer-external-proposal-page",
      "data-customer-facing-offer-page",
      "data-external-proposal-page",
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
      "customerOfferPageJudgement",
      "customerOfferPageSendabilityMode",
      "externalProposalPageJudgement",
      "externalProposalPageSendabilityMode",
      "customerFacingOfferExternalProposalEvidenceGroupIds",
      "safe_to_send",
      "review_before_send",
      "not_safe_to_send",
      "discussion_only",
    ]) {
      expect(contract).toContain(snippet);
    }

    for (const snippet of [
      "Recommendation, discussion-only and boundary notes still do not equal commitment.",
      "Recommendation, discussion-only language and proposal reinforcement still do not equal commitment.",
      "sendability_trace",
      "external-safe proposal",
    ]) {
      expect(detailModel).toContain(snippet);
    }

    for (const snippet of ["/offers/", "/external-proposals/"]) {
      expect(proposalPackageView).toContain(snippet);
    }
  });

  it("keeps checks and delivery assets aligned to the external expression pages", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const pilotReadiness = read("scripts/pilot-readiness-check.ts");
    const demoScript = read("docs/product/demo-script.md");
    const manualAcceptance = read("docs/pilot/manual-acceptance-paths.md");
    const deliveryBoundary = read("docs/pilot/delivery-boundary.md");
    const principles = read("docs/product/product-principles.md");

    for (const snippet of [
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md",
      "CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DETAIL_CONTRACT_REPORT.md",
    ]) {
      expect(selfCheck).toContain(snippet);
      expect(pilotReadiness).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "customer_facing_offer_external_proposal_pages_keep_sendability_boundary_and_evidence",
    );
    expect(demoScript).toContain(
      "Customer-facing Offer / External Proposal Decision-first Pages",
    );
    expect(manualAcceptance).toContain(
      "路径 K：Customer-facing Offer / External Proposal Decision-first Pages",
    );
    expect(deliveryBoundary).toContain(
      "customer-facing offer / external proposal detail",
    );
    expect(principles).toContain(
      "customer-facing offer / external proposal 详情页",
    );
  });
});
