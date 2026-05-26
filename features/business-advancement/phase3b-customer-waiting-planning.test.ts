import { describe, expect, it } from "vitest";
import {
  CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
  CUSTOMER_WAITING_PLANNING_OWNERSHIP_RULE,
  CUSTOMER_WAITING_PLANNING_PREFLIGHT_ID,
  CUSTOMER_WAITING_PLANNING_PRODUCER_RANK,
  CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS,
  CUSTOMER_WAITING_PLANNING_SIGNAL_TYPE,
  CUSTOMER_WAITING_PLANNING_SOURCE_TYPE,
  CUSTOMER_WAITING_PLANNING_THRESHOLD_MS,
  CUSTOMER_WAITING_PLANNING_TIE_BREAK_ORDER,
  CUSTOMER_WAITING_PLANNING_TPQR_ID,
  buildCustomerWaitingPlanningCandidates,
  compareCustomerWaitingCandidates,
  computeCustomerWaitingWaitedMs,
  customerWaitingProducerRank,
  dedupCustomerWaitingByEmailThreadIdAfterProducers,
  evaluateCustomerWaitingPlanning,
  evaluateCustomerWaitingRow,
  type CustomerWaitingPlanningCandidate,
  type CustomerWaitingPlanningSourceRow,
} from "./phase3b-customer-waiting-planning";

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
const HOUR_MS = 60 * 60 * 1000;

describe("CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS", () => {
  it("contains five planning rows (covering TPQR-004 winner, generic-only winner, dedup loser, threshold_not_met, workspace boundary)", () => {
    expect(CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS).toHaveLength(5);
  });

  it("every row has unique rowId, non-empty workspaceId, explicit membership flag, and producer", () => {
    const seen = new Set<string>();
    for (const row of CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS) {
      expect(row.rowId.trim()).not.toBe("");
      expect(seen.has(row.rowId), `duplicate rowId ${row.rowId}`).toBe(false);
      seen.add(row.rowId);
      expect(row.workspaceId.trim()).not.toBe("");
      expect(typeof row.workspaceMembershipConfirmed).toBe("boolean");
      expect(row.producerId).toBeDefined();
      expect(row.emailThreadId.trim()).not.toBe("");
      expect(row.evidenceRefs.length).toBeGreaterThan(0);
    }
  });

  it("anchors at the documented Phase 3B planning constants", () => {
    expect(CUSTOMER_WAITING_PLANNING_TPQR_ID).toBe("TPQR-004");
    expect(CUSTOMER_WAITING_PLANNING_PREFLIGHT_ID).toBe("PF3A-004");
    expect(CUSTOMER_WAITING_PLANNING_SIGNAL_TYPE).toBe("customer_waiting");
    expect(CUSTOMER_WAITING_PLANNING_SOURCE_TYPE).toBe("combined");
    expect(CUSTOMER_WAITING_PLANNING_THRESHOLD_MS).toBe(24 * 60 * 60 * 1000);
    expect(CUSTOMER_WAITING_PLANNING_OWNERSHIP_RULE).toBe(
      "merge_and_dedup_by_email_thread_id_after_producers",
    );
    expect(CUSTOMER_WAITING_PLANNING_TIE_BREAK_ORDER).toEqual([
      "tpqr004_crm_linked",
      "loadWaitingEmailThreads_generic",
    ]);
  });

  it("encodes producer rank with TPQR-004 first", () => {
    expect(
      CUSTOMER_WAITING_PLANNING_PRODUCER_RANK.tpqr004_crm_linked,
    ).toBeLessThan(
      CUSTOMER_WAITING_PLANNING_PRODUCER_RANK.loadWaitingEmailThreads_generic,
    );
    expect(customerWaitingProducerRank("tpqr004_crm_linked")).toBe(0);
    expect(customerWaitingProducerRank("loadWaitingEmailThreads_generic")).toBe(
      1,
    );
  });

  it("includes an overlapping emailThreadId across producers", () => {
    const grouped = new Map<string, Set<string>>();
    for (const row of CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS) {
      const existing = grouped.get(row.emailThreadId) ?? new Set();
      existing.add(row.producerId);
      grouped.set(row.emailThreadId, existing);
    }
    const overlap = [...grouped.entries()].find(
      ([, producers]) => producers.size >= 2,
    );
    expect(overlap, "at least one emailThreadId must overlap").toBeDefined();
  });
});

describe("computeCustomerWaitingWaitedMs", () => {
  const referenceClockMs = CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS;

  it("returns positive waitedMs for past lastCustomerMessageAtMs", () => {
    const row = CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "CW-PLAN-001",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const waitedMs = computeCustomerWaitingWaitedMs(row, referenceClockMs);
    expect(waitedMs).toBeGreaterThan(CUSTOMER_WAITING_PLANNING_THRESHOLD_MS);
  });

  it("clamps future-dated lastCustomerMessageAtMs to zero", () => {
    const row: CustomerWaitingPlanningSourceRow = {
      ...CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS[0],
      rowId: "TEST-FUTURE",
      lastCustomerMessageAtMs: referenceClockMs + 60 * 60 * 1000,
    };
    expect(computeCustomerWaitingWaitedMs(row, referenceClockMs)).toBe(0);
  });

  it("returns 0 when lastCustomerMessageAtMs equals the reference clock", () => {
    const row: CustomerWaitingPlanningSourceRow = {
      ...CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS[0],
      rowId: "TEST-EQUAL",
      lastCustomerMessageAtMs: referenceClockMs,
    };
    expect(computeCustomerWaitingWaitedMs(row, referenceClockMs)).toBe(0);
  });
});

describe("evaluateCustomerWaitingRow", () => {
  const referenceClockMs = CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS;

  it("includes CW-PLAN-001 (TPQR-004 CRM-linked, 4d wait, workspace confirmed)", () => {
    const row = CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "CW-PLAN-001",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const result = evaluateCustomerWaitingRow(row, referenceClockMs);
    expect(result.included).toBe(true);
    if (!result.included) return;
    expect(result.candidate.tpqrId).toBe("TPQR-004");
    expect(result.candidate.preflightId).toBe("PF3A-004");
    expect(result.candidate.signalType).toBe("customer_waiting");
    expect(result.candidate.sourceType).toBe("combined");
    expect(result.candidate.ownershipRule).toBe(
      "merge_and_dedup_by_email_thread_id_after_producers",
    );
    expect(result.candidate.producerId).toBe("tpqr004_crm_linked");
    expect(result.candidate.producerRank).toBe(0);
    expect(result.candidate.emailThreadId).toBe(row.emailThreadId);
    expect(result.candidate.opportunityIdPresent).toBe(true);
    expect(result.candidate.lastCustomerMessageAtMs).toBe(
      row.lastCustomerMessageAtMs,
    );
    expect(result.candidate.waitedMs).toBeGreaterThan(
      CUSTOMER_WAITING_PLANNING_THRESHOLD_MS,
    );
    expect(result.candidate.thresholdMs).toBe(
      CUSTOMER_WAITING_PLANNING_THRESHOLD_MS,
    );
    expect(result.candidate.evaluatedAtMs).toBe(referenceClockMs);
    expect(result.candidate.sourceRowId).toBe(row.rowId);
    expect(result.candidate.riskLevel).toBe("high");
    expect(result.candidate.reviewPosture).toBe("human_owner_required");
    expect(result.candidate.evidenceRefs.length).toBeGreaterThan(0);
    expect(result.candidate.primaryAction).toContain(row.emailThreadId);
    expect(result.candidate.planningOnly).toBe(true);
  });

  it("includes CW-PLAN-002 (generic, same emailThreadId as 001) at the per-row stage; dedup happens later", () => {
    const row = CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "CW-PLAN-002",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const result = evaluateCustomerWaitingRow(row, referenceClockMs);
    expect(result.included).toBe(true);
    if (!result.included) return;
    expect(result.candidate.producerId).toBe("loadWaitingEmailThreads_generic");
  });

  it("excludes CW-PLAN-004 (fresh) with reason threshold_not_met", () => {
    const row = CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "CW-PLAN-004",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const result = evaluateCustomerWaitingRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("threshold_not_met");
    expect(result.excluded.detail).toContain("24h");
  });

  it("excludes CW-PLAN-005 (workspace not confirmed) with reason workspace_boundary_not_confirmed", () => {
    const row = CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS.find(
      (r) => r.rowId === "CW-PLAN-005",
    );
    expect(row).toBeDefined();
    if (!row) return;
    const result = evaluateCustomerWaitingRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("workspace_boundary_not_confirmed");
  });

  it("workspace_boundary_not_confirmed has highest exclusion priority over threshold_not_met", () => {
    const row: CustomerWaitingPlanningSourceRow = {
      rowId: "TEST-BOUNDARY-PRIORITY",
      workspaceId: "ws-test",
      workspaceMembershipConfirmed: false,
      producerId: "tpqr004_crm_linked",
      emailThreadId: "em-test",
      opportunityIdPresent: true,
      title: "test",
      lastCustomerMessageAtMs: referenceClockMs - 1 * HOUR_MS,
      evidenceRefs: ["test evidence"],
      sourceScenario: "test scenario",
    };
    const result = evaluateCustomerWaitingRow(row, referenceClockMs);
    expect(result.included).toBe(false);
    if (result.included) return;
    expect(result.excluded.reason).toBe("workspace_boundary_not_confirmed");
  });
});

describe("dedupCustomerWaitingByEmailThreadIdAfterProducers", () => {
  const referenceClockMs = CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS;

  function makeCandidate(
    rowId: string,
    producerId: "tpqr004_crm_linked" | "loadWaitingEmailThreads_generic",
    emailThreadId: string,
  ): CustomerWaitingPlanningCandidate {
    return {
      itemId: `${rowId}-candidate`,
      title: rowId,
      reason: "test",
      evidenceRefs: ["test"],
      primaryAction: `review: email thread ${emailThreadId} (review required; planning candidate)`,
      boundaryNote: "test",
      reviewPosture: "human_owner_required",
      sourceSummary: "test",
      riskLevel: "high",
      sortKey: 0,
      planningOnly: true,
      tpqrId: "TPQR-004",
      preflightId: "PF3A-004",
      signalType: "customer_waiting",
      sourceType: "combined",
      ownershipRule: "merge_and_dedup_by_email_thread_id_after_producers",
      producerId,
      producerRank:
        CUSTOMER_WAITING_PLANNING_PRODUCER_RANK[producerId],
      emailThreadId,
      opportunityIdPresent: producerId === "tpqr004_crm_linked",
      lastCustomerMessageAtMs: referenceClockMs - 4 * DAY_MS,
      waitedMs: 4 * DAY_MS,
      evaluatedAtMs: referenceClockMs,
      sourceRowId: rowId,
      thresholdMs: CUSTOMER_WAITING_PLANNING_THRESHOLD_MS,
    };
  }

  it("keeps TPQR-004 winner when both producers share an emailThreadId", () => {
    const generic = makeCandidate(
      "G",
      "loadWaitingEmailThreads_generic",
      "em-shared",
    );
    const tpqr = makeCandidate("T", "tpqr004_crm_linked", "em-shared");
    const { winners, losers } =
      dedupCustomerWaitingByEmailThreadIdAfterProducers([generic, tpqr]);
    expect(winners).toHaveLength(1);
    expect(winners[0].producerId).toBe("tpqr004_crm_linked");
    expect(losers).toHaveLength(1);
    expect(losers[0].producerId).toBe("loadWaitingEmailThreads_generic");
  });

  it("keeps TPQR-004 winner regardless of input order", () => {
    const generic = makeCandidate(
      "G",
      "loadWaitingEmailThreads_generic",
      "em-shared",
    );
    const tpqr = makeCandidate("T", "tpqr004_crm_linked", "em-shared");
    for (const order of [
      [generic, tpqr],
      [tpqr, generic],
    ]) {
      const { winners } =
        dedupCustomerWaitingByEmailThreadIdAfterProducers(order);
      expect(winners).toHaveLength(1);
      expect(winners[0].producerId).toBe("tpqr004_crm_linked");
    }
  });

  it("falls back to the generic candidate when no TPQR-004 row exists for that emailThreadId", () => {
    const generic = makeCandidate(
      "G",
      "loadWaitingEmailThreads_generic",
      "em-only-generic",
    );
    const { winners, losers } =
      dedupCustomerWaitingByEmailThreadIdAfterProducers([generic]);
    expect(winners).toHaveLength(1);
    expect(winners[0].producerId).toBe("loadWaitingEmailThreads_generic");
    expect(losers).toHaveLength(0);
  });

  it("emits no losers when all emailThreadIds are unique", () => {
    const a = makeCandidate("A", "tpqr004_crm_linked", "em-a");
    const b = makeCandidate("B", "loadWaitingEmailThreads_generic", "em-b");
    const c = makeCandidate("C", "tpqr004_crm_linked", "em-c");
    const { winners, losers } =
      dedupCustomerWaitingByEmailThreadIdAfterProducers([a, b, c]);
    expect(winners).toHaveLength(3);
    expect(losers).toHaveLength(0);
    const ids = winners.map((w) => w.emailThreadId).sort();
    expect(ids).toEqual(["em-a", "em-b", "em-c"]);
  });
});

describe("buildCustomerWaitingPlanningCandidates", () => {
  const referenceClockMs = CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS;

  it("produces exactly two inclusion candidates from the bundled fixture", () => {
    const built = buildCustomerWaitingPlanningCandidates(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect(built.candidates).toHaveLength(2);
    expect(built.excluded).toHaveLength(3);
  });

  it("orders candidates by waitedMs DESC then producerRank ASC then emailThreadId ASC", () => {
    const built = buildCustomerWaitingPlanningCandidates(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect(built.candidates.map((c) => c.sourceRowId)).toEqual([
      "CW-PLAN-001",
      "CW-PLAN-003",
    ]);
  });

  it("assigns zero-based contiguous sortKey values", () => {
    const built = buildCustomerWaitingPlanningCandidates(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    built.candidates.forEach((candidate, index) => {
      expect(candidate.sortKey).toBe(index);
    });
  });

  it("dedups overlapping emailThreadId in favor of TPQR-004 (CW-PLAN-002 is the deduped loser)", () => {
    const built = buildCustomerWaitingPlanningCandidates(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const dedupLoser = built.excluded.find(
      (row) => row.sourceRowId === "CW-PLAN-002",
    );
    expect(dedupLoser).toBeDefined();
    expect(dedupLoser?.reason).toBe(
      "deduped_by_email_thread_id_after_producers",
    );
    const winner = built.candidates.find(
      (c) => c.emailThreadId === "em-thread-shared",
    );
    expect(winner?.producerId).toBe("tpqr004_crm_linked");
    expect(winner?.sourceRowId).toBe("CW-PLAN-001");
  });

  it("keeps the generic-only row (CW-PLAN-003) because no TPQR-004 row covers its emailThreadId", () => {
    const built = buildCustomerWaitingPlanningCandidates(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const genericWinner = built.candidates.find(
      (c) => c.emailThreadId === "em-thread-generic-only",
    );
    expect(genericWinner).toBeDefined();
    expect(genericWinner?.producerId).toBe("loadWaitingEmailThreads_generic");
    expect(genericWinner?.sourceRowId).toBe("CW-PLAN-003");
  });

  it("yields the same ordering when input rows are reversed (deterministic)", () => {
    const reference = buildCustomerWaitingPlanningCandidates(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const reversed = buildCustomerWaitingPlanningCandidates(
      [...CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS].reverse(),
      referenceClockMs,
    );
    expect(reversed.candidates.map((c) => c.itemId)).toEqual(
      reference.candidates.map((c) => c.itemId),
    );
  });

  it("produces no duplicate emailThreadId in the final candidates", () => {
    const built = buildCustomerWaitingPlanningCandidates(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const ids = built.candidates.map((c) => c.emailThreadId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not mutate the input row array", () => {
    const snapshot = [...CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS];
    buildCustomerWaitingPlanningCandidates(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect([...CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS]).toEqual(snapshot);
  });

  it("breaks waitedMs ties by producerRank ASC then emailThreadId ASC", () => {
    const tied: readonly CustomerWaitingPlanningSourceRow[] = [
      {
        rowId: "TIE-GENERIC-A",
        workspaceId: "ws-tie",
        workspaceMembershipConfirmed: true,
        producerId: "loadWaitingEmailThreads_generic",
        emailThreadId: "em-tie-a",
        opportunityIdPresent: false,
        title: "tie generic a",
        lastCustomerMessageAtMs: referenceClockMs - 5 * DAY_MS,
        evidenceRefs: ["e"],
        sourceScenario: "s",
      },
      {
        rowId: "TIE-TPQR-B",
        workspaceId: "ws-tie",
        workspaceMembershipConfirmed: true,
        producerId: "tpqr004_crm_linked",
        emailThreadId: "em-tie-b",
        opportunityIdPresent: true,
        title: "tie tpqr b",
        lastCustomerMessageAtMs: referenceClockMs - 5 * DAY_MS,
        evidenceRefs: ["e"],
        sourceScenario: "s",
      },
      {
        rowId: "TIE-GENERIC-C",
        workspaceId: "ws-tie",
        workspaceMembershipConfirmed: true,
        producerId: "loadWaitingEmailThreads_generic",
        emailThreadId: "em-tie-c",
        opportunityIdPresent: false,
        title: "tie generic c",
        lastCustomerMessageAtMs: referenceClockMs - 5 * DAY_MS,
        evidenceRefs: ["e"],
        sourceScenario: "s",
      },
    ];
    const built = buildCustomerWaitingPlanningCandidates(tied, referenceClockMs);
    // All three share waitedMs. TPQR-004 should win producerRank tie-break,
    // then emailThreadId ascending among generic (em-tie-a < em-tie-c).
    expect(built.candidates.map((c) => c.sourceRowId)).toEqual([
      "TIE-TPQR-B",
      "TIE-GENERIC-A",
      "TIE-GENERIC-C",
    ]);
  });
});

describe("compareCustomerWaitingCandidates", () => {
  const baseCandidate: CustomerWaitingPlanningCandidate = {
    itemId: "a",
    title: "a",
    reason: "a",
    evidenceRefs: ["a"],
    primaryAction: "review: email thread em-x",
    boundaryNote: "x",
    reviewPosture: "human_owner_required",
    sourceSummary: "x",
    riskLevel: "high",
    sortKey: 0,
    planningOnly: true,
    tpqrId: "TPQR-004",
    preflightId: "PF3A-004",
    signalType: "customer_waiting",
    sourceType: "combined",
    ownershipRule: "merge_and_dedup_by_email_thread_id_after_producers",
    producerId: "tpqr004_crm_linked",
    producerRank: 0,
    emailThreadId: "em-x",
    opportunityIdPresent: true,
    lastCustomerMessageAtMs: 0,
    waitedMs: 100,
    evaluatedAtMs: 0,
    sourceRowId: "ZZZ",
    thresholdMs: CUSTOMER_WAITING_PLANNING_THRESHOLD_MS,
  };

  it("returns negative when a is more waited than b", () => {
    const a = baseCandidate;
    const b: CustomerWaitingPlanningCandidate = {
      ...a,
      waitedMs: 50,
      sourceRowId: "AAA",
    };
    expect(compareCustomerWaitingCandidates(a, b)).toBeLessThan(0);
  });

  it("breaks waitedMs ties by producerRank ASC", () => {
    const a: CustomerWaitingPlanningCandidate = {
      ...baseCandidate,
      producerId: "tpqr004_crm_linked",
      producerRank: 0,
    };
    const b: CustomerWaitingPlanningCandidate = {
      ...baseCandidate,
      producerId: "loadWaitingEmailThreads_generic",
      producerRank: 1,
    };
    expect(compareCustomerWaitingCandidates(a, b)).toBeLessThan(0);
    expect(compareCustomerWaitingCandidates(b, a)).toBeGreaterThan(0);
    expect(compareCustomerWaitingCandidates(a, a)).toBe(0);
  });

  it("breaks producerRank ties by emailThreadId ASC then sourceRowId ASC", () => {
    const a: CustomerWaitingPlanningCandidate = {
      ...baseCandidate,
      emailThreadId: "em-a",
      sourceRowId: "row-z",
    };
    const b: CustomerWaitingPlanningCandidate = {
      ...baseCandidate,
      emailThreadId: "em-b",
      sourceRowId: "row-a",
    };
    expect(compareCustomerWaitingCandidates(a, b)).toBeLessThan(0);
    const c: CustomerWaitingPlanningCandidate = {
      ...baseCandidate,
      emailThreadId: "em-a",
      sourceRowId: "row-a",
    };
    const d: CustomerWaitingPlanningCandidate = {
      ...baseCandidate,
      emailThreadId: "em-a",
      sourceRowId: "row-b",
    };
    expect(compareCustomerWaitingCandidates(c, d)).toBeLessThan(0);
  });
});

describe("evaluateCustomerWaitingPlanning", () => {
  const referenceClockMs = CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS;

  it("all checks pass against the bundled fixture", () => {
    const summary = evaluateCustomerWaitingPlanning(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const failed = summary.checks.filter((c) => !c.passed);
    expect(
      failed,
      `Failed checks: ${failed
        .map((c) => `${c.checkName}: ${c.detail}`)
        .join("; ")}`,
    ).toHaveLength(0);
    expect(summary.allPassed).toBe(true);
  });

  it("reports correct counts and anchors", () => {
    const summary = evaluateCustomerWaitingPlanning(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect(summary.totalSourceRows).toBe(5);
    expect(summary.includedCount).toBe(2);
    expect(summary.excludedCount).toBe(3);
    expect(summary.tpqrId).toBe("TPQR-004");
    expect(summary.preflightId).toBe("PF3A-004");
    expect(summary.ownershipRule).toBe(
      "merge_and_dedup_by_email_thread_id_after_producers",
    );
    expect(summary.tieBreakOrder).toEqual([
      "tpqr004_crm_linked",
      "loadWaitingEmailThreads_generic",
    ]);
    expect(summary.thresholdMs).toBe(24 * 60 * 60 * 1000);
  });

  it("surfaces ten checks", () => {
    const summary = evaluateCustomerWaitingPlanning(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    expect(summary.checks).toHaveLength(10);
  });

  it("every candidate's boundaryNote preserves recommendation/explanation/draft/proof distinctions", () => {
    const summary = evaluateCustomerWaitingPlanning(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
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
    const summary = evaluateCustomerWaitingPlanning(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
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

  it("no excluded reason text contains forbidden authorization wording", () => {
    const summary = evaluateCustomerWaitingPlanning(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    for (const row of summary.excluded) {
      const lower = row.detail.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
        expect(
          lower.includes(pattern),
          `${row.sourceRowId}: forbidden wording "${pattern}"`,
        ).toBe(false);
      }
    }
  });

  it("included candidate uses review-required planning verb (review/open) referencing the synthetic emailThreadId", () => {
    const summary = evaluateCustomerWaitingPlanning(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    for (const candidate of summary.candidates) {
      const verb = candidate.primaryAction.toLowerCase();
      expect(
        verb.startsWith("review") || verb.startsWith("open"),
        `${candidate.itemId}: primaryAction must use review/open planning verb`,
      ).toBe(true);
      expect(candidate.primaryAction).toContain(candidate.emailThreadId);
    }
  });

  it("flags a fixture that introduces forbidden wording", () => {
    const dirty: readonly CustomerWaitingPlanningSourceRow[] = [
      {
        ...CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS[0],
        rowId: "TEST-DIRTY",
        evidenceRefs: ["this row claims auto execute authority"],
      },
    ];
    const summary = evaluateCustomerWaitingPlanning(dirty, referenceClockMs);
    const noAuthCheck = summary.checks.find(
      (c) => c.checkName === "no_runtime_schema_or_write_authority",
    );
    expect(noAuthCheck?.passed).toBe(false);
    expect(summary.allPassed).toBe(false);
  });

  it("flags a fixture missing inclusion / dedup / threshold / membership coverage", () => {
    const fresh: readonly CustomerWaitingPlanningSourceRow[] = [
      {
        ...CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS[3], // CW-PLAN-004, fresh row
        rowId: "TEST-FRESH-ONLY",
      },
    ];
    const summary = evaluateCustomerWaitingPlanning(fresh, referenceClockMs);
    const fixtureCheck = summary.checks.find(
      (c) =>
        c.checkName ===
        "fixture_covers_inclusion_dedup_threshold_and_membership",
    );
    expect(fixtureCheck?.passed).toBe(false);
    expect(summary.allPassed).toBe(false);
  });

  it("workspace membership boundary check passes against the bundled fixture", () => {
    const summary = evaluateCustomerWaitingPlanning(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const membershipCheck = summary.checks.find(
      (c) => c.checkName === "workspace_membership_boundary_present",
    );
    expect(membershipCheck?.passed).toBe(true);
  });

  it("dedup ownership rule check passes against the bundled fixture", () => {
    const summary = evaluateCustomerWaitingPlanning(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const dedupCheck = summary.checks.find(
      (c) =>
        c.checkName ===
        "dedup_ownership_rule_is_merge_and_dedup_after_producers_with_tpqr004_first",
    );
    expect(dedupCheck?.passed).toBe(true);
  });

  it("no-duplicate-emailThreadId check passes against the bundled fixture", () => {
    const summary = evaluateCustomerWaitingPlanning(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const dupCheck = summary.checks.find(
      (c) => c.checkName === "no_duplicate_email_thread_id_in_final_candidates",
    );
    expect(dupCheck?.passed).toBe(true);
  });

  it("excluded rows have valid reasons", () => {
    const summary = evaluateCustomerWaitingPlanning(
      CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
      referenceClockMs,
    );
    const excludedCheck = summary.checks.find(
      (c) => c.checkName === "excluded_rows_have_reasons",
    );
    expect(excludedCheck?.passed).toBe(true);
    const reasons = new Set(summary.excluded.map((row) => row.reason));
    expect(reasons.has("threshold_not_met")).toBe(true);
    expect(reasons.has("workspace_boundary_not_confirmed")).toBe(true);
    expect(reasons.has("deduped_by_email_thread_id_after_producers")).toBe(
      true,
    );
  });
});
