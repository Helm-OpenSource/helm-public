import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("decision-first IA rollout", () => {
  it("keeps the shared reporting surfaces available", () => {
    const pageHeader = read("components/shared/page-header.tsx");
    const reportingPanel = read(
      "components/shared/reporting-protocol-panel.tsx",
    );
    const sharedComponents = read("components/shared/narrative-components.tsx");

    expect(pageHeader).toContain("takeaways");
    expect(pageHeader).toContain("decisions");
    expect(reportingPanel).toContain("data-reporting-protocol");
    expect(reportingPanel).toContain("Current summary");
    expect(reportingPanel).toContain('data-frontstage-block="current-summary"');
    expect(reportingPanel).toContain("Review snapshot");
    expect(reportingPanel).toContain("Supporting context");
    expect(reportingPanel).toContain("pageWorkerAssignments");
    expect(reportingPanel).toContain("pageEvidenceGroups");
    expect(sharedComponents).toContain("WhyItMattersBlock");
    expect(sharedComponents).toContain("BoundaryNote");
    expect(sharedComponents).toContain("data-worker-assignment-detail");
    expect(sharedComponents).toContain("data-evidence-group");
    expect(sharedComponents).toContain("data-evidence-target");
  });

  it("wires the reporting protocol into the three representative pages", () => {
    type RepresentativePage = string | string[];
    const representativePages: RepresentativePage[] = [
      // The dashboard page is composed from a thin orchestrator plus
      // dedicated builders under features/dashboard/, so the contract is
      // verified across that bundle rather than the page file alone.
      [
        "app/(workspace)/dashboard/page.tsx",
        "features/dashboard/header-briefing.ts",
        "features/dashboard/view-model.ts",
        "features/dashboard/evidence-groups.ts",
      ],
      "features/opportunities/opportunities-client.tsx",
      "features/approvals/approvals-client.tsx",
    ];

    for (const pagePath of representativePages) {
      const paths = Array.isArray(pagePath) ? pagePath : [pagePath];
      const content = paths.map((p) => read(p)).join("\n");
      const aggregateLabel = paths.join(", ");

      expect(content, aggregateLabel).toContain("ReportingProtocolPanel");
      expect(content, aggregateLabel).toContain("pageJudgement");
      expect(content, aggregateLabel).toContain("pageWhyItMatters");
      expect(content, aggregateLabel).toContain("pageDecisionRequest");
      expect(content, aggregateLabel).toContain("pageBoundarySummary");
      expect(content, aggregateLabel).toContain("pageEvidenceSummary");
      expect(content, aggregateLabel).toContain("pageWorkerSummary");
      expect(content, aggregateLabel).toContain("pageWorkerAssignments");
      expect(content, aggregateLabel).toContain("pageEvidenceGroups");
      expect(content, aggregateLabel).toContain("createEvidencePayloadGroups");
    }
  });
});
