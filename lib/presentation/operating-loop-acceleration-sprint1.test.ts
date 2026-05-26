import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("operating loop acceleration sprint 1", () => {
  it("keeps sprint docs present", () => {
    for (const relativePath of [
      "docs/product/HELM_OPERATING_LOOP_PATH_AUDIT_REPORT.md",
      "docs/product/HELM_JUDGEMENT_TO_ACTION_ACCELERATION_REPORT.md",
      "docs/product/HELM_ROLE_HANDOFF_ACCELERATION_REPORT.md",
      "docs/product/HELM_HIGH_FREQUENCY_ACTION_TEMPLATES_REPORT.md",
      "docs/product/HELM_RETRO_TO_MEMORY_GOAL_FEEDBACK_REPORT.md",
      "docs/reviews/HELM_OPERATING_LOOP_ACCELERATION_ALIGNMENT_REPORT.md",
      "docs/product/HELM_OPERATING_LOOP_ACCELERATION_SPRINT_1_REPORT.md",
    ]) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps docs indexes pointed at operating loop acceleration", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "HELM_OPERATING_LOOP_PATH_AUDIT_REPORT.md",
      "HELM_JUDGEMENT_TO_ACTION_ACCELERATION_REPORT.md",
      "HELM_ROLE_HANDOFF_ACCELERATION_REPORT.md",
      "HELM_HIGH_FREQUENCY_ACTION_TEMPLATES_REPORT.md",
      "HELM_RETRO_TO_MEMORY_GOAL_FEEDBACK_REPORT.md",
      "HELM_OPERATING_LOOP_ACCELERATION_ALIGNMENT_REPORT.md",
      "HELM_OPERATING_LOOP_ACCELERATION_SPRINT_1_REPORT.md",
      "Operating Loop Acceleration Sprint 1",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
  });

  it("keeps acceleration markers wired into surfaces and checks", () => {
    const dashboardSurface = read(
      "features/dashboard/goal-driven-home-surface.tsx",
    );
    const goalDrivenHome = read("lib/operating-system/goal-driven-home.ts");
    const operatingHome = read(
      "features/internal-operating-workspace/internal-operating-home.tsx",
    );
    const roleSurface = read(
      "features/internal-operating-workspace/role-handoff-surface.tsx",
    );
    const workspaceFoundation = read(
      "lib/internal-operating-workspace/foundation.ts",
    );
    const successQueueModel = read(
      "features/customer-success-handoff/queue-model.ts",
    );
    const successQueueView = read(
      "features/customer-success-handoff/queue-view.tsx",
    );
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const report = read(
      "docs/product/HELM_OPERATING_LOOP_ACCELERATION_SPRINT_1_REPORT.md",
    );

    for (const snippet of [
      "Top 3 immediate actions",
      "Top 3 decisions waiting",
      "Top 3 blockers to clear",
      "Action template packs",
      "Retro -> memory / goal / campaign",
      "HELM_OPERATING_LOOP_PATH_AUDIT_REPORT.md",
      "HELM_JUDGEMENT_TO_ACTION_ACCELERATION_REPORT.md",
      "HELM_ROLE_HANDOFF_ACCELERATION_REPORT.md",
      "HELM_HIGH_FREQUENCY_ACTION_TEMPLATES_REPORT.md",
      "HELM_RETRO_TO_MEMORY_GOAL_FEEDBACK_REPORT.md",
      "HELM_OPERATING_LOOP_ACCELERATION_ALIGNMENT_REPORT.md",
      "operating_loop_acceleration_assets",
      "operating_loop_acceleration_keeps_boundary_and_owner_explicit",
      "当前 operating loop 主路径是否已经清楚",
      "judgement -> action 路径是否已经缩短",
      "role handoff -> 接手动作路径是否已经缩短",
      "高频 next action 是否已经模板化",
      "复盘 -> memory / goal / campaign 回挂是否已经更快",
    ]) {
      expect(
        [
          dashboardSurface,
          goalDrivenHome,
          operatingHome,
          roleSurface,
          workspaceFoundation,
          successQueueModel,
          successQueueView,
          selfCheck,
          boundaryCheck,
          report,
        ].join("\n"),
      ).toContain(snippet);
    }
  });
});
