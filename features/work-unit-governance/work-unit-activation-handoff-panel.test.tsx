import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkUnitActivationHandoffPanel } from "@/features/work-unit-governance/work-unit-activation-handoff-panel";
import { buildActivationHandoffReadout } from "@/lib/work-unit-governance/activation-handoff";
import { validateUserVisibleTerminology } from "@/lib/work-unit-governance/contracts";
import {
  buildSyntheticActivationHandoffRequest,
  buildSyntheticPromotedWorkUnit,
} from "@/lib/work-unit-governance/synthetic-fixtures";

describe("WorkUnitActivationHandoffPanel", () => {
  it("renders a simple Chinese activation handoff without internal GitHub terms", () => {
    const workUnit = buildSyntheticPromotedWorkUnit({
      activationScope: "production_runtime",
    });
    const request = buildSyntheticActivationHandoffRequest(workUnit);
    const readout = buildActivationHandoffReadout({ workUnit, request });
    const html = renderToStaticMarkup(
      <WorkUnitActivationHandoffPanel readout={readout} english={false} />,
    );

    expect(html).toContain("生效范围交接");
    expect(html).toContain("等待独立授权");
    expect(html).toContain("不自动外发");
    expect(html).toContain("不自动生效");
    expect(html).not.toMatch(/\b(?:Branch|PR|Merge|CI|Ruleset|Merge Queue)\b/);
    expect(validateUserVisibleTerminology(html)).toEqual([]);
  });
});
