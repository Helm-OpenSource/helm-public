import { describe, expect, it } from "vitest";
import {
  RUNTIME_GUARD_RESOLUTION_PLAN,
  evaluateRuntimeGuardResolutionPlan,
} from "./runtime-guard-resolution-plan";

const REQUIRED_SOURCE_PHASE3_CHECK_IDS = [
  "PF3-002",
  "PF3-003",
  "PF3-004",
  "PF3-005",
] as const;

const FORBIDDEN_AUTHORIZATION_PATTERNS = [
  "may add a schema",
  "may add schema",
  "may create schema",
  "may add runtime extractor",
  "may add a runtime extractor",
  "may create extractor",
  "may add event queue",
  "may create event queue",
  "authorizes official write",
  "may auto-write",
  "may auto write",
  "grants execution authority",
  "may auto-send",
  "may auto send",
  "may auto-approve",
  "may auto approve",
  "llm may determine",
  "llm may rank",
  "may change page behavior",
  "may add api route",
] as const;

const TPQR003_FORBIDDEN_OUTDATED_PATTERNS = [
  "zero matches",
  "no matches",
  "no typescript references",
  "not maintained",
  "never written",
  "schema-only",
] as const;

const REQUIRED_BOUNDARY_DISTINCTIONS = [
  "recommendation != commitment",
  "explanation != approval",
  "draft != send",
  "proof != external write success",
] as const;

describe("RUNTIME_GUARD_RESOLUTION_PLAN", () => {
  it("contains exactly 4 guard-resolution rows", () => {
    expect(RUNTIME_GUARD_RESOLUTION_PLAN).toHaveLength(4);
  });

  it("represents PF3-002, PF3-003, PF3-004, PF3-005 each exactly once", () => {
    for (const id of REQUIRED_SOURCE_PHASE3_CHECK_IDS) {
      const matches = RUNTIME_GUARD_RESOLUTION_PLAN.filter(
        (r) => r.sourcePhase3CheckId === id,
      );
      expect(matches, `${id} must appear exactly once`).toHaveLength(1);
    }
  });

  it("intentionally excludes PF3-001 (already ready_for_thin_read_model_planning)", () => {
    const violation = RUNTIME_GUARD_RESOLUTION_PLAN.find(
      (r) => r.sourcePhase3CheckId === "PF3-001",
    );
    expect(
      violation,
      "PF3-001 must NOT appear in Phase 3A guard-resolution rows",
    ).toBeUndefined();
  });

  it("every row has a non-empty evidenceToCollect", () => {
    for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
      expect(
        row.evidenceToCollect.length,
        `${row.guardId}: evidenceToCollect must be non-empty`,
      ).toBeGreaterThan(0);
      for (const item of row.evidenceToCollect) {
        expect(item.trim()).not.toBe("");
      }
    }
  });

  it("every row has a non-empty acceptedResolutionCriteria", () => {
    for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
      expect(
        row.acceptedResolutionCriteria.length,
        `${row.guardId}: acceptedResolutionCriteria must be non-empty`,
      ).toBeGreaterThan(0);
      for (const item of row.acceptedResolutionCriteria) {
        expect(item.trim()).not.toBe("");
      }
    }
  });

  it("every row has a non-empty stopConditions", () => {
    for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
      expect(
        row.stopConditions.length,
        `${row.guardId}: stopConditions must be non-empty`,
      ).toBeGreaterThan(0);
      for (const item of row.stopConditions) {
        expect(item.trim()).not.toBe("");
      }
    }
  });

  it("every row has a non-empty nextWorkOrder", () => {
    for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
      expect(
        row.nextWorkOrder.length,
        `${row.guardId}: nextWorkOrder must be non-empty`,
      ).toBeGreaterThan(0);
      for (const item of row.nextWorkOrder) {
        expect(item.trim()).not.toBe("");
      }
    }
  });

  it("every row has a non-empty boundaryNotes", () => {
    for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
      expect(
        row.boundaryNotes.length,
        `${row.guardId}: boundaryNotes must be non-empty`,
      ).toBeGreaterThan(0);
      for (const item of row.boundaryNotes) {
        expect(item.trim()).not.toBe("");
      }
    }
  });

  it("every row's runtimeImplementationAllowed and schemaChangeAllowed are false", () => {
    for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
      expect(
        row.runtimeImplementationAllowed,
        `${row.guardId}: runtimeImplementationAllowed must be false`,
      ).toBe(false);
      expect(
        row.schemaChangeAllowed,
        `${row.guardId}: schemaChangeAllowed must be false`,
      ).toBe(false);
    }
  });

  it("every row's currentStatus is conditional_requires_runtime_guard", () => {
    for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
      expect(row.currentStatus).toBe("conditional_requires_runtime_guard");
    }
  });

  it("PF3A-003 does not contain false outdated wording about overdueFlag", () => {
    const row = RUNTIME_GUARD_RESOLUTION_PLAN.find(
      (r) => r.sourcePhase3CheckId === "PF3-003",
    );
    expect(row).toBeDefined();
    const combined = [
      ...row!.evidenceToCollect,
      ...row!.acceptedResolutionCriteria,
      ...row!.stopConditions,
      ...row!.nextWorkOrder,
      ...row!.boundaryNotes,
    ]
      .join(" \n ")
      .toLowerCase();
    for (const pattern of TPQR003_FORBIDDEN_OUTDATED_PATTERNS) {
      expect(
        combined.includes(pattern),
        `PF3A-003 must not contain outdated wording "${pattern}"`,
      ).toBe(false);
    }
  });

  it("PF3A-003 cites the actual repo truth for overdueFlag", () => {
    const row = RUNTIME_GUARD_RESOLUTION_PLAN.find(
      (r) => r.sourcePhase3CheckId === "PF3-003",
    );
    expect(row).toBeDefined();
    const combined = [
      ...row!.evidenceToCollect,
      ...row!.acceptedResolutionCriteria,
      ...row!.stopConditions,
      ...row!.nextWorkOrder,
      ...row!.boundaryNotes,
    ]
      .join(" \n ")
      .toLowerCase();
    expect(combined.includes("deriveoverdueflag")).toBe(true);
    expect(combined.includes("commitment.service.ts:72")).toBe(true);
    expect(combined.includes("commitment.service.ts:112")).toBe(true);
    expect(combined.includes("commitment.service.ts:194")).toBe(true);
    expect(combined.includes("data/queries.ts:351")).toBe(true);
    expect(combined.includes("features/meetings/queries.ts:437")).toBe(true);
    expect(
      combined.includes("actively defined"),
      "PF3A-003 must restate that overdueFlag is actively defined/derived/written/read",
    ).toBe(true);
  });

  it("PF3A-003 contains the safe query-planning direction (dueDate/status heuristic or deriveOverdueFlag-style)", () => {
    const row = RUNTIME_GUARD_RESOLUTION_PLAN.find(
      (r) => r.sourcePhase3CheckId === "PF3-003",
    );
    expect(row).toBeDefined();
    const combined = [
      ...row!.evidenceToCollect,
      ...row!.acceptedResolutionCriteria,
      ...row!.stopConditions,
      ...row!.nextWorkOrder,
      ...row!.boundaryNotes,
    ]
      .join(" \n ")
      .toLowerCase();
    const hasSafeDirection =
      combined.includes("duedate/status heuristic") ||
      combined.includes("duedate/status") ||
      combined.includes("deriveoverdueflag-style") ||
      combined.includes("deriveoverdueflag read-time derivation");
    expect(
      hasSafeDirection,
      "PF3A-003 must name the dueDate/status heuristic or deriveOverdueFlag-style derivation as the safe planning direction",
    ).toBe(true);
    const guardsAgainstSole =
      combined.includes("only time-sensitive filter") ||
      combined.includes("sole time-sensitive filter") ||
      combined.includes("only runtime filter") ||
      combined.includes("sole runtime filter") ||
      combined.includes("only as the only time-sensitive filter");
    expect(
      guardsAgainstSole,
      "PF3A-003 must guard against using persisted overdueFlag as the only time-sensitive filter",
    ).toBe(true);
  });

  it("no row authorizes auto-write, auto-send, execution authority, LLM ranking, or schema design", () => {
    for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
      const fields: string[] = [
        ...row.evidenceToCollect,
        ...row.acceptedResolutionCriteria,
        ...row.stopConditions,
        ...row.nextWorkOrder,
        ...row.boundaryNotes,
      ];
      for (const field of fields) {
        const lower = field.toLowerCase();
        for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
          expect(
            lower.includes(pattern),
            `${row.guardId}: field contains forbidden authorization pattern "${pattern}"`,
          ).toBe(false);
        }
      }
    }
  });

  it("every row's boundaryNotes preserve recommendation/explanation/draft/proof distinctions", () => {
    for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
      const combined = row.boundaryNotes.join(" \n ").toLowerCase();
      for (const phrase of REQUIRED_BOUNDARY_DISTINCTIONS) {
        expect(
          combined.includes(phrase),
          `${row.guardId}: boundaryNotes must include "${phrase}"`,
        ).toBe(true);
      }
    }
  });

  it("every row's resolutionClass is one of the allowed planning vocabulary values", () => {
    const allowed = new Set([
      "no_schema_plan_ready",
      "requires_source_audit",
      "requires_dedup_design",
      "requires_readout_derivation_design",
      "requires_separate_schema_review",
    ]);
    for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
      expect(
        allowed.has(row.resolutionClass),
        `${row.guardId}: resolutionClass "${row.resolutionClass}" must be in the allowed vocabulary`,
      ).toBe(true);
    }
  });

  it("PF3A-004 is classified as requires_dedup_design", () => {
    const row = RUNTIME_GUARD_RESOLUTION_PLAN.find(
      (r) => r.sourcePhase3CheckId === "PF3-004",
    );
    expect(row).toBeDefined();
    expect(row!.resolutionClass).toBe("requires_dedup_design");
  });

  it("PF3A-005 is classified as requires_readout_derivation_design", () => {
    const row = RUNTIME_GUARD_RESOLUTION_PLAN.find(
      (r) => r.sourcePhase3CheckId === "PF3-005",
    );
    expect(row).toBeDefined();
    expect(row!.resolutionClass).toBe("requires_readout_derivation_design");
  });

  it("PF3A-002 is classified as requires_source_audit", () => {
    const row = RUNTIME_GUARD_RESOLUTION_PLAN.find(
      (r) => r.sourcePhase3CheckId === "PF3-002",
    );
    expect(row).toBeDefined();
    expect(row!.resolutionClass).toBe("requires_source_audit");
  });

  it("PF3A-003 is classified as requires_separate_schema_review (any maintenance path is out of Phase 3A scope)", () => {
    const row = RUNTIME_GUARD_RESOLUTION_PLAN.find(
      (r) => r.sourcePhase3CheckId === "PF3-003",
    );
    expect(row).toBeDefined();
    expect(row!.resolutionClass).toBe("requires_separate_schema_review");
  });
});

describe("evaluateRuntimeGuardResolutionPlan", () => {
  it("all evaluator checks pass", () => {
    const result = evaluateRuntimeGuardResolutionPlan();
    const failed = result.checks.filter((c) => !c.passed);
    expect(
      failed,
      `Failed checks: ${failed.map((c) => `${c.checkName}: ${c.detail}`).join("; ")}`,
    ).toHaveLength(0);
    expect(result.allPassed).toBe(true);
  });

  it("totalRows is 4", () => {
    const result = evaluateRuntimeGuardResolutionPlan();
    expect(result.totalRows).toBe(4);
  });

  it("has 9 evaluator checks", () => {
    const result = evaluateRuntimeGuardResolutionPlan();
    expect(result.checks).toHaveLength(9);
  });
});
