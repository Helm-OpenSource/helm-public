import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  PHASE3J_DEFAULT_ENABLED,
  PHASE3J_FORBIDDEN_FILES,
  PHASE3J_MODULE_PLAN_POSTURE,
  PHASE3J_NEXT_ALLOWED_WORK,
  PHASE3J_RULE_VERSION,
  PHASE3J_RUNTIME_ADOPTION_POSTURE,
  PHASE3J_FAMILY_PLANS,
  TPQR001_FAMILY_PLAN,
  TPQR003_FAMILY_PLAN,
  TPQR004_FAMILY_PLAN,
  evaluatePhase3jDisabledRuntimeSourcePlan,
} from "./phase3j-disabled-runtime-source-plan";

// ---------------------------------------------------------------------------
// Evaluator — top-level assertions
// ---------------------------------------------------------------------------

describe("evaluatePhase3jDisabledRuntimeSourcePlan", () => {
  const summary = evaluatePhase3jDisabledRuntimeSourcePlan();

  it("returns runtimeAdoptionPosture No-Go exactly", () => {
    expect(summary.runtimeAdoptionPosture).toBe(PHASE3J_RUNTIME_ADOPTION_POSTURE);
    expect(summary.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("returns modulePlanPosture Conditional-Go exactly", () => {
    expect(summary.modulePlanPosture).toBe(PHASE3J_MODULE_PLAN_POSTURE);
    expect(summary.modulePlanPosture).toBe("Conditional-Go");
  });

  it("returns nextAllowedWork exactly matching the exported constant", () => {
    expect(summary.nextAllowedWork).toBe(PHASE3J_NEXT_ALLOWED_WORK);
  });

  it("nextAllowedWork mentions Phase 3K and not production adoption", () => {
    expect(summary.nextAllowedWork).toContain("Phase 3K");
    expect(summary.nextAllowedWork).toContain("Must not allow production adoption");
  });

  it("nextAllowedWork mentions seam prototype or calibration fixture", () => {
    const mentionsSeam = summary.nextAllowedWork.includes("seam prototype");
    const mentionsCalibration = summary.nextAllowedWork.includes("calibration fixture");
    expect(mentionsSeam || mentionsCalibration).toBe(true);
  });

  it("nextAllowedWork enumerates forbidden paths", () => {
    expect(summary.nextAllowedWork).toContain("data/queries.ts");
    expect(summary.nextAllowedWork).toContain(
      "features/mobile/lib/mobile-command-read-model.ts",
    );
    expect(summary.nextAllowedWork).toContain("app/");
    expect(summary.nextAllowedWork).toContain("app/api/");
    expect(summary.nextAllowedWork).toContain("prisma/schema.prisma");
  });

  it("returns ruleVersion matching the exported constant", () => {
    expect(summary.ruleVersion).toBe(PHASE3J_RULE_VERSION);
  });

  it("has exactly 12 checks", () => {
    expect(summary.totalChecks).toBe(12);
    expect(summary.checks).toHaveLength(12);
  });

  it("all 12 checks pass", () => {
    expect(summary.allPassed).toBe(true);
    expect(summary.passed).toBe(12);
    const failed = summary.checks.filter((c) => !c.passed);
    expect(failed).toHaveLength(0);
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

  it("exports PHASE3J_FORBIDDEN_FILES matching summary.forbiddenFiles", () => {
    expect(summary.forbiddenFiles).toEqual(PHASE3J_FORBIDDEN_FILES);
  });
});

// ---------------------------------------------------------------------------
// Individual check names and pass status
// ---------------------------------------------------------------------------

describe("individual checks all pass with correct names", () => {
  const { checks } = evaluatePhase3jDisabledRuntimeSourcePlan();
  const byName = Object.fromEntries(checks.map((c) => [c.checkName, c]));

  const expectedCheckNames = [
    "all_families_disabled_by_default",
    "no_production_targets_allowed",
    "tpqr001_action_item_seam_plan_present",
    "tpqr003_commitment_explicit_clock_plan_present",
    "tpqr004_email_thread_dual_producer_plan_present",
    "workspace_scope_required_for_all",
    "capability_scope_required_for_all",
    "threshold_calibration_required_for_all",
    "audit_bundle_required_for_all",
    "test_seam_required_before_runtime",
    "runtime_adoption_posture_is_no_go",
    "next_allowed_work_is_not_production_adoption",
  ] as const;

  for (const name of expectedCheckNames) {
    it(`check '${name}' passes`, () => {
      const check = byName[name];
      expect(check, `check '${name}' not found`).toBeDefined();
      expect(check.passed, check?.detail).toBe(true);
    });
  }

  it("check names cover all 12 required checks exactly", () => {
    const names = checks.map((c) => c.checkName);
    for (const expected of expectedCheckNames) {
      expect(names).toContain(expected);
    }
    expect(names).toHaveLength(12);
  });
});

// ---------------------------------------------------------------------------
// PHASE3J_DEFAULT_ENABLED
// ---------------------------------------------------------------------------

describe("PHASE3J_DEFAULT_ENABLED", () => {
  it("is exactly false", () => {
    expect(PHASE3J_DEFAULT_ENABLED).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Family plan defaultEnabled=false
// ---------------------------------------------------------------------------

describe("family plan defaultEnabled", () => {
  it("TPQR001_FAMILY_PLAN defaultEnabled is false", () => {
    expect(TPQR001_FAMILY_PLAN.defaultEnabled).toBe(false);
  });

  it("TPQR003_FAMILY_PLAN defaultEnabled is false", () => {
    expect(TPQR003_FAMILY_PLAN.defaultEnabled).toBe(false);
  });

  it("TPQR004_FAMILY_PLAN defaultEnabled is false", () => {
    expect(TPQR004_FAMILY_PLAN.defaultEnabled).toBe(false);
  });

  it("all PHASE3J_FAMILY_PLANS have defaultEnabled=false", () => {
    for (const plan of PHASE3J_FAMILY_PLANS) {
      expect(plan.defaultEnabled, `${plan.tpqrId} defaultEnabled`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Family plan productionIntegrationAllowed=false
// ---------------------------------------------------------------------------

describe("family plan productionIntegrationAllowed", () => {
  it("TPQR001_FAMILY_PLAN productionIntegrationAllowed is false", () => {
    expect(TPQR001_FAMILY_PLAN.productionIntegrationAllowed).toBe(false);
  });

  it("TPQR003_FAMILY_PLAN productionIntegrationAllowed is false", () => {
    expect(TPQR003_FAMILY_PLAN.productionIntegrationAllowed).toBe(false);
  });

  it("TPQR004_FAMILY_PLAN productionIntegrationAllowed is false", () => {
    expect(TPQR004_FAMILY_PLAN.productionIntegrationAllowed).toBe(false);
  });

  it("all PHASE3J_FAMILY_PLANS have productionIntegrationAllowed=false", () => {
    for (const plan of PHASE3J_FAMILY_PLANS) {
      expect(
        plan.productionIntegrationAllowed,
        `${plan.tpqrId} productionIntegrationAllowed`,
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// forbiddenProductionTargets
// ---------------------------------------------------------------------------

describe("family plan forbiddenProductionTargets", () => {
  const requiredTargets = [
    "data/queries.ts",
    "features/mobile/lib/mobile-command-read-model.ts",
    "app/",
    "app/api/",
    "prisma/schema.prisma",
  ];

  for (const plan of [TPQR001_FAMILY_PLAN, TPQR003_FAMILY_PLAN, TPQR004_FAMILY_PLAN]) {
    for (const target of requiredTargets) {
      it(`${plan.tpqrId} forbiddenProductionTargets includes '${target}'`, () => {
        expect(plan.forbiddenProductionTargets).toContain(target);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// auditFieldsRequired
// ---------------------------------------------------------------------------

describe("family plan auditFieldsRequired", () => {
  const requiredFields = [
    "sourceRowId",
    "ruleVersion",
    "thresholdStatus",
    "exclusionReason",
    "workspaceId",
    "family",
  ];

  for (const plan of [TPQR001_FAMILY_PLAN, TPQR003_FAMILY_PLAN, TPQR004_FAMILY_PLAN]) {
    for (const field of requiredFields) {
      it(`${plan.tpqrId} auditFieldsRequired includes '${field}'`, () => {
        expect(plan.auditFieldsRequired).toContain(field);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// nextAllowedWork does not imply unguarded production adoption
// ---------------------------------------------------------------------------

describe("PHASE3J_NEXT_ALLOWED_WORK safety assertions", () => {
  it("explicitly states must not allow production adoption", () => {
    expect(PHASE3J_NEXT_ALLOWED_WORK).toContain("Must not allow production adoption");
  });

  it("does not contain bare 'production adoption' string without negation guard", () => {
    const lower = PHASE3J_NEXT_ALLOWED_WORK.toLowerCase();
    const idx = lower.indexOf("production adoption");
    if (idx !== -1) {
      const before = lower.slice(Math.max(0, idx - 20), idx);
      const hasNegation = before.includes("not") || before.includes("must not");
      expect(hasNegation).toBe(true);
    }
  });

  it("mentions defaultEnabled=false constraint", () => {
    expect(PHASE3J_NEXT_ALLOWED_WORK).toContain("defaultEnabled=false");
  });

  it("mentions productionIntegrationAllowed=false constraint", () => {
    expect(PHASE3J_NEXT_ALLOWED_WORK).toContain("productionIntegrationAllowed=false");
  });
});

// ---------------------------------------------------------------------------
// Source file purity check
// ---------------------------------------------------------------------------

describe("phase3j-disabled-runtime-source-plan.ts source file purity", () => {
  const sourceText = readFileSync(
    new URL("./phase3j-disabled-runtime-source-plan.ts", import.meta.url),
    "utf-8",
  );

  it("has no @/ alias imports (no DB or service imports)", () => {
    expect(sourceText).not.toMatch(/from\s+["']@\//);
    expect(sourceText).not.toMatch(/require\s*\(\s*["']@\//);
  });

  it("has no db import", () => {
    expect(sourceText).not.toContain('from "@/lib/db"');
    expect(sourceText).not.toContain("import { db }");
    expect(sourceText).not.toMatch(/import\s+.*\bdb\b.*from/);
  });

  it("has no Date.now() wall-clock calls (outside string literals)", () => {
    const stripped = sourceText.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
    expect(stripped).not.toContain("Date.now()");
  });

  it("has no filesystem imports", () => {
    expect(sourceText).not.toMatch(/from\s+["']fs["']/);
    expect(sourceText).not.toMatch(/from\s+["']node:fs["']/);
  });

  it("has no network imports", () => {
    expect(sourceText).not.toMatch(/from\s+["']http["']/);
    expect(sourceText).not.toMatch(/from\s+["']https["']/);
    expect(sourceText).not.toMatch(/from\s+["']node:http["']/);
    expect(sourceText).not.toMatch(/from\s+["']node:https["']/);
  });

  it("exports PHASE3J_RUNTIME_ADOPTION_POSTURE as No-Go literal", () => {
    expect(sourceText).toContain('"No-Go"');
    expect(PHASE3J_RUNTIME_ADOPTION_POSTURE).toBe("No-Go");
  });

  it("exports PHASE3J_MODULE_PLAN_POSTURE as Conditional-Go literal", () => {
    expect(sourceText).toContain('"Conditional-Go"');
    expect(PHASE3J_MODULE_PLAN_POSTURE).toBe("Conditional-Go");
  });

  it("does not contain forbidden production integration strings that imply implementation", () => {
    expect(sourceText).not.toContain("db.actionItem.findMany(");
    expect(sourceText).not.toContain("db.commitment.findMany(");
    expect(sourceText).not.toContain("db.emailThread.findMany(");
    expect(sourceText).not.toContain("prisma.actionItem");
    expect(sourceText).not.toContain("prisma.commitment");
    expect(sourceText).not.toContain("prisma.emailThread");
  });

  it("does not import from prisma client directly", () => {
    expect(sourceText).not.toMatch(/from\s+["']@prisma\/client["']/);
    expect(sourceText).not.toMatch(/from\s+["']\.\.\/\.\.\/prisma/);
  });

  it("has no imports at all (pure feature code)", () => {
    const importLines = sourceText
      .split("\n")
      .filter((line) => /^import\s/.test(line.trim()));
    expect(importLines).toHaveLength(0);
  });
});
