import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("inbox / follow-up / review request detail chain sprint 1", () => {
  it("keeps the sprint 1 docs present", () => {
    const requiredDocs = [
      "docs/product/INBOX_FOLLOWUP_REVIEW_REQUEST_DETAIL_CONTRACT_REPORT.md",
      "docs/product/INBOX_FOLLOWUP_REVIEW_REQUEST_PAGES_REPORT.md",
      "docs/reviews/INBOX_FOLLOWUP_REVIEW_REQUEST_ALIGNMENT_REPORT.md",
      "docs/product/INBOX_FOLLOWUP_REVIEW_REQUEST_DETAIL_CHAIN_SPRINT_1_REPORT.md",
    ];

    for (const relativePath of requiredDocs) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps README and docs index pointed at the new chain pages", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "INBOX_FOLLOWUP_REVIEW_REQUEST_DETAIL_CONTRACT_REPORT.md",
      "INBOX_FOLLOWUP_REVIEW_REQUEST_PAGES_REPORT.md",
      "INBOX_FOLLOWUP_REVIEW_REQUEST_ALIGNMENT_REPORT.md",
      "INBOX_FOLLOWUP_REVIEW_REQUEST_DETAIL_CHAIN_SPRINT_1_REPORT.md",
      "Inbox / Follow-up / Review Request Detail Chain Sprint 1",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps inbox, follow-up and review request routes aligned to the unified chain", () => {
    const inboxRoute = read("app/(workspace)/inbox/[id]/page.tsx");
    const followupRoute = read("app/(workspace)/follow-ups/[id]/page.tsx");
    const reviewRoute = read("app/(workspace)/review-requests/[id]/page.tsx");
    const model = read("features/inbox-followup-review-request/detail-model.ts");
    const view = read("features/inbox-followup-review-request/detail-view.tsx");
    const contract = read(
      "lib/presentation/inbox-followup-review-request-detail-contract.ts",
    );
    const navigationModel = read("lib/presentation/unified-detail-navigation.ts");
    const navigationPanel = read("components/shared/unified-detail-navigation-panel.tsx");
    const roleShell = read("components/shared/role-conversation-detail-shell.tsx");

    for (const snippet of [
      "InboxFollowupReviewRequestDetailView",
      "buildInboxDetailPageModel",
    ]) {
      expect(inboxRoute).toContain(snippet);
    }

    for (const snippet of [
      "InboxFollowupReviewRequestDetailView",
      "buildFollowupDetailPageModel",
      "buildProposalPackageCommercialDetail",
    ]) {
      expect(followupRoute).toContain(snippet);
    }

    for (const snippet of [
      "InboxFollowupReviewRequestDetailView",
      "buildReviewRequestDetailPageModel",
      "getApprovalTasksData",
    ]) {
      expect(reviewRoute).toContain(snippet);
    }

    for (const snippet of [
      "data-inbox-followup-review-request-page",
      "data-inbox-followup-review-request-kind",
      "buildInboxDetailPageModel",
      "buildFollowupDetailPageModel",
      "buildReviewRequestDetailPageModel",
      "detailNodeType: \"inbox-detail\"",
      "detailNodeType: \"follow-up-detail\"",
      "detailNodeType: \"review-request-detail\"",
      "handoffSource: \"conversation\"",
      "handoffTarget: \"inbox-detail\"",
      "handoffTarget: \"follow-up-detail\"",
      "handoffSource: \"follow-up-detail\"",
      "handoffTarget: \"review-request-detail\"",
      "handoffSource: \"review-request-detail\"",
      "handoffTarget: \"founder-conversation\"",
      "handoffTarget: \"sales-conversation\"",
      "handoffTarget: \"delivery-conversation\"",
      "handoffTarget: \"company-detail\"",
      "handoffTarget: \"proposal\"",
      "handoffTarget: \"external-narrative\"",
      "/inbox/",
      "/follow-ups/",
      "/review-requests/",
      "/packages/",
      "/offers/",
      "/proposals/",
      "/external-narratives/",
      "customer-facing-with-boundary",
      "review-before-send",
      "internal-only",
    ]) {
      expect(model).toContain(snippet);
    }

    for (const snippet of [
      "InboxFollowupReviewRequestDetailView",
      "AgentSurfaceDetailView",
      "data-inbox-followup-review-request-page",
    ]) {
      expect(view).toContain(snippet);
    }

    for (const snippet of [
      "inboxDetailJudgement",
      "followupDetailJudgement",
      "reviewRequestDetailJudgement",
      "inbox-customer-thread",
      "followup-review-before-send",
      "review-request-escalated",
      "handoff_trace",
    ]) {
      expect(contract).toContain(snippet);
    }

    for (const snippet of [
      "\"inbox-detail\"",
      "\"follow-up-detail\"",
      "\"review-request-detail\"",
    ]) {
      expect(navigationModel).toContain(snippet);
      expect(navigationPanel).toContain(snippet);
    }

    for (const snippet of [
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
      expect(roleShell).toContain(snippet);
    }
  });

  it("keeps checks and delivery assets aligned to the new detail chain", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const pilotReadiness = read("scripts/pilot-readiness-check.ts");
    const demoScript = read("docs/product/demo-script.md");
    const manualAcceptance = read("docs/pilot/manual-acceptance-paths.md");
    const deliveryBoundary = read("docs/pilot/delivery-boundary.md");
    const principles = read("docs/product/product-principles.md");
    const packageJson = read("package.json");
    const totalReport = read(
      "docs/product/INBOX_FOLLOWUP_REVIEW_REQUEST_DETAIL_CHAIN_SPRINT_1_REPORT.md",
    );

    for (const snippet of [
      "INBOX_FOLLOWUP_REVIEW_REQUEST_DETAIL_CONTRACT_REPORT.md",
      "INBOX_FOLLOWUP_REVIEW_REQUEST_PAGES_REPORT.md",
      "INBOX_FOLLOWUP_REVIEW_REQUEST_ALIGNMENT_REPORT.md",
      "INBOX_FOLLOWUP_REVIEW_REQUEST_DETAIL_CHAIN_SPRINT_1_REPORT.md",
    ]) {
      expect(selfCheck).toContain(snippet);
      expect(pilotReadiness).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "inbox_followup_review_request_pages_keep_scene_review_mode_and_boundary_visible",
    );
    expect(demoScript).toContain("Inbox / Follow-up / Review Request Detail Chain");
    expect(manualAcceptance).toContain(
      "路径 AA：Inbox / Follow-up / Review Request Detail Chain",
    );
    expect(deliveryBoundary).toContain(
      "inbox / follow-up / review request detail chain",
    );
    expect(principles).toContain(
      "inbox / follow-up / review request detail",
    );
    expect(packageJson).toContain(
      "lib/presentation/inbox-followup-review-request-detail-contract.test.ts",
    );
    expect(packageJson).toContain(
      "lib/presentation/inbox-followup-review-request-pages-sprint1.test.ts",
    );
    expect(totalReport).toContain("Inbox / follow-up / review request detail reporting contract");
    expect(totalReport).toContain("Handoff mainline stability");
  });
});
