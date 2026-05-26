import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loaderSource = readFileSync("features/approvals/page-loader.ts", "utf8");

describe("approvals page loader degraded mode contract", () => {
  it("keeps the critical approval queue outside optional read model fan-out", () => {
    expect(loaderSource).toContain("const tasks = await getApprovalTasksData");
    expect(loaderSource).toContain("resolveOptionalApprovalsReadModel");
    expect(loaderSource).toContain(
      "getWorkspaceBusinessLoopGapReadout(workspace.id).then",
    );
    expect(loaderSource).toContain("getWorkspaceFirstLoopModel({");
    expect(loaderSource).toContain("resolveApprovalsExtensions({ workspace })");
    expect(loaderSource).toContain("getApprovalLearningPanels({");
    expect(loaderSource).toContain("buildFallbackFirstLoopModel(english)");
    expect(loaderSource).toContain("buildFallbackBusinessLoopGapSummary()");
    expect(loaderSource).not.toContain(
      "getApprovalTasksData(workspace.id),\n    getWorkspaceBusinessLoopGapReadout",
    );
  });
});
