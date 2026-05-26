import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  PHASE3K_RULE_VERSION,
  PHASE3K_RUNTIME_ADOPTION_POSTURE,
  PHASE3K_FIXTURE_PACK_POSTURE,
  PHASE3K_REAL_DATA_CALIBRATION_COMPLETE,
  PHASE3K_NEXT_ALLOWED_WORK,
  tpqr001FamilyResult,
  tpqr003FamilyResult,
  tpqr004FamilyResult,
  evaluatePhase3kThresholdCalibrationFixtures,
} from "./phase3k-threshold-calibration-fixtures";

const FEATURE_SOURCE = readFileSync(
  resolve(__dirname, "phase3k-threshold-calibration-fixtures.ts"),
  "utf-8"
);

const EXPECTED_CHECK_NAMES = [
  "tpqr001_fixture_thresholds_cover_24_48_72",
  "tpqr001_conservative_default_is_72h",
  "tpqr001_false_positive_guard_passes",
  "tpqr003_binary_predicate_fixture_validated_without_persisted_flag",
  "tpqr004_dual_producer_dedup_fixture_validated",
  "all_families_real_data_validated_false",
  "production_calibration_complete_false_for_all",
  "runtime_adoption_posture_is_no_go",
  "next_allowed_work_is_not_production_adoption",
  "no_runtime_or_production_targets",
];

describe("Phase 3K threshold calibration fixtures — posture constants", () => {
  it("exports correct rule version", () => {
    expect(PHASE3K_RULE_VERSION).toBe("phase3k-threshold-calibration-fixtures/v1");
  });

  it("runtime adoption posture is No-Go", () => {
    expect(PHASE3K_RUNTIME_ADOPTION_POSTURE).toBe("No-Go");
  });

  it("fixture pack posture is Conditional-Go", () => {
    expect(PHASE3K_FIXTURE_PACK_POSTURE).toBe("Conditional-Go");
  });

  it("real data calibration complete is false", () => {
    expect(PHASE3K_REAL_DATA_CALIBRATION_COMPLETE).toBe(false);
  });

  it("next allowed work is not production adoption and references Phase 3L or real-data calibration", () => {
    const lower = PHASE3K_NEXT_ALLOWED_WORK.toLowerCase();
    expect(lower).toContain("not production adoption");
    expect(lower.includes("phase 3l") || lower.includes("real-data calibration")).toBe(true);
  });
});

describe("Phase 3K threshold calibration fixtures — TPQR-001", () => {
  it("covers threshold candidates 24h, 48h, 72h", () => {
    const labels = tpqr001FamilyResult.thresholdCandidates.map((c) => c.labelHuman);
    expect(labels).toContain("24h");
    expect(labels).toContain("48h");
    expect(labels).toContain("72h");
  });

  it("conservative default is 72h (259200000ms)", () => {
    expect(tpqr001FamilyResult.conservativeFixtureDefaultMs).toBe(259200000);
    expect(tpqr001FamilyResult.conservativeFixtureDefaultHuman).toBe("72h");
  });

  it("72h candidate false positive rate is below 0.1", () => {
    const candidate = tpqr001FamilyResult.thresholdCandidates.find(
      (c) => c.labelHuman === "72h"
    );
    expect(candidate).toBeDefined();
    expect(candidate!.syntheticFalsePositiveRate).toBeLessThan(0.1);
  });

  it("has synthetic labelled scenarios", () => {
    expect(tpqr001FamilyResult.syntheticLabelledScenarios.length).toBeGreaterThan(0);
  });

  it("scenarios use actionItemAgeMs and expectedBlockedDecisionCandidateByFixture fields", () => {
    for (const s of tpqr001FamilyResult.syntheticLabelledScenarios) {
      expect(typeof s.actionItemAgeMs).toBe("number");
      expect(typeof s.expectedBlockedDecisionCandidateByFixture).toBe("boolean");
      expect(typeof s.hasApprovalTask).toBe("boolean");
      expect(typeof s.workspaceMatches).toBe("boolean");
    }
  });

  it("includes at least one workspace mismatch scenario that is not a candidate", () => {
    const workspaceMismatches = tpqr001FamilyResult.syntheticLabelledScenarios.filter(
      (s) => s.workspaceMatches === false
    );
    expect(workspaceMismatches.length).toBeGreaterThanOrEqual(1);
    for (const s of workspaceMismatches) {
      expect(s.expectedBlockedDecisionCandidateByFixture).toBe(false);
    }
  });

  it("includes at least one hasApprovalTask=true exclusion scenario that is not a candidate", () => {
    const withApprovalTask = tpqr001FamilyResult.syntheticLabelledScenarios.filter(
      (s) => s.hasApprovalTask === true
    );
    expect(withApprovalTask.length).toBeGreaterThanOrEqual(1);
    for (const s of withApprovalTask) {
      expect(s.expectedBlockedDecisionCandidateByFixture).toBe(false);
    }
  });

  it("realDataValidated is false", () => {
    expect(tpqr001FamilyResult.realDataValidated).toBe(false);
  });

  it("productionCalibrationComplete is false", () => {
    expect(tpqr001FamilyResult.productionCalibrationComplete).toBe(false);
  });

  it("runtimeAdoptionPosture is No-Go", () => {
    expect(tpqr001FamilyResult.runtimeAdoptionPosture).toBe("No-Go");
  });
});

describe("Phase 3K threshold calibration fixtures — TPQR-003", () => {
  it("binary predicate validated", () => {
    expect(tpqr003FamilyResult.binaryPredicateValidated).toBe(true);
  });

  it("no scenario has persistedOverdueFlagAuthority=true", () => {
    for (const s of tpqr003FamilyResult.syntheticScenarios) {
      expect(s.persistedOverdueFlagAuthority).toBe(false);
    }
  });

  it("family-level persistedOverdueFlagAuthority is false", () => {
    expect(tpqr003FamilyResult.persistedOverdueFlagAuthority).toBe(false);
  });

  it("realDataValidated is false", () => {
    expect(tpqr003FamilyResult.realDataValidated).toBe(false);
  });

  it("productionCalibrationComplete is false", () => {
    expect(tpqr003FamilyResult.productionCalibrationComplete).toBe(false);
  });

  it("runtimeAdoptionPosture is No-Go", () => {
    expect(tpqr003FamilyResult.runtimeAdoptionPosture).toBe("No-Go");
  });
});

describe("Phase 3K threshold calibration fixtures — TPQR-004", () => {
  it("dual producer dedup validated", () => {
    expect(tpqr004FamilyResult.dualProducerDedupValidated).toBe(true);
  });

  it("all dedup scenarios expect single deduplicated result", () => {
    for (const s of tpqr004FamilyResult.dedupScenarios) {
      expect(s.expectDeduplicatedToSingle).toBe(true);
    }
  });

  it("all scenarios are in WAITING_US stage", () => {
    for (const s of tpqr004FamilyResult.dedupScenarios) {
      expect(s.stageName).toBe("WAITING_US");
    }
  });

  it("dedup is keyed by emailThreadId not commitment identity", () => {
    const descLower = tpqr004FamilyResult.description.toLowerCase();
    expect(descLower).toContain("emailthreadid");
    for (const s of tpqr004FamilyResult.dedupScenarios) {
      expect(s.notes.toLowerCase()).toContain("emailthreadid");
    }
  });

  it("realDataValidated is false", () => {
    expect(tpqr004FamilyResult.realDataValidated).toBe(false);
  });

  it("productionCalibrationComplete is false", () => {
    expect(tpqr004FamilyResult.productionCalibrationComplete).toBe(false);
  });

  it("runtimeAdoptionPosture is No-Go", () => {
    expect(tpqr004FamilyResult.runtimeAdoptionPosture).toBe("No-Go");
  });
});

describe("Phase 3K threshold calibration fixtures — evaluator", () => {
  it("returns all 10 expected check names", () => {
    const result = evaluatePhase3kThresholdCalibrationFixtures();
    const names = result.checks.map((c) => c.name);
    expect(names).toHaveLength(10);
    for (const expected of EXPECTED_CHECK_NAMES) {
      expect(names).toContain(expected);
    }
  });

  it("all 10 checks pass", () => {
    const result = evaluatePhase3kThresholdCalibrationFixtures();
    for (const check of result.checks) {
      expect(check.pass, `check ${check.name} should pass: ${check.detail}`).toBe(true);
    }
  });

  it("allPass is true", () => {
    const result = evaluatePhase3kThresholdCalibrationFixtures();
    expect(result.allPass).toBe(true);
  });

  it("runtimeAdoptionPosture in result is No-Go", () => {
    const result = evaluatePhase3kThresholdCalibrationFixtures();
    expect(result.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("family summaries all have realDataValidated=false and productionCalibrationComplete=false", () => {
    const result = evaluatePhase3kThresholdCalibrationFixtures();
    for (const [family, summary] of Object.entries(result.familySummaries)) {
      expect(summary.realDataValidated, `${family} realDataValidated`).toBe(false);
      expect(summary.productionCalibrationComplete, `${family} productionCalibrationComplete`).toBe(
        false
      );
    }
  });
});

describe("Phase 3K — source text purity", () => {
  it("feature file has no import statements", () => {
    const importLines = FEATURE_SOURCE.split("\n").filter((line) =>
      /^\s*import\s/.test(line)
    );
    expect(importLines).toHaveLength(0);
  });

  it("feature file has no @/ path alias", () => {
    expect(FEATURE_SOURCE).not.toMatch(/@\//);
  });

  it("feature file has no db import or prisma client import", () => {
    expect(FEATURE_SOURCE).not.toMatch(/from\s+['"].*prisma/i);
    expect(FEATURE_SOURCE).not.toMatch(/from\s+['"].*@prisma/i);
    expect(FEATURE_SOURCE).not.toMatch(/from\s+['"].*db['"]/i);
  });

  it("feature file has no Date.now() call", () => {
    expect(FEATURE_SOURCE).not.toMatch(/Date\.now\s*\(/);
  });

  it("feature file has no fs or network imports", () => {
    expect(FEATURE_SOURCE).not.toMatch(/from\s+['"]fs['"]/);
    expect(FEATURE_SOURCE).not.toMatch(/from\s+['"]node:fs['"]/);
    expect(FEATURE_SOURCE).not.toMatch(/from\s+['"]http[s]?['"]/);
    expect(FEATURE_SOURCE).not.toMatch(/from\s+['"]node:http['"]/);
    expect(FEATURE_SOURCE).not.toMatch(/require\s*\(/);
  });

  it("feature file has no executable Prisma query strings", () => {
    expect(FEATURE_SOURCE).not.toMatch(/prisma\.\w+\.(findMany|findFirst|create|update|delete)/);
  });

  it("feature file does not contain 'Overdue commitment' text", () => {
    expect(FEATURE_SOURCE).not.toMatch(/Overdue commitment/i);
  });

  it("feature file does not contain 'commitmentAgeMs' field", () => {
    expect(FEATURE_SOURCE).not.toMatch(/commitmentAgeMs/);
  });
});
