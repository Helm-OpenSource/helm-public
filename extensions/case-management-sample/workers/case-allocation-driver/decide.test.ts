import { describe, expect, it } from "vitest";

import rawCases from "../../fixtures/case.sample.json";
import rawEmployees from "../../fixtures/employee.sample.json";
import { decideAllocations } from "./decide";
import { CASE_ALLOCATION_DRIVER_MANIFEST } from "./manifest";
import type { SampleCaseRecord } from "../../signals/case/case-mapper";
import type { SampleEmployeeRecord } from "./types";

const cases = rawCases as SampleCaseRecord[];
const employees = rawEmployees as SampleEmployeeRecord[];

describe("case-management-sample case allocation driver", () => {
  it("keeps the worker manifest read-only", () => {
    expect(CASE_ALLOCATION_DRIVER_MANIFEST.dataAccess.writes).toEqual([]);
    expect(CASE_ALLOCATION_DRIVER_MANIFEST.maxEffectMode).toBe("read_only");
  });

  it("suppresses assignment proposals in observer mode", () => {
    const report = decideAllocations({ cases, employees });
    const proposal = report.proposals.find(
      (item) => item.proposalKind === "propose_assignment_recommendation",
    );

    expect(proposal?.commitment).toBe("suggestion_only");
    expect(proposal?.requiresApproval).toBe(false);
    expect(proposal?.suppressed).toBe(true);
    expect(proposal?.proposalKey).toMatch(/^allocation:CASE-SAMPLE-/);
  });

  it("keeps boundary cases as read-only flags", () => {
    const report = decideAllocations({ cases, employees, operationMode: "active" });
    const boundaryFlag = report.proposals.find(
      (item) => item.proposalKind === "flag_boundary_review_required",
    );

    expect(boundaryFlag).toMatchObject({
      caseId: "CASE-SAMPLE-001",
      commitment: "suggestion_only",
      requiresApproval: false,
      suppressed: false,
    });
  });

  it("flags capacity gaps when no active owner is available", () => {
    const inactiveEmployees: SampleEmployeeRecord[] = employees.map((employee) => ({
      ...employee,
      active: false,
    }));
    const report = decideAllocations({
      cases,
      employees: inactiveEmployees,
      operationMode: "active",
    });

    expect(report.stats.eligibleEmployees).toBe(0);
    expect(report.proposals.some((item) => item.proposalKind === "flag_capacity_gap")).toBe(true);
  });
});
