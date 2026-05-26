import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("unified detail navigation / cross-detail handoff sprint 1", () => {
  it("keeps the sprint 1 docs present", () => {
    const requiredDocs = [
      "docs/product/UNIFIED_DETAIL_NAVIGATION_MODEL_REPORT.md",
      "docs/product/CROSS_DETAIL_HANDOFF_MODEL_REPORT.md",
      "docs/product/DETAIL_NAVIGATION_HANDOFF_IMPLEMENTATION_REPORT.md",
      "docs/reviews/UNIFIED_DETAIL_NAVIGATION_ALIGNMENT_REPORT.md",
      "docs/product/UNIFIED_DETAIL_NAVIGATION_CROSS_DETAIL_HANDOFF_SPRINT_1_REPORT.md",
    ];

    for (const relativePath of requiredDocs) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps README and docs index pointed at the unified navigation reports", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "UNIFIED_DETAIL_NAVIGATION_MODEL_REPORT.md",
      "CROSS_DETAIL_HANDOFF_MODEL_REPORT.md",
      "DETAIL_NAVIGATION_HANDOFF_IMPLEMENTATION_REPORT.md",
      "UNIFIED_DETAIL_NAVIGATION_ALIGNMENT_REPORT.md",
      "UNIFIED_DETAIL_NAVIGATION_CROSS_DETAIL_HANDOFF_SPRINT_1_REPORT.md",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps the shared navigation model and panel aligned", () => {
    const model = read("lib/presentation/unified-detail-navigation.ts");
    const panel = read("components/shared/unified-detail-navigation-panel.tsx");

    for (const snippet of [
      "detailNodeType",
      "detailNodeSummary",
      "detailNodeStage",
      "detailNodeBoundary",
      "detailNodeAudienceMode",
      "detailNodeSendabilityMode",
      "detailNodeStrengthMode",
      "detailNodePrev",
      "detailNodeNext",
      "detailNodeCurrentReason",
      "detailNodePriority",
      "detailNodeNavigationHint",
      "handoffSource",
      "handoffTarget",
      "handoffReason",
      "handoffBoundary",
      "handoffPrerequisite",
      "handoffDependency",
      "handoffRisk",
      "handoffDecisionRequest",
      "handoffNextAction",
      "handoffWorkerSummary",
      "handoffEvidenceSummary",
      "handoffVisibilityMode",
      "proposal",
      "package",
      "customer-facing-offer",
      "external-proposal",
      "reinforcement",
      "sendability",
      "variants",
    ]) {
      expect(model).toContain(snippet);
    }

    for (const snippet of [
      "data-unified-detail-navigation",
      "data-detail-node-current",
      "data-detail-node-prev",
      "data-detail-node-next",
      "data-cross-detail-handoff",
      "data-handoff-source",
      "data-handoff-target",
      "data-handoff-boundary",
      "data-handoff-next-action",
    ]) {
      expect(panel).toContain(snippet);
    }
  });

  it("keeps the key commercial detail chains wired into the detail pages", () => {
    const proposalPackageView = read(
      "features/proposal-package/proposal-package-detail-view.tsx",
    );
    const externalExpressionView = read(
      "features/customer-facing-offer-external-proposal/detail-view.tsx",
    );
    const reinforcementSendabilityView = read(
      "features/commitment-reinforcement-sendability/detail-view.tsx",
    );

    for (const content of [
      proposalPackageView,
      externalExpressionView,
      reinforcementSendabilityView,
    ]) {
      expect(content).toContain("UnifiedDetailNavigationPanel");
      expect(content).toContain("createUnifiedDetailNavigationModel");
    }

    for (const snippet of [
      "/packages/",
      "/offers/",
      "handoffSource: \"proposal\"",
      "handoffTarget: \"package\"",
      "handoffTarget: \"customer-facing-offer\"",
    ]) {
      expect(proposalPackageView).toContain(snippet);
    }

    for (const snippet of [
      "/external-proposals/",
      "/reinforcements/",
      "handoffSource: \"customer-facing-offer\"",
      "handoffTarget: \"external-proposal\"",
      "handoffTarget: \"reinforcement\"",
    ]) {
      expect(externalExpressionView).toContain(snippet);
    }

    for (const snippet of [
      "/sendability/",
      "handoffSource: \"external-proposal\"",
      "handoffSource: \"reinforcement\"",
      "handoffTarget: \"sendability\"",
    ]) {
      expect(reinforcementSendabilityView).toContain(snippet);
    }

  });

  it("keeps checks and delivery assets aligned to navigation and handoff", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const pilotReadiness = read("scripts/pilot-readiness-check.ts");
    const demoScript = read("docs/product/demo-script.md");
    const manualAcceptance = read("docs/pilot/manual-acceptance-paths.md");
    const deliveryBoundary = read("docs/pilot/delivery-boundary.md");
    const principles = read("docs/product/product-principles.md");

    for (const snippet of [
      "UNIFIED_DETAIL_NAVIGATION_CROSS_DETAIL_HANDOFF_SPRINT_1_REPORT.md",
      "UNIFIED_DETAIL_NAVIGATION_MODEL_REPORT.md",
      "CROSS_DETAIL_HANDOFF_MODEL_REPORT.md",
    ]) {
      expect(selfCheck).toContain(snippet);
      expect(pilotReadiness).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "detail_navigation_handoff_keeps_cross_detail_reason_boundary_and_next_action",
    );
    expect(demoScript).toContain(
      "Unified Detail Navigation / Cross-detail Handoff",
    );
    expect(manualAcceptance).toContain(
      "路径 O：Unified Detail Navigation / Cross-detail Handoff",
    );
    expect(deliveryBoundary).toContain(
      "unified detail navigation / cross-detail handoff",
    );
    expect(principles).toContain(
      "跨 detail handoff 不是普通跳转链接",
    );
  });
});
