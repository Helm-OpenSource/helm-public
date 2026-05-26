import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const hierarchyGuardViews = [
  "components/shared/role-conversation-detail-shell.tsx",
  "features/customer-success-handoff/queue-view.tsx",
  "features/conversation-detail/detail-view.tsx",
  "features/proposal-package/proposal-package-detail-view.tsx",
  "features/commitment-reinforcement-sendability/detail-view.tsx",
  "features/customer-facing-offer-external-proposal/detail-view.tsx",
  "features/external-narrative-detail/detail-view.tsx",
  "features/commercial-narrative-strengthening/detail-view.tsx",
] as const;

describe("page component hierarchy spec", () => {
  it("pins the formal spec in the main doc entry points", () => {
    const spec = read(
      "docs/product/HELM_PAGE_COMPONENTS_AND_INFORMATION_HIERARCHY_SPEC_V1.md",
    );
    const narrativeReport = read(
      "docs/product/HELM_NARRATIVE_COMPONENTS_REPORT.md",
    );
    const hierarchyReport = read(
      "docs/product/HELM_INFORMATION_HIERARCHY_REPORT.md",
    );
    const docsReadme = read("docs/README.md");
    const reportingReport = read("docs/product/HELM_REPORTING_PROTOCOL_REPORT.md");
    const iaReport = read("docs/product/DECISION_FIRST_IA_REPORT.md");

    expect(spec).toContain("L1：前台层");
    expect(spec).toContain("L2：中间层");
    expect(spec).toContain("L3：后台层");
    expect(spec).toContain("NarrativeHeader");
    expect(spec).toContain("ReviewSnapshotBlock");
    expect(spec).toContain("EvidenceDrawer");
    expect(spec).toContain("用户先完成判断和动作，再决定要不要看系统解释。");

    expect(docsReadme).toContain(
      "product/HELM_PAGE_COMPONENTS_AND_INFORMATION_HIERARCHY_SPEC_V1.md",
    );
    expect(reportingReport).toContain(
      "HELM_PAGE_COMPONENTS_AND_INFORMATION_HIERARCHY_SPEC_V1.md",
    );
    expect(iaReport).toContain(
      "HELM_PAGE_COMPONENTS_AND_INFORMATION_HIERARCHY_SPEC_V1.md",
    );
    expect(narrativeReport).toContain("NarrativeHeader");
    expect(narrativeReport).toContain("EvidenceDrawer");
    expect(hierarchyReport).toContain("前台层");
    expect(hierarchyReport).toContain("后台层");
  });

  it("keeps panel markers and scripts aligned to the hierarchy spec", () => {
    const panel = read("components/shared/reporting-protocol-panel.tsx");
    const sharedComponents = read("components/shared/narrative-components.tsx");
    const componentRegistry = read("lib/presentation/narrative-components.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const selfCheck = read("scripts/helm-self-check.ts");

    for (const snippet of [
      'data-page-layer="frontstage"',
      'data-page-layer="midstage"',
      'data-page-layer="backstage"',
      'data-page-layer="evidence"',
      'data-frontstage-block="current-summary"',
      'data-frontstage-block="decision-request"',
      'data-frontstage-block="next-action"',
      'data-frontstage-block="boundary"',
    ]) {
      expect(panel).toContain(snippet);
      expect(boundaryCheck).toContain(snippet);
      expect(selfCheck).toContain(snippet);
    }

    for (const snippet of [
      "data-narrative-header",
      "data-review-snapshot-block",
      "data-why-it-matters-block",
      "data-decision-request-card",
      "data-action-rail",
      "data-boundary-note",
      "data-worker-assignment-detail",
      "data-evidence-drawer",
      "data-evidence-group",
      "data-evidence-target",
    ]) {
      expect(sharedComponents).toContain(snippet);
      expect(boundaryCheck).toContain(snippet);
      expect(selfCheck).toContain(snippet);
    }

    for (const snippet of [
      "NarrativeHeader",
      "ReviewSnapshotBlock",
      "WhyItMattersBlock",
      "DecisionRequestCard",
      "CollaborationRequestCard",
      "ActionRail",
      "BoundaryNote",
      "WorkerSummary",
      "EvidenceDrawer",
      "前台层",
      "后台层",
    ]) {
      expect(componentRegistry).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "HELM_PAGE_COMPONENTS_AND_INFORMATION_HIERARCHY_SPEC_V1.md",
    );
    expect(selfCheck).toContain(
      "HELM_PAGE_COMPONENTS_AND_INFORMATION_HIERARCHY_SPEC_V1.md",
    );
  });

  it("keeps shared detail shells from wiring the same page judgement into competing first-screen hero slots", () => {
    const unifiedDetailNavigation = read(
      "components/shared/unified-detail-navigation-panel.tsx",
    );

    expect(unifiedDetailNavigation).not.toContain("currentNode.detailNodeSummary");

    for (const relativePath of hierarchyGuardViews) {
      const view = read(relativePath);
      expect(view).toContain("pagePrioritySignal");
      expect(view).not.toContain("NarrativeHeader");
    }
  });

  it("keeps shell and nested object headers subordinate to the route-level h1", () => {
    const sidebar = read("components/layout/sidebar.tsx");
    const pageHeader = read("components/shared/page-header.tsx");
    const contactDetailClient = read("features/contacts/contact-detail-client.tsx");
    const companyDetailClient = read("features/companies/company-detail-client.tsx");

    expect(sidebar.match(/<h2\b/g) ?? []).toHaveLength(0);
    expect(pageHeader).toContain('titleAs?: "h1" | "h2"');
    expect(contactDetailClient).toContain('titleAs="h2"');
    expect(companyDetailClient).toContain('titleAs="h2"');
  });
});
