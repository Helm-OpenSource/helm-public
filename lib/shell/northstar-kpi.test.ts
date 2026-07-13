import { describe, expect, it } from "vitest";

import {
  buildCoreDefaultNorthstarKpis,
  validateNorthstarKpis,
  type NorthstarKpi,
} from "./northstar-kpi";

function kpi(overrides: Partial<NorthstarKpi> = {}): NorthstarKpi {
  return {
    key: "recovery_rate",
    label: "回收率",
    status: "measured",
    unit: "percent",
    value: 42,
    bandLabel: null,
    direction: "up_good",
    href: "/operating",
    basisRef: "provider:recovery_rate",
    ...overrides,
  };
}

const has = (kpis: NorthstarKpi[], issue: string) =>
  validateNorthstarKpis(kpis).some((i) => i.issue === issue);

describe("validateNorthstarKpis", () => {
  it("passes a well-formed measured KPI", () => {
    expect(validateNorthstarKpis([kpi()])).toEqual([]);
  });

  it("accepts the new numeric units index / rate (value non-null, bandLabel null)", () => {
    expect(validateNorthstarKpis([kpi({ unit: "index", value: 108, bandLabel: null })])).toEqual([]);
    expect(validateNorthstarKpis([kpi({ unit: "rate", value: 3, bandLabel: null })])).toEqual([]);
    // still numeric-unit rules: a band label on index/rate is rejected
    expect(has([kpi({ unit: "index", value: 108, bandLabel: "x" })], "band_label_on_non_currency_unit")).toBe(true);
  });

  it("passes a currency_band KPI carrying only a band label", () => {
    expect(
      validateNorthstarKpis([
        kpi({ unit: "currency_band", value: null, bandLabel: "¥10k–50k" }),
      ]),
    ).toEqual([]);
  });

  it("rejects a callback field on a KPI (iron law: read/navigate only)", () => {
    expect(has([{ ...kpi(), onClick: () => {} } as never], "callback_field:onClick")).toBe(true);
  });

  it("rejects unknown status / unit / direction enums", () => {
    expect(has([kpi({ status: "guessed" as never })], "unknown_status")).toBe(true);
    expect(has([kpi({ unit: "yuan" as never })], "unknown_unit")).toBe(true);
    expect(has([kpi({ direction: "sideways" as never })], "unknown_direction")).toBe(true);
  });

  it("rejects a non-measured KPI carrying a value", () => {
    expect(
      has([kpi({ status: "pending_source", pendingSourceNote: "接入中", value: 5 })], "non_measured_carries_value"),
    ).toBe(true);
  });

  it("rejects a currency_band KPI carrying a raw value (money is band-only)", () => {
    expect(
      has([kpi({ unit: "currency_band", value: 12345, bandLabel: "¥10k–50k" })], "currency_band_carries_raw_value"),
    ).toBe(true);
  });

  it("rejects a measured currency_band KPI missing its band label", () => {
    expect(
      has([kpi({ unit: "currency_band", value: null, bandLabel: null })], "currency_band_missing_band_label"),
    ).toBe(true);
  });

  it("rejects a band label on a non-currency unit", () => {
    expect(has([kpi({ unit: "percent", value: 10, bandLabel: "¥1k" })], "band_label_on_non_currency_unit")).toBe(true);
  });

  it("rejects non-finite value, empty key/label/basisRef, off-site href, dup key, pending-without-note", () => {
    expect(has([kpi({ value: Number.NaN })], "non_finite_value")).toBe(true);
    expect(has([kpi({ key: " " })], "empty_key")).toBe(true);
    expect(has([kpi({ label: "" })], "empty_label")).toBe(true);
    expect(has([kpi({ basisRef: "" })], "empty_basis_ref")).toBe(true);
    expect(has([kpi({ href: "https://evil.example" })], "href_not_in_site")).toBe(true);
    expect(has([kpi({ href: "//evil" })], "href_not_in_site")).toBe(true);
    expect(has([kpi({ key: "dup" }), kpi({ key: "dup" })], "duplicate_key")).toBe(true);
    expect(
      has([kpi({ status: "pending_source", value: null, bandLabel: null })], "pending_source_without_note"),
    ).toBe(true);
  });
});

describe("buildCoreDefaultNorthstarKpis", () => {
  it("is an honest empty set (Core has no KPI source; no fabrication)", () => {
    expect(buildCoreDefaultNorthstarKpis()).toEqual([]);
  });
});
