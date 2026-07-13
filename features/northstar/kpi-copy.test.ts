import { describe, expect, it } from "vitest";
import { formatKpiValue, DIRECTION_COPY } from "./kpi-copy";
import type { NorthstarKpi } from "@/lib/shell/northstar-kpi";

function kpi(o: Partial<NorthstarKpi>): NorthstarKpi {
  return { key: "k", label: "L", status: "measured", unit: "count", value: 5, bandLabel: null, direction: "up_good", href: null, basisRef: "r", ...o };
}

describe("kpi-copy formatKpiValue", () => {
  it("currency_band shows bandLabel only, never a raw amount", () => {
    expect(formatKpiValue(kpi({ unit: "currency_band", value: null, bandLabel: "¥10k–50k" }), false)).toEqual({ text: "¥10k–50k", muted: false });
  });
  it("units format (percent/days/count) when measured", () => {
    expect(formatKpiValue(kpi({ unit: "percent", value: 42 }), false).text).toBe("42%");
    expect(formatKpiValue(kpi({ unit: "days", value: 3 }), true).text).toBe("3d");
    expect(formatKpiValue(kpi({ unit: "count", value: 9 }), false).text).toBe("9");
  });
  it("three-state: no_data → — ; pending_source → note (both muted)", () => {
    expect(formatKpiValue(kpi({ status: "no_data", value: null }), false)).toEqual({ text: "—", muted: true });
    expect(formatKpiValue(kpi({ status: "pending_source", value: null, pendingSourceNote: "接入中" }), false)).toEqual({ text: "接入中", muted: true });
  });
  it("direction copy tones", () => {
    expect(DIRECTION_COPY.up_good.arrow).toBe("↑");
    expect(DIRECTION_COPY.neutral.tone).toBe("neutral");
  });
});
