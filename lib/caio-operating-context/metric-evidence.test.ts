import { describe, expect, it } from "vitest";

import { buildCaioMetricObservationContent, summarizeCaioSourceRun } from "./metric-evidence";

const base = {
  templateId: "dead-letters", domain: "operations", sourceKey: "source-a",
  windowStart: new Date("2026-09-16T01:50:00Z"), windowEnd: new Date("2026-09-16T02:00:00Z"),
  denominator: 40,
};

describe("buildCaioMetricObservationContent", () => {
  it("hashes equal content equally regardless of key order", () => {
    const a = buildCaioMetricObservationContent({ ...base, values: { count: 3, rate: 0.1 } });
    const b = buildCaioMetricObservationContent({ ...base, values: { rate: 0.1, count: 3 } });
    expect(a).toEqual(b);
    expect(a.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(a.evidenceRef).toBe(`caio-metric:dead-letters:${a.contentHash.slice(7, 23)}`);
  });

  it("changes the hash when a value, window or null changes", () => {
    const a = buildCaioMetricObservationContent({ ...base, values: { count: 3 } });
    expect(buildCaioMetricObservationContent({ ...base, values: { count: 4 } }).contentHash).not.toBe(a.contentHash);
    expect(buildCaioMetricObservationContent({ ...base, values: { count: null } }).contentHash).not.toBe(a.contentHash);
    expect(buildCaioMetricObservationContent({ ...base, values: { count: 3 }, windowEnd: new Date("2026-09-16T02:10:00Z") }).contentHash)
      .not.toBe(a.contentHash);
  });
});

describe("summarizeCaioSourceRun", () => {
  const ok = (n: number) => ({ status: "ok" as const, contentHash: `sha256:${String(n).repeat(64).slice(0, 64)}`, evidenceRef: `caio-metric:t${n}:x` });
  const unknown = { status: "unknown" as const, contentHash: null, evidenceRef: null };

  it("reports success when every template was read", () => {
    const summary = summarizeCaioSourceRun([ok(1), ok(2)]);
    expect(summary).toMatchObject({ outcome: "success", freshness: "fresh", completenessPercent: 100, errorCodes: [] });
    expect(summary.summaryHash).toMatch(/^sha256:/u);
    expect(summary.evidenceRefs).toEqual(["caio-metric:t1:x", "caio-metric:t2:x"]);
  });

  it("reports partial success and never counts unknown reads", () => {
    expect(summarizeCaioSourceRun([ok(1), unknown])).toMatchObject({
      outcome: "partial_success", freshness: "fresh", completenessPercent: 50, evidenceRefs: ["caio-metric:t1:x"], errorCodes: ["metric_unknown"],
    });
  });

  it("reports failure with no summary or evidence when nothing was read", () => {
    expect(summarizeCaioSourceRun([unknown, unknown])).toEqual({
      outcome: "failure", freshness: "unknown", completenessPercent: 0, summaryHash: null, evidenceRefs: [], errorCodes: ["metric_unknown"],
    });
  });
});
