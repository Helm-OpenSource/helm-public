import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { splitSystemJudgementBlocks } from "@/lib/presentation/system-judgement-blocks";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const guardedSurfaces = [
  "features/dashboard/goal-driven-home-surface.tsx",
  "features/imports/imports-client.tsx",
  "features/diagnostics/diagnostics-client.tsx",
  "features/opportunities/opportunities-client.tsx",
  "features/customer-success-handoff/queue-view.tsx",
] as const;

// Object-first queue pages (wave 3, see CLAUDE.md "Object-first"): the loop-gap
// readout is system judgement, so these pages may drop it or consume it only
// inside their single closing system judgement block.
// 对象优先的队列页：闭环缺口读数属于系统判断，可以不用；用就只在末尾唯一的系统判断块里消费。
const objectFirstSurfaces = [
  "features/inbox/inbox-client.tsx",
  "features/approvals/approvals-client.tsx",
  "features/reports/reports-client.tsx",
  "features/internal-operating-workspace/internal-operating-home.tsx",
] as const;

function expectNoPageLocalGapMapping(surface: string) {
  expect(surface).not.toContain("businessLoopGapSummary.primaryGap");
  expect(surface).not.toContain("const primaryGap = businessLoopGapSummary");
  expect(surface).not.toContain("const blocker = businessLoopGapSummary");
  expect(surface).not.toContain("const pendingDecision = businessLoopGapSummary");
  expect(surface).not.toContain("const nextAction = businessLoopGapSummary");
}

describe("business-loop gap readout helper guard", () => {
  it("keeps the shared helper as the only allowed page-level mapping entrypoint", () => {
    const helper = read("lib/presentation/business-loop-gap-readout.ts");

    expect(helper).toContain("export function buildBusinessLoopGapReadout");
    expect(helper).toContain('label: english ? "Loop gap" : "闭环缺口"');

    for (const relativePath of guardedSurfaces) {
      const surface = read(relativePath);

      expect(surface).toContain("buildBusinessLoopGapReadout");
      expect(surface).toContain("const businessLoopGapReadout = buildBusinessLoopGapReadout");
      expectNoPageLocalGapMapping(surface);
    }
  });

  it("keeps object-first queue pages consuming the readout only inside their system judgement block", () => {
    for (const relativePath of objectFirstSurfaces) {
      const surface = read(relativePath);

      expectNoPageLocalGapMapping(surface);
      expect(surface, relativePath).not.toMatch(/void businessLoopGapReadout/);

      if (!surface.includes("buildBusinessLoopGapReadout")) continue;

      expect(surface, relativePath).toContain(
        "const businessLoopGapReadout = buildBusinessLoopGapReadout",
      );
      const { outside } = splitSystemJudgementBlocks(relativePath, surface);
      const usesOutside = outside.match(/\bbusinessLoopGapReadout\b/g) ?? [];
      const usesTotal = surface.match(/\bbusinessLoopGapReadout\b/g) ?? [];

      // Outside the block only the definition itself may name the readout.
      expect(usesOutside, `${relativePath} consumes the readout outside the block`).toHaveLength(1);
      expect(
        usesTotal.length,
        `${relativePath} builds the readout without rendering it in the block`,
      ).toBeGreaterThan(1);
    }
  });
});
