import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("proactive baseline freeze", () => {
  it("keeps the baseline freeze reports present", () => {
    const requiredDocs = [
      "docs/product/HELM_PROACTIVE_BASELINE_REVIEW_REPORT.md",
      "docs/product/ACTIVE_REPORTING_BASELINE_FREEZE_REPORT.md",
      "docs/product/PROACTIVE_COLLABORATION_BASELINE_FREEZE_REPORT.md",
      "docs/product/PROACTIVE_FLOWS_BASELINE_FREEZE_REPORT.md",
      "docs/product/HELM_PROACTIVE_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "docs/reviews/HELM_PROACTIVE_BASELINE_ALIGNMENT_REPORT.md",
      "docs/product/HELM_PROACTIVE_REPORTING_COLLABORATION_BASELINE_FREEZE_REPORT.md",
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
    const requiredSnippets = [
      "HELM_PROACTIVE_BASELINE_REVIEW_REPORT.md",
      "ACTIVE_REPORTING_BASELINE_FREEZE_REPORT.md",
      "PROACTIVE_COLLABORATION_BASELINE_FREEZE_REPORT.md",
      "PROACTIVE_FLOWS_BASELINE_FREEZE_REPORT.md",
      "HELM_PROACTIVE_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "HELM_PROACTIVE_BASELINE_ALIGNMENT_REPORT.md",
      "HELM_PROACTIVE_REPORTING_COLLABORATION_BASELINE_FREEZE_REPORT.md",
    ];

    for (const snippet of requiredSnippets) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps proactive baseline references in checks and delivery assets", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const pilotReadiness = read("scripts/pilot-readiness-check.ts");
    const demoScript = read("docs/product/demo-script.md");
    const manualAcceptance = read("docs/pilot/manual-acceptance-paths.md");
    const deliveryBoundary = read("docs/pilot/delivery-boundary.md");

    expect(selfCheck).toContain("HELM_PROACTIVE_REPORTING_COLLABORATION_BASELINE_FREEZE_REPORT.md");
    expect(pilotReadiness).toContain("HELM_PROACTIVE_REPORTING_COLLABORATION_BASELINE_FREEZE_REPORT.md");
    expect(demoScript).toContain("founder 决策请求");
    expect(demoScript).toContain("sales / delivery 协作窗口");
    expect(manualAcceptance).toContain("evidence drawer");
    expect(deliveryBoundary).toContain("Baseline Freeze");
  });
});
