import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkUnitPrivatePlaneHandoffPanel } from "@/features/work-unit-governance/work-unit-private-plane-handoff-panel";
import { validateUserVisibleTerminology } from "@/lib/work-unit-governance/contracts";
import { buildPrivatePlaneHandoffReadout } from "@/lib/work-unit-governance/private-plane-handoff";

describe("WorkUnitPrivatePlaneHandoffPanel", () => {
  it("renders the private-plane handoff lanes without implying execution or leaking private details", () => {
    const readout = buildPrivatePlaneHandoffReadout();
    const readoutJson = JSON.stringify(readout);
    const html = renderToStaticMarkup(
      <WorkUnitPrivatePlaneHandoffPanel readout={readout} english={false} />,
    );

    expect(readout.lanes).toHaveLength(4);
    expect(readout.publicCorePersists).toBe(false);
    expect(readout.sendsExternally).toBe(false);
    expect(readout.writesTarget).toBe(false);
    expect(readout.activatesRuntime).toBe(false);
    expect(readout.appliesAsset).toBe(false);
    expect(readout.grantsApproval).toBe(false);
    expect(readout.readinessClaim).toBe("not_readiness");
    expect(readout.activationClaim).toBe("not_activation");
    expect(readout.applicationClaim).toBe("not_applied");

    expect(html).toContain("私有执行面交接边界");
    expect(html).toContain("公司主线保存");
    expect(html).toContain("负责人通知与升级");
    expect(html).toContain("运行时生效执行");
    expect(html).toContain("经验资产落库与应用");
    expect(html).toContain("不保存真实私有主线");
    expect(html).toContain("不发送通知");
    expect(html).toContain("不触发运行时生效");
    expect(html).toContain("不应用经验资产");
    expect(html).toContain("不是生产就绪");
    expect(html).toContain("不是执行");

    expect(html).not.toMatch(/\b(?:Branch|PR|Merge|CI|Ruleset|Merge Queue)\b/);
    expect(readoutJson).not.toMatch(/https?:\/\//i);
    expect(readoutJson).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(readoutJson).not.toMatch(/\b(?:password|api[_-]?key|secret|token)\s*[:=]/i);
    expect(validateUserVisibleTerminology(html)).toEqual([]);
  });
});
