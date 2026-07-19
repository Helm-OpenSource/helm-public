import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkUnitProofPackagePanel } from "@/features/work-unit-governance/work-unit-proof-package-panel";
import { validateUserVisibleTerminology } from "@/lib/work-unit-governance/contracts";
import { buildWorkUnitProofPackageReadout } from "@/lib/work-unit-governance/proof-package";
import {
  buildSyntheticPromotedWorkUnit,
  buildSyntheticWorkUnitProofPackage,
} from "@/lib/work-unit-governance/synthetic-fixtures";

describe("WorkUnitProofPackagePanel", () => {
  it("renders a simple Chinese proof viewer without internal GitHub terms", () => {
    const workUnit = buildSyntheticPromotedWorkUnit();
    const proofPackage = buildSyntheticWorkUnitProofPackage(workUnit);
    const readout = buildWorkUnitProofPackageReadout(proofPackage);
    const html = renderToStaticMarkup(
      <WorkUnitProofPackagePanel readout={readout} english={false} />,
    );

    expect(html).toContain("证明包查看器");
    expect(html).toContain("快照绑定");
    expect(html).toContain("不是生产就绪");
    expect(html).toContain("不自动批准");
    expect(html).not.toMatch(/\b(?:Branch|PR|Merge|CI|Ruleset|Merge Queue)\b/);
    expect(validateUserVisibleTerminology(html)).toEqual([]);
  });
});
