import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("operating foundation baseline freeze", () => {
  it("keeps the baseline freeze docs present", () => {
    for (const relativePath of [
      "docs/product/HELM_OPERATING_FOUNDATION_BASELINE_REVIEW_REPORT.md",
      "docs/product/HELM_OPERATING_CONSTITUTION_BASELINE_FREEZE_REPORT.md",
      "docs/product/HELM_ROLE_AUDIENCE_BASELINE_FREEZE_REPORT.md",
      "docs/product/HELM_ORGANIZATIONAL_MEMORY_BASELINE_FREEZE_REPORT.md",
      "docs/product/HELM_GOAL_CAMPAIGN_BASELINE_FREEZE_REPORT.md",
      "docs/reviews/HELM_OPERATING_FOUNDATION_BASELINE_ALIGNMENT_REPORT.md",
      "docs/product/HELM_OPERATING_FOUNDATION_BASELINE_FREEZE_REPORT.md",
    ]) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps README and docs index pointed at the baseline freeze docs", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "HELM_OPERATING_FOUNDATION_BASELINE_REVIEW_REPORT.md",
      "HELM_OPERATING_CONSTITUTION_BASELINE_FREEZE_REPORT.md",
      "HELM_ROLE_AUDIENCE_BASELINE_FREEZE_REPORT.md",
      "HELM_ORGANIZATIONAL_MEMORY_BASELINE_FREEZE_REPORT.md",
      "HELM_GOAL_CAMPAIGN_BASELINE_FREEZE_REPORT.md",
      "HELM_OPERATING_FOUNDATION_BASELINE_ALIGNMENT_REPORT.md",
      "HELM_OPERATING_FOUNDATION_BASELINE_FREEZE_REPORT.md",
      "Operating Foundation Baseline Freeze",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps baseline freeze references visible in checks and surface reports", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const surfaceReport = read(
      "docs/product/HELM_OPERATING_FOUNDATION_PRODUCT_SURFACE_REPORT.md",
    );
    const nextStage = read(
      "docs/product/HELM_OPERATING_SYSTEM_NEXT_STAGE_ACTIONS_REPORT.md",
    );

    for (const snippet of [
      "HELM_OPERATING_FOUNDATION_BASELINE_REVIEW_REPORT.md",
      "HELM_OPERATING_CONSTITUTION_BASELINE_FREEZE_REPORT.md",
      "HELM_ROLE_AUDIENCE_BASELINE_FREEZE_REPORT.md",
      "HELM_ORGANIZATIONAL_MEMORY_BASELINE_FREEZE_REPORT.md",
      "HELM_GOAL_CAMPAIGN_BASELINE_FREEZE_REPORT.md",
      "HELM_OPERATING_FOUNDATION_BASELINE_ALIGNMENT_REPORT.md",
      "HELM_OPERATING_FOUNDATION_BASELINE_FREEZE_REPORT.md",
    ]) {
      expect(selfCheck).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "operating_foundation_baseline_freeze_keeps_honest_scope",
    );
    expect(surfaceReport).toContain("goal-driven home surface");
    expect(nextStage).toContain("Operating Foundation Baseline Freeze");
  });
});
