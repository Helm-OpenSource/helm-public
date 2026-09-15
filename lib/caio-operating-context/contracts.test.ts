import { describe, expect, it } from "vitest";

import {
  assertCaioOperatingContextPack,
  CaioOperatingContextContractError,
  parseCaioDetectorHit,
  parseCaioMetricResult,
} from "./contracts";

const template = (templateId: string, sourceKey = "source-a") => ({
  templateId, domain: "operations", sourceKey, run: async () => ({ values: {}, denominator: null }),
});
const detector = (detectorId: string, requiredTemplateIds: string[]) => ({
  detectorId, title: { zh: "标题", en: "Title" }, requiredTemplateIds, evaluate: () => [],
});

describe("parseCaioMetricResult", () => {
  it("accepts finite numbers and null keyed by refs", () => {
    expect(parseCaioMetricResult({ values: { dead_letters: 3, ratio: 0.25, unknown_slot: null }, denominator: 12 }))
      .toEqual({ ok: true, values: { dead_letters: 3, ratio: 0.25, unknown_slot: null }, denominator: 12 });
  });

  it.each([
    [{ values: { name: "张三" }, denominator: null }],
    [{ values: { n: Number.NaN }, denominator: null }],
    [{ values: { n: Number.POSITIVE_INFINITY }, denominator: null }],
    [{ values: { n: [1] }, denominator: null }],
    [{ values: { "bad key": 1 }, denominator: null }],
    [{ values: {}, denominator: -1 }],
    [{ values: {}, denominator: null, extra: true }],
    [null],
  ])("rejects %j as invalid", (raw) => {
    expect(parseCaioMetricResult(raw)).toEqual({ ok: false, errorCode: "metric_result_invalid" });
  });

  it("rejects keys that the source-governance guard treats as unsafe", () => {
    expect(parseCaioMetricResult({ values: { customerName: 1 }, denominator: null }))
      .toEqual({ ok: false, errorCode: "metric_result_unsafe" });
  });
});

describe("parseCaioDetectorHit", () => {
  const hit = { mergeKey: "dead-letter-surge", objectKey: "job:closure", severity: "critical", reasonCode: "dead_letter_rate_high", evidenceTemplateIds: ["dead-letters"] };

  it("accepts a hit whose evidence is inside the detector inputs", () => {
    expect(parseCaioDetectorHit(hit, ["dead-letters", "attempts"])).toEqual({ ok: true, hit });
  });

  it("rejects evidence outside the declared inputs", () => {
    expect(parseCaioDetectorHit({ ...hit, evidenceTemplateIds: ["other"] }, ["dead-letters"]))
      .toEqual({ ok: false, errorCode: "detector_evidence_outside_inputs" });
  });

  it.each([{ ...hit, severity: "fatal" }, { ...hit, evidenceTemplateIds: [] }, { ...hit, mergeKey: "" }, { ...hit, note: "x" }])(
    "rejects malformed hit %j", (raw) => {
      expect(parseCaioDetectorHit(raw, ["dead-letters"])).toEqual({ ok: false, errorCode: "detector_hit_invalid" });
    });
});

describe("assertCaioOperatingContextPack", () => {
  it("accepts unique templates and detectors that reference known templates", () => {
    expect(() => assertCaioOperatingContextPack({ templates: [template("a"), template("b")], detectors: [detector("d", ["a", "b"])] })).not.toThrow();
  });

  it.each([
    [{ templates: [template("a"), template("a")], detectors: [] }, "duplicate_template_id"],
    [{ templates: [template("a")], detectors: [detector("d", ["a"]), detector("d", ["a"])] }, "duplicate_detector_id"],
    [{ templates: [template("a")], detectors: [detector("d", ["missing"])] }, "detector_unknown_template"],
    [{ templates: [template("a")], detectors: [detector("d", [])] }, "detector_requires_inputs"],
    [{ templates: [template("Bad Id")], detectors: [] }, "template_id_invalid"],
  ] as const)("rejects %#: %s", (pack, reason) => {
    try {
      assertCaioOperatingContextPack(pack as never);
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(CaioOperatingContextContractError);
      expect((error as CaioOperatingContextContractError).reasons).toContain(reason);
    }
  });
});
