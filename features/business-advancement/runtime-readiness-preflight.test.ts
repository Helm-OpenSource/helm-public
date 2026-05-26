import { describe, expect, it } from "vitest";
import {
  RUNTIME_READINESS_PREFLIGHT,
  evaluateRuntimeReadinessPreflight,
} from "./runtime-readiness-preflight";

const REQUIRED_TPQR_IDS = [
  "TPQR-001",
  "TPQR-002",
  "TPQR-003",
  "TPQR-004",
  "TPQR-005",
] as const;

const FORBIDDEN_AUTHORIZATION_PATTERNS = [
  "may add a schema",
  "may add schema",
  "may create schema",
  "may add runtime extractor",
  "may add a runtime extractor",
  "may create extractor",
  "may add event queue",
  "may create event queue",
  "authorizes official write",
  "may auto-write",
  "may auto write",
  "grants execution authority",
  "may auto-send",
  "may auto send",
  "may auto-approve",
  "may auto approve",
  "llm may determine",
  "llm may rank",
  "may change page behavior",
  "may add api route",
] as const;

describe("RUNTIME_READINESS_PREFLIGHT", () => {
  it("has exactly 5 preflight rows", () => {
    expect(RUNTIME_READINESS_PREFLIGHT).toHaveLength(5);
  });

  it("covers all required TPQR IDs: TPQR-001 through TPQR-005", () => {
    const covered = new Set(RUNTIME_READINESS_PREFLIGHT.map((r) => r.linkedTpqrId));
    for (const id of REQUIRED_TPQR_IDS) {
      expect(covered.has(id), `${id} must be covered by a preflight row`).toBe(true);
    }
  });

  it("every row has runtimeAdoptionPosture === 'review_only_not_implemented'", () => {
    for (const row of RUNTIME_READINESS_PREFLIGHT) {
      expect(
        row.runtimeAdoptionPosture,
        `${row.preflightId}: runtimeAdoptionPosture must be 'review_only_not_implemented'`
      ).toBe("review_only_not_implemented");
    }
  });

  it("regression guard: no row contains 'ready_for_runtime_adoption' in any field or status", () => {
    for (const row of RUNTIME_READINESS_PREFLIGHT) {
      const fields = [
        row.repoEvidence,
        row.conditionalRuntimeGuard ?? "",
        row.followUpRequired ?? "",
        row.runtimeReadinessStatus,
      ];
      for (const field of fields) {
        expect(
          field.toLowerCase().includes("ready_for_runtime_adoption"),
          `${row.preflightId}: field must not contain forbidden wording 'ready_for_runtime_adoption'`
        ).toBe(false);
      }
    }
  });

  it("TPQR-003 cites actual overdueFlag derivation and write paths in TypeScript code", () => {
    const row = RUNTIME_READINESS_PREFLIGHT.find((r) => r.linkedTpqrId === "TPQR-003");
    expect(row).toBeDefined();
    const evidence = row!.repoEvidence.toLowerCase();
    const citesActualCode =
      evidence.includes("deriveoverdueflag") &&
      evidence.includes("commitment.service.ts:72") &&
      evidence.includes("commitment.service.ts:112") &&
      evidence.includes("commitment.service.ts:194");
    expect(
      citesActualCode,
      "TPQR-003 repoEvidence must cite deriveOverdueFlag and commitment.service.ts read/write paths"
    ).toBe(true);
  });

  it("TPQR-003 does not contain outdated no-reference wording for overdueFlag", () => {
    const row = RUNTIME_READINESS_PREFLIGHT.find((r) => r.linkedTpqrId === "TPQR-003");
    expect(row).toBeDefined();
    const combinedText =
      row!.repoEvidence.toLowerCase() +
      (row!.conditionalRuntimeGuard?.toLowerCase() ?? "");
    const hasFalseNoReferenceClaim =
      combinedText.includes("zero matches") ||
      combinedText.includes("no matches") ||
      combinedText.includes("no typescript references") ||
      combinedText.includes("not maintained") ||
      combinedText.includes("never written") ||
      combinedText.includes("schema-only");
    expect(
      hasFalseNoReferenceClaim,
      "TPQR-003 must not claim overdueFlag has no TypeScript references or is schema-only"
    ).toBe(false);
  });

  it("TPQR-003 guard avoids using persisted overdueFlag as the sole runtime filter", () => {
    const row = RUNTIME_READINESS_PREFLIGHT.find((r) => r.linkedTpqrId === "TPQR-003");
    expect(row).toBeDefined();
    const guard = row!.conditionalRuntimeGuard?.toLowerCase() ?? "";
    expect(guard.includes("persisted commitment.overdueflag column")).toBe(true);
    expect(guard.includes("sole")).toBe(true);
    expect(guard.includes("duedate/status") || guard.includes("deriveoverdueflag")).toBe(true);
  });

  it("all conditional rows have non-empty conditionalRuntimeGuard", () => {
    for (const row of RUNTIME_READINESS_PREFLIGHT) {
      if (row.runtimeReadinessStatus === "conditional_requires_runtime_guard") {
        expect(
          row.conditionalRuntimeGuard?.trim(),
          `${row.preflightId}: conditional row must have non-empty conditionalRuntimeGuard`
        ).toBeTruthy();
      }
    }
  });

  it("no row authorizes schema, API, runtime extractor, event queue, official write, auto execution, LLM ranking, or page behavior changes", () => {
    for (const row of RUNTIME_READINESS_PREFLIGHT) {
      const fields = [
        row.repoEvidence,
        row.conditionalRuntimeGuard ?? "",
        row.followUpRequired ?? "",
      ];
      for (const field of fields) {
        const lower = field.toLowerCase();
        for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
          expect(
            lower.includes(pattern),
            `${row.preflightId}: field contains forbidden authorization pattern "${pattern}"`
          ).toBe(false);
        }
      }
    }
  });

  it("TPQR-001 has runtimeReadinessStatus === 'ready_for_thin_read_model_planning'", () => {
    const row = RUNTIME_READINESS_PREFLIGHT.find((r) => r.linkedTpqrId === "TPQR-001");
    expect(row).toBeDefined();
    expect(row!.runtimeReadinessStatus).toBe("ready_for_thin_read_model_planning");
  });

  it("TPQR-002, TPQR-003, TPQR-004, TPQR-005 have runtimeReadinessStatus === 'conditional_requires_runtime_guard'", () => {
    const conditionalIds = ["TPQR-002", "TPQR-003", "TPQR-004", "TPQR-005"];
    for (const tpqrId of conditionalIds) {
      const row = RUNTIME_READINESS_PREFLIGHT.find((r) => r.linkedTpqrId === tpqrId);
      expect(row, `${tpqrId} preflight row must exist`).toBeDefined();
      expect(
        row!.runtimeReadinessStatus,
        `${tpqrId}: expected 'conditional_requires_runtime_guard'`
      ).toBe("conditional_requires_runtime_guard");
    }
  });

  it("all rows have workspaceMembershipBoundaryConfirmed === true", () => {
    for (const row of RUNTIME_READINESS_PREFLIGHT) {
      expect(
        row.workspaceMembershipBoundaryConfirmed,
        `${row.preflightId}: workspaceMembershipBoundaryConfirmed must be true`
      ).toBe(true);
    }
  });

  it("every row has a non-empty repoEvidence", () => {
    for (const row of RUNTIME_READINESS_PREFLIGHT) {
      expect(
        row.repoEvidence.trim(),
        `${row.preflightId}: repoEvidence must not be empty`
      ).not.toBe("");
    }
  });

  it("TPQR-004 conditionalRuntimeGuard addresses deduplication against loadWaitingEmailThreads", () => {
    const row = RUNTIME_READINESS_PREFLIGHT.find((r) => r.linkedTpqrId === "TPQR-004");
    expect(row).toBeDefined();
    const guard = row!.conditionalRuntimeGuard?.toLowerCase() ?? "";
    expect(
      guard.includes("deduplicat") || guard.includes("duplicate") || guard.includes("deduplicate"),
      "TPQR-004 conditionalRuntimeGuard must address deduplication"
    ).toBe(true);
  });

  it("TPQR-005 conditionalRuntimeGuard addresses derivedStaleDays derivation source", () => {
    const row = RUNTIME_READINESS_PREFLIGHT.find((r) => r.linkedTpqrId === "TPQR-005");
    expect(row).toBeDefined();
    const guard = row!.conditionalRuntimeGuard?.toLowerCase() ?? "";
    expect(
      guard.includes("derivedstaledays") || guard.includes("staledays") || guard.includes("derivation"),
      "TPQR-005 conditionalRuntimeGuard must address derivedStaleDays derivation source"
    ).toBe(true);
  });
});

describe("evaluateRuntimeReadinessPreflight", () => {
  it("all evaluator checks pass", () => {
    const result = evaluateRuntimeReadinessPreflight();
    const failed = result.checks.filter((c) => !c.passed);
    expect(
      failed,
      `Failed checks: ${failed.map((c) => `${c.checkName}: ${c.detail}`).join("; ")}`
    ).toHaveLength(0);
    expect(result.allPassed).toBe(true);
  });

  it("total rows is 5", () => {
    const result = evaluateRuntimeReadinessPreflight();
    expect(result.totalRows).toBe(5);
  });

  it("has 9 evaluator checks", () => {
    const result = evaluateRuntimeReadinessPreflight();
    expect(result.checks).toHaveLength(9);
  });
});
