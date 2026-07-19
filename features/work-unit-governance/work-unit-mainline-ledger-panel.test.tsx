import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkUnitMainlineLedgerPanel } from "@/features/work-unit-governance/work-unit-mainline-ledger-panel";
import { validateUserVisibleTerminology } from "@/lib/work-unit-governance/contracts";
import { buildPrivateMainlineLedgerReadout } from "@/lib/work-unit-governance/mainline-ledger";
import { buildSyntheticPrivateMainlineLedger } from "@/lib/work-unit-governance/synthetic-fixtures";

describe("WorkUnitMainlineLedgerPanel", () => {
  it("renders a simple Chinese ledger surface without internal GitHub terms", () => {
    const readout = buildPrivateMainlineLedgerReadout(buildSyntheticPrivateMainlineLedger());
    const html = renderToStaticMarkup(
      <WorkUnitMainlineLedgerPanel readout={readout} english={false} />,
    );

    expect(html).toContain("公司主线账本");
    expect(html).toContain("追加记录");
    expect(html).toContain("当前有效视图");
    expect(html).toContain("无真实客户事实");
    expect(html).not.toMatch(/\b(?:Branch|PR|Merge|CI|Ruleset|Merge Queue)\b/);
    expect(validateUserVisibleTerminology(html)).toEqual([]);
  });
});
