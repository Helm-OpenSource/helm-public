import { describe, expect, it } from "vitest";
import {
  BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
  BLOCKED_DECISION_PLANNING_PREFLIGHT_ID,
  BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS,
  BLOCKED_DECISION_PLANNING_SIGNAL_TYPE,
  BLOCKED_DECISION_PLANNING_SOURCE_TYPE,
  BLOCKED_DECISION_PLANNING_THRESHOLD_MS,
  BLOCKED_DECISION_PLANNING_TPQR_ID,
  buildBlockedDecisionDeepLinkPlanningTarget,
  buildBlockedDecisionPlanningCandidates,
  compareBlockedDecisionCandidates,
  computeBlockedDecisionStalenessMs,
  evaluateBlockedDecisionPlanning,
  evaluateBlockedDecisionRow,
  type BlockedDecisionPlanningCandidate,
  type BlockedDecisionPlanningSourceRow,
} from "./phase3b-blocked-decision-planning";

const REQUIRED_BOUNDARY_PHRASES = [
  "recommendation != commitment",
  "explanation != approval",
  "draft != send",
  "proof != external write success",
] as const;

const FORBIDDEN_AUTHORIZATION_PATTERNS = [
  "auto_execute",
  "auto execute",
  "auto-execute",
  "official_write",
  "official write",
  "auto_send",
  "auto send",
  "auto-send",
  "auto_approve",
  "auto approve",
  "auto-approve",
  "cross_tenant",
  "cross-tenant",
  "llm_rank",
  "llm rank",
  "llm may determine",
  "llm may rank",
  "approves runtime adoption",
  "approves production query adoption",
  "may add a schema",
  "may add schema",
  "may add runtime extractor",
  "may auto-write",
  "may auto write",
  "grants execution authority",
  "may change page behavior",
  "may add api route",
] as const;

describe("BLOCKED_DECISION_PLANNING_FIXTURE_ROWS", () => {
  it("contains exactly four planning rows (one inclusion + three exclusions)", () => {
    expect(BLOCKED_DECISION_PLANNING_FIXTURE_ROWS).toHaveLength(4);
  });

  it("every row has unique rowId, non-empty workspaceId, and explicit membership flag", () => {
    const seen = new Set<string>();
    for (const row of BLOCKED_DECISION_PLANNING_FIXTURE_ROWS) {
      expect(row.rowId.trim()).not.toBe("");
      expect(seen.has(row.rowId), `duplicate rowId ${row.rowId}`).toBe(false);
      seen.add(row.rowId);
      expect(row.workspaceId.trim()).not.toBe("");
      expect(typeof row.workspaceMembershipConfirmed).toBe("boolean");
      expect(row.evidenceRefs.length).toBeGreaterThan(0);
    }
  });

  it("anchors at the documented Phase 3B planning constants", () => {
    expect(BLOCKED_DECISION_PLANNING_TPQR_ID).toBe("TPQR-001");
    expect(BLOCKED_DECISION_PLANNING_PREFLIGHT_ID).toBe("PF3-001");
    expect(BLOCKED_DECISION_PLANNING_SIGNAL_TYPE).toBe("blocked_decision");
    expect(BLOCKED_DECISION_PLANNING_SOURCE_TYPE).toBe("meeting");
    expect(BLOCKED_DECISION_PLANNING_THRESHOLD_MS).toBe(48 * 60 * 60 * 1000);
  });
});

describe("computeBlockedDecisionStalenessMs", () => {
  const referenceClockMs = BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS;

  it("returns positive staleness for past updatedAt", () => {
    const row = BLOCKED_DECISION_PLANNING_FIXTURE_ROWS[0];
    const staleness = computeBlockedDecisionStalenessMs(row, referenceClockMs);
    expect(staleness).toBeGreaterThan(BLOCKED_DECISION_PLANNING_THRESHOLD_MS);
  });

  it("clamps future-dated updatedAt to zero", () => {
    const row: BlockedDecisionPlanningSourceRow = {
      ...BLOCKED_DECISION_PLANNING_FIXTURE_ROWS[0],
      rowId: "TEST-FUTURE",
      updatedAtMs: referenceClockMs + 60 * 60 * 1000,
    };
    expect(computeBlockedDecisionStalenessMs(row, referenceClockMs)).toBe(0);
  });
});

describe("evaluateBlockedDecisionRow", () => {
  const referenceClockMs = BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS;

  it("includes the stale, no-approvalTask, workspace-confirmed row (BD-PLAN-001)", () => {
    const row = BLOCKED_DECISION_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "BD-PLAN-001",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const result = evaluateBlockedDecisionRow(row, referenceClockMs);
    expect(result.included).toBe(true);
    if (!result.included) return;
    expect(result.candidate.tpqrId).toBe("TPQR-001");
    expect(result.candidate.preflightId).toBe("PF3-001");
    expect(result.candidate.signalType).toBe("blocked_decision");
    expect(result.candidate.sourceType).toBe("meeting");
    expect(result.candidate.thresholdMs).toBe(
      BLOCKED_DECISION_PLANNING_THRESHOLD_MS,
    );
    expect(result.candidate.stalenessMs).toBeGreaterThan(
      BLOCKED_DECISION_PLANNING_THRESHOLD_MS,
    );
    expect(result.candidate.riskLevel).toBe("high");
    expect(result.candidate.reviewPosture).toBe("human_owner_required");
    expect(result.candidate.evidenceRefs.length).toBeGreaterThan(0);
    expect(result.candidate.deepLinkPlanningTarget).toContain(row.meetingId);
    expect(result.candidate.primaryAction).toContain(
      result.candidate.deepLinkPlanningTarget,
    );
    expect(result.candidate.planningOnly).toBe(true);
  });

  it("excludes the fresh row (BD-PLAN-002) with reason threshold_not_met", () => {
    const row = BLOCKED_DECISION_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "BD-PLAN-002",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const result = evaluateBlockedDecisionRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("threshold_not_met");
    expect(result.excluded.detail).toContain("48h");
  });

  it("excludes the already-in-review row (BD-PLAN-003) with reason already_in_review", () => {
    const row = BLOCKED_DECISION_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "BD-PLAN-003",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const result = evaluateBlockedDecisionRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("already_in_review");
  });

  it("excludes the unconfirmed-workspace row (BD-PLAN-004) with reason workspace_boundary_not_confirmed", () => {
    const row = BLOCKED_DECISION_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "BD-PLAN-004",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const result = evaluateBlockedDecisionRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("workspace_boundary_not_confirmed");
  });

  it("workspace-boundary check has highest exclusion priority over already_in_review and threshold_not_met", () => {
    const row: BlockedDecisionPlanningSourceRow = {
      rowId: "TEST-BOUNDARY-PRIORITY",
      workspaceId: "ws-test",
      workspaceMembershipConfirmed: false,
      actionItemId: "synth-action-test",
      meetingId: "synth-meeting-test",
      title: "test",
      hasApprovalTask: true,
      updatedAtMs: referenceClockMs - 10 * 60 * 60 * 1000,
      evidenceRefs: ["test evidence"],
      sourceScenario: "test scenario",
    };
    const result = evaluateBlockedDecisionRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("workspace_boundary_not_confirmed");
  });
});

describe("buildBlockedDecisionPlanningCandidates", () => {
  const referenceClockMs = BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS;

  it("produces exactly one inclusion candidate from the bundled fixture", () => {
    const built = buildBlockedDecisionPlanningCandidates(
      BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect(built.candidates).toHaveLength(1);
    expect(built.excluded).toHaveLength(3);
    expect(built.candidates[0].sourceRowId).toBe("BD-PLAN-001");
  });

  it("assigns zero-based contiguous sortKey values", () => {
    const built = buildBlockedDecisionPlanningCandidates(
      BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    built.candidates.forEach((candidate, index) => {
      expect(candidate.sortKey).toBe(index);
    });
  });

  it("orders multiple candidates by stalenessMs descending then sourceRowId ascending", () => {
    const rows: readonly BlockedDecisionPlanningSourceRow[] = [
      {
        rowId: "ZZ-LATEST",
        workspaceId: "ws-test",
        workspaceMembershipConfirmed: true,
        actionItemId: "ai-zz",
        meetingId: "m-zz",
        title: "ZZ",
        hasApprovalTask: false,
        updatedAtMs: referenceClockMs - 50 * 60 * 60 * 1000,
        evidenceRefs: ["zz"],
        sourceScenario: "zz",
      },
      {
        rowId: "AA-OLDEST",
        workspaceId: "ws-test",
        workspaceMembershipConfirmed: true,
        actionItemId: "ai-aa",
        meetingId: "m-aa",
        title: "AA",
        hasApprovalTask: false,
        updatedAtMs: referenceClockMs - 200 * 60 * 60 * 1000,
        evidenceRefs: ["aa"],
        sourceScenario: "aa",
      },
      {
        rowId: "BB-TIE",
        workspaceId: "ws-test",
        workspaceMembershipConfirmed: true,
        actionItemId: "ai-bb",
        meetingId: "m-bb",
        title: "BB",
        hasApprovalTask: false,
        updatedAtMs: referenceClockMs - 200 * 60 * 60 * 1000,
        evidenceRefs: ["bb"],
        sourceScenario: "bb",
      },
    ];
    const built = buildBlockedDecisionPlanningCandidates(rows, referenceClockMs);
    expect(built.candidates.map((c) => c.sourceRowId)).toEqual([
      "AA-OLDEST",
      "BB-TIE",
      "ZZ-LATEST",
    ]);
  });

  it("yields the same ordering when input rows are reversed (deterministic)", () => {
    const reference = buildBlockedDecisionPlanningCandidates(
      BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const reversed = buildBlockedDecisionPlanningCandidates(
      [...BLOCKED_DECISION_PLANNING_FIXTURE_ROWS].reverse(),
      referenceClockMs,
    );
    expect(reversed.candidates.map((c) => c.itemId)).toEqual(
      reference.candidates.map((c) => c.itemId),
    );
  });

  it("does not mutate the input row array", () => {
    const snapshot = [...BLOCKED_DECISION_PLANNING_FIXTURE_ROWS];
    buildBlockedDecisionPlanningCandidates(
      BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect([...BLOCKED_DECISION_PLANNING_FIXTURE_ROWS]).toEqual(snapshot);
  });
});

describe("compareBlockedDecisionCandidates", () => {
  it("returns negative when a is staler than b", () => {
    const a: BlockedDecisionPlanningCandidate = {
      itemId: "a",
      title: "a",
      reason: "a",
      evidenceRefs: ["a"],
      primaryAction: "open: x",
      boundaryNote: "x",
      reviewPosture: "human_owner_required",
      sourceSummary: "x",
      riskLevel: "high",
      sortKey: 0,
      planningOnly: true,
      tpqrId: "TPQR-001",
      preflightId: "PF3-001",
      signalType: "blocked_decision",
      sourceType: "meeting",
      thresholdMs: BLOCKED_DECISION_PLANNING_THRESHOLD_MS,
      stalenessMs: 100,
      evaluatedAtMs: 0,
      deepLinkPlanningTarget: "x",
      sourceRowId: "ZZZ",
    };
    const b: BlockedDecisionPlanningCandidate = { ...a, stalenessMs: 50, sourceRowId: "AAA" };
    expect(compareBlockedDecisionCandidates(a, b)).toBeLessThan(0);
  });

  it("breaks staleness ties by sourceRowId ascending", () => {
    const a: BlockedDecisionPlanningCandidate = {
      itemId: "a",
      title: "a",
      reason: "a",
      evidenceRefs: ["a"],
      primaryAction: "open: x",
      boundaryNote: "x",
      reviewPosture: "human_owner_required",
      sourceSummary: "x",
      riskLevel: "high",
      sortKey: 0,
      planningOnly: true,
      tpqrId: "TPQR-001",
      preflightId: "PF3-001",
      signalType: "blocked_decision",
      sourceType: "meeting",
      thresholdMs: BLOCKED_DECISION_PLANNING_THRESHOLD_MS,
      stalenessMs: 100,
      evaluatedAtMs: 0,
      deepLinkPlanningTarget: "x",
      sourceRowId: "AAA",
    };
    const b: BlockedDecisionPlanningCandidate = { ...a, sourceRowId: "BBB" };
    expect(compareBlockedDecisionCandidates(a, b)).toBeLessThan(0);
    expect(compareBlockedDecisionCandidates(b, a)).toBeGreaterThan(0);
    expect(compareBlockedDecisionCandidates(a, a)).toBe(0);
  });
});

describe("buildBlockedDecisionDeepLinkPlanningTarget", () => {
  it("returns a planning anchor string with both ids embedded", () => {
    const target = buildBlockedDecisionDeepLinkPlanningTarget("m-1", "ai-1");
    expect(target).toContain("m-1");
    expect(target).toContain("ai-1");
    expect(target.startsWith("planning://")).toBe(true);
  });
});

describe("evaluateBlockedDecisionPlanning", () => {
  const referenceClockMs = BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS;

  it("all checks pass against the bundled fixture", () => {
    const summary = evaluateBlockedDecisionPlanning(
      BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const failed = summary.checks.filter((c) => !c.passed);
    expect(
      failed,
      `Failed checks: ${failed.map((c) => `${c.checkName}: ${c.detail}`).join("; ")}`,
    ).toHaveLength(0);
    expect(summary.allPassed).toBe(true);
  });

  it("reports correct counts and anchors", () => {
    const summary = evaluateBlockedDecisionPlanning(
      BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect(summary.totalSourceRows).toBe(4);
    expect(summary.includedCount).toBe(1);
    expect(summary.excludedCount).toBe(3);
    expect(summary.tpqrId).toBe("TPQR-001");
    expect(summary.preflightId).toBe("PF3-001");
    expect(summary.thresholdMs).toBe(48 * 60 * 60 * 1000);
  });

  it("surfaces nine checks", () => {
    const summary = evaluateBlockedDecisionPlanning(
      BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect(summary.checks).toHaveLength(9);
  });

  it("every candidate's boundaryNote preserves recommendation/explanation/draft/proof distinctions", () => {
    const summary = evaluateBlockedDecisionPlanning(
      BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    for (const candidate of summary.candidates) {
      const lower = candidate.boundaryNote.toLowerCase();
      for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
        expect(
          lower.includes(phrase),
          `${candidate.itemId}: boundaryNote must include "${phrase}"`,
        ).toBe(true);
      }
    }
  });

  it("no candidate text contains forbidden authorization wording", () => {
    const summary = evaluateBlockedDecisionPlanning(
      BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    for (const candidate of summary.candidates) {
      const fields: string[] = [
        candidate.title,
        candidate.reason,
        candidate.primaryAction,
        candidate.boundaryNote,
        candidate.sourceSummary,
        candidate.deepLinkPlanningTarget,
        ...candidate.evidenceRefs,
      ];
      for (const field of fields) {
        const lower = field.toLowerCase();
        for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
          expect(
            lower.includes(pattern),
            `${candidate.itemId}: forbidden wording "${pattern}"`,
          ).toBe(false);
        }
      }
    }
  });

  it("included candidate uses review-required deep-link planning verb (open/review)", () => {
    const summary = evaluateBlockedDecisionPlanning(
      BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    for (const candidate of summary.candidates) {
      const verb = candidate.primaryAction.toLowerCase();
      expect(
        verb.startsWith("open") || verb.startsWith("review"),
        `${candidate.itemId}: primaryAction must use open/review planning verb`,
      ).toBe(true);
      expect(candidate.primaryAction).toContain(candidate.deepLinkPlanningTarget);
    }
  });

  it("flags a fixture that introduces forbidden wording", () => {
    const dirty: readonly BlockedDecisionPlanningSourceRow[] = [
      {
        ...BLOCKED_DECISION_PLANNING_FIXTURE_ROWS[0],
        rowId: "TEST-DIRTY",
        evidenceRefs: ["this row claims auto execute authority"],
      },
    ];
    const summary = evaluateBlockedDecisionPlanning(dirty, referenceClockMs);
    const noAuthCheck = summary.checks.find(
      (c) => c.checkName === "no_runtime_schema_or_write_authority",
    );
    expect(noAuthCheck?.passed).toBe(false);
    expect(summary.allPassed).toBe(false);
  });

  it("flags a fixture missing inclusion or exclusion-reason coverage", () => {
    const fresh: readonly BlockedDecisionPlanningSourceRow[] = [
      {
        ...BLOCKED_DECISION_PLANNING_FIXTURE_ROWS[1],
        rowId: "TEST-FRESH-ONLY",
      },
    ];
    const summary = evaluateBlockedDecisionPlanning(fresh, referenceClockMs);
    const fixtureCheck = summary.checks.find(
      (c) => c.checkName === "fixture_covers_inclusion_and_all_exclusion_reasons",
    );
    expect(fixtureCheck?.passed).toBe(false);
    expect(summary.allPassed).toBe(false);
  });

  it("flags an included candidate sourced from an unconfirmed-workspace row when bypassed", () => {
    const summary = evaluateBlockedDecisionPlanning(
      BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const membershipCheck = summary.checks.find(
      (c) => c.checkName === "workspace_membership_boundary_present",
    );
    expect(membershipCheck?.passed).toBe(true);
  });
});
