import { describe, it, expect } from "vitest";
import {
  evaluatePhase3lDisabledSeamPrototypeReview,
  PHASE3L_SEAM_REVIEW_PLANS,
  PHASE3L_NEXT_ALLOWED_WORK,
  TPQR003_SEAM_REVIEW_PLAN,
  TPQR004_SEAM_REVIEW_PLAN,
} from "./phase3l-disabled-seam-prototype-review";

describe("Phase 3L Disabled Seam Prototype Review", () => {
  it("evaluator returns exactly 12 checks", () => {
    const result = evaluatePhase3lDisabledSeamPrototypeReview();
    expect(result.checks).toHaveLength(12);
  });

  it("all 12 checks pass", () => {
    const result = evaluatePhase3lDisabledSeamPrototypeReview();
    const failing = result.checks.filter((c) => !c.pass);
    expect(failing).toHaveLength(0);
  });

  it("allPass is true", () => {
    const result = evaluatePhase3lDisabledSeamPrototypeReview();
    expect(result.allPass).toBe(true);
  });

  it("check names are exactly the expected 12", () => {
    const result = evaluatePhase3lDisabledSeamPrototypeReview();
    const names = result.checks.map((c) => c.name);
    expect(names).toEqual([
      "all_plans_disabled_by_default",
      "all_plans_production_integration_false",
      "all_plans_read_only",
      "all_plans_require_workspace_scope",
      "all_plans_require_capability",
      "tpqr001_action_item_approval_task_absence_seam_reviewed",
      "tpqr003_explicit_reference_clock_and_no_persisted_flag_authority_reviewed",
      "tpqr004_dual_producer_email_thread_dedup_reviewed",
      "test_seam_requirements_defined_for_all",
      "forbidden_production_targets_enumerated",
      "runtime_adoption_posture_is_no_go",
      "next_allowed_work_is_disabled_feature_only_not_production",
    ]);
  });

  describe("all plans — posture invariants", () => {
    it("every plan has defaultEnabled=false", () => {
      for (const plan of PHASE3L_SEAM_REVIEW_PLANS) {
        expect(plan.defaultEnabled).toBe(false);
      }
    });

    it("every plan has readOnly=true", () => {
      for (const plan of PHASE3L_SEAM_REVIEW_PLANS) {
        expect(plan.readOnly).toBe(true);
      }
    });

    it("every plan has productionIntegrationAllowed=false", () => {
      for (const plan of PHASE3L_SEAM_REVIEW_PLANS) {
        expect(plan.productionIntegrationAllowed).toBe(false);
      }
    });

    it("every plan has workspaceScopeRequired=true", () => {
      for (const plan of PHASE3L_SEAM_REVIEW_PLANS) {
        expect(plan.workspaceScopeRequired).toBe(true);
      }
    });

    it("every plan has non-empty capabilityRequired", () => {
      for (const plan of PHASE3L_SEAM_REVIEW_PLANS) {
        expect(plan.capabilityRequired.length).toBeGreaterThan(0);
      }
    });

    it("every plan blockedProductionTargets includes data/queries.ts", () => {
      for (const plan of PHASE3L_SEAM_REVIEW_PLANS) {
        expect(plan.blockedProductionTargets).toContain("data/queries.ts");
      }
    });

    it("every plan blockedProductionTargets includes app/", () => {
      for (const plan of PHASE3L_SEAM_REVIEW_PLANS) {
        expect(plan.blockedProductionTargets).toContain("app/");
      }
    });

    it("every plan blockedProductionTargets includes app/api/", () => {
      for (const plan of PHASE3L_SEAM_REVIEW_PLANS) {
        expect(plan.blockedProductionTargets).toContain("app/api/");
      }
    });

    it("every plan blockedProductionTargets includes prisma/schema.prisma", () => {
      for (const plan of PHASE3L_SEAM_REVIEW_PLANS) {
        expect(plan.blockedProductionTargets).toContain("prisma/schema.prisma");
      }
    });

    it("every plan blockedProductionTargets includes features/mobile/lib/mobile-command-read-model.ts", () => {
      for (const plan of PHASE3L_SEAM_REVIEW_PLANS) {
        expect(plan.blockedProductionTargets).toContain(
          "features/mobile/lib/mobile-command-read-model.ts",
        );
      }
    });
  });

  describe("TPQR-003 specific assertions", () => {
    it("persistedFlagAuthorityAllowed=false", () => {
      expect(TPQR003_SEAM_REVIEW_PLAN.persistedFlagAuthorityAllowed).toBe(false);
    });

    it("referenceClockRequired=true", () => {
      expect(TPQR003_SEAM_REVIEW_PLAN.referenceClockRequired).toBe(true);
    });
  });

  describe("TPQR-004 specific assertions", () => {
    it("dualProducerRequired=true", () => {
      expect(TPQR004_SEAM_REVIEW_PLAN.dualProducerRequired).toBe(true);
    });

    it("referenceClockRequired=false", () => {
      expect(TPQR004_SEAM_REVIEW_PLAN.referenceClockRequired).toBe(false);
    });
  });

  describe("nextAllowedWork", () => {
    it("mentions Phase 3M", () => {
      expect(PHASE3L_NEXT_ALLOWED_WORK.toLowerCase()).toContain("phase 3m");
    });

    it("mentions feature-only", () => {
      expect(PHASE3L_NEXT_ALLOWED_WORK.toLowerCase()).toContain("feature-only");
    });

    it("mentions defaultEnabled=false", () => {
      expect(PHASE3L_NEXT_ALLOWED_WORK.toLowerCase()).toContain(
        "defaultenabled=false",
      );
    });

    it("explicitly says not production adoption", () => {
      expect(PHASE3L_NEXT_ALLOWED_WORK.toLowerCase()).toContain(
        "not production adoption",
      );
    });
  });

  describe("source purity — feature file has no runtime side-effects", () => {
    it("feature file source contains no @/ path alias imports", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync(
        new URL("./phase3l-disabled-seam-prototype-review.ts", import.meta.url)
          .pathname,
        "utf8",
      );
      expect(src).not.toMatch(/from\s+['"]@\//);
    });

    it("feature file source contains no db import", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync(
        new URL("./phase3l-disabled-seam-prototype-review.ts", import.meta.url)
          .pathname,
        "utf8",
      );
      expect(src).not.toMatch(/from\s+['"][^'"]*\bdb\b/);
      expect(src).not.toMatch(/import\s+.*\bprisma\b/i);
    });

    it("feature file source contains no Date.now() call", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync(
        new URL("./phase3l-disabled-seam-prototype-review.ts", import.meta.url)
          .pathname,
        "utf8",
      );
      // Strip string literal contents so mentions inside data strings don't trip the check.
      const stripped = src.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""').replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''");
      expect(stripped).not.toMatch(/Date\.now\(\)/);
    });

    it("feature file source contains no fs or network imports", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync(
        new URL("./phase3l-disabled-seam-prototype-review.ts", import.meta.url)
          .pathname,
        "utf8",
      );
      expect(src).not.toMatch(/from\s+['"]fs['"]/);
      expect(src).not.toMatch(/from\s+['"]node:fs['"]/);
      expect(src).not.toMatch(/from\s+['"]https?:['"]/);
      expect(src).not.toMatch(/require\s*\(\s*['"]fs['"]/);
    });

    it("feature file source has no top-level import statements", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync(
        new URL("./phase3l-disabled-seam-prototype-review.ts", import.meta.url)
          .pathname,
        "utf8",
      );
      expect(src).not.toMatch(/^import\s+/m);
    });

    it("feature file source contains no executable Prisma query strings", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync(
        new URL("./phase3l-disabled-seam-prototype-review.ts", import.meta.url)
          .pathname,
        "utf8",
      );
      expect(src).not.toMatch(/\.findMany\s*\(/);
      expect(src).not.toMatch(/\.findFirst\s*\(/);
      expect(src).not.toMatch(/\.create\s*\(/);
      expect(src).not.toMatch(/\.update\s*\(/);
      expect(src).not.toMatch(/\.delete\s*\(/);
    });
  });
});
