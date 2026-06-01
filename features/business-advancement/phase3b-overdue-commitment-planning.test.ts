import { describe, expect, it } from "vitest";
import {
  OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
  OVERDUE_COMMITMENT_PLANNING_GRACE_MS,
  OVERDUE_COMMITMENT_PLANNING_PREFLIGHT_ID,
  OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS,
  OVERDUE_COMMITMENT_PLANNING_SIGNAL_TYPE,
  OVERDUE_COMMITMENT_PLANNING_SOURCE_TYPE,
  OVERDUE_COMMITMENT_PLANNING_TERMINAL_STATUSES,
  OVERDUE_COMMITMENT_PLANNING_THRESHOLD_RULE,
  OVERDUE_COMMITMENT_PLANNING_TPQR_ID,
  buildOverdueCommitmentPlanningCandidates,
  compareOverdueCommitmentCandidates,
  computeOverdueByMs,
  evaluateOverdueCommitmentPlanning,
  evaluateOverdueCommitmentRow,
  isTerminalCommitmentStatus,
  type OverdueCommitmentPlanningCandidate,
  type OverdueCommitmentPlanningSourceRow,
} from "./phase3b-overdue-commitment-planning";

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
  "auto-execution",
  "official_write",
  "official write",
  "auto_send",
  "auto send",
  "auto-send",
  "auto_approve",
  "auto approve",
  "auto-approve",
  "auto-approval",
  "cross_tenant",
  "cross-tenant",
  "llm_rank",
  "llm rank",
  "llm final ranking",
  "production query adoption",
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

const DAY_MS = 24 * 60 * 60 * 1000;

describe("OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS", () => {
  it("contains six planning rows (two inclusions + four exclusions)", () => {
    expect(OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS).toHaveLength(6);
  });

  it("every row has unique rowId, non-empty workspaceId, explicit membership flag, and persistedOverdueFlag", () => {
    const seen = new Set<string>();
    for (const row of OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS) {
      expect(row.rowId.trim()).not.toBe("");
      expect(seen.has(row.rowId), `duplicate rowId ${row.rowId}`).toBe(false);
      seen.add(row.rowId);
      expect(row.workspaceId.trim()).not.toBe("");
      expect(typeof row.workspaceMembershipConfirmed).toBe("boolean");
      expect(typeof row.persistedOverdueFlag).toBe("boolean");
      expect(row.evidenceRefs.length).toBeGreaterThan(0);
    }
  });

  it("anchors at the documented Phase 3B planning constants", () => {
    expect(OVERDUE_COMMITMENT_PLANNING_TPQR_ID).toBe("TPQR-003");
    expect(OVERDUE_COMMITMENT_PLANNING_PREFLIGHT_ID).toBe("PF3A-003");
    expect(OVERDUE_COMMITMENT_PLANNING_SIGNAL_TYPE).toBe("overdue_commitment");
    expect(OVERDUE_COMMITMENT_PLANNING_SOURCE_TYPE).toBe("combined");
    expect(OVERDUE_COMMITMENT_PLANNING_THRESHOLD_RULE).toBe(
      "due_date_lt_reference_clock_and_status_not_terminal",
    );
    expect(OVERDUE_COMMITMENT_PLANNING_GRACE_MS).toBe(0);
    expect(OVERDUE_COMMITMENT_PLANNING_TERMINAL_STATUSES).toEqual([
      "FULFILLED",
      "CANCELED",
    ]);
  });
});

describe("isTerminalCommitmentStatus", () => {
  it("returns true for FULFILLED and CANCELED", () => {
    expect(isTerminalCommitmentStatus("FULFILLED")).toBe(true);
    expect(isTerminalCommitmentStatus("CANCELED")).toBe(true);
  });

  it("returns false for PENDING and IN_PROGRESS", () => {
    expect(isTerminalCommitmentStatus("PENDING")).toBe(false);
    expect(isTerminalCommitmentStatus("IN_PROGRESS")).toBe(false);
  });
});

describe("computeOverdueByMs", () => {
  const referenceClockMs = OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS;

  it("returns positive overdueByMs for past dueDate with non-terminal status row", () => {
    const row = OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "OC-PLAN-002",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const overdueByMs = computeOverdueByMs(row, referenceClockMs);
    expect(overdueByMs).toBeGreaterThan(0);
  });

  it("returns 0 when dueDate is missing", () => {
    const row = OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "OC-PLAN-005",
    );
    expect(row).toBeDefined();
    if (!row) return;
    expect(computeOverdueByMs(row, referenceClockMs)).toBe(0);
  });

  it("returns 0 when dueDate is in the future", () => {
    const row = OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "OC-PLAN-003",
    );
    expect(row).toBeDefined();
    if (!row) return;
    expect(computeOverdueByMs(row, referenceClockMs)).toBe(0);
  });

  it("returns 0 when dueDate equals the reference clock (no grace period)", () => {
    const row: OverdueCommitmentPlanningSourceRow = {
      ...OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS[0],
      rowId: "TEST-EQUAL",
      dueDateMs: referenceClockMs,
    };
    expect(computeOverdueByMs(row, referenceClockMs)).toBe(0);
  });
});

describe("evaluateOverdueCommitmentRow", () => {
  const referenceClockMs = OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS;

  it("includes OC-PLAN-001 (5 days past, non-terminal) even though persistedOverdueFlag=false", () => {
    const row = OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "OC-PLAN-001",
    );
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.persistedOverdueFlag).toBe(false);
    const result = evaluateOverdueCommitmentRow(row, referenceClockMs);
    expect(result.included).toBe(true);
    if (!result.included) return;
    expect(result.candidate.tpqrId).toBe("TPQR-003");
    expect(result.candidate.preflightId).toBe("PF3A-003");
    expect(result.candidate.signalType).toBe("overdue_commitment");
    expect(result.candidate.sourceType).toBe("combined");
    expect(result.candidate.thresholdRule).toBe(
      OVERDUE_COMMITMENT_PLANNING_THRESHOLD_RULE,
    );
    expect(result.candidate.graceMs).toBe(0);
    expect(result.candidate.dueDateMs).toBe(row.dueDateMs);
    expect(result.candidate.status).toBe(row.status);
    expect(result.candidate.overdueByMs).toBeGreaterThan(0);
    expect(result.candidate.riskLevel).toBe("high");
    expect(result.candidate.reviewPosture).toBe("human_owner_required");
    expect(result.candidate.evidenceRefs.length).toBeGreaterThan(0);
    expect(result.candidate.primaryAction).toContain(row.commitmentId);
    expect(result.candidate.planningOnly).toBe(true);
  });

  it("includes OC-PLAN-002 (9 days past, non-terminal)", () => {
    const row = OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "OC-PLAN-002",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const result = evaluateOverdueCommitmentRow(row, referenceClockMs);
    expect(result.included).toBe(true);
    if (!result.included) return;
    expect(result.candidate.overdueByMs).toBe(9 * DAY_MS);
  });

  it("excludes OC-PLAN-003 (3 days future) with reason threshold_not_met even though persistedOverdueFlag=true", () => {
    const row = OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "OC-PLAN-003",
    );
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.persistedOverdueFlag).toBe(true);
    const result = evaluateOverdueCommitmentRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("threshold_not_met");
  });

  it("excludes OC-PLAN-004 (FULFILLED) with reason terminal_status even though dueDate is past and persistedOverdueFlag=true", () => {
    const row = OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "OC-PLAN-004",
    );
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.persistedOverdueFlag).toBe(true);
    const result = evaluateOverdueCommitmentRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("terminal_status");
  });

  it("excludes OC-PLAN-005 (missing dueDate) with reason missing_due_date", () => {
    const row = OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "OC-PLAN-005",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const result = evaluateOverdueCommitmentRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("missing_due_date");
  });

  it("excludes OC-PLAN-006 (workspace not confirmed) with reason workspace_boundary_not_confirmed", () => {
    const row = OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "OC-PLAN-006",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const result = evaluateOverdueCommitmentRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("workspace_boundary_not_confirmed");
  });

  it("workspace_boundary_not_confirmed has highest exclusion priority", () => {
    const row: OverdueCommitmentPlanningSourceRow = {
      rowId: "TEST-BOUNDARY-PRIORITY",
      workspaceId: "ws-test",
      workspaceMembershipConfirmed: false,
      commitmentId: "synth-commitment-test",
      opportunityId: "synth-opportunity-test",
      title: "test",
      dueDateMs: null,
      status: "FULFILLED",
      persistedOverdueFlag: true,
      evidenceRefs: ["test evidence"],
      sourceScenario: "test scenario",
    };
    const result = evaluateOverdueCommitmentRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("workspace_boundary_not_confirmed");
  });

  it("missing_due_date has priority over terminal_status when workspace is confirmed", () => {
    const row: OverdueCommitmentPlanningSourceRow = {
      rowId: "TEST-MISSING-OVER-TERMINAL",
      workspaceId: "ws-test",
      workspaceMembershipConfirmed: true,
      commitmentId: "synth-commitment-test",
      opportunityId: "synth-opportunity-test",
      title: "test",
      dueDateMs: null,
      status: "FULFILLED",
      persistedOverdueFlag: false,
      evidenceRefs: ["test evidence"],
      sourceScenario: "test scenario",
    };
    const result = evaluateOverdueCommitmentRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("missing_due_date");
  });

  it("terminal_status has priority over threshold_not_met when dueDate is in the future and status is terminal", () => {
    const row: OverdueCommitmentPlanningSourceRow = {
      rowId: "TEST-TERMINAL-OVER-THRESHOLD",
      workspaceId: "ws-test",
      workspaceMembershipConfirmed: true,
      commitmentId: "synth-commitment-test",
      opportunityId: "synth-opportunity-test",
      title: "test",
      dueDateMs: referenceClockMs + 5 * DAY_MS,
      status: "CANCELED",
      persistedOverdueFlag: false,
      evidenceRefs: ["test evidence"],
      sourceScenario: "test scenario",
    };
    const result = evaluateOverdueCommitmentRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("terminal_status");
  });
});

describe("buildOverdueCommitmentPlanningCandidates", () => {
  const referenceClockMs = OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS;

  it("produces exactly two inclusion candidates from the bundled fixture", () => {
    const built = buildOverdueCommitmentPlanningCandidates(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect(built.candidates).toHaveLength(2);
    expect(built.excluded).toHaveLength(4);
  });

  it("orders candidates by overdueByMs descending then sourceRowId ascending", () => {
    const built = buildOverdueCommitmentPlanningCandidates(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect(built.candidates.map((c) => c.sourceRowId)).toEqual([
      "OC-PLAN-002",
      "OC-PLAN-001",
    ]);
  });

  it("assigns zero-based contiguous sortKey values", () => {
    const built = buildOverdueCommitmentPlanningCandidates(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    built.candidates.forEach((candidate, index) => {
      expect(candidate.sortKey).toBe(index);
    });
  });

  it("breaks overdueByMs ties by sourceRowId ascending", () => {
    const rows: readonly OverdueCommitmentPlanningSourceRow[] = [
      {
        rowId: "ZZ-LATEST",
        workspaceId: "ws-test",
        workspaceMembershipConfirmed: true,
        commitmentId: "synth-zz",
        opportunityId: "opp-zz",
        title: "ZZ",
        dueDateMs: referenceClockMs - 10 * DAY_MS,
        status: "PENDING",
        persistedOverdueFlag: false,
        evidenceRefs: ["zz"],
        sourceScenario: "zz",
      },
      {
        rowId: "AA-OLDEST",
        workspaceId: "ws-test",
        workspaceMembershipConfirmed: true,
        commitmentId: "synth-aa",
        opportunityId: "opp-aa",
        title: "AA",
        dueDateMs: referenceClockMs - 30 * DAY_MS,
        status: "PENDING",
        persistedOverdueFlag: false,
        evidenceRefs: ["aa"],
        sourceScenario: "aa",
      },
      {
        rowId: "BB-TIE",
        workspaceId: "ws-test",
        workspaceMembershipConfirmed: true,
        commitmentId: "synth-bb",
        opportunityId: "opp-bb",
        title: "BB",
        dueDateMs: referenceClockMs - 30 * DAY_MS,
        status: "PENDING",
        persistedOverdueFlag: false,
        evidenceRefs: ["bb"],
        sourceScenario: "bb",
      },
    ];
    const built = buildOverdueCommitmentPlanningCandidates(rows, referenceClockMs);
    expect(built.candidates.map((c) => c.sourceRowId)).toEqual([
      "AA-OLDEST",
      "BB-TIE",
      "ZZ-LATEST",
    ]);
  });

  it("yields the same ordering when input rows are reversed (deterministic)", () => {
    const reference = buildOverdueCommitmentPlanningCandidates(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const reversed = buildOverdueCommitmentPlanningCandidates(
      [...OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS].reverse(),
      referenceClockMs,
    );
    expect(reversed.candidates.map((c) => c.itemId)).toEqual(
      reference.candidates.map((c) => c.itemId),
    );
  });

  it("does not mutate the input row array", () => {
    const snapshot = [...OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS];
    buildOverdueCommitmentPlanningCandidates(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect([...OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS]).toEqual(snapshot);
  });

  it("yields an identical candidate set when persistedOverdueFlag is flipped on every row", () => {
    const reference = buildOverdueCommitmentPlanningCandidates(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const flipped = OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS.map((row) => ({
      ...row,
      persistedOverdueFlag: !row.persistedOverdueFlag,
    }));
    const flippedBuilt = buildOverdueCommitmentPlanningCandidates(
      flipped,
      referenceClockMs,
    );
    expect(flippedBuilt.candidates.map((c) => c.sourceRowId)).toEqual(
      reference.candidates.map((c) => c.sourceRowId),
    );
    expect(flippedBuilt.excluded.map((row) => row.sourceRowId)).toEqual(
      reference.excluded.map((row) => row.sourceRowId),
    );
  });
});

describe("compareOverdueCommitmentCandidates", () => {
  const baseCandidate: OverdueCommitmentPlanningCandidate = {
    itemId: "a",
    title: "a",
    reason: "a",
    evidenceRefs: ["a"],
    primaryAction: "review: commitment x",
    boundaryNote: "x",
    reviewPosture: "human_owner_required",
    sourceSummary: "x",
    riskLevel: "high",
    sortKey: 0,
    planningOnly: true,
    tpqrId: "TPQR-003",
    preflightId: "PF3A-003",
    signalType: "overdue_commitment",
    sourceType: "combined",
    thresholdRule: "due_date_lt_reference_clock_and_status_not_terminal",
    graceMs: 0,
    dueDateMs: 0,
    status: "PENDING",
    overdueByMs: 100,
    evaluatedAtMs: 0,
    sourceRowId: "ZZZ",
  };

  it("returns negative when a is more overdue than b", () => {
    const a = baseCandidate;
    const b: OverdueCommitmentPlanningCandidate = {
      ...a,
      overdueByMs: 50,
      sourceRowId: "AAA",
    };
    expect(compareOverdueCommitmentCandidates(a, b)).toBeLessThan(0);
  });

  it("breaks overdueByMs ties by sourceRowId ascending", () => {
    const a: OverdueCommitmentPlanningCandidate = {
      ...baseCandidate,
      sourceRowId: "AAA",
    };
    const b: OverdueCommitmentPlanningCandidate = {
      ...baseCandidate,
      sourceRowId: "BBB",
    };
    expect(compareOverdueCommitmentCandidates(a, b)).toBeLessThan(0);
    expect(compareOverdueCommitmentCandidates(b, a)).toBeGreaterThan(0);
    expect(compareOverdueCommitmentCandidates(a, a)).toBe(0);
  });
});

describe("evaluateOverdueCommitmentPlanning", () => {
  const referenceClockMs = OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS;

  it("all checks pass against the bundled fixture", () => {
    const summary = evaluateOverdueCommitmentPlanning(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
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
    const summary = evaluateOverdueCommitmentPlanning(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect(summary.totalSourceRows).toBe(6);
    expect(summary.includedCount).toBe(2);
    expect(summary.excludedCount).toBe(4);
    expect(summary.tpqrId).toBe("TPQR-003");
    expect(summary.preflightId).toBe("PF3A-003");
    expect(summary.thresholdRule).toBe(
      "due_date_lt_reference_clock_and_status_not_terminal",
    );
    expect(summary.graceMs).toBe(0);
  });

  it("surfaces ten checks", () => {
    const summary = evaluateOverdueCommitmentPlanning(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect(summary.checks).toHaveLength(10);
  });

  it("every candidate's boundaryNote preserves recommendation/explanation/draft/proof distinctions", () => {
    const summary = evaluateOverdueCommitmentPlanning(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
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
    const summary = evaluateOverdueCommitmentPlanning(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    for (const candidate of summary.candidates) {
      const fields: string[] = [
        candidate.title,
        candidate.reason,
        candidate.primaryAction,
        candidate.boundaryNote,
        candidate.sourceSummary,
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

  it("included candidate uses review-required planning verb (review/open) referencing the synthetic commitmentId", () => {
    const summary = evaluateOverdueCommitmentPlanning(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    for (const candidate of summary.candidates) {
      const verb = candidate.primaryAction.toLowerCase();
      expect(
        verb.startsWith("review") || verb.startsWith("open"),
        `${candidate.itemId}: primaryAction must use review/open planning verb`,
      ).toBe(true);
      const sourceRow = OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS.find(
        (r) => r.rowId === candidate.sourceRowId,
      );
      expect(sourceRow).toBeDefined();
      if (!sourceRow) continue;
      expect(candidate.primaryAction).toContain(sourceRow.commitmentId);
    }
  });

  it("flags a fixture that introduces forbidden wording", () => {
    const dirty: readonly OverdueCommitmentPlanningSourceRow[] = [
      {
        ...OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS[0],
        rowId: "TEST-DIRTY",
        evidenceRefs: ["this row claims auto execute authority"],
      },
    ];
    const summary = evaluateOverdueCommitmentPlanning(dirty, referenceClockMs);
    const noAuthCheck = summary.checks.find(
      (c) => c.checkName === "no_runtime_schema_or_write_authority",
    );
    expect(noAuthCheck?.passed).toBe(false);
    expect(summary.allPassed).toBe(false);
  });

  it("flags a fixture missing inclusion or exclusion-reason coverage", () => {
    const fresh: readonly OverdueCommitmentPlanningSourceRow[] = [
      {
        ...OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS[2], // OC-PLAN-003 future dueDate, threshold_not_met
        rowId: "TEST-FRESH-ONLY",
      },
    ];
    const summary = evaluateOverdueCommitmentPlanning(fresh, referenceClockMs);
    const fixtureCheck = summary.checks.find(
      (c) =>
        c.checkName ===
        "fixture_covers_inclusion_all_exclusion_reasons_and_persisted_flag_mismatch",
    );
    expect(fixtureCheck?.passed).toBe(false);
    expect(summary.allPassed).toBe(false);
  });

  it("flags a fixture without any persisted-flag mismatch row", () => {
    // Build a fixture that covers all four exclusion reasons + inclusion,
    // but where every row has persistedOverdueFlag matching its read-time
    // derivation. The persisted-flag mismatch coverage check must fail.
    const consistent: readonly OverdueCommitmentPlanningSourceRow[] = [
      {
        rowId: "CONSISTENT-INCLUDED",
        workspaceId: "ws-consistent",
        workspaceMembershipConfirmed: true,
        commitmentId: "synth-c-1",
        opportunityId: "synth-o-1",
        title: "consistent included",
        dueDateMs: referenceClockMs - 5 * DAY_MS,
        status: "PENDING",
        persistedOverdueFlag: true,
        evidenceRefs: ["e"],
        sourceScenario: "s",
      },
      {
        rowId: "CONSISTENT-FUTURE",
        workspaceId: "ws-consistent",
        workspaceMembershipConfirmed: true,
        commitmentId: "synth-c-2",
        opportunityId: "synth-o-2",
        title: "consistent future",
        dueDateMs: referenceClockMs + 5 * DAY_MS,
        status: "PENDING",
        persistedOverdueFlag: false,
        evidenceRefs: ["e"],
        sourceScenario: "s",
      },
      {
        rowId: "CONSISTENT-TERMINAL",
        workspaceId: "ws-consistent",
        workspaceMembershipConfirmed: true,
        commitmentId: "synth-c-3",
        opportunityId: "synth-o-3",
        title: "consistent terminal",
        dueDateMs: referenceClockMs - 5 * DAY_MS,
        status: "FULFILLED",
        persistedOverdueFlag: false,
        evidenceRefs: ["e"],
        sourceScenario: "s",
      },
      {
        rowId: "CONSISTENT-MISSING",
        workspaceId: "ws-consistent",
        workspaceMembershipConfirmed: true,
        commitmentId: "synth-c-4",
        opportunityId: "synth-o-4",
        title: "consistent missing",
        dueDateMs: null,
        status: "PENDING",
        persistedOverdueFlag: false,
        evidenceRefs: ["e"],
        sourceScenario: "s",
      },
      {
        rowId: "CONSISTENT-BOUNDARY",
        workspaceId: "ws-consistent-b",
        workspaceMembershipConfirmed: false,
        commitmentId: "synth-c-5",
        opportunityId: "synth-o-5",
        title: "consistent boundary",
        dueDateMs: referenceClockMs - 5 * DAY_MS,
        status: "PENDING",
        persistedOverdueFlag: true,
        evidenceRefs: ["e"],
        sourceScenario: "s",
      },
    ];
    const summary = evaluateOverdueCommitmentPlanning(
      consistent,
      referenceClockMs,
    );
    const fixtureCheck = summary.checks.find(
      (c) =>
        c.checkName ===
        "fixture_covers_inclusion_all_exclusion_reasons_and_persisted_flag_mismatch",
    );
    expect(fixtureCheck?.passed).toBe(false);
    expect(summary.allPassed).toBe(false);
  });

  it("workspace membership boundary check passes against the bundled fixture", () => {
    const summary = evaluateOverdueCommitmentPlanning(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const membershipCheck = summary.checks.find(
      (c) => c.checkName === "workspace_membership_boundary_present",
    );
    expect(membershipCheck?.passed).toBe(true);
  });

  it("read-time derivation check passes against the bundled fixture", () => {
    const summary = evaluateOverdueCommitmentPlanning(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const derivationCheck = summary.checks.find(
      (c) =>
        c.checkName === "read_time_due_date_status_derivation_is_authority",
    );
    expect(derivationCheck?.passed).toBe(true);
  });

  it("no-persisted-flag-authority check passes against the bundled fixture", () => {
    const summary = evaluateOverdueCommitmentPlanning(
      OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const noPersistedCheck = summary.checks.find(
      (c) => c.checkName === "no_persisted_overdue_flag_authority",
    );
    expect(noPersistedCheck?.passed).toBe(true);
  });
});
