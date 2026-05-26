import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const guardedSurfaces = [
  "features/dashboard/goal-driven-home-surface.tsx",
  "features/internal-operating-workspace/internal-operating-home.tsx",
  "features/reports/reports-client.tsx",
  "features/approvals/approvals-client.tsx",
  "features/imports/imports-client.tsx",
  "features/inbox/inbox-client.tsx",
  "features/diagnostics/diagnostics-client.tsx",
  "features/opportunities/opportunities-client.tsx",
  "features/customer-success-handoff/queue-view.tsx",
] as const;

describe("business-loop gap readout helper guard", () => {
  it("keeps the shared helper as the only allowed page-level mapping entrypoint", () => {
    const helper = read("lib/presentation/business-loop-gap-readout.ts");

    expect(helper).toContain("export function buildBusinessLoopGapReadout");
    expect(helper).toContain('label: english ? "Loop gap" : "闭环缺口"');

    for (const relativePath of guardedSurfaces) {
      const surface = read(relativePath);

      expect(surface).toContain("buildBusinessLoopGapReadout");
      expect(surface).toContain("const businessLoopGapReadout = buildBusinessLoopGapReadout");
      expect(surface).not.toContain("businessLoopGapSummary.primaryGap");
      expect(surface).not.toContain("const primaryGap = businessLoopGapSummary");
      expect(surface).not.toContain("const blocker = businessLoopGapSummary");
      expect(surface).not.toContain("const pendingDecision = businessLoopGapSummary");
      expect(surface).not.toContain("const nextAction = businessLoopGapSummary");
    }
  });
});
