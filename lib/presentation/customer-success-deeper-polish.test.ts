import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("customer success deeper polish sprint 1", () => {
  it("keeps the deeper polish docs present", () => {
    for (const relativePath of [
      "docs/product/CUSTOMER_SUCCESS_ISSUE_VARIANTS_POLISH_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_ESCALATION_VARIANTS_POLISH_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_RENEWAL_EXPANSION_RISK_POLISH_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_DEEPER_POLISH_HANDOFF_REPORT.md",
      "docs/reviews/CUSTOMER_SUCCESS_DEEPER_POLISH_ALIGNMENT_REPORT.md",
      "docs/product/CUSTOMER_SUCCESS_ISSUE_ESCALATION_DEEPER_POLISH_SPRINT_1_REPORT.md",
    ]) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps docs indexes pointed at customer success deeper polish", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "CUSTOMER_SUCCESS_ISSUE_VARIANTS_POLISH_REPORT.md",
      "CUSTOMER_SUCCESS_ESCALATION_VARIANTS_POLISH_REPORT.md",
      "CUSTOMER_SUCCESS_RENEWAL_EXPANSION_RISK_POLISH_REPORT.md",
      "CUSTOMER_SUCCESS_DEEPER_POLISH_HANDOFF_REPORT.md",
      "CUSTOMER_SUCCESS_DEEPER_POLISH_ALIGNMENT_REPORT.md",
      "CUSTOMER_SUCCESS_ISSUE_ESCALATION_DEEPER_POLISH_SPRINT_1_REPORT.md",
      "Customer Success Issue / Escalation Deeper Polish Sprint 1",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps deeper issue / escalation / renewal-risk cues wired into handoff, queue and role surface", () => {
    const detailModel = read("features/customer-success-handoff/detail-model.ts");
    const queueModel = read("features/customer-success-handoff/queue-model.ts");
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const operatingFoundation = read("lib/internal-operating-workspace/foundation.ts");
    const roleSurfaceReport = read(
      "docs/product/HELM_INTERNAL_ROLE_HANDOFF_SURFACES_REPORT.md",
    );
    const handoffReport = read(
      "docs/product/CUSTOMER_SUCCESS_DEEPER_POLISH_HANDOFF_REPORT.md",
    );
    const totalReport = read(
      "docs/product/CUSTOMER_SUCCESS_ISSUE_ESCALATION_DEEPER_POLISH_SPRINT_1_REPORT.md",
    );

    for (const snippet of [
      "Issue sub-variant",
      "Escalation sub-variant",
      "Renewal / expansion risk sub-variant",
      "success issue follow-through",
      "blocked issue resolution",
      "customer-visible issue clarification",
      "internal-only issue prep",
      "review-before-send issue response",
      "boundary-only issue response",
      "escalation-triggered follow-through",
      "founder-escalated issue",
      "delivery-escalated issue",
      "sales-escalated issue",
      "blocked-by-dependency escalation",
      "blocked-by-boundary escalation",
      "internal-only escalation prep",
      "renewal risk clarification",
      "expansion blocked clarification",
      "success follow-through before expansion",
      "review-before-send expansion clarification",
      "non-commitment fallback for success / expansion",
      "review request -> customer success handoff",
      "customer success -> founder handoff",
      "customer success -> sales handoff",
      "customer success -> delivery handoff",
      "Sub-variant cue",
      "success-issue-variants",
      "escalation-variants",
      "renewal-expansion-risk-variants",
      "/customer-success/",
      "/success-checks/",
      "/expansion-reviews/",
    ]) {
      expect(
        [
          detailModel,
          queueModel,
          queueView,
          operatingFoundation,
          roleSurfaceReport,
          handoffReport,
          totalReport,
        ].join("\n"),
      ).toContain(snippet);
    }
  });
});
