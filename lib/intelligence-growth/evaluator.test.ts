import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildEvalReport,
  DIMENSION_FIXTURE_MAP,
  runDimensionValidation,
  runEval,
  validateFixtureCase,
} from "./evaluator";

const ROOT = path.resolve(__dirname, "../..");

// ── Per-case validation ────────────────────────────────────────────────────────

describe("validateFixtureCase", () => {
  const BASE_POSITIVE = {
    id: "test-001",
    dimension: "context",
    input: { workspaceId: "tenant-alpha", dimension: "context", evalRunId: "r1", evidenceRefs: [] },
    expected: { decision: "learning_candidate", reason: "ok", boundaryViolations: [] },
    isNegativeBoundary: false,
  };

  it("passes a valid positive case", () => {
    const result = validateFixtureCase(BASE_POSITIVE, "fake.json");
    expect(result.passed).toBe(true);
  });

  it("passes a valid negative boundary case with review_required", () => {
    const c = {
      ...BASE_POSITIVE,
      expected: { ...BASE_POSITIVE.expected, decision: "review_required" },
      isNegativeBoundary: true,
    };
    expect(validateFixtureCase(c, "fake.json").passed).toBe(true);
  });

  it("passes a valid negative boundary case with rejected", () => {
    const c = {
      ...BASE_POSITIVE,
      expected: { ...BASE_POSITIVE.expected, decision: "rejected" },
      isNegativeBoundary: true,
    };
    expect(validateFixtureCase(c, "fake.json").passed).toBe(true);
  });

  it("fails when a required field is missing", () => {
    const { id: _id, ...noId } = BASE_POSITIVE;
    const result = validateFixtureCase(noId, "fake.json");
    expect(result.passed).toBe(false);
    expect((result as { passed: false; reason: string }).reason).toMatch(/id/);
  });

  it("fails when expected.decision is not a valid GrowthDecision", () => {
    const c = { ...BASE_POSITIVE, expected: { ...BASE_POSITIVE.expected, decision: "unknown_decision" } };
    const result = validateFixtureCase(c, "fake.json");
    expect(result.passed).toBe(false);
    expect((result as { passed: false; reason: string }).reason).toMatch(/GrowthDecision/);
  });

  it("fails when expected.decision is an unsafe promoting value", () => {
    for (const bad of ["approved", "auto_promote", "production_ready", "active", "promoted"]) {
      const c = { ...BASE_POSITIVE, expected: { ...BASE_POSITIVE.expected, decision: bad } };
      const result = validateFixtureCase(c, "fake.json");
      expect(result.passed).toBe(false);
      expect((result as { passed: false; reason: string }).reason).toMatch(/auto-promotion/);
    }
  });

  it("fails when negative boundary case has decision learning_candidate (invalid negative decision)", () => {
    const c = {
      ...BASE_POSITIVE,
      expected: { ...BASE_POSITIVE.expected, decision: "learning_candidate" },
      isNegativeBoundary: true,
    };
    const result = validateFixtureCase(c, "fake.json");
    expect(result.passed).toBe(false);
    expect((result as { passed: false; reason: string }).reason).toMatch(/negative boundary/);
  });

  it("fails when negative boundary case has decision watch_only (invalid negative decision)", () => {
    const c = {
      ...BASE_POSITIVE,
      expected: { ...BASE_POSITIVE.expected, decision: "watch_only" },
      isNegativeBoundary: true,
    };
    const result = validateFixtureCase(c, "fake.json");
    expect(result.passed).toBe(false);
  });

  it("fails when positive case has decision rejected", () => {
    const c = {
      ...BASE_POSITIVE,
      expected: { ...BASE_POSITIVE.expected, decision: "rejected" },
      isNegativeBoundary: false,
    };
    const result = validateFixtureCase(c, "fake.json");
    expect(result.passed).toBe(false);
    expect((result as { passed: false; reason: string }).reason).toMatch(/positive case/);
  });

  it("fails when input contains an unsafe workspaceId", () => {
    const c = {
      ...BASE_POSITIVE,
      input: { ...BASE_POSITIVE.input, workspaceId: "prod-workspace-real" },
    };
    const result = validateFixtureCase(c, "fake.json");
    expect(result.passed).toBe(false);
    expect((result as { passed: false; reason: string }).reason).toMatch(/unsafe workspaceId/);
  });

  it("fails when nested workspaceId is unsafe", () => {
    const c = {
      ...BASE_POSITIVE,
      input: {
        ...BASE_POSITIVE.input,
        objectRef: { kind: "opportunity", id: "opp-1", workspaceId: "real-tenant-123" },
      },
    };
    const result = validateFixtureCase(c, "fake.json");
    expect(result.passed).toBe(false);
    expect((result as { passed: false; reason: string }).reason).toMatch(/unsafe workspaceId/);
  });

  it("fails when boundaryViolations contains an invalid NoGoBoundary", () => {
    const c = {
      ...BASE_POSITIVE,
      expected: { ...BASE_POSITIVE.expected, boundaryViolations: ["no_db_schema", "invalid_boundary"] },
    };
    const result = validateFixtureCase(c, "fake.json");
    expect(result.passed).toBe(false);
    expect((result as { passed: false; reason: string }).reason).toMatch(/invalid boundaryViolation/);
  });

  it("passes with valid boundaryViolations entries", () => {
    const c = {
      ...BASE_POSITIVE,
      expected: {
        ...BASE_POSITIVE.expected,
        decision: "review_required",
        boundaryViolations: ["no_db_schema", "no_api"],
      },
      isNegativeBoundary: true,
    };
    expect(validateFixtureCase(c, "fake.json").passed).toBe(true);
  });
});

// ── Dimension-level runner ─────────────────────────────────────────────────────

describe("runDimensionValidation", () => {
  const goodCase = {
    id: "d-001",
    dimension: "memory",
    input: { dimension: "memory", evalRunId: "r1", workspaceId: "tenant-beta", evidenceRefs: [] },
    expected: { decision: "watch_only", reason: "ok", boundaryViolations: [] },
    isNegativeBoundary: false,
  };
  const badCase = {
    ...goodCase,
    id: "d-002",
    expected: { ...goodCase.expected, decision: "learning_candidate" },
    isNegativeBoundary: true,
  };

  it("returns all passed when all cases are valid", () => {
    const { result, failures } = runDimensionValidation("memory", [goodCase], "f.json");
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.autoPromoteCount).toBe(0);
    expect(result.productionWriteCount).toBe(0);
    expect(failures).toHaveLength(0);
  });

  it("records failure for invalid case", () => {
    const { result, failures } = runDimensionValidation("memory", [goodCase, badCase], "f.json");
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("d-002");
  });

  it("always sets autoPromoteCount=0 and productionWriteCount=0", () => {
    const { result } = runDimensionValidation("memory", [goodCase, badCase], "f.json");
    expect(result.autoPromoteCount).toBe(0);
    expect(result.productionWriteCount).toBe(0);
  });
});

// ── buildEvalReport ────────────────────────────────────────────────────────────

describe("buildEvalReport", () => {
  it("always sets runtimeAdoptionAllowed=false and reviewFirstStatus=enforced", () => {
    const report = buildEvalReport([], []);
    expect(report.summary.runtimeAdoptionAllowed).toBe(false);
    expect(report.summary.reviewFirstStatus).toBe("enforced");
    expect(report.summary.autoPromoteCount).toBe(0);
    expect(report.summary.productionWriteCount).toBe(0);
  });
});

// ── All real fixture cases pass ────────────────────────────────────────────────

describe("all fixture files pass validation", () => {
  for (const [dim, relPath] of Object.entries(DIMENSION_FIXTURE_MAP)) {
    it(`dimension ${dim} — all cases pass`, () => {
      const absPath = path.join(ROOT, relPath);
      const cases = JSON.parse(readFileSync(absPath, "utf8")) as unknown[];
      expect(cases.length).toBeGreaterThan(0);

      for (const c of cases) {
        const result = validateFixtureCase(c, absPath);
        if (!result.passed) {
          const id = (c as Record<string, unknown>).id ?? "unknown";
          throw new Error(
            `Fixture ${String(id)} in ${relPath} failed validation: ${(result as { passed: false; reason: string }).reason}`,
          );
        }
      }
    });
  }
});

// ── runEval integration ────────────────────────────────────────────────────────

describe("runEval", () => {
  it("runs all 10 dimensions and returns a report with no failures", () => {
    const report = runEval({ root: ROOT });
    expect(report.dimensions).toHaveLength(10);
    expect(report.summary.totalFailed).toBe(0);
    expect(report.summary.autoPromoteCount).toBe(0);
    expect(report.summary.productionWriteCount).toBe(0);
    expect(report.summary.runtimeAdoptionAllowed).toBe(false);
    expect(report.summary.reviewFirstStatus).toBe("enforced");
    expect(report.failures).toHaveLength(0);
  });

  it("filters by dimension", () => {
    const report = runEval({ dimension: "context", root: ROOT });
    expect(report.dimensions).toHaveLength(1);
    expect(report.dimensions[0].dimension).toBe("context");
    expect(report.dimensions[0].failed).toBe(0);
  });

  it("filters by input file", () => {
    const absPath = path.join(ROOT, DIMENSION_FIXTURE_MAP.routing);
    const report = runEval({ inputFile: absPath, root: ROOT });
    expect(report.dimensions).toHaveLength(1);
    expect(report.dimensions[0].dimension).toBe("routing");
    expect(report.dimensions[0].failed).toBe(0);
  });

  it("detects synthetic invalid negative boundary decision", () => {
    const syntheticCases = [
      {
        id: "syn-001",
        dimension: "context",
        input: { dimension: "context", evalRunId: "r1", workspaceId: "tenant-alpha", evidenceRefs: [] },
        expected: { decision: "learning_candidate", reason: "bad negative", boundaryViolations: [] },
        isNegativeBoundary: true,
      },
    ];
    const json = JSON.stringify(syntheticCases);
    const { result, failures } = runDimensionValidation(
      "context",
      JSON.parse(json) as unknown[],
      "synthetic.json",
    );
    expect(result.failed).toBe(1);
    expect(failures[0].reason).toMatch(/negative boundary/);
  });

  it("detects unsafe workspaceId", () => {
    const syntheticCases = [
      {
        id: "syn-002",
        dimension: "routing",
        input: { dimension: "routing", evalRunId: "r1", workspaceId: "prod-real-tenant", evidenceRefs: [] },
        expected: { decision: "watch_only", reason: "bad wid", boundaryViolations: [] },
        isNegativeBoundary: false,
      },
    ];
    const { result, failures } = runDimensionValidation(
      "routing",
      JSON.parse(JSON.stringify(syntheticCases)) as unknown[],
      "synthetic.json",
    );
    expect(result.failed).toBe(1);
    expect(failures[0].reason).toMatch(/unsafe workspaceId/);
  });

  it("--output-json: writes a valid report file to a temp directory", () => {
    const actualDir = path.join(os.tmpdir(), `igs-eval-test-${Date.now()}`);
    mkdirSync(actualDir, { recursive: true });
    const outputPath = path.join(actualDir, "reports", "latest.json");

    try {
      // Simulate what the CLI does: run eval, write to output path
      const report = runEval({ dimension: "context", root: ROOT });
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");

      expect(existsSync(outputPath)).toBe(true);

      const written = JSON.parse(readFileSync(outputPath, "utf8")) as typeof report;
      expect(written.summary.runtimeAdoptionAllowed).toBe(false);
      expect(written.summary.reviewFirstStatus).toBe("enforced");
      expect(written.summary.autoPromoteCount).toBe(0);
      expect(written.summary.productionWriteCount).toBe(0);
      expect(typeof written.runAt).toBe("string");
    } finally {
      rmSync(actualDir, { recursive: true, force: true });
    }
  });
});
