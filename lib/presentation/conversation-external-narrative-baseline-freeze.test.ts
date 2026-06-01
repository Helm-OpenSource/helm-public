import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("conversation / external narrative baseline freeze", () => {
  it("keeps the baseline freeze reports present", () => {
    const requiredDocs = [
      "docs/product/CONVERSATION_EXTERNAL_NARRATIVE_BASELINE_REVIEW_REPORT.md",
      "docs/product/CONVERSATION_DETAIL_BASELINE_FREEZE_REPORT.md",
      "docs/product/EXTERNAL_NARRATIVE_DETAIL_BASELINE_FREEZE_REPORT.md",
      "docs/product/CONVERSATION_EXTERNAL_NARRATIVE_CHAIN_BASELINE_FREEZE_REPORT.md",
      "docs/product/CONVERSATION_EXTERNAL_NARRATIVE_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "docs/reviews/CONVERSATION_EXTERNAL_NARRATIVE_BASELINE_ALIGNMENT_REPORT.md",
      "docs/product/CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_BASELINE_FREEZE_REPORT.md",
    ];

    for (const relativePath of requiredDocs) {
      expect(existsSync(path.join(root, relativePath)), `${relativePath} should exist`).toBe(true);
    }
  });

  it("keeps README and docs index pointed at the freeze docs", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "CONVERSATION_EXTERNAL_NARRATIVE_BASELINE_REVIEW_REPORT.md",
      "CONVERSATION_DETAIL_BASELINE_FREEZE_REPORT.md",
      "EXTERNAL_NARRATIVE_DETAIL_BASELINE_FREEZE_REPORT.md",
      "CONVERSATION_EXTERNAL_NARRATIVE_CHAIN_BASELINE_FREEZE_REPORT.md",
      "CONVERSATION_EXTERNAL_NARRATIVE_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "CONVERSATION_EXTERNAL_NARRATIVE_BASELINE_ALIGNMENT_REPORT.md",
      "CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_BASELINE_FREEZE_REPORT.md",
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
      "CONVERSATION_EXTERNAL_NARRATIVE_BASELINE_REVIEW_REPORT.md",
      "CONVERSATION_DETAIL_BASELINE_FREEZE_REPORT.md",
      "EXTERNAL_NARRATIVE_DETAIL_BASELINE_FREEZE_REPORT.md",
      "CONVERSATION_EXTERNAL_NARRATIVE_CHAIN_BASELINE_FREEZE_REPORT.md",
      "CONVERSATION_EXTERNAL_NARRATIVE_DELIVERY_BASELINE_FREEZE_REPORT.md",
      "CONVERSATION_EXTERNAL_NARRATIVE_BASELINE_ALIGNMENT_REPORT.md",
      "CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_BASELINE_FREEZE_REPORT.md",
    ]) {
      expect(selfCheck).toContain(snippet);
      expect(pilotReadiness).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "conversation_external_narrative_baseline_freeze_keeps_honest_boundary",
    );
    expect(demoScript).toContain(
      "Conversation / External Narrative Detail Chain Baseline Freeze",
    );
    expect(manualAcceptance).toContain(
      "路径 S：Conversation / External Narrative Detail Chain Baseline Freeze",
    );
    expect(deliveryBoundary).toContain(
      "Conversation / External Narrative Detail Chain Baseline Freeze",
    );
    expect(principles).toContain(
      "Conversation / External Narrative Detail Chain Baseline Freeze",
    );
    expect(principles).toContain("Baseline Freeze");
    expect(packageJson).toContain(
      "lib/presentation/conversation-external-narrative-baseline-freeze.test.ts",
    );
  });
});
