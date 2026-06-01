import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("customer success handoff baseline freeze", () => {
  it("keeps the baseline freeze reports present", () => {
    const requiredDocs = [
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_BASELINE_REVIEW_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_SURFACE_BASELINE_FREEZE_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_DETAIL_BASELINE_FREEZE_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_CHAIN_BASELINE_FREEZE_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "docs/reviews/CUSTOMER_SUCCESS_HANDOFF_BASELINE_ALIGNMENT_REPORT.md",
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
      "CUSTOMER_SUCCESS_HANDOFF_BASELINE_REVIEW_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_SURFACE_BASELINE_FREEZE_REPORT.md",
      "CUSTOMER_SUCCESS_DETAIL_BASELINE_FREEZE_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_CHAIN_BASELINE_FREEZE_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_BASELINE_ALIGNMENT_REPORT.md",
      "Customer Success Handoff Surface Baseline Freeze",
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
      "CUSTOMER_SUCCESS_HANDOFF_BASELINE_REVIEW_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_SURFACE_BASELINE_FREEZE_REPORT.md",
      "CUSTOMER_SUCCESS_DETAIL_BASELINE_FREEZE_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_CHAIN_BASELINE_FREEZE_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "CUSTOMER_SUCCESS_HANDOFF_BASELINE_ALIGNMENT_REPORT.md",
    ]) {
      expect(selfCheck).toContain(snippet);
      expect(pilotReadiness).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "customer_success_handoff_baseline_freeze_keeps_honest_boundary",
    );
    expect(demoScript).toContain(
      "Customer Success Handoff Surface Baseline Freeze",
    );
    expect(manualAcceptance).toContain(
      "路径 AD：Customer Success Handoff Surface Baseline Freeze",
    );
    expect(deliveryBoundary).toContain(
      "Customer Success Handoff Surface Baseline Freeze",
    );
    expect(principles).toContain(
      "Customer Success Handoff Surface Baseline Freeze",
    );
    expect(packageJson).toContain(
      "lib/presentation/customer-success-handoff-baseline-freeze.test.ts",
    );
  });
});
