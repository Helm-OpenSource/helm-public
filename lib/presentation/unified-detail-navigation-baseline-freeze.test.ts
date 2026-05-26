import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("unified detail navigation / cross-detail handoff baseline freeze", () => {
  it("keeps the baseline freeze reports present", () => {
    const requiredDocs = [
      "docs/product/UNIFIED_DETAIL_NAVIGATION_BASELINE_REVIEW_REPORT.md",
      "docs/product/UNIFIED_DETAIL_NAVIGATION_BASELINE_FREEZE_REPORT.md",
      "docs/product/CROSS_DETAIL_HANDOFF_BASELINE_FREEZE_REPORT.md",
      "docs/product/DETAIL_NAVIGATION_HANDOFF_BASELINE_FREEZE_REPORT.md",
      "docs/product/UNIFIED_DETAIL_NAVIGATION_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "docs/reviews/UNIFIED_DETAIL_NAVIGATION_BASELINE_ALIGNMENT_REPORT.md",
      "docs/product/UNIFIED_DETAIL_NAVIGATION_CROSS_DETAIL_HANDOFF_BASELINE_FREEZE_REPORT.md",
    ];

    for (const relativePath of requiredDocs) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps README and docs index pointed at the freeze docs", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "UNIFIED_DETAIL_NAVIGATION_BASELINE_REVIEW_REPORT.md",
      "UNIFIED_DETAIL_NAVIGATION_BASELINE_FREEZE_REPORT.md",
      "CROSS_DETAIL_HANDOFF_BASELINE_FREEZE_REPORT.md",
      "DETAIL_NAVIGATION_HANDOFF_BASELINE_FREEZE_REPORT.md",
      "UNIFIED_DETAIL_NAVIGATION_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "UNIFIED_DETAIL_NAVIGATION_BASELINE_ALIGNMENT_REPORT.md",
      "UNIFIED_DETAIL_NAVIGATION_CROSS_DETAIL_HANDOFF_BASELINE_FREEZE_REPORT.md",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps freeze references visible in checks and delivery assets", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const pilotReadiness = read("scripts/pilot-readiness-check.ts");
    const demoScript = read("docs/product/demo-script.md");
    const manualAcceptance = read("docs/pilot/manual-acceptance-paths.md");
    const deliveryBoundary = read("docs/pilot/delivery-boundary.md");
    const principles = read("docs/product/product-principles.md");
    const packageJson = read("package.json");

    for (const snippet of [
      "UNIFIED_DETAIL_NAVIGATION_BASELINE_REVIEW_REPORT.md",
      "UNIFIED_DETAIL_NAVIGATION_BASELINE_FREEZE_REPORT.md",
      "CROSS_DETAIL_HANDOFF_BASELINE_FREEZE_REPORT.md",
      "DETAIL_NAVIGATION_HANDOFF_BASELINE_FREEZE_REPORT.md",
      "UNIFIED_DETAIL_NAVIGATION_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "UNIFIED_DETAIL_NAVIGATION_BASELINE_ALIGNMENT_REPORT.md",
      "UNIFIED_DETAIL_NAVIGATION_CROSS_DETAIL_HANDOFF_BASELINE_FREEZE_REPORT.md",
    ]) {
      expect(selfCheck).toContain(snippet);
      expect(pilotReadiness).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "unified_detail_navigation_baseline_freeze_keeps_honest_navigation_boundary",
    );
    expect(demoScript).toContain(
      "Unified Detail Navigation / Cross-detail Handoff Baseline Freeze",
    );
    expect(manualAcceptance).toContain(
      "路径 P：Unified Detail Navigation / Cross-detail Handoff Baseline Freeze",
    );
    expect(deliveryBoundary).toContain(
      "Unified Detail Navigation Baseline Freeze",
    );
    expect(principles).toContain(
      "Unified Detail Navigation / Cross-detail Handoff",
    );
    expect(principles).toContain("Baseline Freeze");
    expect(packageJson).toContain(
      "lib/presentation/unified-detail-navigation-baseline-freeze.test.ts",
    );
  });
});
