import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("goal-driven home sprint 1", () => {
  it("keeps the goal-driven home docs present", () => {
    for (const relativePath of [
      "docs/product/HELM_GOAL_DRIVEN_HOME_STRUCTURE_REPORT.md",
      "docs/product/HELM_GOAL_DRIVEN_HOME_PAGES_REPORT.md",
      "docs/product/HELM_GOAL_DRIVEN_HOME_CHAIN_LINK_REPORT.md",
      "docs/reviews/HELM_GOAL_DRIVEN_HOME_ALIGNMENT_REPORT.md",
      "docs/product/HELM_GOAL_DRIVEN_HOME_CAMPAIGN_SURFACE_SPRINT_1_REPORT.md",
      "docs/product/HELM_OPERATING_MAINLINE_SEQUENTIAL_PROGRAM_3_REPORT.md",
    ]) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps docs indexes pointed at goal-driven home and program report", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "HELM_GOAL_DRIVEN_HOME_STRUCTURE_REPORT.md",
      "HELM_GOAL_DRIVEN_HOME_PAGES_REPORT.md",
      "HELM_GOAL_DRIVEN_HOME_CHAIN_LINK_REPORT.md",
      "HELM_GOAL_DRIVEN_HOME_ALIGNMENT_REPORT.md",
      "HELM_GOAL_DRIVEN_HOME_CAMPAIGN_SURFACE_SPRINT_1_REPORT.md",
      "HELM_OPERATING_MAINLINE_SEQUENTIAL_PROGRAM_3_REPORT.md",
      "Goal-driven Home / Campaign Surface Sprint 1",
      "Helm Operating Mainline Sequential Program 3 Report",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps goal-driven home markers wired into dashboard, helper and checks", () => {
    const dashboardPage = read("app/(workspace)/dashboard/page.tsx");
    const pageLoader = read("features/dashboard/page-loader.ts");
    const homeSurface = read("features/dashboard/goal-driven-home-surface.tsx");
    const helper = read("lib/operating-system/goal-driven-home.ts");
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const totalReport = read(
      "docs/product/HELM_GOAL_DRIVEN_HOME_CAMPAIGN_SURFACE_SPRINT_1_REPORT.md",
    );
    const programReport = read(
      "docs/product/HELM_OPERATING_MAINLINE_SEQUENTIAL_PROGRAM_3_REPORT.md",
    );

    for (const snippet of [
      "GoalDrivenHomeSurface",
      "buildGoalDrivenHomeModel",
      "getInternalOperatingWorkspaceData",
      "getWorkspaceBusinessLoopGapReadout",
      "businessLoopGapReadout",
      "buildBusinessLoopGapReadout",
      "Current Campaign",
      "Top 3 Operating Judgements",
      "Top 3 Chain Moves",
      "Top 3 Blockers",
      "Top 3 Decision Requests",
      "Helm Did",
      "Role-specific Handoffs",
      "Evidence / Trace entry",
      "goal_driven_home_assets",
      "goal_driven_home_keeps_campaign_first_without_becoming_platform",
      "首页是否已经真正围绕 goal / campaign 重组",
      "Operating Foundation Baseline Freeze 是否已经成立",
      "Goal-driven Home / Campaign Surface 是否已经成立",
      "Customer Success issue / escalation deeper polish 是否已经成立",
    ]) {
      expect(
        [
          dashboardPage,
          pageLoader,
          homeSurface,
          helper,
          selfCheck,
          boundaryCheck,
          totalReport,
          programReport,
        ].join("\n"),
      ).toContain(snippet);
    }
  });
});
