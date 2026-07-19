import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkUnitRepairLearningPanel } from "@/features/work-unit-governance/work-unit-repair-learning-panel";
import { validateUserVisibleTerminology } from "@/lib/work-unit-governance/contracts";
import { buildRepairLearningReadout } from "@/lib/work-unit-governance/repair-learning-loop";
import {
  buildSyntheticFailedWorkUnit,
  buildSyntheticLearningAssetDraft,
  buildSyntheticLearningFinding,
  buildSyntheticRepairedWorkUnit,
  buildSyntheticRepairCandidateRecord,
} from "@/lib/work-unit-governance/synthetic-fixtures";

describe("WorkUnitRepairLearningPanel", () => {
  it("renders a simple Chinese repair loop without internal GitHub terms", () => {
    const original = buildSyntheticFailedWorkUnit();
    const repaired = buildSyntheticRepairedWorkUnit(original);
    const repair = buildSyntheticRepairCandidateRecord({ original, repaired });
    const finding = buildSyntheticLearningFinding(original);
    const readout = buildRepairLearningReadout({
      original,
      repaired,
      repair,
      findings: [finding],
      learningDrafts: [buildSyntheticLearningAssetDraft({ finding })],
    });
    const html = renderToStaticMarkup(
      <WorkUnitRepairLearningPanel readout={readout} english={false} />,
    );

    expect(html).toContain("修复与经验入库");
    expect(html).toContain("新候选方案");
    expect(html).toContain("可执行资产");
    expect(html).toContain("不自动修改检查规则");
    expect(html).not.toMatch(/\b(?:Branch|PR|Merge|CI|Ruleset|Merge Queue)\b/);
    expect(validateUserVisibleTerminology(html)).toEqual([]);
  });
});
