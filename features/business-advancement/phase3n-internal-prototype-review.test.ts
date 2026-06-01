import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  PHASE3N_EVIDENCE,
  PHASE3N_INTERNAL_PROTOTYPE_REVIEW_POSTURE,
  PHASE3N_NEXT_ALLOWED_WORK,
  PHASE3N_RULE_VERSION,
  PHASE3N_RUNTIME_ADOPTION_POSTURE,
  evaluatePhase3nInternalPrototypeReview,
} from "./phase3n-internal-prototype-review";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Phase 3N constants", () => {
  it("PHASE3N_RULE_VERSION is correct", () => {
    expect(PHASE3N_RULE_VERSION).toBe("phase3n-internal-prototype-review/v1");
  });

  it("PHASE3N_RUNTIME_ADOPTION_POSTURE is No-Go", () => {
    expect(PHASE3N_RUNTIME_ADOPTION_POSTURE).toBe("No-Go");
  });

  it("PHASE3N_INTERNAL_PROTOTYPE_REVIEW_POSTURE is Complete", () => {
    expect(PHASE3N_INTERNAL_PROTOTYPE_REVIEW_POSTURE).toBe("Complete");
  });

  it("PHASE3N_NEXT_ALLOWED_WORK requires real-data calibration before production adoption", () => {
    const lower = PHASE3N_NEXT_ALLOWED_WORK.toLowerCase();
    expect(lower).toMatch(/real-data calibration/);
    expect(lower).toMatch(/not production adoption now/);
    expect(lower).toMatch(/only after/);
    expect(lower).toMatch(/production query aggregator|app\//);
  });
});

// ---------------------------------------------------------------------------
// Phase 3M evidence assertions
// ---------------------------------------------------------------------------

describe("Phase 3N — Phase 3M evidence", () => {
  it("Phase 3M ruleVersion is correct", () => {
    expect(PHASE3N_EVIDENCE.phase3m.ruleVersion).toBe(
      "phase3m-disabled-internal-seam-prototype/v1",
    );
  });

  it("Phase 3M default flags are all false", () => {
    expect(PHASE3N_EVIDENCE.phase3m.defaultFlags.tpqr001).toBe(false);
    expect(PHASE3N_EVIDENCE.phase3m.defaultFlags.tpqr003).toBe(false);
    expect(PHASE3N_EVIDENCE.phase3m.defaultFlags.tpqr004).toBe(false);
  });

  it("Phase 3M has 3 capability gates all starting with helm.business-advancement.source.", () => {
    const caps = PHASE3N_EVIDENCE.phase3m.capabilityGates;
    expect(caps).toHaveLength(3);
    for (const c of caps) {
      expect(c).toMatch(/^helm\.business-advancement\.source\./);
    }
  });

  it("Phase 3M productionIntegrationAllowed is false", () => {
    expect(PHASE3N_EVIDENCE.phase3m.productionIntegrationAllowed).toBe(false);
  });

  it("Phase 3M prototypePosture is Conditional-Go", () => {
    expect(PHASE3N_EVIDENCE.phase3m.prototypePosture).toBe("Conditional-Go");
  });

  it("Phase 3M runtimeAdoptionPosture is No-Go", () => {
    expect(PHASE3N_EVIDENCE.phase3m.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("Phase 3M source purity evidence method references the test file", () => {
    expect(PHASE3N_EVIDENCE.phase3m.sourcePurity.evidenceMethod).toContain(
      "phase3m-disabled-internal-seam-prototype.test.ts",
    );
  });

  it("Phase 3M all source purity flags are true", () => {
    const p = PHASE3N_EVIDENCE.phase3m.sourcePurity;
    expect(p.noAtImport).toBe(true);
    expect(p.noDbImport).toBe(true);
    expect(p.noPrismaImport).toBe(true);
    expect(p.noDateNow).toBe(true);
    expect(p.noFsImport).toBe(true);
    expect(p.noNetworkImport).toBe(true);
    expect(p.noAppImport).toBe(true);
    expect(p.noDataQueriesImport).toBe(true);
    expect(p.noMobileReadModelImport).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TPQR-004 dedup fix evidence
// ---------------------------------------------------------------------------

describe("Phase 3N — TPQR-004 dedup fix evidence", () => {
  it("bug description mentions generic producer null filter fix", () => {
    expect(PHASE3N_EVIDENCE.tpqr004DedupFix.bugDescription).toContain(
      "opportunityId === null",
    );
  });

  it("regression coverage file is the Phase 3M test file", () => {
    expect(PHASE3N_EVIDENCE.tpqr004DedupFix.regressionCoveredIn).toContain(
      "phase3m-disabled-internal-seam-prototype.test.ts",
    );
  });

  it("test evidence mentions deduped_by_crm_linked", () => {
    expect(PHASE3N_EVIDENCE.tpqr004DedupFix.testEvidence).toContain(
      "deduped_by_crm_linked",
    );
  });
});

// ---------------------------------------------------------------------------
// Test run evidence
// ---------------------------------------------------------------------------

describe("Phase 3N — test run evidence", () => {
  it("test run shows 23 files", () => {
    expect(PHASE3N_EVIDENCE.testRun.files).toBe(23);
  });

  it("test run shows 807 tests", () => {
    expect(PHASE3N_EVIDENCE.testRun.tests).toBe(807);
  });

  it("test run status is PASS", () => {
    expect(PHASE3N_EVIDENCE.testRun.status).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// Quality checks evidence
// ---------------------------------------------------------------------------

describe("Phase 3N — quality checks evidence", () => {
  it("typecheck is PASS", () => {
    expect(PHASE3N_EVIDENCE.qualityChecks.typecheck).toBe("PASS");
  });

  it("check:boundaries is PASS", () => {
    expect(PHASE3N_EVIDENCE.qualityChecks.checkBoundaries).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// Remaining blockers
// ---------------------------------------------------------------------------

describe("Phase 3N — remaining blockers", () => {
  it("includes real DB row calibration missing", () => {
    const found = PHASE3N_EVIDENCE.remainingBlockers.some((b) =>
      b.includes("real DB row calibration missing"),
    );
    expect(found).toBe(true);
  });

  it("includes production capability registry not wired", () => {
    const found = PHASE3N_EVIDENCE.remainingBlockers.some((b) =>
      b.includes("production capability registry not wired"),
    );
    expect(found).toBe(true);
  });

  it("includes production query integration absent", () => {
    const found = PHASE3N_EVIDENCE.remainingBlockers.some((b) =>
      b.includes("production query integration absent"),
    );
    expect(found).toBe(true);
  });

  it("includes production query aggregator not integrated", () => {
    const found = PHASE3N_EVIDENCE.remainingBlockers.some((b) =>
      b.includes("production query aggregator"),
    );
    expect(found).toBe(true);
  });

  it("includes mobile command read model not touched", () => {
    const found = PHASE3N_EVIDENCE.remainingBlockers.some((b) =>
      b.includes("mobile command read model"),
    );
    expect(found).toBe(true);
  });

  it("has at least 5 blockers enumerated", () => {
    expect(PHASE3N_EVIDENCE.remainingBlockers.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Evaluator — all 10 checks present and named correctly
// ---------------------------------------------------------------------------

const EXPECTED_CHECK_NAMES = [
  "phase3m_feature_only_prototype_complete",
  "phase3m_disabled_by_default_and_capability_gated",
  "phase3m_production_integration_false",
  "phase3m_source_purity_verified",
  "tpqr004_dedup_regression_fixed",
  "business_advancement_tests_passed",
  "typecheck_and_boundary_checks_passed",
  "real_data_calibration_still_missing",
  "runtime_adoption_posture_is_no_go",
  "next_allowed_work_requires_real_data_before_production",
] as const;

describe("Phase 3N evaluator — check names and counts", () => {
  const result = evaluatePhase3nInternalPrototypeReview();

  it("returns exactly 10 checks", () => {
    expect(result.totalChecks).toBe(10);
    expect(result.checks).toHaveLength(10);
  });

  it("check names match expected exactly", () => {
    const names = result.checks.map((c) => c.name);
    for (const expected of EXPECTED_CHECK_NAMES) {
      expect(names).toContain(expected);
    }
    expect(names).toHaveLength(EXPECTED_CHECK_NAMES.length);
  });

  it("all 10 checks pass", () => {
    const failed = result.checks.filter((c) => !c.pass);
    expect(failed).toHaveLength(0);
  });

  it("allPass is true", () => {
    expect(result.allPass).toBe(true);
  });

  it("passedCount equals totalChecks", () => {
    expect(result.passedCount).toBe(result.totalChecks);
  });
});

// ---------------------------------------------------------------------------
// Evaluator — postures and constants on result
// ---------------------------------------------------------------------------

describe("Phase 3N evaluator — postures", () => {
  const result = evaluatePhase3nInternalPrototypeReview();

  it("ruleVersion is correct", () => {
    expect(result.ruleVersion).toBe("phase3n-internal-prototype-review/v1");
  });

  it("runtimeAdoptionPosture is No-Go", () => {
    expect(result.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("internalPrototypeReviewPosture is Complete", () => {
    expect(result.internalPrototypeReviewPosture).toBe("Complete");
  });

  it("nextAllowedWork requires real-data calibration before production", () => {
    const lower = result.nextAllowedWork.toLowerCase();
    expect(lower).toMatch(/real-data calibration/);
    expect(lower).toMatch(/not production adoption now/);
  });

  it("remainingBlockers contains real data calibration entry", () => {
    const found = result.remainingBlockers.some((b) =>
      b.includes("real DB row calibration missing"),
    );
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Individual check pass assertions
// ---------------------------------------------------------------------------

describe("Phase 3N evaluator — individual checks all pass", () => {
  const result = evaluatePhase3nInternalPrototypeReview();

  for (const name of EXPECTED_CHECK_NAMES) {
    it(`check "${name}" passes`, () => {
      const check = result.checks.find((c) => c.name === name);
      expect(check).toBeDefined();
      expect(check!.pass).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Source file purity checks
// ---------------------------------------------------------------------------

describe("Phase 3N source file purity", () => {
  const src = readFileSync(
    new URL(
      "./phase3n-internal-prototype-review.ts",
      import.meta.url,
    ),
    "utf-8",
  );

  it("has no @/ import", () => {
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/import\s+["']@\//);
  });

  it("has no db import", () => {
    expect(src).not.toMatch(/from\s+["']db["']/);
    expect(src).not.toMatch(/require\s*\(\s*["']db["']\s*\)/);
  });

  it("has no prisma import", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*prisma[^"']*["']/i);
  });

  it("has no Date.now() call (no wall-clock read)", () => {
    // Only detect actual calls, not string literals containing the phrase
    expect(src).not.toMatch(/[^'"`]Date\.now\s*\(\s*\)/);
  });

  it("has no fs import", () => {
    expect(src).not.toMatch(/from\s+["']fs["']/);
    expect(src).not.toMatch(/from\s+["']node:fs["']/);
  });

  it("has no network import (http/https/fetch/axios)", () => {
    expect(src).not.toMatch(/from\s+["'](https?|axios|node-fetch|got)["']/);
  });

  it("has no app/ import", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*\/app\//);
  });

  it("has no production-query-aggregator import", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*data\/queries/);
  });

  it("has no mobile read-model import", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*mobile-command-read-model/);
  });
});
