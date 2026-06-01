import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("customer success handoff surface sprint 1", () => {
  it("keeps the sprint 1 docs present", () => {
    const requiredDocs = [
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_SURFACE_CONTRACT_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_DETAIL_CONTRACT_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_MODEL_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_PAGE_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_CHAIN_INTEGRATION_REPORT.md",
      "docs/reviews/CUSTOMER_SUCCESS_HANDOFF_ALIGNMENT_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_SURFACE_SPRINT_1_REPORT.md",
    ];

    for (const relativePath of requiredDocs) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps README and docs index pointed at the customer success handoff surface", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "CUSTOMER_SUCCESS_HANDOFF_SURFACE_CONTRACT_REPORT.md",
      "CUSTOMER_SUCCESS_DETAIL_CONTRACT_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_MODEL_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_PAGE_REPORT.md",
      "CUSTOMER_SUCCESS_CHAIN_INTEGRATION_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_ALIGNMENT_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_SURFACE_SPRINT_1_REPORT.md",
      "Customer Success Handoff Surface Sprint 1",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps customer success, success check and expansion review aligned to the unified chain", () => {
    const handoffRoute = read("app/(workspace)/customer-success/[id]/page.tsx");
    const successCheckRoute = read("app/(workspace)/success-checks/[id]/page.tsx");
    const expansionReviewRoute = read(
      "app/(workspace)/expansion-reviews/[id]/page.tsx",
    );
    const companyRoute = read("app/(workspace)/companies/[id]/page.tsx");
    const companyLoader = read("features/companies/page-loader.ts");
    const customerSuccessModel = read(
      "features/customer-success-handoff/detail-model.ts",
    );
    const customerSuccessView = read(
      "features/customer-success-handoff/detail-view.tsx",
    );
    const successCheckModel = read("features/success-check/detail-model.ts");
    const successCheckView = read("features/success-check/detail-view.tsx");
    const expansionReviewModel = read("features/expansion-review/detail-model.ts");
    const expansionReviewView = read("features/expansion-review/detail-view.tsx");
    const reviewRequestModel = read(
      "features/inbox-followup-review-request/detail-model.ts",
    );
    const companyChainModel = read(
      "features/conversation-chain-extension/detail-model.ts",
    );
    const contract = read(
      "lib/presentation/customer-success-handoff-surface-contract.ts",
    );
    const navigationModel = read("lib/presentation/unified-detail-navigation.ts");
    const navigationPanel = read("components/shared/unified-detail-navigation-panel.tsx");

    for (const snippet of [
      "CustomerSuccessHandoffDetailView",
      "buildCustomerSuccessHandoffPageModel",
      "getApprovalTasksData",
    ]) {
      expect(handoffRoute).toContain(snippet);
    }

    for (const snippet of [
      "SuccessCheckDetailView",
      "buildSuccessCheckDetailPageModel",
      "getApprovalTasksData",
    ]) {
      expect(successCheckRoute).toContain(snippet);
    }

    for (const snippet of [
      "ExpansionReviewDetailView",
      "buildExpansionReviewDetailPageModel",
      "getApprovalTasksData",
    ]) {
      expect(expansionReviewRoute).toContain(snippet);
    }

    for (const snippet of ["pendingReviewRequestId", "customerSuccessOpportunityId"]) {
      expect(companyRoute).toContain(snippet);
    }

    expect(companyLoader).toContain("getApprovalTasksData");

    for (const snippet of [
      "data-customer-success-handoff-page",
      "data-customer-success-handoff-kind",
      "buildCustomerSuccessHandoffPageModel",
      "buildSuccessCheckPageModel",
      "buildExpansionReviewPageModel",
      "customerSuccessHandoffJudgement",
      "customerSuccessDetailJudgement",
      "customerSuccessHandoffStage",
      "customerSuccessDetailStage",
      "detailNodeType: \"customer-success\"",
      "detailNodeType: \"success-check\"",
      "detailNodeType: \"expansion-review\"",
      "handoffSource: \"review-request-detail\"",
      "handoffTarget: \"customer-success\"",
      "handoffSource: \"company-detail\"",
      "handoffTarget: \"review-request-detail\"",
      "handoffTarget: \"customer-success\"",
      "handoffSource: \"customer-success\"",
      "handoffTarget: \"success-check\"",
      "handoffTarget: \"expansion-review\"",
      "handoffTarget: \"package\"",
      "handoffTarget: \"proposal\"",
      "handoffTarget: \"customer-facing-offer\"",
      "handoffTarget: \"external-proposal\"",
      "handoffTarget: \"reinforcement\"",
      "handoffTarget: \"founder-conversation\"",
      "handoffTarget: \"sales-conversation\"",
      "handoffTarget: \"delivery-conversation\"",
      "/customer-success/",
      "/success-checks/",
      "/expansion-reviews/",
      "success-follow-through",
      "expansion-review",
      "expansion-ready-but-blocked",
      "blocked-by-boundary",
    ]) {
      expect(customerSuccessModel).toContain(snippet);
    }

    for (const snippet of [
      "CustomerSuccessHandoffDetailView",
      "AgentSurfaceDetailView",
      "formatCustomerSuccessHandoffDetailModel",
      "rootDataAttributes={displayModel.rootDataAttributes}",
      "data-customer-success-handoff-kind",
    ]) {
      expect(customerSuccessView).toContain(snippet);
    }

    for (const snippet of [
      "data-success-check-agent-surface",
      "\"data-shared-agent-surface\": \"success-check-detail\"",
      "AgentSurfaceDetailView",
      "AgentAuthorityState",
      "AgentAttentionState",
      "AgentPolicyCue",
      "createPageReportingProtocol",
      "Since last seen",
      "Why this is back now",
      "Progress trace",
      "Open customer success handoff",
      "Open expansion review",
      "detailNodeType: \"success-check\"",
    ]) {
      expect([successCheckModel, successCheckView].join("\n")).toContain(snippet);
    }

    expect(successCheckModel).not.toContain("issue-follow-through");
    expect(successCheckModel).not.toContain("CustomerSuccessExternalDraftKind");

    for (const snippet of [
      "data-expansion-review-agent-surface",
      "\"data-shared-agent-surface\": \"expansion-review-detail\"",
      "ExpansionReviewDetailView",
      "AgentAuthorityState",
      "AgentAttentionState",
      "AgentPolicyCue",
      "createPageReportingProtocol",
      "Since last seen",
      "Why this is back now",
      "Progress trace",
      "Expansion review / Review surface",
      "detailNodeType: \"expansion-review\"",
    ]) {
      expect(
        [expansionReviewModel, expansionReviewView, expansionReviewRoute].join("\n"),
      ).toContain(snippet);
    }

    expect(expansionReviewModel).not.toContain("issue-follow-through");
    expect(expansionReviewModel).not.toContain("CustomerSuccessExternalDraftKind");

    for (const snippet of [
      "review-request-detail",
      "company-detail",
      "customer-success",
      "Use company detail only when the team needs broader account context",
    ]) {
      expect(reviewRequestModel).toContain(snippet);
    }

    for (const snippet of [
      "pendingReviewRequestId",
      "customerSuccessOpportunityId",
      "handoffTarget: \"review-request-detail\"",
      "handoffTarget: \"customer-success\"",
      "/customer-success/",
      "/review-requests/",
    ]) {
      expect(companyChainModel).toContain(snippet);
    }

    for (const snippet of [
      "customerSuccessHandoffJudgement",
      "customerSuccessDetailJudgement",
      "customerSuccessHandoffStage",
      "customerSuccessDetailStage",
      "success-follow-through",
      "expansion-review",
      "blocked-by-boundary",
      "handoff_trace",
      "success_trace",
    ]) {
      expect(contract).toContain(snippet);
    }

    for (const snippet of [
      "\"customer-success\"",
      "\"success-check\"",
      "\"expansion-review\"",
    ]) {
      expect(navigationModel).toContain(snippet);
      expect(navigationPanel).toContain(snippet);
    }
  });

  it("keeps checks and delivery assets aligned to the customer success surface", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const pilotReadiness = read("scripts/pilot-readiness-check.ts");
    const demoScript = read("docs/product/demo-script.md");
    const manualAcceptance = read("docs/pilot/manual-acceptance-paths.md");
    const deliveryBoundary = read("docs/pilot/delivery-boundary.md");
    const principles = read("docs/product/product-principles.md");
    const packageJson = read("package.json");
    const totalReport = read(
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_SURFACE_SPRINT_1_REPORT.md",
    );

    for (const snippet of [
      "CUSTOMER_SUCCESS_HANDOFF_SURFACE_CONTRACT_REPORT.md",
      "CUSTOMER_SUCCESS_DETAIL_CONTRACT_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_MODEL_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_PAGE_REPORT.md",
      "CUSTOMER_SUCCESS_CHAIN_INTEGRATION_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_ALIGNMENT_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_SURFACE_SPRINT_1_REPORT.md",
    ]) {
      expect(selfCheck).toContain(snippet);
      expect(pilotReadiness).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "customer_success_handoff_surface_pages_keep_handoff_boundary_and_non_commitment_visible",
    );
    expect(demoScript).toContain("Customer Success Handoff Surface");
    expect(manualAcceptance).toContain(
      "路径 AC：Customer Success Handoff Surface",
    );
    expect(deliveryBoundary).toContain("customer success handoff surface");
    expect(principles).toContain("customer success handoff");
    expect(packageJson).toContain(
      "lib/presentation/customer-success-handoff-surface-contract.test.ts",
    );
    expect(packageJson).toContain(
      "lib/presentation/customer-success-handoff-sprint1.test.ts",
    );
    expect(totalReport).toContain("Customer success handoff surface contract");
    expect(totalReport).toContain("Customer success detail contract");
    expect(totalReport).toContain("Customer success handoff model");
    expect(totalReport).toContain("Handoff mainline stability");
  });
});
