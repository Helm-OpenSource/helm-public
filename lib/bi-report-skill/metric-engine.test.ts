import { afterEach, describe, expect, it, vi } from "vitest";

import { computeBiReportMetrics } from "@/lib/bi-report-skill/metric-engine";
import type { BiReportMetricDefinition } from "@/lib/bi-report-skill/types";

afterEach(() => {
  vi.restoreAllMocks();
});

const rows = [
  { paid: 30, billed: 100, paid_prev: 20, billed_prev: 100 },
  { paid: 30, billed: 100, paid_prev: 20, billed_prev: 100 },
];

describe("computeBiReportMetrics derived-metric resolution", () => {
  it("computes a derived metric that references a LATER-defined derived metric", () => {
    // pct_change references ratios declared AFTER it. Previously the forward
    // reference read undefined and the change collapsed to 0.
    const definitions = {
      version: "v1",
      aggregations: [
        { key: "pay_rate_change", label: "Pay rate Δ", type: "pct_change", current: "pay_rate", previous: "pay_rate_prev", format: "percent" },
        { key: "paid_sum", label: "Paid", type: "sum", field: "paid" },
        { key: "billed_sum", label: "Billed", type: "sum", field: "billed" },
        { key: "paid_prev_sum", label: "Paid prev", type: "sum", field: "paid_prev" },
        { key: "billed_prev_sum", label: "Billed prev", type: "sum", field: "billed_prev" },
        { key: "pay_rate", label: "Pay rate", type: "ratio", numerator: "paid_sum", denominator: "billed_sum" },
        { key: "pay_rate_prev", label: "Pay rate prev", type: "ratio", numerator: "paid_prev_sum", denominator: "billed_prev_sum" },
      ],
    } as unknown as BiReportMetricDefinition;

    const { metricsByKey } = computeBiReportMetrics({ definitions, rows });

    // paid=60, billed=200 → 0.3 ; prev paid=40, billed=200 → 0.2
    expect(metricsByKey.pay_rate).toBeCloseTo(0.3);
    expect(metricsByKey.pay_rate_prev).toBeCloseTo(0.2);
    // (0.3 - 0.2) / 0.2 = 0.5 — NOT 0
    expect(metricsByKey.pay_rate_change).toBeCloseTo(0.5);
  });

  it("still computes simple sums and ratios over sums", () => {
    const definitions = {
      version: "v1",
      aggregations: [
        { key: "paid_sum", label: "Paid", type: "sum", field: "paid" },
        { key: "billed_sum", label: "Billed", type: "sum", field: "billed" },
        { key: "pay_rate", label: "Pay rate", type: "ratio", numerator: "paid_sum", denominator: "billed_sum" },
      ],
    } as unknown as BiReportMetricDefinition;

    const { metricsByKey } = computeBiReportMetrics({ definitions, rows });
    expect(metricsByKey.paid_sum).toBe(60);
    expect(metricsByKey.pay_rate).toBeCloseTo(0.3);
  });

  it("warns when a sum exceeds the safe-integer range (precision risk)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bigRows = [
      { amt: Number.MAX_SAFE_INTEGER },
      { amt: Number.MAX_SAFE_INTEGER },
    ];
    const definitions = {
      version: "v1",
      aggregations: [{ key: "amt_sum", label: "Amount", type: "sum", field: "amt" }],
    } as unknown as BiReportMetricDefinition;

    computeBiReportMetrics({ definitions, rows: bigRows });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("MAX_SAFE_INTEGER");
  });

  it("does not warn for ordinary in-range sums", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const definitions = {
      version: "v1",
      aggregations: [{ key: "paid_sum", label: "Paid", type: "sum", field: "paid" }],
    } as unknown as BiReportMetricDefinition;
    computeBiReportMetrics({ definitions, rows });
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns (instead of silently emitting 0) when a metric references an undefined key", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const definitions = {
      version: "v1",
      aggregations: [
        { key: "paid_sum", label: "Paid", type: "sum", field: "paid" },
        { key: "bogus", label: "Bogus", type: "ratio", numerator: "paid_sum", denominator: "does_not_exist" },
      ],
    } as unknown as BiReportMetricDefinition;

    const { metricsByKey } = computeBiReportMetrics({ definitions, rows });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("does_not_exist");
    // denominator missing → safeRatio returns 0
    expect(metricsByKey.bogus).toBe(0);
  });
});
