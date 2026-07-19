import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkUnitReviewConsole } from "@/features/work-unit-governance/work-unit-review-console";
import {
  computeWorkUnitSnapshotHash,
  validateUserVisibleTerminology,
} from "@/lib/work-unit-governance/contracts";
import { buildWorkUnitRuntimeReadout } from "@/lib/work-unit-governance/runtime";
import {
  buildSyntheticWorkUnit,
  syntheticAcceptedDecision,
} from "@/lib/work-unit-governance/synthetic-fixtures";

describe("WorkUnitReviewConsole", () => {
  it("renders a simple Chinese decision surface without internal GitHub terms", () => {
    const readout = buildWorkUnitRuntimeReadout(buildSyntheticWorkUnit());
    const html = renderToStaticMarkup(
      <WorkUnitReviewConsole readout={readout} english={false} />,
    );

    expect(html).toContain("工作包复核台");
    expect(html).toContain("发起");
    expect(html).toContain("等待");
    expect(html).toContain("复核");
    expect(html).toContain("Synthetic renewal-cost check");
    expect(html).toContain("无自动批准");
    expect(html).toContain("复核候选方案");
    expect(html).not.toMatch(/\b(?:Branch|PR|Merge|CI|Ruleset|Merge Queue)\b/);
    expect(validateUserVisibleTerminology(html)).toEqual([]);
  });

  it("shows stale work as blocked for entering the company mainline", () => {
    const candidate = buildSyntheticWorkUnit();
    const snapshotHash = computeWorkUnitSnapshotHash(candidate);
    const readout = buildWorkUnitRuntimeReadout(
      buildSyntheticWorkUnit({
        status: "accepted_by_human",
        decisionSnapshotHash: snapshotHash,
        decision: syntheticAcceptedDecision(snapshotHash),
        relatedMainlineChanges: [
          {
            mainlineRef: "mainline:quote:Q-001:v2",
            conflictKeys: ["quote:Q-001"],
            changedAt: "2026-07-19T01:00:00.000Z",
          },
        ],
      }),
    );
    const html = renderToStaticMarkup(
      <WorkUnitReviewConsole readout={readout} english={false} />,
    );

    expect(html).toContain("需要重新复核");
    expect(html).toContain("不能定稿");
    expect(validateUserVisibleTerminology(html)).toEqual([]);
  });
});
