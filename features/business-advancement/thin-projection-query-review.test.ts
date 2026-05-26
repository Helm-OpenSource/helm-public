import { describe, expect, it } from "vitest";
import { ADVANCEMENT_SIGNAL_FIXTURES } from "./fixtures";
import { FIXTURE_FEASIBILITY_MATRIX } from "./read-model-feasibility";
import { buildMustPushAdapterResults } from "./must-push-adapter";
import {
  THIN_PROJECTION_QUERY_REVIEW,
  evaluateThinProjectionQueryReview,
} from "./thin-projection-query-review";

const REQUIRED_FIXTURE_IDS = [
  "AS-FX-002",
  "AS-FX-004",
  "AS-FX-005",
  "AS-FX-006",
  "AS-FX-007",
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

describe("THIN_PROJECTION_QUERY_REVIEW", () => {
  it("has exactly 5 review rows", () => {
    expect(THIN_PROJECTION_QUERY_REVIEW).toHaveLength(5);
  });

  it("covers all required fixture IDs: AS-FX-002, AS-FX-004, AS-FX-005, AS-FX-006, AS-FX-007", () => {
    const covered = new Set(THIN_PROJECTION_QUERY_REVIEW.map((r) => r.fixtureId));
    for (const id of REQUIRED_FIXTURE_IDS) {
      expect(covered.has(id), `${id} must be covered by a review row`).toBe(true);
    }
  });

  it("every row references an active Phase 2 adapter candidate", () => {
    const adapterResults = buildMustPushAdapterResults(
      ADVANCEMENT_SIGNAL_FIXTURES,
      FIXTURE_FEASIBILITY_MATRIX
    );
    const activeIds = new Set(
      adapterResults.filter((r) => r.status === "active").map((r) => r.fixtureId)
    );
    for (const row of THIN_PROJECTION_QUERY_REVIEW) {
      expect(
        activeIds.has(row.fixtureId),
        `${row.reviewId}/${row.fixtureId}: must be an active Phase 2 adapter candidate`
      ).toBe(true);
    }
  });

  it("every row has runtimeAdoptionPosture === 'review_only_not_implemented'", () => {
    for (const row of THIN_PROJECTION_QUERY_REVIEW) {
      expect(
        row.runtimeAdoptionPosture,
        `${row.reviewId}: runtimeAdoptionPosture must be 'review_only_not_implemented'`
      ).toBe("review_only_not_implemented");
    }
  });

  it("no row authorizes schema, API, runtime extractor, event queue, official write, auto execution, LLM ranking, or page behavior changes", () => {
    for (const row of THIN_PROJECTION_QUERY_REVIEW) {
      const fields = [
        row.workspaceScopeCheck,
        row.membershipCapabilityGateCheck,
        row.boundaryNote,
        row.residualRisk,
      ];
      for (const field of fields) {
        const lower = field.toLowerCase();
        for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
          expect(
            lower.includes(pattern),
            `${row.reviewId}: field contains forbidden authorization pattern "${pattern}"`
          ).toBe(false);
        }
      }
    }
  });

  it("no whereClause produces invalid logical connectors (AND OR, OR AND) when joined", () => {
    for (const row of THIN_PROJECTION_QUERY_REVIEW) {
      const joined = row.proposedReadOnlyWhereClause.whereClauses.join(" AND ");
      expect(
        joined.includes("AND OR"),
        `${row.reviewId}: joining whereClauses produces invalid 'AND OR' sequence`
      ).toBe(false);
      expect(
        joined.includes("OR AND"),
        `${row.reviewId}: joining whereClauses produces invalid 'OR AND' sequence`
      ).toBe(false);
    }
  });

  it("every row has a non-empty workspace scope check", () => {
    for (const row of THIN_PROJECTION_QUERY_REVIEW) {
      expect(
        row.workspaceScopeCheck.trim(),
        `${row.reviewId}: workspaceScopeCheck must not be empty`
      ).not.toBe("");
    }
  });

  it("every row has a non-empty membership/capability gate check", () => {
    for (const row of THIN_PROJECTION_QUERY_REVIEW) {
      expect(
        row.membershipCapabilityGateCheck.trim(),
        `${row.reviewId}: membershipCapabilityGateCheck must not be empty`
      ).not.toBe("");
    }
  });

  it("every row has at least one excluded state or noise guard", () => {
    for (const row of THIN_PROJECTION_QUERY_REVIEW) {
      expect(
        row.excludedStatesOrNoiseGuards.length,
        `${row.reviewId}: excludedStatesOrNoiseGuards must not be empty`
      ).toBeGreaterThan(0);
    }
  });

  it("every row has a non-empty residual risk", () => {
    for (const row of THIN_PROJECTION_QUERY_REVIEW) {
      expect(
        row.residualRisk.trim(),
        `${row.reviewId}: residualRisk must not be empty`
      ).not.toBe("");
    }
  });

  it("crm AS-FX-005 explicitly addresses commitment workspace scope with schema evidence", () => {
    const row = THIN_PROJECTION_QUERY_REVIEW.find((r) => r.fixtureId === "AS-FX-005");
    expect(row).toBeDefined();
    const lower = row!.workspaceScopeCheck.toLowerCase();
    expect(
      lower.includes("workspaceid") &&
        (lower.includes("confirmed") ||
          lower.includes("resolved") ||
          lower.includes("schema.prisma")),
      "AS-FX-005 workspaceScopeCheck must cite schema evidence for commitment.workspaceId"
    ).toBe(true);
  });

  it("crm AS-FX-006 explicitly addresses emailThread FK and workspace path with schema evidence", () => {
    const row = THIN_PROJECTION_QUERY_REVIEW.find((r) => r.fixtureId === "AS-FX-006");
    expect(row).toBeDefined();
    const combinedText =
      row!.workspaceScopeCheck.toLowerCase() +
      (row!.proposedReadOnlyWhereClause.joinNote?.toLowerCase() ?? "");
    expect(
      combinedText.includes("opportunityid") &&
        (combinedText.includes("confirmed") ||
          combinedText.includes("resolved") ||
          combinedText.includes("schema.prisma")),
      "AS-FX-006 must cite schema evidence for emailThread.opportunityId FK and workspace scope"
    ).toBe(true);
  });

  it("tenant_resource AS-FX-007 includes a noise guard for severity-independent staleDays filtering", () => {
    const row = THIN_PROJECTION_QUERY_REVIEW.find((r) => r.fixtureId === "AS-FX-007");
    expect(row).toBeDefined();
    const guards = row!.excludedStatesOrNoiseGuards.join(" ").toLowerCase();
    expect(
      guards.includes("take") ||
        guards.includes("cap") ||
        guards.includes("limit") ||
        guards.includes("noise"),
      "AS-FX-007 must include a take/cap/limit noise guard for severity-independent staleDays filtering"
    ).toBe(true);
  });
});

describe("evaluateThinProjectionQueryReview", () => {
  it("all evaluator checks pass", () => {
    const result = evaluateThinProjectionQueryReview();
    const failed = result.checks.filter((c) => !c.passed);
    expect(
      failed,
      `Failed checks: ${failed.map((c) => `${c.checkName}: ${c.detail}`).join("; ")}`
    ).toHaveLength(0);
    expect(result.allPassed).toBe(true);
  });

  it("total rows is 5", () => {
    const result = evaluateThinProjectionQueryReview();
    expect(result.totalRows).toBe(5);
  });

  it("has 9 evaluator checks", () => {
    const result = evaluateThinProjectionQueryReview();
    expect(result.checks).toHaveLength(9);
  });
});
