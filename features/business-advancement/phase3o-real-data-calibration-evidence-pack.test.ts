import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE3O_EVALUATION,
  DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
  PHASE3O_MIN_ROWS_PER_FAMILY,
  PHASE3O_NEXT_ALLOWED_WORK,
  PHASE3O_REAL_DATA_CALIBRATION_POSTURE,
  PHASE3O_REDACTION_CONTRACT,
  PHASE3O_RULE_VERSION,
  PHASE3O_RUNTIME_ADOPTION_POSTURE,
  PHASE3O_TPQR001_THRESHOLD_MS,
  evaluatePhase3oRealDataCalibrationEvidencePack,
  type Phase3oEvidencePackInput,
} from "./phase3o-real-data-calibration-evidence-pack";

function liveSnapshot(
  patch: Partial<Phase3oEvidencePackInput> = {},
): Phase3oEvidencePackInput {
  return {
    ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    ...patch,
    sampleKind: "redacted_live_db_snapshot",
    rows: {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows,
      ...patch.rows,
    },
  };
}

function localDevelopmentSnapshot(
  patch: Partial<Phase3oEvidencePackInput> = {},
): Phase3oEvidencePackInput {
  return {
    ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    ...patch,
    sampleKind: "local_development_snapshot",
    rows: {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows,
      ...patch.rows,
    },
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Phase 3O constants", () => {
  it("uses the expected rule version", () => {
    expect(PHASE3O_RULE_VERSION).toBe(
      "phase3o-real-data-calibration-evidence-pack/v1",
    );
  });

  it("keeps runtime adoption posture as No-Go", () => {
    expect(PHASE3O_RUNTIME_ADOPTION_POSTURE).toBe("No-Go");
  });

  it("uses evidence-contract-ready calibration posture", () => {
    expect(PHASE3O_REAL_DATA_CALIBRATION_POSTURE).toBe(
      "Evidence-Contract-Ready",
    );
  });

  it("keeps the minimum row count small and explicit", () => {
    expect(PHASE3O_MIN_ROWS_PER_FAMILY).toBe(4);
  });

  it("uses the Phase 3K conservative 72h TPQR-001 threshold", () => {
    expect(PHASE3O_TPQR001_THRESHOLD_MS).toBe(259200000);
  });

  it("next allowed work is review, not production adoption", () => {
    const lower = PHASE3O_NEXT_ALLOWED_WORK.toLowerCase();
    expect(lower).toContain("runtime adoption review");
    expect(lower).toContain("not production adoption");
  });
});

// ---------------------------------------------------------------------------
// Default synthetic sample
// ---------------------------------------------------------------------------

describe("Phase 3O default synthetic evidence pack", () => {
  it("is synthetic, not a live DB snapshot", () => {
    expect(DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.sampleKind).toBe(
      "synthetic_fixture",
    );
  });

  it("has explicit referenceClockMs", () => {
    expect(DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.referenceClockMs).toBe(
      1777161600000,
    );
  });

  it("has at least 4 TPQR-001 rows", () => {
    expect(DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001.length).toBeGreaterThanOrEqual(
      4,
    );
  });

  it("has at least 4 TPQR-003 rows", () => {
    expect(DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003.length).toBeGreaterThanOrEqual(
      4,
    );
  });

  it("has at least 4 TPQR-004 rows", () => {
    expect(DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004.length).toBeGreaterThanOrEqual(
      4,
    );
  });

  it("never validates real data by default", () => {
    expect(DEFAULT_PHASE3O_EVALUATION.realDataValidated).toBe(false);
  });

  it("never completes production calibration by default", () => {
    expect(DEFAULT_PHASE3O_EVALUATION.productionCalibrationComplete).toBe(false);
  });

  it("keeps runtime adoption No-Go by default", () => {
    expect(DEFAULT_PHASE3O_EVALUATION.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("has a synthetic blocker by default", () => {
    expect(DEFAULT_PHASE3O_EVALUATION.blockers).toContain(
      "sampleKind is synthetic_fixture — real DB row calibration has not been provided",
    );
  });
});

describe("Phase 3O local development snapshot", () => {
  const result = evaluatePhase3oRealDataCalibrationEvidencePack(
    localDevelopmentSnapshot(),
  );

  it("does not validate real data from local development snapshots", () => {
    expect(result.sampleKind).toBe("local_development_snapshot");
    expect(result.realDataValidated).toBe(false);
    expect(result.productionCalibrationComplete).toBe(false);
  });

  it("keeps runtime adoption No-Go for local development snapshots", () => {
    expect(result.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("blocks local development snapshots from production calibration", () => {
    expect(result.blockers).toContain(
      "sampleKind is local_development_snapshot — local DB development validation does not satisfy real live DB calibration",
    );
  });
});

// ---------------------------------------------------------------------------
// Valid redacted live snapshot
// ---------------------------------------------------------------------------

describe("Phase 3O valid redacted live snapshot", () => {
  const result = evaluatePhase3oRealDataCalibrationEvidencePack(liveSnapshot());

  it("can validate a supplied redacted live snapshot", () => {
    expect(result.sampleKind).toBe("redacted_live_db_snapshot");
    expect(result.realDataValidated).toBe(true);
  });

  it("can complete production calibration evidence without changing runtime posture", () => {
    expect(result.productionCalibrationComplete).toBe(true);
    expect(result.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("has no blockers for the valid live snapshot", () => {
    expect(result.blockers).toHaveLength(0);
  });

  it("calibrates TPQR-001", () => {
    expect(result.tpqr001.calibrated).toBe(true);
    expect(result.tpqr001.checksPass).toBe(true);
  });

  it("calibrates TPQR-003", () => {
    expect(result.tpqr003.calibrated).toBe(true);
    expect(result.tpqr003.checksPass).toBe(true);
  });

  it("calibrates TPQR-004", () => {
    expect(result.tpqr004.calibrated).toBe(true);
    expect(result.tpqr004.checksPass).toBe(true);
  });

  it("keeps included and excluded counts visible for every family", () => {
    expect(result.tpqr001.includedCount).toBeGreaterThanOrEqual(1);
    expect(result.tpqr001.excludedCount).toBeGreaterThanOrEqual(1);
    expect(result.tpqr003.includedCount).toBeGreaterThanOrEqual(1);
    expect(result.tpqr003.excludedCount).toBeGreaterThanOrEqual(1);
    expect(result.tpqr004.includedCount).toBeGreaterThanOrEqual(1);
    expect(result.tpqr004.excludedCount).toBeGreaterThanOrEqual(1);
  });

  it("does not allow production adoption directly", () => {
    expect(result.nextAllowedWork.toLowerCase()).toContain(
      "production runtime adoption review",
    );
    expect(result.nextAllowedWork.toLowerCase()).toContain(
      "not production adoption",
    );
  });
});

// ---------------------------------------------------------------------------
// TPQR-001 blocker cases
// ---------------------------------------------------------------------------

describe("Phase 3O TPQR-001 calibration blockers", () => {
  it("fails without a stale no-review included row", () => {
    const input = liveSnapshot({
      rows: {
        tpqr001: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001.filter(
          (row) => row.rowId !== "redacted-ai-stale-no-review",
        ),
        tpqr003: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003,
        tpqr004: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004,
      },
    });
    const result = evaluatePhase3oRealDataCalibrationEvidencePack(input);
    expect(result.tpqr001.calibrated).toBe(false);
    expect(result.tpqr001.blockers).toContain(
      "TPQR-001: minimum_redacted_row_volume",
    );
    expect(result.tpqr001.blockers).toContain(
      "TPQR-001: stale_no_review_row_included",
    );
  });

  it("fails without fresh threshold exclusion", () => {
    const input = liveSnapshot({
      rows: {
        tpqr001: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001.map(
          (row) =>
            row.rowId === "redacted-ai-fresh-no-review"
              ? { ...row, updatedAtMs: inputClockMinus(4) }
              : row,
        ),
        tpqr003: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003,
        tpqr004: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004,
      },
    });
    const result = evaluatePhase3oRealDataCalibrationEvidencePack(input);
    expect(result.tpqr001.blockers).toContain("TPQR-001: fresh_row_excluded");
  });

  it("fails without already-in-review exclusion", () => {
    const input = liveSnapshot({
      rows: {
        tpqr001: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001.map(
          (row) =>
            row.rowId === "redacted-ai-already-in-review"
              ? { ...row, hasApprovalTask: false }
              : row,
        ),
        tpqr003: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003,
        tpqr004: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004,
      },
    });
    const result = evaluatePhase3oRealDataCalibrationEvidencePack(input);
    expect(result.tpqr001.blockers).toContain(
      "TPQR-001: already_in_review_excluded",
    );
  });

  it("fails without workspace mismatch exclusion", () => {
    const input = liveSnapshot({
      rows: {
        tpqr001: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001.map(
          (row) =>
            row.rowId === "redacted-ai-wrong-workspace"
              ? { ...row, workspaceId: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.workspaceId }
              : row,
        ),
        tpqr003: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003,
        tpqr004: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004,
      },
    });
    const result = evaluatePhase3oRealDataCalibrationEvidencePack(input);
    expect(result.tpqr001.blockers).toContain(
      "TPQR-001: workspace_mismatch_excluded",
    );
  });
});

// ---------------------------------------------------------------------------
// TPQR-003 blocker cases
// ---------------------------------------------------------------------------

describe("Phase 3O TPQR-003 calibration blockers", () => {
  it("fails without persisted false included proof", () => {
    const input = liveSnapshot({
      rows: {
        tpqr001: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001,
        tpqr003: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003.map(
          (row) =>
            row.rowId === "redacted-c-overdue-flag-false"
              ? { ...row, persistedOverdueFlag: true }
              : row,
        ),
        tpqr004: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004,
      },
    });
    const result = evaluatePhase3oRealDataCalibrationEvidencePack(input);
    expect(result.tpqr003.blockers).toContain(
      "TPQR-003: persisted_false_can_still_be_included",
    );
  });

  it("fails without persisted true excluded proof", () => {
    const input = liveSnapshot({
      rows: {
        tpqr001: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001,
        tpqr003: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003.map(
          (row) => ({ ...row, persistedOverdueFlag: false }),
        ),
        tpqr004: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004,
      },
    });
    const result = evaluatePhase3oRealDataCalibrationEvidencePack(input);
    expect(result.tpqr003.blockers).toContain(
      "TPQR-003: persisted_true_can_still_be_excluded",
    );
  });

  it("fails without future due-date exclusion", () => {
    const input = liveSnapshot({
      rows: {
        tpqr001: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001,
        tpqr003: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003.map(
          (row) =>
            row.rowId === "redacted-c-future-flag-true"
              ? { ...row, dueDateMs: inputClockMinus(2) }
              : row,
        ),
        tpqr004: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004,
      },
    });
    const result = evaluatePhase3oRealDataCalibrationEvidencePack(input);
    expect(result.tpqr003.blockers).toContain(
      "TPQR-003: future_due_date_excluded_by_reference_clock",
    );
  });

  it("fails without terminal status exclusion", () => {
    const input = liveSnapshot({
      rows: {
        tpqr001: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001,
        tpqr003: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003.map(
          (row) =>
            row.rowId === "redacted-c-terminal-flag-true"
              ? { ...row, status: "ACTIVE" }
              : row,
        ),
        tpqr004: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004,
      },
    });
    const result = evaluatePhase3oRealDataCalibrationEvidencePack(input);
    expect(result.tpqr003.blockers).toContain(
      "TPQR-003: terminal_status_excluded",
    );
  });
});

// ---------------------------------------------------------------------------
// TPQR-004 blocker cases
// ---------------------------------------------------------------------------

describe("Phase 3O TPQR-004 calibration blockers", () => {
  it("fails without CRM-linked inclusion", () => {
    const input = liveSnapshot({
      rows: {
        tpqr001: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001,
        tpqr003: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003,
        tpqr004: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004.map(
          (row) =>
            row.rowId === "redacted-et-crm-linked"
              ? { ...row, opportunityId: null }
              : row,
        ),
      },
    });
    const result = evaluatePhase3oRealDataCalibrationEvidencePack(input);
    expect(result.tpqr004.blockers).toContain(
      "TPQR-004: crm_linked_row_included",
    );
  });

  it("fails without generic duplicate exclusion", () => {
    const input = liveSnapshot({
      rows: {
        tpqr001: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001,
        tpqr003: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003,
        tpqr004: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004.map(
          (row) =>
            row.rowId === "redacted-et-generic-duplicate"
              ? { ...row, emailThreadId: "redacted-thread-not-duplicate" }
              : row,
        ),
      },
    });
    const result = evaluatePhase3oRealDataCalibrationEvidencePack(input);
    expect(result.tpqr004.blockers).toContain(
      "TPQR-004: generic_duplicate_excluded_by_crm_linked",
    );
  });

  it("fails without generic-only inclusion", () => {
    const input = liveSnapshot({
      rows: {
        tpqr001: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001,
        tpqr003: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003,
        tpqr004: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004.filter(
          (row) => row.rowId !== "redacted-et-generic-only",
        ),
      },
    });
    const result = evaluatePhase3oRealDataCalibrationEvidencePack(input);
    expect(result.tpqr004.blockers).toContain(
      "TPQR-004: minimum_redacted_row_volume",
    );
    expect(result.tpqr004.blockers).toContain(
      "TPQR-004: generic_only_row_included",
    );
  });

  it("fails without workspace mismatch exclusion", () => {
    const input = liveSnapshot({
      rows: {
        tpqr001: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001,
        tpqr003: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003,
        tpqr004: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004.map(
          (row) =>
            row.rowId === "redacted-et-wrong-workspace"
              ? { ...row, workspaceId: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.workspaceId }
              : row,
        ),
      },
    });
    const result = evaluatePhase3oRealDataCalibrationEvidencePack(input);
    expect(result.tpqr004.blockers).toContain(
      "TPQR-004: workspace_mismatch_excluded",
    );
  });
});

// ---------------------------------------------------------------------------
// Redaction contract
// ---------------------------------------------------------------------------

describe("Phase 3O redaction contract", () => {
  it("requires redacted rows before evaluator input", () => {
    expect(PHASE3O_REDACTION_CONTRACT.join(" ")).toMatch(/redacted/i);
  });

  it("forbids customer names and raw email material", () => {
    const contract = PHASE3O_REDACTION_CONTRACT.join(" ").toLowerCase();
    expect(contract).toContain("customer names");
    expect(contract).toContain("email bodies");
    expect(contract).toContain("raw email addresses");
  });

  it("forbids secrets and tokens", () => {
    const contract = PHASE3O_REDACTION_CONTRACT.join(" ").toLowerCase();
    expect(contract).toContain("secrets");
    expect(contract).toContain("tokens");
  });

  it("default rows use redacted identifiers", () => {
    const allRowIds = [
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr001.map(
        (row) => row.rowId,
      ),
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr003.map(
        (row) => row.rowId,
      ),
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.rows.tpqr004.map(
        (row) => row.rowId,
      ),
    ];
    expect(allRowIds.every((id) => id.startsWith("redacted-"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Source purity
// ---------------------------------------------------------------------------

describe("Phase 3O source file purity", () => {
  const src = readFileSync(
    new URL("./phase3o-real-data-calibration-evidence-pack.ts", import.meta.url),
    "utf-8",
  );

  it("has no @/ import", () => {
    expect(src).not.toMatch(/from\s+["']@\//);
  });

  it("has no db import", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*db[^"']*["']/i);
  });

  it("has no prisma import", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*prisma[^"']*["']/i);
  });

  it("has no fs import", () => {
    expect(src).not.toMatch(/from\s+["']fs["']/);
    expect(src).not.toMatch(/from\s+["']node:fs["']/);
  });

  it("has no network import", () => {
    expect(src).not.toMatch(/from\s+["'](https?|axios|node-fetch|got)["']/);
  });

  it("has no Date.now call", () => {
    expect(src).not.toMatch(/[^'"`]Date\.now\s*\(\s*\)/);
  });

  it("has no app import", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*\/app\//);
  });

  it("has no production query import", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*data\/queries/);
  });

  it("has no mobile read-model import", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*mobile-command-read-model/);
  });
});

function inputClockMinus(days: number): number {
  return (
    DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.referenceClockMs -
    days * 86400000
  );
}
