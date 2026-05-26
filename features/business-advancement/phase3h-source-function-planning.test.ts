import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  PHASE3H_BLOCKED_DECISION_THRESHOLD_MS,
  PHASE3H_DEFAULT_ENABLED,
  PHASE3H_FIXTURE_WORKSPACE_ID,
  PHASE3H_REFERENCE_CLOCK_MS,
  PHASE3H_RULE_VERSION,
  PHASE3H_TPQR001_FIXTURE_ROWS,
  PHASE3H_TPQR003_FIXTURE_ROWS,
  PHASE3H_TPQR004_FIXTURE_ROWS,
  evaluatePhase3hSourceFunctions,
  sourceBlockedDecisionCandidates,
  sourceCustomerWaitingCandidates,
  sourceOverdueCommitmentCandidates,
} from "./phase3h-source-function-planning";

const OTHER_WS = "ws-other-test" as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runTpqr001(enabled = true, workspaceId = PHASE3H_FIXTURE_WORKSPACE_ID) {
  return sourceBlockedDecisionCandidates({
    workspaceId,
    referenceClockMs: PHASE3H_REFERENCE_CLOCK_MS,
    thresholdMs: PHASE3H_BLOCKED_DECISION_THRESHOLD_MS,
    enabled,
    rows: PHASE3H_TPQR001_FIXTURE_ROWS,
  });
}

function runTpqr003(enabled = true, workspaceId = PHASE3H_FIXTURE_WORKSPACE_ID, referenceClockMs: number = PHASE3H_REFERENCE_CLOCK_MS) {
  return sourceOverdueCommitmentCandidates({
    workspaceId,
    referenceClockMs,
    enabled,
    rows: PHASE3H_TPQR003_FIXTURE_ROWS,
  });
}

function runTpqr004(enabled = true, workspaceId = PHASE3H_FIXTURE_WORKSPACE_ID) {
  return sourceCustomerWaitingCandidates({
    workspaceId,
    enabled,
    rows: PHASE3H_TPQR004_FIXTURE_ROWS,
  });
}

// ---------------------------------------------------------------------------
// Disabled-by-default / enabled=false
// ---------------------------------------------------------------------------

describe("Phase 3H named source functions — disabled by default", () => {
  it("PHASE3H_DEFAULT_ENABLED is false", () => {
    expect(PHASE3H_DEFAULT_ENABLED).toBe(false);
  });

  it("TPQR-001 returns no candidates when enabled=false", () => {
    const result = runTpqr001(false);
    expect(result.included).toHaveLength(0);
  });

  it("TPQR-001 excludes all rows with reason 'disabled' when enabled=false", () => {
    const result = runTpqr001(false);
    expect(result.excluded.length).toBeGreaterThan(0);
    for (const exc of result.excluded) {
      expect(exc.exclusionReason).toBe("disabled");
    }
  });

  it("TPQR-003 returns no candidates when enabled=false", () => {
    const result = runTpqr003(false);
    expect(result.included).toHaveLength(0);
  });

  it("TPQR-003 excludes all rows with reason 'disabled' when enabled=false", () => {
    const result = runTpqr003(false);
    expect(result.excluded.length).toBeGreaterThan(0);
    for (const exc of result.excluded) {
      expect(exc.exclusionReason).toBe("disabled");
    }
  });

  it("TPQR-004 returns no candidates when enabled=false", () => {
    const result = runTpqr004(false);
    expect(result.included).toHaveLength(0);
    expect(result.crmLinkedCandidateCount).toBe(0);
    expect(result.genericCandidateCount).toBe(0);
  });

  it("TPQR-004 excludes all rows with reason 'disabled' when enabled=false", () => {
    const result = runTpqr004(false);
    expect(result.excluded.length).toBeGreaterThan(0);
    for (const exc of result.excluded) {
      expect(exc.exclusionReason).toBe("disabled");
    }
  });
});

// ---------------------------------------------------------------------------
// Workspace mismatch excluded for all families
// ---------------------------------------------------------------------------

describe("Phase 3H named source functions — workspace mismatch", () => {
  it("TPQR-001 excludes out-of-scope rows with workspace_mismatch", () => {
    const result = runTpqr001(true);
    const mismatch = result.excluded.filter(
      (e) => e.exclusionReason === "workspace_mismatch",
    );
    expect(mismatch.length).toBeGreaterThan(0);
    for (const e of mismatch) {
      expect(e.workspaceId).not.toBe(PHASE3H_FIXTURE_WORKSPACE_ID);
    }
  });

  it("TPQR-001 does not include any row with wrong workspace", () => {
    const result = sourceBlockedDecisionCandidates({
      workspaceId: OTHER_WS,
      referenceClockMs: PHASE3H_REFERENCE_CLOCK_MS,
      thresholdMs: PHASE3H_BLOCKED_DECISION_THRESHOLD_MS,
      enabled: true,
      rows: PHASE3H_TPQR001_FIXTURE_ROWS,
    });
    expect(result.included).toHaveLength(0);
  });

  it("TPQR-003 excludes out-of-scope rows with workspace_mismatch", () => {
    const result = runTpqr003(true);
    const mismatch = result.excluded.filter(
      (e) => e.exclusionReason === "workspace_mismatch",
    );
    expect(mismatch.length).toBeGreaterThan(0);
    for (const e of mismatch) {
      expect(e.workspaceId).not.toBe(PHASE3H_FIXTURE_WORKSPACE_ID);
    }
  });

  it("TPQR-004 excludes out-of-scope rows with workspace_mismatch", () => {
    const result = runTpqr004(true);
    const mismatch = result.excluded.filter(
      (e) => e.exclusionReason === "workspace_mismatch",
    );
    expect(mismatch.length).toBeGreaterThan(0);
    for (const e of mismatch) {
      expect(e.workspaceId).not.toBe(PHASE3H_FIXTURE_WORKSPACE_ID);
    }
  });
});

// ---------------------------------------------------------------------------
// TPQR-001 specific
// ---------------------------------------------------------------------------

describe("Phase 3H TPQR-001 blocked_decision source function", () => {
  it("includes the stale no-review row", () => {
    const result = runTpqr001(true);
    const found = result.included.find(
      (c) => c.sourceRowId === "ai-001-stale-no-review",
    );
    expect(found).toBeDefined();
    expect(found?.tpqrId).toBe("TPQR-001");
    expect(found?.stalenessMs).toBeGreaterThan(PHASE3H_BLOCKED_DECISION_THRESHOLD_MS);
  });

  it("excludes the row already in review (hasApprovalTask=true)", () => {
    const result = runTpqr001(true);
    const found = result.excluded.find(
      (e) => e.sourceRowId === "ai-001-in-review",
    );
    expect(found).toBeDefined();
    expect(found?.exclusionReason).toBe("already_in_review");
  });

  it("excludes the fresh row (within threshold)", () => {
    const result = runTpqr001(true);
    const found = result.excluded.find(
      (e) => e.sourceRowId === "ai-001-fresh",
    );
    expect(found).toBeDefined();
    expect(found?.exclusionReason).toBe("threshold_not_met");
    expect(found?.audit.thresholdStatus).toBe("threshold_not_met");
  });

  it("does not include the row already in review even when very stale", () => {
    const result = sourceBlockedDecisionCandidates({
      workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
      referenceClockMs: PHASE3H_REFERENCE_CLOCK_MS,
      thresholdMs: PHASE3H_BLOCKED_DECISION_THRESHOLD_MS,
      enabled: true,
      rows: [
        {
          rowId: "ai-very-stale-in-review",
          workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
          updatedAtMs: PHASE3H_REFERENCE_CLOCK_MS - 30 * 24 * 60 * 60 * 1000,
          hasApprovalTask: true,
        },
      ],
    });
    expect(result.included).toHaveLength(0);
    expect(result.excluded[0]?.exclusionReason).toBe("already_in_review");
  });
});

// ---------------------------------------------------------------------------
// TPQR-003 specific
// ---------------------------------------------------------------------------

describe("Phase 3H TPQR-003 overdue_commitment source function", () => {
  it("includes overdue rows regardless of persistedOverdueFlag=false", () => {
    const result = runTpqr003(true);
    const found = result.included.find(
      (c) => c.sourceRowId === "c-003-overdue-flag-false",
    );
    expect(found).toBeDefined();
    expect(found?.tpqrId).toBe("TPQR-003");
  });

  it("includes overdue rows regardless of persistedOverdueFlag=true", () => {
    const result = runTpqr003(true);
    const found = result.included.find(
      (c) => c.sourceRowId === "c-003-overdue-flag-true",
    );
    expect(found).toBeDefined();
  });

  it("flipping persistedOverdueFlag does not change candidate inclusion (non-authority proof)", () => {
    const baseResult = runTpqr003(true);
    const flippedRows = PHASE3H_TPQR003_FIXTURE_ROWS.map((row) => ({
      ...row,
      persistedOverdueFlag: !row.persistedOverdueFlag,
    }));
    const flippedResult = sourceOverdueCommitmentCandidates({
      workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
      referenceClockMs: PHASE3H_REFERENCE_CLOCK_MS,
      enabled: true,
      rows: flippedRows,
    });
    const baseIds = baseResult.included.map((c) => c.sourceRowId).sort();
    const flippedIds = flippedResult.included.map((c) => c.sourceRowId).sort();
    expect(baseIds).toEqual(flippedIds);
  });

  it("excludes terminal-status row (FULFILLED)", () => {
    const result = runTpqr003(true);
    const found = result.excluded.find(
      (e) => e.sourceRowId === "c-003-terminal",
    );
    expect(found?.exclusionReason).toBe("terminal_status");
  });

  it("excludes row with missing dueDate", () => {
    const result = runTpqr003(true);
    const found = result.excluded.find(
      (e) => e.sourceRowId === "c-003-no-due-date",
    );
    expect(found?.exclusionReason).toBe("missing_due_date");
  });

  it("excludes not-yet-overdue row with threshold_not_met", () => {
    const result = runTpqr003(true);
    const found = result.excluded.find(
      (e) => e.sourceRowId === "c-003-not-yet-overdue",
    );
    expect(found?.exclusionReason).toBe("threshold_not_met");
    expect(found?.audit.thresholdStatus).toBe("threshold_not_met");
  });

  it("requires explicit referenceClockMs — different clocks change inclusion", () => {
    const presentResult = runTpqr003(true);
    const pastClockMs = PHASE3H_REFERENCE_CLOCK_MS - 365 * 24 * 60 * 60 * 1000;
    const pastResult = runTpqr003(true, PHASE3H_FIXTURE_WORKSPACE_ID, pastClockMs);
    expect(presentResult.included.length).toBeGreaterThan(0);
    expect(pastResult.included.length).toBeLessThan(presentResult.included.length);
  });

  it("candidates do not expose persistedOverdueFlag", () => {
    const result = runTpqr003(true);
    const serialized = JSON.stringify(result.included);
    expect(serialized).not.toContain("persistedOverdueFlag");
  });
});

// ---------------------------------------------------------------------------
// TPQR-004 specific
// ---------------------------------------------------------------------------

describe("Phase 3H TPQR-004 customer_waiting source function", () => {
  it("CRM-linked producer produces candidates", () => {
    const result = runTpqr004(true);
    expect(result.crmLinkedCandidateCount).toBeGreaterThan(0);
    const crmCandidates = result.included.filter(
      (c) => c.producerKind === "crm_linked",
    );
    expect(crmCandidates.length).toBeGreaterThan(0);
  });

  it("generic producer produces candidates", () => {
    const result = runTpqr004(true);
    expect(result.genericCandidateCount).toBeGreaterThan(0);
    const genericCandidates = result.included.filter(
      (c) => c.producerKind === "generic",
    );
    expect(genericCandidates.length).toBeGreaterThan(0);
  });

  it("after-producer dedup: no duplicate emailThreadIds in included", () => {
    const result = runTpqr004(true);
    const ids = result.included.map((c) => c.emailThreadId);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  it("after-producer dedup: CRM-linked wins over generic for same emailThreadId", () => {
    const result = runTpqr004(true);
    const crmRow = PHASE3H_TPQR004_FIXTURE_ROWS.find(
      (r) => r.opportunityId !== null,
    );
    expect(crmRow).toBeDefined();
    const candidate = result.included.find(
      (c) => c.emailThreadId === crmRow?.emailThreadId,
    );
    expect(candidate?.producerKind).toBe("crm_linked");
  });

  it("generic-producer duplicate excluded with deduped_by_crm_linked", () => {
    const result = runTpqr004(true);
    const dedupedExclusions = result.excluded.filter(
      (e) => e.exclusionReason === "deduped_by_crm_linked",
    );
    expect(dedupedExclusions.length).toBeGreaterThan(0);
  });

  it("excludes non-WAITING_US rows with not_waiting_us", () => {
    const result = runTpqr004(true);
    const found = result.excluded.find(
      (e) => e.sourceRowId === "et-004-not-waiting",
    );
    expect(found?.exclusionReason).toBe("not_waiting_us");
  });

  it("TPQR-004 no sourceRowId appears in both included and excluded", () => {
    const result = runTpqr004(true);
    const includedIds = new Set(result.included.map((c) => c.sourceRowId));
    for (const e of result.excluded) {
      expect(includedIds.has(e.sourceRowId)).toBe(false);
    }
  });

  it("TPQR-004 CRM-linked rows are not excluded with deduped_by_crm_linked", () => {
    const result = runTpqr004(true);
    const crmLinkedRowIds = new Set(
      PHASE3H_TPQR004_FIXTURE_ROWS.filter((r) => r.opportunityId !== null).map(
        (r) => r.rowId,
      ),
    );
    const wrongExclusions = result.excluded.filter(
      (e) =>
        crmLinkedRowIds.has(e.sourceRowId) &&
        e.exclusionReason === "deduped_by_crm_linked",
    );
    expect(wrongExclusions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Audit metadata
// ---------------------------------------------------------------------------

describe("Phase 3H audit metadata", () => {
  it("all TPQR-001 included candidates have complete audit metadata", () => {
    const result = runTpqr001(true);
    expect(result.included.length).toBeGreaterThan(0);
    for (const c of result.included) {
      expect(c.audit.tpqrId).toBe("TPQR-001");
      expect(c.audit.sourceRowId).toBe(c.sourceRowId);
      expect(c.audit.ruleVersion).toBe(PHASE3H_RULE_VERSION);
      expect(c.audit.thresholdStatus).toBe("calibration_placeholder");
      expect(c.audit.exclusionReason).toBeNull();
      expect(c.audit.sourceFunctionName).toBe("sourceBlockedDecisionCandidates");
    }
  });

  it("all TPQR-001 excluded rows have complete audit metadata", () => {
    const result = runTpqr001(true);
    expect(result.excluded.length).toBeGreaterThan(0);
    for (const e of result.excluded) {
      expect(e.audit.tpqrId).toBe("TPQR-001");
      expect(e.audit.sourceRowId).toBe(e.sourceRowId);
      expect(e.audit.ruleVersion).toBe(PHASE3H_RULE_VERSION);
      expect(e.audit.exclusionReason).toBe(e.exclusionReason);
      expect(e.audit.sourceFunctionName).toBe("sourceBlockedDecisionCandidates");
    }
  });

  it("all TPQR-003 included candidates have complete audit metadata", () => {
    const result = runTpqr003(true);
    expect(result.included.length).toBeGreaterThan(0);
    for (const c of result.included) {
      expect(c.audit.tpqrId).toBe("TPQR-003");
      expect(c.audit.sourceRowId).toBe(c.sourceRowId);
      expect(c.audit.ruleVersion).toBe(PHASE3H_RULE_VERSION);
      expect(c.audit.thresholdStatus).toBe("calibration_placeholder");
      expect(c.audit.exclusionReason).toBeNull();
      expect(c.audit.sourceFunctionName).toBe("sourceOverdueCommitmentCandidates");
    }
  });

  it("all TPQR-003 excluded rows have complete audit metadata", () => {
    const result = runTpqr003(true);
    expect(result.excluded.length).toBeGreaterThan(0);
    for (const e of result.excluded) {
      expect(e.audit.tpqrId).toBe("TPQR-003");
      expect(e.audit.sourceRowId).toBe(e.sourceRowId);
      expect(e.audit.ruleVersion).toBe(PHASE3H_RULE_VERSION);
      expect(e.audit.exclusionReason).toBe(e.exclusionReason);
      expect(e.audit.sourceFunctionName).toBe("sourceOverdueCommitmentCandidates");
    }
  });

  it("all TPQR-004 included candidates have complete audit metadata", () => {
    const result = runTpqr004(true);
    expect(result.included.length).toBeGreaterThan(0);
    for (const c of result.included) {
      expect(c.audit.tpqrId).toBe("TPQR-004");
      expect(c.audit.sourceRowId).toBe(c.sourceRowId);
      expect(c.audit.ruleVersion).toBe(PHASE3H_RULE_VERSION);
      expect(c.audit.thresholdStatus).toBe("calibration_placeholder");
      expect(c.audit.exclusionReason).toBeNull();
      expect(c.audit.sourceFunctionName).toBe("sourceCustomerWaitingCandidates");
    }
  });

  it("all TPQR-004 excluded rows have complete audit metadata", () => {
    const result = runTpqr004(true);
    expect(result.excluded.length).toBeGreaterThan(0);
    for (const e of result.excluded) {
      expect(e.audit.tpqrId).toBe("TPQR-004");
      expect(e.audit.sourceRowId).toBe(e.sourceRowId);
      expect(e.audit.ruleVersion).toBe(PHASE3H_RULE_VERSION);
      expect(e.audit.exclusionReason).toBe(e.exclusionReason);
      expect(e.audit.sourceFunctionName).toBe("sourceCustomerWaitingCandidates");
    }
  });
});

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

describe("Phase 3H evaluator", () => {
  it("evaluator passes all checks", () => {
    const summary = evaluatePhase3hSourceFunctions();
    const failed = summary.checks.filter((c) => !c.passed);
    expect(failed).toHaveLength(0);
    expect(summary.allPassed).toBe(true);
  });

  it("evaluator returns runtimeAdoptionPosture = 'No-Go'", () => {
    const summary = evaluatePhase3hSourceFunctions();
    expect(summary.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("evaluator carries PHASE3H_RULE_VERSION", () => {
    const summary = evaluatePhase3hSourceFunctions();
    expect(summary.ruleVersion).toBe(PHASE3H_RULE_VERSION);
  });

  it("evaluator totalChecks >= 11", () => {
    const summary = evaluatePhase3hSourceFunctions();
    expect(summary.totalChecks).toBeGreaterThanOrEqual(11);
  });
});

// ---------------------------------------------------------------------------
// Source file static checks
// ---------------------------------------------------------------------------

describe("Phase 3H source file static checks", () => {
  const src = readFileSync(
    new URL("./phase3h-source-function-planning.ts", import.meta.url),
    "utf-8",
  );

  it("source file has no @/ import statement", () => {
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/import\s+["']@\//);
  });

  it("source file has no db import", () => {
    expect(src).not.toMatch(/from\s+["']db["']/);
    expect(src).not.toMatch(/require\s*\(\s*["']db["']\s*\)/);
  });

  it("source file has no Date.now() call", () => {
    // Match the actual function call, not comment references to the pattern
    expect(src).not.toMatch(/Date\.now\s*\(/);
  });

  it("source file has no prisma import", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*prisma[^"']*["']/i);
  });

  it("source file has no runtime import beyond local types/constants", () => {
    // Should have no import statements at all
    expect(src).not.toMatch(/^import\s/m);
  });
});
