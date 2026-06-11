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

  it("consumes capacity per employee and flags the overflow once exhausted", () => {
    const owners: SampleEmployeeRecord[] = [
      { employeeRefId: "owner-a", displayName: "Owner A", role: "case-owner", active: true, reviewCapacity: 1 },
      { employeeRefId: "owner-b", displayName: "Owner B", role: "case-owner", active: true, reviewCapacity: 1 },
    ];
    // Three non-boundary open cases, two seats of capacity → 2 assignments + 1 gap.
    const threeCases: SampleCaseRecord[] = [1, 2, 3].map((n) => ({
      workspaceId: "ws",
      caseId: `CASE-CAP-00${n}`,
      ownerRefId: "unassigned",
      stage: "active_followup",
      ageDays: 2,
      priorityScore: 50,
      evidenceCount: 1,
      blockedReason: null,
      observedDate: "2026-05-18",
    }));

    const report = decideAllocations({
      cases: threeCases,
      employees: owners,
      operationMode: "active",
    });

    const assignments = report.proposals.filter(
      (p) => p.proposalKind === "propose_assignment_recommendation",
    );
    const gaps = report.proposals.filter((p) => p.proposalKind === "flag_capacity_gap");

    expect(assignments).toHaveLength(2);
    expect(gaps).toHaveLength(1);
    // Each owner is used exactly once — not all cases dumped on the first seat.
    const assignedOwners = assignments.map((p) => p.recommendedOwnerRefId).sort();
    expect(assignedOwners).toEqual(["owner-a", "owner-b"]);
  });
});
