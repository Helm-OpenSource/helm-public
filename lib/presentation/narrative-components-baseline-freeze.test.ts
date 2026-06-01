import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("narrative components baseline freeze", () => {
  it("keeps the baseline freeze reports present", () => {
    const requiredDocs = [
      "docs/product/NARRATIVE_COMPONENTS_BASELINE_REVIEW_REPORT.md",
      "docs/product/NARRATIVE_COMPONENTS_BASELINE_FREEZE_REPORT.md",
      "docs/product/INFORMATION_HIERARCHY_BASELINE_FREEZE_REPORT.md",
      "docs/product/REPRESENTATIVE_PAGES_BASELINE_FREEZE_REPORT.md",
      "docs/product/NARRATIVE_COMPONENTS_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "docs/reviews/NARRATIVE_COMPONENTS_BASELINE_ALIGNMENT_REPORT.md",
      "docs/product/HELM_NARRATIVE_COMPONENTS_DECISION_FIRST_PAGES_BASELINE_FREEZE_REPORT.md",
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
      "NARRATIVE_COMPONENTS_BASELINE_REVIEW_REPORT.md",
      "NARRATIVE_COMPONENTS_BASELINE_FREEZE_REPORT.md",
      "INFORMATION_HIERARCHY_BASELINE_FREEZE_REPORT.md",
      "REPRESENTATIVE_PAGES_BASELINE_FREEZE_REPORT.md",
      "NARRATIVE_COMPONENTS_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "NARRATIVE_COMPONENTS_BASELINE_ALIGNMENT_REPORT.md",
      "HELM_NARRATIVE_COMPONENTS_DECISION_FIRST_PAGES_BASELINE_FREEZE_REPORT.md",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps freeze references visible in checks and delivery assets", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const pilotReadiness = read("scripts/pilot-readiness-check.ts");
    const demoScript = read("docs/product/demo-script.md");
    const manualAcceptance = read("docs/pilot/manual-acceptance-paths.md");
    const deliveryBoundary = read("docs/pilot/delivery-boundary.md");

    expect(selfCheck).toContain(
      "HELM_NARRATIVE_COMPONENTS_DECISION_FIRST_PAGES_BASELINE_FREEZE_REPORT.md",
    );
    expect(pilotReadiness).toContain(
      "HELM_NARRATIVE_COMPONENTS_DECISION_FIRST_PAGES_BASELINE_FREEZE_REPORT.md",
    );
    expect(demoScript).toContain("Decision-first 页面模板基线");
    expect(demoScript).toContain(
      "NarrativeHeader / ReviewSnapshotBlock / WhyItMattersBlock",
    );
    expect(manualAcceptance).toContain("路径 I：Narrative Components Baseline Freeze");
    expect(deliveryBoundary).toContain("Narrative Components Baseline Freeze");
  });
});
