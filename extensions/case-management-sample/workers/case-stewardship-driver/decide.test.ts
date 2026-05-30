import { describe, expect, it } from "vitest";

import rawCases from "../../fixtures/case.sample.json";
import { decideStewardship } from "./decide";
import { CASE_STEWARDSHIP_DRIVER_MANIFEST } from "./manifest";
import type { SampleCaseRecord } from "../../signals/case/case-mapper";

const cases = rawCases as SampleCaseRecord[];

describe("case-management-sample case stewardship driver", () => {
  it("keeps the worker manifest read-only", () => {
    expect(CASE_STEWARDSHIP_DRIVER_MANIFEST.dataAccess.writes).toEqual([]);
    expect(CASE_STEWARDSHIP_DRIVER_MANIFEST.maxEffectMode).toBe("read_only");
  });

  it("keeps every active case in the roster", () => {
    const report = decideStewardship({ cases, today: "2026-05-18" });

    expect(report.roster.map((entry) => entry.caseId).sort()).toEqual([
      "CASE-SAMPLE-001",
      "CASE-SAMPLE-002",
      "CASE-SAMPLE-003",
    ]);
    expect(report.stats.activeCases).toBe(3);
  });

  it("flags evidence gaps without creating commitments", () => {
    const report = decideStewardship({ cases, today: "2026-05-18" });
    const flag = report.flags.find((item) => item.proposalKind === "flag_evidence_gap");

    expect(flag).toMatchObject({
      caseId: "CASE-SAMPLE-003",
      commitment: "suggestion_only",
      requiresApproval: false,
      suppressed: false,
    });
  });

  it("flags dropped cases after long idle windows", () => {
    const report = decideStewardship({ cases, today: "2026-06-01" });

    expect(report.flags.some((item) => item.proposalKind === "flag_dropped_case")).toBe(true);
    expect(report.stats.dropped).toBeGreaterThan(0);
  });
});
