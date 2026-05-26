import { describe, expect, it } from "vitest";

import implementationHealthFixturePack from "@/evals/implementation-health/implementation-health-cases.json";
import {
  runImplementationHealthEval,
  type ImplementationHealthCase,
  type ImplementationHealthFixturePack,
} from "@/lib/evals/implementation-health-evals";

const DEFAULT_PACK =
  implementationHealthFixturePack as ImplementationHealthFixturePack;

function clonePack(): ImplementationHealthFixturePack {
  return JSON.parse(JSON.stringify(DEFAULT_PACK)) as ImplementationHealthFixturePack;
}

function findCase(
  pack: ImplementationHealthFixturePack,
  id: string,
): ImplementationHealthCase {
  const target = pack.cases.find((item) => item.id === id);
  if (!target) {
    throw new Error(`fixture case ${id} not found`);
  }
  return target;
}

describe("implementation health P0 offline eval", () => {
  it("passes the checked-in implementation health fixture pack", () => {
    const summary = runImplementationHealthEval();

    expect(summary.passed).toBe(true);
    expect(summary.version).toBe("implementation-health-p0-v1");
    expect(summary.totalCases).toBe(15);
    expect(summary.healthyCaseCount).toBeGreaterThanOrEqual(1);
    expect(summary.blockedCaseCount).toBeGreaterThanOrEqual(3);
    expect(summary.watchCaseCount).toBeGreaterThanOrEqual(2);
    expect(summary.degradedCaseCount).toBeGreaterThanOrEqual(1);
    expect(summary.notApplicableCaseCount).toBeGreaterThanOrEqual(1);
    expect(summary.preventedBoundaryAttemptCount).toBeGreaterThanOrEqual(7);

    expect(summary.rawDataLeakCount).toBe(0);
    expect(summary.realPersonNameLeakCount).toBe(0);
    expect(summary.hrPerformanceClaimCount).toBe(0);
    expect(summary.autoExecutionAttemptCount).toBe(0);
    expect(summary.autoNotificationAttemptCount).toBe(0);
    expect(summary.causalClaimCount).toBe(0);
    expect(summary.crossTenantOriginalTextAccessCount).toBe(0);
    expect(summary.actorAggregationAttemptCount).toBe(0);
    expect(summary.dynamicReasonCodeCount).toBe(0);
    expect(summary.tenantConfigWriteAttemptCount).toBe(0);
    expect(summary.defaultFallbackOwnerAssignmentCount).toBe(0);
    expect(summary.reasonCodeUnknownCount).toBe(0);
    expect(summary.failures).toEqual([]);
  });

  it("fails when an HR scoring overreach is incorrectly accepted", () => {
    const mutated = clonePack();
    findCase(mutated, "IH-009-HR-SCORING-REJECT").expect.outcome = "accepted";

    const summary = runImplementationHealthEval(mutated);

    expect(summary.passed).toBe(false);
    expect(summary.hrPerformanceClaimCount).toBe(1);
    expect(
      summary.failures.some((entry) =>
        entry.reason.startsWith("hr_performance_claim_count_exceeds"),
      ),
    ).toBe(true);
  });

  it("fails when raw customer data access is incorrectly accepted", () => {
    const mutated = clonePack();
    findCase(mutated, "IH-010-RAW-CUSTOMER-DATA-REJECT").expect.outcome = "accepted";

    const summary = runImplementationHealthEval(mutated);

    expect(summary.passed).toBe(false);
    expect(summary.rawDataLeakCount).toBe(1);
    expect(summary.crossTenantOriginalTextAccessCount).toBe(1);
  });

  it("fails when a causal ROI claim is incorrectly accepted", () => {
    const mutated = clonePack();
    findCase(mutated, "IH-011-CAUSAL-ROI-CLAIM-REJECT").expect.outcome = "accepted";

    const summary = runImplementationHealthEval(mutated);

    expect(summary.passed).toBe(false);
    expect(summary.causalClaimCount).toBe(1);
  });

  it("fails when per-actor aggregation is incorrectly accepted", () => {
    const mutated = clonePack();
    findCase(mutated, "IH-012-ACTOR-AGGREGATION-REJECT").expect.outcome = "accepted";

    const summary = runImplementationHealthEval(mutated);

    expect(summary.passed).toBe(false);
    expect(summary.actorAggregationAttemptCount).toBe(1);
  });

  it("fails when a dynamic reason code is introduced into a snapshot", () => {
    const mutated = clonePack();
    const target = findCase(mutated, "IH-002-NO-ACTIVE-USER");
    target.snapshot!.nodeStates[1]!.reasonCodes.push("runtime_created_reason");

    const summary = runImplementationHealthEval(mutated);

    expect(summary.passed).toBe(false);
    expect(summary.reasonCodeUnknownCount).toBe(1);
    expect(
      summary.failures.some((entry) =>
        entry.reason.startsWith("reason_code_unknown_count_exceeds"),
      ),
    ).toBe(true);
  });

  it("fails when a review queue item is allowed to write tenant config", () => {
    const mutated = clonePack();
    findCase(mutated, "IH-014-REVIEW-QUEUE-AUTO-WRITE-REJECT").expect.outcome = "accepted";

    const summary = runImplementationHealthEval(mutated);

    expect(summary.passed).toBe(false);
    expect(summary.autoExecutionAttemptCount).toBe(1);
    expect(summary.tenantConfigWriteAttemptCount).toBe(1);
  });

  it("fails when notification default fallback owner is incorrectly accepted", () => {
    const mutated = clonePack();
    findCase(mutated, "IH-015-NOTIFICATION-FALLBACK-OWNER-REJECT").expect.outcome = "accepted";

    const summary = runImplementationHealthEval(mutated);

    expect(summary.passed).toBe(false);
    expect(summary.autoNotificationAttemptCount).toBe(1);
    expect(summary.defaultFallbackOwnerAssignmentCount).toBe(1);
  });

  it("fails when fixture drifts into runtime substrings", () => {
    const mutated = clonePack();
    const target = findCase(mutated, "IH-001-HEALTHY-TENANT");
    (target as Record<string, unknown>)["__drift__"] = [
      "import { db } from '",
      "@/lib",
      "/db",
      "'",
    ].join("");

    const summary = runImplementationHealthEval(mutated);

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((entry) =>
        entry.reason.startsWith("fixture_contains_forbidden_runtime_substring"),
      ),
    ).toBe(true);
  });

  it("fails when snapshot overallState stops matching deterministic rules", () => {
    const mutated = clonePack();
    const target = findCase(mutated, "IH-003-OWNER-SUPERVISOR-UNMAPPED");
    target.snapshot!.overallState = "healthy";

    const summary = runImplementationHealthEval(mutated);

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((entry) =>
        entry.reason.startsWith("overall_state_mismatch"),
      ),
    ).toBe(true);
  });

  it("fails when follow-through ledger claims causality", () => {
    const mutated = clonePack();
    const target = findCase(mutated, "IH-001-HEALTHY-TENANT");
    target.followThroughLedger!.causalClaimAllowed = true;

    const summary = runImplementationHealthEval(mutated);

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((entry) =>
        entry.reason === "follow_through_ledger_causal_claim_allowed",
      ),
    ).toBe(true);
  });
});
