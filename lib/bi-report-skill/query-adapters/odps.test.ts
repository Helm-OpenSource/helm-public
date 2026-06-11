import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryBiReportRowsFromOdps } from "./odps";

// Minimal Response-like stub so the adapter's response.ok / response.json()
// path runs without depending on a global Response implementation.
function makeFetch(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

function callOdps(fetchImpl: typeof fetch) {
  return queryBiReportRowsFromOdps({
    workspaceId: "ws",
    skill: {} as never,
    subscription: {} as never,
    sql: "SELECT 1",
    sqlParams: {},
    fetchImpl,
  });
}

describe("queryBiReportRowsFromOdps", () => {
  const previous = process.env.BI_REPORT_ODPS_API_URL;
  beforeEach(() => {
    // Force the HTTP-bridge path (no MCP env configured here).
    process.env.BI_REPORT_ODPS_API_URL = "http://odps.example/api/odps/query";
  });
  afterEach(() => {
    process.env.BI_REPORT_ODPS_API_URL = previous;
    vi.restoreAllMocks();
  });

  it("throws — not silently zero rows — when the bridge reports success=false on a 200", async () => {
    // The real bridge returns HTTP 200 with { success:false, error } on failure.
    const fetchImpl = makeFetch({
      success: false,
      error: "ODPS-0130131: Table not found - table datakey.`missing` cannot be resolved",
    });
    await expect(callOdps(fetchImpl)).rejects.toThrow(/Table not found/i);
  });

  it("returns normalized rows on a successful response", async () => {
    const fetchImpl = makeFetch({
      success: true,
      columns: [{ name: "one" }, { name: "maybe_null" }, { name: "dec_val" }],
      rows: [{ one: 1, maybe_null: null, dec_val: 2.5 }],
    });
    await expect(callOdps(fetchImpl)).resolves.toEqual([
      { one: 1, maybe_null: null, dec_val: 2.5 },
    ]);
  });

  it("warns once per query (not per row) when a BIGINT column exceeds safe-integer precision", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // The bridge returns BIGINT as a raw number, so these arrive already rounded.
    // Many rows share the corrupted column — the warning must not repeat per row.
    const fetchImpl = makeFetch({
      success: true,
      rows: [
        { case_id: 9223372036854775807, small: 3 },
        { case_id: 9223372036854775806, small: 4 },
        { case_id: 9223372036854775805, small: 5 },
      ],
    });
    await callOdps(fetchImpl);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("case_id"));
    // a normal safe integer column must NOT be named
    expect(String(warn.mock.calls[0]?.[0])).not.toContain('"small"');
  });

  it("does not warn when all integers are within the safe range", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = makeFetch({ success: true, rows: [{ a: 1, b: 2_000_000 }] });
    await callOdps(fetchImpl);
    expect(warn).not.toHaveBeenCalled();
  });
});
