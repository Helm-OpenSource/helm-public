import { describe, expect, it } from "vitest";

import {
  renderBiReportSql,
  resolveBiReportSqlParams,
} from "@/lib/bi-report-skill/sql-template";

describe("resolveBiReportSqlParams", () => {
  // 2026-06-09 18:30 UTC == 2026-06-10 02:30 Asia/Shanghai: the business day
  // already rolled over in CN while UTC is still on the previous day.
  const crossMidnight = new Date("2026-06-09T18:30:00.000Z");

  it("resolves {{today}} in the subscription timezone", () => {
    const resolved = resolveBiReportSqlParams(
      { biz_date: "{{today}}" },
      { referenceDate: crossMidnight, timeZone: "Asia/Shanghai" },
    );
    expect(resolved.biz_date).toBe("2026-06-10");
  });

  it("defaults {{today}} to UTC when no timezone is given", () => {
    const resolved = resolveBiReportSqlParams(
      { biz_date: "{{today}}" },
      { referenceDate: crossMidnight },
    );
    expect(resolved.biz_date).toBe("2026-06-09");
  });

  it("applies day offsets relative to the timezone-resolved date", () => {
    const resolved = resolveBiReportSqlParams(
      { biz_date: "{{today-1d}}" },
      { referenceDate: crossMidnight, timeZone: "Asia/Shanghai" },
    );
    expect(resolved.biz_date).toBe("2026-06-09");
  });

  it("resolves {{month}} in the subscription timezone", () => {
    const endOfMonth = new Date("2026-06-30T17:00:00.000Z"); // 2026-07-01 01:00 +08:00
    const resolved = resolveBiReportSqlParams(
      { biz_month: "{{month}}" },
      { referenceDate: endOfMonth, timeZone: "Asia/Shanghai" },
    );
    expect(resolved.biz_month).toBe("2026-07");
  });

  it("resolves {{month-1m}} correctly when reference date is the 31st", () => {
    // Regression: setMonth() on Mar 31 overflowed to Mar (Feb has no 31st).
    const mar31 = new Date("2026-03-31T03:00:00.000Z");
    const resolved = resolveBiReportSqlParams(
      { biz_month: "{{month-1m}}" },
      { referenceDate: mar31, timeZone: "Asia/Shanghai" },
    );
    expect(resolved.biz_month).toBe("2026-02");
  });

  it("falls back to UTC for an invalid timezone name", () => {
    const resolved = resolveBiReportSqlParams(
      { biz_date: "{{today}}" },
      { referenceDate: crossMidnight, timeZone: "Not/AZone" },
    );
    expect(resolved.biz_date).toBe("2026-06-09");
  });

  it("passes through static values untouched", () => {
    const resolved = resolveBiReportSqlParams(
      { biz_date: "2026-01-01" },
      { referenceDate: crossMidnight, timeZone: "Asia/Shanghai" },
    );
    expect(resolved.biz_date).toBe("2026-01-01");
  });
});

describe("renderBiReportSql", () => {
  it("substitutes and escapes parameters", () => {
    const sql = renderBiReportSql("select * from t where d = '{{biz_date}}'", {
      biz_date: "2026-06-09",
    });
    expect(sql).toBe("select * from t where d = '2026-06-09'");
  });

  it("escapes single quotes the ODPS way (backslash, not doubled-quote)", () => {
    // ODPS does not honor '' (it concatenates adjacent literals and drops the
    // quote); it uses C-style \' . Verified against the live ODPS bridge.
    const sql = renderBiReportSql("select '{{name}}'", { name: "o'brien" });
    expect(sql).toBe("select 'o\\'brien'");
  });

  it("escapes backslashes before quotes so a trailing backslash can't break out", () => {
    const sql = renderBiReportSql("select '{{v}}'", { v: "a\\'b" });
    // a\'b  ->  backslash doubled then quote escaped  ->  a\\\'b
    expect(sql).toBe("select 'a\\\\\\'b'");
  });

  it("throws on missing params", () => {
    expect(() => renderBiReportSql("select '{{missing}}'", {})).toThrow(
      /missing params missing/,
    );
  });
});
