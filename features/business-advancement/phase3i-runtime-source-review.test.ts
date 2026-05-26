import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  PHASE3I_FORBIDDEN_FILES,
  PHASE3I_NEXT_ALLOWED_WORK,
  PHASE3I_RULE_VERSION,
  PHASE3I_RUNTIME_ADOPTION_POSTURE,
  TPQR001_SCHEMA_SEAM,
  TPQR003_SCHEMA_SEAM,
  TPQR004_SCHEMA_SEAM,
  evaluatePhase3iRuntimeSourceReview,
} from "./phase3i-runtime-source-review";

// ---------------------------------------------------------------------------
// Evaluator — top-level assertions
// ---------------------------------------------------------------------------

describe("evaluatePhase3iRuntimeSourceReview", () => {
  const summary = evaluatePhase3iRuntimeSourceReview();

  it("returns runtimeAdoptionPosture No-Go exactly", () => {
    expect(summary.runtimeAdoptionPosture).toBe(PHASE3I_RUNTIME_ADOPTION_POSTURE);
    expect(summary.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("returns nextAllowedWork exactly matching the exported constant", () => {
    expect(summary.nextAllowedWork).toBe(PHASE3I_NEXT_ALLOWED_WORK);
  });

  it("nextAllowedWork mentions Phase 3J and disabled-by-default", () => {
    expect(summary.nextAllowedWork).toContain("Phase 3J");
    expect(summary.nextAllowedWork).toContain("disabled-by-default");
  });

  it("nextAllowedWork enumerates all forbidden paths", () => {
    expect(summary.nextAllowedWork).toContain("data/queries.ts");
    expect(summary.nextAllowedWork).toContain(
      "features/mobile/lib/mobile-command-read-model.ts",
    );
    expect(summary.nextAllowedWork).toContain("app/");
    expect(summary.nextAllowedWork).toContain("app/api/");
    expect(summary.nextAllowedWork).toContain("prisma/schema.prisma");
  });

  it("returns ruleVersion matching the exported constant", () => {
    expect(summary.ruleVersion).toBe(PHASE3I_RULE_VERSION);
  });

  it("has exactly 13 checks", () => {
    expect(summary.totalChecks).toBe(13);
    expect(summary.checks).toHaveLength(13);
  });

  it("all 13 checks pass", () => {
    expect(summary.allPassed).toBe(true);
    expect(summary.passed).toBe(13);
    const failed = summary.checks.filter((c) => !c.passed);
    expect(failed).toHaveLength(0);
  });

  it("phase3jConditionalGo is true", () => {
    expect(summary.phase3jConditionalGo).toBe(true);
  });

  it("forbiddenFiles enumerates all required paths", () => {
    expect(summary.forbiddenFiles).toContain("data/queries.ts");
    expect(summary.forbiddenFiles).toContain(
      "features/mobile/lib/mobile-command-read-model.ts",
    );
    expect(summary.forbiddenFiles).toContain("app/");
    expect(summary.forbiddenFiles).toContain("app/api/");
    expect(summary.forbiddenFiles).toContain("prisma/schema.prisma");
  });

  it("exports PHASE3I_FORBIDDEN_FILES matching summary.forbiddenFiles", () => {
    expect(summary.forbiddenFiles).toEqual(PHASE3I_FORBIDDEN_FILES);
  });
});

// ---------------------------------------------------------------------------
// Individual check names and pass status
// ---------------------------------------------------------------------------

describe("individual checks all pass with correct names", () => {
  const { checks } = evaluatePhase3iRuntimeSourceReview();
  const byName = Object.fromEntries(checks.map((c) => [c.checkName, c]));

  const expectedCheckNames = [
    "tpqr001_schema_seam_confirmed",
    "tpqr001_source_does_not_confuse_pending_approval_queue",
    "tpqr001_threshold_calibration_placeholder_blocks_runtime",
    "tpqr003_schema_seam_confirmed",
    "tpqr003_explicit_reference_clock_no_date_now",
    "tpqr003_persisted_overdue_flag_non_authority_reconfirmed",
    "tpqr004_schema_seam_confirmed",
    "tpqr004_both_producers_and_dedup_seam_proven",
    "all_thresholds_are_calibration_placeholder",
    "no_runtime_db_seam_for_any_family",
    "runtime_adoption_posture_is_no_go",
    "phase3j_conditional_go_disabled_by_default",
    "forbidden_files_enumerated",
  ] as const;

  for (const name of expectedCheckNames) {
    it(`check '${name}' passes`, () => {
      const check = byName[name];
      expect(check, `check '${name}' not found`).toBeDefined();
      expect(check.passed, check?.detail).toBe(true);
    });
  }

  it("check names cover all 13 required checks exactly", () => {
    const names = checks.map((c) => c.checkName);
    for (const expected of expectedCheckNames) {
      expect(names).toContain(expected);
    }
    expect(names).toHaveLength(13);
  });
});

// ---------------------------------------------------------------------------
// TPQR-001 schema seam evidence
// ---------------------------------------------------------------------------

describe("TPQR001_SCHEMA_SEAM", () => {
  it("workspaceScopeNonNull is true", () => {
    expect(TPQR001_SCHEMA_SEAM.workspaceScopeNonNull).toBe(true);
  });

  it("queryShapeReadOnly is true", () => {
    expect(TPQR001_SCHEMA_SEAM.queryShapeReadOnly).toBe(true);
  });

  it("relevantRelations includes approvalTask optional one-to-one", () => {
    expect(
      TPQR001_SCHEMA_SEAM.relevantRelations.some((r) =>
        r.includes("approvalTask"),
      ),
    ).toBe(true);
  });

  it("existingSourceSeparation confirms mutually exclusive targets", () => {
    expect(TPQR001_SCHEMA_SEAM.existingSourceSeparation).toContain(
      "mutually exclusive",
    );
  });

  it("blockingGaps includes calibration_placeholder threshold gap", () => {
    expect(
      TPQR001_SCHEMA_SEAM.blockingGaps.some((g) =>
        g.includes("calibration_placeholder"),
      ),
    ).toBe(true);
  });

  it("blockingGaps includes function-to-DB seam gap", () => {
    expect(
      TPQR001_SCHEMA_SEAM.blockingGaps.some((g) =>
        g.includes("function-to-DB seam"),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TPQR-003 schema seam evidence
// ---------------------------------------------------------------------------

describe("TPQR003_SCHEMA_SEAM", () => {
  it("workspaceScopeNonNull is true", () => {
    expect(TPQR003_SCHEMA_SEAM.workspaceScopeNonNull).toBe(true);
  });

  it("queryShapeReadOnly is true", () => {
    expect(TPQR003_SCHEMA_SEAM.queryShapeReadOnly).toBe(true);
  });

  it("relevantFields includes dueDate as inclusion predicate", () => {
    expect(
      TPQR003_SCHEMA_SEAM.relevantFields.some((f) => f.includes("dueDate")),
    ).toBe(true);
  });

  it("relevantFields includes overdueFlag as non-authority", () => {
    expect(
      TPQR003_SCHEMA_SEAM.relevantFields.some((f) =>
        f.includes("overdueFlag") && f.includes("NOT inclusion authority"),
      ),
    ).toBe(true);
  });

  it("existingSourceSeparation confirms explicit referenceClockMs and no Date.now usage", () => {
    expect(TPQR003_SCHEMA_SEAM.existingSourceSeparation).toContain(
      "explicit referenceClockMs",
    );
    expect(TPQR003_SCHEMA_SEAM.existingSourceSeparation).toContain(
      "no Date.now usage",
    );
    expect(TPQR003_SCHEMA_SEAM.existingSourceSeparation).toContain("Date.now");
  });

  it("existingSourceSeparation references non-authority proof from Phase 3H", () => {
    expect(TPQR003_SCHEMA_SEAM.existingSourceSeparation).toContain(
      "non-authority proof",
    );
  });

  it("blockingGaps includes function-to-DB seam gap", () => {
    expect(
      TPQR003_SCHEMA_SEAM.blockingGaps.some((g) =>
        g.includes("function-to-DB seam"),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TPQR-004 schema seam evidence
// ---------------------------------------------------------------------------

describe("TPQR004_SCHEMA_SEAM", () => {
  it("workspaceScopeNonNull is true", () => {
    expect(TPQR004_SCHEMA_SEAM.workspaceScopeNonNull).toBe(true);
  });

  it("queryShapeReadOnly is true", () => {
    expect(TPQR004_SCHEMA_SEAM.queryShapeReadOnly).toBe(true);
  });

  it("relevantFields includes opportunityId nullable FK as CRM-linked seam", () => {
    expect(
      TPQR004_SCHEMA_SEAM.relevantFields.some(
        (f) => f.includes("opportunityId") && f.includes("nullable FK"),
      ),
    ).toBe(true);
  });

  it("existingSourceSeparation confirms existing source is generic only", () => {
    expect(TPQR004_SCHEMA_SEAM.existingSourceSeparation).toContain(
      "generic producer only",
    );
    expect(TPQR004_SCHEMA_SEAM.existingSourceSeparation).toContain(
      "no CRM-linked producer",
    );
  });

  it("existingSourceSeparation confirms Phase 3H adds CRM-linked and dedup", () => {
    expect(TPQR004_SCHEMA_SEAM.existingSourceSeparation).toContain(
      "Phase 3H sourceCustomerWaitingCandidates adds CRM-linked producer",
    );
  });

  it("blockingGaps includes function-to-DB seam gap", () => {
    expect(
      TPQR004_SCHEMA_SEAM.blockingGaps.some((g) =>
        g.includes("function-to-DB seam"),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Source file purity check
// ---------------------------------------------------------------------------

describe("phase3i-runtime-source-review.ts source file purity", () => {
  const sourceText = readFileSync(
    new URL("./phase3i-runtime-source-review.ts", import.meta.url),
    "utf-8",
  );

  it("has no @/ alias imports (no DB or service imports)", () => {
    expect(sourceText).not.toMatch(/from\s+["']@\//);
    expect(sourceText).not.toMatch(/require\s*\(\s*["']@\//);
  });

  it("has no Date.now() wall-clock calls (outside string literals)", () => {
    // Remove all string literals, then check for Date.now()
    const stripped = sourceText.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    expect(stripped).not.toContain("Date.now()");
  });

  it("has no filesystem or network imports", () => {
    expect(sourceText).not.toMatch(/from\s+["']fs["']/);
    expect(sourceText).not.toMatch(/from\s+["']node:fs["']/);
    expect(sourceText).not.toMatch(/from\s+["']http["']/);
    expect(sourceText).not.toMatch(/from\s+["']https["']/);
  });

  it("has no db import", () => {
    expect(sourceText).not.toContain('from "@/lib/db"');
    expect(sourceText).not.toContain("import { db }");
  });

  it("exports PHASE3I_RUNTIME_ADOPTION_POSTURE as No-Go literal", () => {
    expect(sourceText).toContain('"No-Go"');
    expect(PHASE3I_RUNTIME_ADOPTION_POSTURE).toBe("No-Go");
  });
});
