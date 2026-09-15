import { describe, expect, it, vi } from "vitest";

import type { CaioDetector, CaioMetricObservationView } from "./contracts";
import { planCaioCandidateTransitions, runCaioDetectors } from "./detector-runner";

const now = new Date("2026-09-16T02:00:00Z");
const ok = (templateId: string, values: Record<string, number | null>): CaioMetricObservationView =>
  ({ templateId, domain: "operations", status: "ok", values, denominator: null, evidenceRef: `caio-metric:${templateId}:x` });
const unknown = (templateId: string): CaioMetricObservationView =>
  ({ templateId, domain: "operations", status: "unknown", values: null, denominator: null, evidenceRef: null });

const deadLetters: CaioDetector = {
  detectorId: "dead-letter-surge", title: { zh: "死信激增", en: "Dead-letter surge" }, requiredTemplateIds: ["dead-letters"],
  evaluate: ({ observations }) => {
    const count = observations.get("dead-letters")?.values?.count ?? 0;
    return count >= 10
      ? [{ mergeKey: "closure", objectKey: "job:closure", severity: "critical", reasonCode: "dead_letters_over_threshold", evidenceTemplateIds: ["dead-letters"] }]
      : [];
  },
};

describe("runCaioDetectors", () => {
  it("evaluates detectors whose inputs are all known", () => {
    const result = runCaioDetectors({ detectors: [deadLetters], observations: new Map([["dead-letters", ok("dead-letters", { count: 12 })]]), now });
    expect(result.evaluated).toEqual([{ detectorId: "dead-letter-surge", hits: [expect.objectContaining({ mergeKey: "closure" })] }]);
  });

  it("skips (never evaluates as zero) when an input is unknown or missing", () => {
    const evaluate = vi.fn(() => []);
    const detector = { ...deadLetters, evaluate };
    expect(runCaioDetectors({ detectors: [detector], observations: new Map([["dead-letters", unknown("dead-letters")]]), now }).skipped)
      .toEqual([{ detectorId: "dead-letter-surge", reason: "input_unknown" }]);
    expect(runCaioDetectors({ detectors: [detector], observations: new Map(), now }).skipped)
      .toEqual([{ detectorId: "dead-letter-surge", reason: "input_missing" }]);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("isolates a throwing detector and rejects hits citing evidence outside its inputs", () => {
    const throwing = { ...deadLetters, detectorId: "throws", evaluate: () => { throw new Error("private detail"); } };
    const outside = { ...deadLetters, detectorId: "outside", evaluate: () => [{ mergeKey: "m", objectKey: "o", severity: "info", reasonCode: "r", evidenceTemplateIds: ["other"] }] };
    const result = runCaioDetectors({ detectors: [throwing, outside, deadLetters], observations: new Map([["dead-letters", ok("dead-letters", { count: 12 })]]), now });
    expect(result.failed).toEqual([{ detectorId: "throws", reason: "detector_threw" }, { detectorId: "outside", reason: "detector_evidence_outside_inputs" }]);
    expect(result.evaluated.map((e) => e.detectorId)).toEqual(["dead-letter-surge"]);
  });

  it("merges duplicate merge keys from one detector into a single hit (highest severity wins)", () => {
    const dup = { ...deadLetters, evaluate: () => [
      { mergeKey: "m", objectKey: "o", severity: "warning", reasonCode: "r", evidenceTemplateIds: ["dead-letters"] },
      { mergeKey: "m", objectKey: "o", severity: "critical", reasonCode: "r", evidenceTemplateIds: ["dead-letters"] },
    ] };
    const result = runCaioDetectors({ detectors: [dup], observations: new Map([["dead-letters", ok("dead-letters", {})]]), now });
    expect(result.evaluated[0].hits).toEqual([expect.objectContaining({ mergeKey: "m", severity: "critical" })]);
  });
});

describe("planCaioCandidateTransitions", () => {
  it("clears open candidates only for detectors that were evaluated this tick and did not hit", () => {
    const plan = planCaioCandidateTransitions({
      run: { evaluated: [{ detectorId: "a", hits: [] }], skipped: [{ detectorId: "b", reason: "input_unknown" }], failed: [{ detectorId: "c", reason: "detector_threw" }] },
      openCandidates: [{ detectorId: "a", mergeKey: "m1" }, { detectorId: "b", mergeKey: "m2" }, { detectorId: "c", mergeKey: "m3" }],
    });
    expect(plan.clears).toEqual([{ detectorId: "a", mergeKey: "m1" }]);
    expect(plan.upserts).toEqual([]);
  });
});
