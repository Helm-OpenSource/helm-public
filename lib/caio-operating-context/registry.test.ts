import { afterEach, describe, expect, it } from "vitest";

import { CaioOperatingContextContractError, type CaioDetector, type CaioMetricQueryTemplate } from "./contracts";
import {
  getRegisteredCaioOperatingContext,
  registerCaioOperatingContextPack,
  resetCaioOperatingContextRegistryForTests,
} from "./registry";

const template = (templateId: string): CaioMetricQueryTemplate => ({
  templateId, domain: "operations", sourceKey: "source-a", run: async () => ({ values: {}, denominator: null }),
});
const detector = (detectorId: string, requiredTemplateIds: string[]): CaioDetector => ({
  detectorId, title: { zh: "标题", en: "Title" }, requiredTemplateIds, evaluate: () => [],
});

afterEach(() => resetCaioOperatingContextRegistryForTests());

describe("CAIO operating-context registry", () => {
  it("is empty before any pack registers", () => {
    expect(getRegisteredCaioOperatingContext()).toEqual({ templates: [], detectors: [] });
  });

  it("merges packs, letting a detector reference another pack's template", () => {
    registerCaioOperatingContextPack({ packId: "pack-a", templates: [template("a")], detectors: [] });
    registerCaioOperatingContextPack({ packId: "pack-b", templates: [template("b")], detectors: [detector("d", ["a", "b"])] });
    const registered = getRegisteredCaioOperatingContext();
    expect(registered.templates.map((t) => t.templateId)).toEqual(["a", "b"]);
    expect(registered.detectors.map((d) => d.detectorId)).toEqual(["d"]);
  });

  it("refuses a repeated pack id instead of silently keeping one copy", () => {
    registerCaioOperatingContextPack({ packId: "pack-a", templates: [template("a")], detectors: [] });
    expect(() => registerCaioOperatingContextPack({ packId: "pack-a", templates: [], detectors: [] }))
      .toThrow("caio_operating_context_pack_already_registered:pack-a");
  });

  it("refuses template id collisions across packs and leaves the registry unchanged", () => {
    registerCaioOperatingContextPack({ packId: "pack-a", templates: [template("a")], detectors: [] });
    try {
      registerCaioOperatingContextPack({ packId: "pack-b", templates: [template("a")], detectors: [] });
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(CaioOperatingContextContractError);
      expect((error as CaioOperatingContextContractError).reasons).toContain("duplicate_template_id");
    }
    expect(getRegisteredCaioOperatingContext().templates).toHaveLength(1);
    // The refused pack id stays free to register correctly later.
    expect(() => registerCaioOperatingContextPack({ packId: "pack-b", templates: [template("b")], detectors: [] })).not.toThrow();
  });
});
