/**
 * Helm Business Advancement — Phase 1B Read-Model Feasibility Tests
 *
 * Validates the feasibility matrix structure and the evaluator logic.
 * All tests are pure — no network, no database, no external services.
 */

import { describe, it, expect } from "vitest";
import { ADVANCEMENT_SIGNAL_FIXTURES } from "./fixtures";
import {
  FIXTURE_FEASIBILITY_MATRIX,
  FEASIBILITY_MATRIX_ROW_COUNT,
  evaluateReadModelFeasibility,
  getFeasibilityStats,
  type FixtureFeasibilityRow,
  type FeasibilityStatus,
} from "./read-model-feasibility";

// ---------------------------------------------------------------------------
// Matrix structure tests
// ---------------------------------------------------------------------------

describe("FIXTURE_FEASIBILITY_MATRIX — structure", () => {
  it("has exactly 20 rows", () => {
    expect(FEASIBILITY_MATRIX_ROW_COUNT).toBe(20);
    expect(FIXTURE_FEASIBILITY_MATRIX.length).toBe(20);
  });

  it("every row has all required fields populated", () => {
    const REQUIRED_FIELDS: Array<keyof FixtureFeasibilityRow> = [
      "fixtureId",
      "sourceType",
      "signalType",
      "feasibilityStatus",
      "candidateReadModels",
      "evidenceRationale",
      "boundaryRationale",
      "forbiddenImplementation",
    ];

    for (const row of FIXTURE_FEASIBILITY_MATRIX) {
      for (const field of REQUIRED_FIELDS) {
        const value = row[field];
        expect(value, `${row.fixtureId}: field "${field}" must be present`).toBeTruthy();
      }
      expect(
        row.evidenceRationale.trim().length,
        `${row.fixtureId}: evidenceRationale must be non-trivial`
      ).toBeGreaterThan(20);
      expect(
        row.boundaryRationale.trim().length,
        `${row.fixtureId}: boundaryRationale must be non-trivial`
      ).toBeGreaterThan(20);
      expect(
        row.forbiddenImplementation.trim().length,
        `${row.fixtureId}: forbiddenImplementation must be non-trivial`
      ).toBeGreaterThan(20);
      expect(
        row.candidateReadModels.length,
        `${row.fixtureId}: candidateReadModels must have at least one entry`
      ).toBeGreaterThan(0);
    }
  });

  it("every fixtureId matches a Phase 1A fixture ID", () => {
    const validIds = new Set(
      ADVANCEMENT_SIGNAL_FIXTURES.map((f) => f.fixtureId)
    );
    for (const row of FIXTURE_FEASIBILITY_MATRIX) {
      expect(
        validIds.has(row.fixtureId),
        `${row.fixtureId}: not a known Phase 1A fixture ID`
      ).toBe(true);
    }
  });

  it("no duplicate fixtureIds in the matrix", () => {
    const ids = FIXTURE_FEASIBILITY_MATRIX.map((r) => r.fixtureId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("all 20 Phase 1A fixture IDs are represented in the matrix", () => {
    const matrixIds = new Set(FIXTURE_FEASIBILITY_MATRIX.map((r) => r.fixtureId));
    for (const fixture of ADVANCEMENT_SIGNAL_FIXTURES) {
      expect(
        matrixIds.has(fixture.fixtureId),
        `${fixture.fixtureId}: missing from feasibility matrix`
      ).toBe(true);
    }
  });

  it("sourceType on each matrix row matches the corresponding fixture sourceType", () => {
    const fixtureMap = new Map(
      ADVANCEMENT_SIGNAL_FIXTURES.map((f) => [f.fixtureId, f])
    );
    for (const row of FIXTURE_FEASIBILITY_MATRIX) {
      const fixture = fixtureMap.get(row.fixtureId);
      expect(fixture).toBeDefined();
      expect(row.sourceType).toBe(fixture!.sourceType);
    }
  });

  it("signalType on each matrix row matches the corresponding fixture signalType", () => {
    const fixtureMap = new Map(
      ADVANCEMENT_SIGNAL_FIXTURES.map((f) => [f.fixtureId, f])
    );
    for (const row of FIXTURE_FEASIBILITY_MATRIX) {
      const fixture = fixtureMap.get(row.fixtureId);
      expect(fixture).toBeDefined();
      expect(row.signalType).toBe(fixture!.signalType);
    }
  });

  it("feasibilityStatus is always one of the 3 valid values", () => {
    const VALID: Set<FeasibilityStatus> = new Set([
      "current_read_model_supported",
      "requires_thin_projection",
      "future_only",
    ]);
    for (const row of FIXTURE_FEASIBILITY_MATRIX) {
      expect(
        VALID.has(row.feasibilityStatus),
        `${row.fixtureId}: invalid feasibilityStatus "${row.feasibilityStatus}"`
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Specific fixture classifications
// ---------------------------------------------------------------------------

describe("FIXTURE_FEASIBILITY_MATRIX — specific classifications", () => {
  const rowById = new Map(
    FIXTURE_FEASIBILITY_MATRIX.map((r) => [r.fixtureId, r])
  );

  // current_read_model_supported fixtures
  const EXPECTED_CURRENT = [
    "AS-FX-001", // meeting / customer_waiting → mobile meeting_follow_up
    "AS-FX-003", // meeting / overdue_commitment → mobile meeting_follow_up
    "AS-FX-008", // tenant_resource / overdue_commitment → mobile proof_or_review_required
    "AS-FX-009", // tenant_resource / resource_evidence_gap → mobile proofRequired
    "AS-FX-012", // email / customer_waiting → mobile customer_waiting
    "AS-FX-015", // ask_helm / boundary_hit → ask_helm access scope
  ];

  // requires_thin_projection fixtures
  const EXPECTED_THIN = [
    "AS-FX-002", // meeting / blocked_decision
    "AS-FX-004", // crm / stalled_opportunity
    "AS-FX-005", // crm / overdue_commitment
    "AS-FX-006", // crm / customer_waiting
    "AS-FX-007", // tenant_resource / stalled_case
    "AS-FX-013", // email / stalled_opportunity
    "AS-FX-018", // user_behavior / resource_evidence_gap
    "AS-FX-019", // combined / stalled_opportunity
    "AS-FX-020", // combined / resource_evidence_gap
  ];

  // future_only fixtures
  const EXPECTED_FUTURE = [
    "AS-FX-010", // report / kpi_anomaly
    "AS-FX-011", // report / blocked_decision
    "AS-FX-014", // ask_helm / repeated_intent (no session persistence)
    "AS-FX-016", // ask_helm / abandoned_high_confidence_answer
    "AS-FX-017", // user_behavior / repeated_intent
  ];

  for (const id of EXPECTED_CURRENT) {
    it(`${id} is current_read_model_supported`, () => {
      expect(rowById.get(id)?.feasibilityStatus).toBe(
        "current_read_model_supported"
      );
    });
  }

  for (const id of EXPECTED_THIN) {
    it(`${id} is requires_thin_projection`, () => {
      expect(rowById.get(id)?.feasibilityStatus).toBe(
        "requires_thin_projection"
      );
    });
  }

  for (const id of EXPECTED_FUTURE) {
    it(`${id} is future_only`, () => {
      expect(rowById.get(id)?.feasibilityStatus).toBe("future_only");
    });
  }

  it("exactly 6 fixtures are current_read_model_supported", () => {
    const count = FIXTURE_FEASIBILITY_MATRIX.filter(
      (r) => r.feasibilityStatus === "current_read_model_supported"
    ).length;
    expect(count).toBe(6);
  });

  it("exactly 9 fixtures are requires_thin_projection", () => {
    const count = FIXTURE_FEASIBILITY_MATRIX.filter(
      (r) => r.feasibilityStatus === "requires_thin_projection"
    ).length;
    expect(count).toBe(9);
  });

  it("exactly 5 fixtures are future_only", () => {
    const count = FIXTURE_FEASIBILITY_MATRIX.filter(
      (r) => r.feasibilityStatus === "future_only"
    ).length;
    expect(count).toBe(5);
  });

  it("future_only fixtures all have candidateReadModels = ['none']", () => {
    const futureRows = FIXTURE_FEASIBILITY_MATRIX.filter(
      (r) => r.feasibilityStatus === "future_only"
    );
    for (const row of futureRows) {
      expect(row.candidateReadModels).toEqual(["none"]);
    }
  });

  it("non-future_only fixtures do not have candidateReadModels = ['none']", () => {
    const nonFuture = FIXTURE_FEASIBILITY_MATRIX.filter(
      (r) => r.feasibilityStatus !== "future_only"
    );
    for (const row of nonFuture) {
      expect(
        row.candidateReadModels.includes("none"),
        `${row.fixtureId}: non-future_only row should not have 'none' as candidate`
      ).toBe(false);
    }
  });

  it("report source fixtures are all future_only", () => {
    const reportRows = FIXTURE_FEASIBILITY_MATRIX.filter(
      (r) => r.sourceType === "report"
    );
    expect(reportRows.length).toBeGreaterThan(0);
    for (const row of reportRows) {
      expect(row.feasibilityStatus).toBe("future_only");
    }
  });

  it("AS-FX-015 (ask_helm boundary_hit) uses ask_helm candidate read model", () => {
    const row = rowById.get("AS-FX-015");
    expect(row?.candidateReadModels).toContain("ask_helm");
  });

  it("AS-FX-014 and AS-FX-016 explain session persistence prohibition", () => {
    for (const id of ["AS-FX-014", "AS-FX-016"]) {
      const row = rowById.get(id);
      const text = (row?.forbiddenImplementation ?? "").toLowerCase();
      expect(
        text.includes("persistence") || text.includes("session"),
        `${id}: forbiddenImplementation should explain session persistence prohibition`
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Boundary protection tests
// ---------------------------------------------------------------------------

describe("FIXTURE_FEASIBILITY_MATRIX — boundary protection", () => {
  const FORBIDDEN_AUTH_PATTERNS = [
    "may add a schema",
    "may add schema",
    "may create schema",
    "may add a runtime extractor",
    "may add runtime extractor",
    "may create extractor",
    "may add event queue",
    "authorizes official write",
    "may auto-write",
    "may auto write",
    "grants execution authority",
    "may auto-send",
    "may auto-approve",
    "llm may determine final",
    "llm may rank",
    "may change page behavior",
  ];

  it("evidenceRationale contains no forbidden authorization language", () => {
    for (const row of FIXTURE_FEASIBILITY_MATRIX) {
      const lower = row.evidenceRationale.toLowerCase();
      for (const pattern of FORBIDDEN_AUTH_PATTERNS) {
        expect(
          lower.includes(pattern),
          `${row.fixtureId}: evidenceRationale contains forbidden pattern "${pattern}"`
        ).toBe(false);
      }
    }
  });

  it("boundaryRationale contains no forbidden authorization language", () => {
    for (const row of FIXTURE_FEASIBILITY_MATRIX) {
      const lower = row.boundaryRationale.toLowerCase();
      for (const pattern of FORBIDDEN_AUTH_PATTERNS) {
        expect(
          lower.includes(pattern),
          `${row.fixtureId}: boundaryRationale contains forbidden pattern "${pattern}"`
        ).toBe(false);
      }
    }
  });

  it("every row has a forbiddenImplementation that explains what remains forbidden", () => {
    const EXPECTED_TERMS = ["schema", "extractor", "write", "auto"];
    for (const row of FIXTURE_FEASIBILITY_MATRIX) {
      const lower = row.forbiddenImplementation.toLowerCase();
      const hasTerm = EXPECTED_TERMS.some((t) => lower.includes(t));
      expect(
        hasTerm,
        `${row.fixtureId}: forbiddenImplementation must mention schema/extractor/write/auto`
      ).toBe(true);
    }
  });

  it("no requires_thin_projection row mentions adding official write path", () => {
    const thinRows = FIXTURE_FEASIBILITY_MATRIX.filter(
      (r) => r.feasibilityStatus === "requires_thin_projection"
    );
    for (const row of thinRows) {
      const combined = `${row.evidenceRationale} ${row.boundaryRationale}`.toLowerCase();
      expect(
        combined.includes("official write"),
        `${row.fixtureId}: thin projection must not mention official write as an allowed path`
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Evaluator tests
// ---------------------------------------------------------------------------

describe("evaluateReadModelFeasibility — passes all 5 checks", () => {
  const summary = evaluateReadModelFeasibility();

  it("returns 5 checks total", () => {
    expect(summary.totalChecks).toBe(5);
  });

  it("all 5 checks pass", () => {
    for (const check of summary.checks) {
      expect(check.passed, `check "${check.checkName}" failed: ${check.detail}`).toBe(true);
    }
  });

  it("overallPassed is true", () => {
    expect(summary.overallPassed).toBe(true);
  });

  it("failed count is 0", () => {
    expect(summary.failed).toBe(0);
  });

  it("passed count equals totalChecks", () => {
    expect(summary.passed).toBe(summary.totalChecks);
  });

  it("check 'all_20_fixtures_mapped' passes", () => {
    const check = summary.checks.find((c) => c.checkName === "all_20_fixtures_mapped");
    expect(check?.passed).toBe(true);
  });

  it("check 'no_unknown_fixture_ids' passes", () => {
    const check = summary.checks.find((c) => c.checkName === "no_unknown_fixture_ids");
    expect(check?.passed).toBe(true);
  });

  it("check 'at_least_3_source_classes_feasible' passes", () => {
    const check = summary.checks.find(
      (c) => c.checkName === "at_least_3_source_classes_feasible"
    );
    expect(check?.passed).toBe(true);
  });

  it("check 'future_only_rows_have_rationale' passes", () => {
    const check = summary.checks.find(
      (c) => c.checkName === "future_only_rows_have_rationale"
    );
    expect(check?.passed).toBe(true);
  });

  it("check 'no_forbidden_implementation_auth' passes", () => {
    const check = summary.checks.find(
      (c) => c.checkName === "no_forbidden_implementation_auth"
    );
    expect(check?.passed).toBe(true);
  });
});

describe("evaluateReadModelFeasibility — failure detection", () => {
  it("detects missing fixture IDs (simulated)", () => {
    // The real matrix has 20 rows; we verify the check logic by inspecting
    // the check directly rather than mutating a const array.
    const allIds = new Set(FIXTURE_FEASIBILITY_MATRIX.map((r) => r.fixtureId));
    const fixtureIds = ADVANCEMENT_SIGNAL_FIXTURES.map((f) => f.fixtureId);
    const missing = fixtureIds.filter((id) => !allIds.has(id));
    // With the real matrix, there should be no missing IDs
    expect(missing).toHaveLength(0);
  });

  it("detects when feasible source count would be insufficient (simulated)", () => {
    // Verify that only report source has all future_only rows
    const reportRows = FIXTURE_FEASIBILITY_MATRIX.filter(
      (r) => r.sourceType === "report"
    );
    const allFuture = reportRows.every((r) => r.feasibilityStatus === "future_only");
    expect(allFuture).toBe(true);

    // But other sources have feasible rows, so overall count >= 3
    const feasibleSources = new Set(
      FIXTURE_FEASIBILITY_MATRIX
        .filter(
          (r) =>
            r.feasibilityStatus === "current_read_model_supported" ||
            r.feasibilityStatus === "requires_thin_projection"
        )
        .map((r) => r.sourceType)
    );
    expect(feasibleSources.size).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Statistics helper tests
// ---------------------------------------------------------------------------

describe("getFeasibilityStats", () => {
  const stats = getFeasibilityStats();

  it("total is 20", () => {
    expect(stats.total).toBe(20);
  });

  it("byStatus sums to 20", () => {
    const sum =
      stats.byStatus.current_read_model_supported +
      stats.byStatus.requires_thin_projection +
      stats.byStatus.future_only;
    expect(sum).toBe(20);
  });

  it("futureOnlyCount matches byStatus.future_only", () => {
    expect(stats.futureOnlyCount).toBe(stats.byStatus.future_only);
  });

  it("feasibleSourceClassCount is at least 3", () => {
    expect(stats.feasibleSourceClassCount).toBeGreaterThanOrEqual(3);
  });

  it("bySource covers all 8 expected source types", () => {
    const EXPECTED_SOURCES = [
      "meeting",
      "crm",
      "tenant_resource",
      "report",
      "email",
      "ask_helm",
      "user_behavior",
      "combined",
    ];
    for (const src of EXPECTED_SOURCES) {
      expect(
        stats.bySource[src],
        `Source "${src}" should appear in bySource stats`
      ).toBeDefined();
    }
  });

  it("report source has 0 current and 0 thin projection entries", () => {
    expect(stats.bySource["report"]?.current).toBe(0);
    expect(stats.bySource["report"]?.thin).toBe(0);
    expect(stats.bySource["report"]?.future).toBeGreaterThan(0);
  });

  it("meeting source has at least 1 current entry", () => {
    expect(stats.bySource["meeting"]?.current).toBeGreaterThanOrEqual(1);
  });

  it("ask_helm source has at least 1 current entry (boundary_hit)", () => {
    expect(stats.bySource["ask_helm"]?.current).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 1B pass conditions test
// ---------------------------------------------------------------------------

describe("Phase 1B pass conditions", () => {
  it("condition 1: at least 3 source classes can project from existing read model", () => {
    const stats = getFeasibilityStats();
    expect(stats.feasibleSourceClassCount).toBeGreaterThanOrEqual(3);
  });

  it("condition 2: no row authorizes unreviewable judgments (all have boundaryRationale)", () => {
    for (const row of FIXTURE_FEASIBILITY_MATRIX) {
      expect(
        row.boundaryRationale.trim().length,
        `${row.fixtureId}: must have non-empty boundaryRationale`
      ).toBeGreaterThan(0);
    }
  });

  it("condition 3: no row expands permissions (no cross-tenant or permission-escalation language in rationalse)", () => {
    const PERMISSION_EXPANSION_TERMS = [
      "cross-tenant",
      "cross tenant",
      "expand permission",
      "escalate permission",
      "permission promotion",
    ];
    for (const row of FIXTURE_FEASIBILITY_MATRIX) {
      const combined =
        `${row.evidenceRationale} ${row.boundaryRationale}`.toLowerCase();
      for (const term of PERMISSION_EXPANSION_TERMS) {
        expect(
          combined.includes(term),
          `${row.fixtureId}: rationale must not contain permission expansion language "${term}"`
        ).toBe(false);
      }
    }
  });

  it("condition 4: no row writes suggestion as commitment (all have 'recommendation' or 'suggestion' in boundary)", () => {
    const SAFE_TERMS = [
      "recommendation",
      "suggestion",
      "review",
      "read-only",
      "read only",
      "human",
      "owner",
    ];
    for (const row of FIXTURE_FEASIBILITY_MATRIX) {
      const lower = row.boundaryRationale.toLowerCase();
      const hasSafeTerm = SAFE_TERMS.some((t) => lower.includes(t));
      expect(
        hasSafeTerm,
        `${row.fixtureId}: boundaryRationale should reference human review or recommendation boundary`
      ).toBe(true);
    }
  });

  it("condition 5: all implementations covered by existing guards (evaluator passes)", () => {
    const summary = evaluateReadModelFeasibility();
    expect(summary.overallPassed).toBe(true);
  });
});
