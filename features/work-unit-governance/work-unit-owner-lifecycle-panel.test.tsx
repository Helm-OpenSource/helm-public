import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkUnitOwnerLifecyclePanel } from "@/features/work-unit-governance/work-unit-owner-lifecycle-panel";
import { validateUserVisibleTerminology } from "@/lib/work-unit-governance/contracts";
import { buildOwnerLifecycleReadout } from "@/lib/work-unit-governance/owner-lifecycle";
import {
  buildSyntheticOwnerLifecyclePolicy,
  buildSyntheticWorkUnit,
  WORK_UNIT_SYNTHETIC_TIME,
} from "@/lib/work-unit-governance/synthetic-fixtures";

describe("WorkUnitOwnerLifecyclePanel", () => {
  it("renders a simple Chinese owner path without internal GitHub terms", () => {
    const readout = buildOwnerLifecycleReadout({
      workUnit: buildSyntheticWorkUnit(),
      policy: buildSyntheticOwnerLifecyclePolicy(),
      receipts: [],
      now: WORK_UNIT_SYNTHETIC_TIME,
    });
    const html = renderToStaticMarkup(
      <WorkUnitOwnerLifecyclePanel readout={readout} english={false} />,
    );

    expect(html).toContain("需要确认的人");
    expect(html).toContain("负责人路径");
    expect(html).toContain("请负责人复核");
    expect(html).toContain("不自动通知");
    expect(html).not.toMatch(/\b(?:Branch|PR|Merge|CI|Ruleset|Merge Queue)\b/);
    expect(validateUserVisibleTerminology(html)).toEqual([]);
  });
});
