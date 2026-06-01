// IGS P0 Slice C — deterministic offline evaluator.
// No DB, no fetch, no LLM APIs — fixture-only, review-first, candidate-only.

import { readFileSync } from "node:fs";
import path from "node:path";

import type { IntelligenceDimension } from "./types";

// ── Constants ──────────────────────────────────────────────────────────────────

const ALLOWED_DECISIONS = new Set([
  "learning_candidate",
  "watch_only",
  "review_required",
  "rejected",
]);

const UNSAFE_PROMOTING_VALUES = new Set([
  "approved",
  "auto_promote",
  "production_ready",
  "active",
  "promoted",
]);

const ALLOWED_NO_GO_BOUNDARIES = new Set([
  "no_db_schema",
  "no_api",
  "no_ui",
  "no_production_prompt_change",
  "no_runtime_self_learning",
]);

const ALLOWED_WORKSPACE_IDS = new Set([
  "tenant-alpha",
  "tenant-beta",
  "tenant-gamma",
]);

// ── Dimension → fixture file map ───────────────────────────────────────────────

export const DIMENSION_FIXTURE_MAP: Record<IntelligenceDimension, string> = {
  context:
    "evals/intelligence-growth/context/context-growth-cases.json",
  object_signal:
    "evals/intelligence-growth/object-signal/object-signal-growth-cases.json",
  memory:
    "evals/intelligence-growth/memory/memory-growth-cases.json",
  routing:
    "evals/intelligence-growth/routing/routing-growth-cases.json",
  action_outcome:
    "evals/intelligence-growth/action-outcome/action-outcome-cases.json",
  worker_skill:
    "evals/intelligence-growth/worker-skill/worker-skill-growth-cases.json",
  prompt_policy:
    "evals/intelligence-growth/prompt-policy/prompt-policy-growth-cases.json",
  eval_replay:
    "evals/intelligence-growth/eval-replay/eval-replay-growth-cases.json",
  tenant_personalization:
    "evals/intelligence-growth/tenant-personalization/tenant-personalization-cases.json",
  cost_model_tool:
    "evals/intelligence-growth/cost-model-tool/cost-model-tool-cases.json",
};

// ── Report types ───────────────────────────────────────────────────────────────

export type DimensionResult = {
  readonly dimension: string;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly boundaryViolations: number;
  readonly autoPromoteCount: 0;
  readonly productionWriteCount: 0;
};

export type FailureEntry = {
  readonly file: string;
  readonly id: string;
  readonly reason: string;
};

export type EvalReport = {
  readonly runAt: string;
  readonly dimensions: readonly DimensionResult[];
  readonly failures: readonly FailureEntry[];
  readonly summary: {
    readonly total: number;
    readonly totalPassed: number;
    readonly totalFailed: number;
    readonly autoPromoteCount: 0;
    readonly productionWriteCount: 0;
    readonly runtimeAdoptionAllowed: false;
    readonly reviewFirstStatus: "enforced";
  };
};

export type CaseValidationResult =
  | { readonly passed: true }
  | { readonly passed: false; readonly reason: string };

// ── Internal helpers ───────────────────────────────────────────────────────────

function collectWorkspaceIds(obj: unknown): string[] {
  if (!obj || typeof obj !== "object") return [];
  const ids: string[] = [];
  if (Array.isArray(obj)) {
    for (const item of obj) ids.push(...collectWorkspaceIds(item));
  } else {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (key === "workspaceId" && typeof val === "string") ids.push(val);
      ids.push(...collectWorkspaceIds(val));
    }
  }
  return ids;
}

// ── Core per-case validation ───────────────────────────────────────────────────

export function validateFixtureCase(
  raw: unknown,
  _filePath: string,
): CaseValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { passed: false, reason: "case is not a plain object" };
  }
  const c = raw as Record<string, unknown>;

  for (const field of [
    "id",
    "dimension",
    "input",
    "expected",
    "isNegativeBoundary",
  ]) {
    if (!(field in c)) {
      return { passed: false, reason: `missing required field: ${field}` };
    }
  }

  const expected = c.expected;
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
    return { passed: false, reason: "expected is not a plain object" };
  }
  const exp = expected as Record<string, unknown>;

  const decision = String(exp.decision ?? "");

  if (UNSAFE_PROMOTING_VALUES.has(decision)) {
    return {
      passed: false,
      reason: `expected.decision "${decision}" implies auto-promotion and is not allowed`,
    };
  }
  if (!ALLOWED_DECISIONS.has(decision)) {
    return {
      passed: false,
      reason: `expected.decision "${decision}" is not a valid GrowthDecision`,
    };
  }

  const isNeg = Boolean(c.isNegativeBoundary);

  if (isNeg && decision !== "review_required" && decision !== "rejected") {
    return {
      passed: false,
      reason: `negative boundary case must have decision "review_required" or "rejected", got "${decision}"`,
    };
  }
  if (!isNeg && decision === "rejected") {
    return {
      passed: false,
      reason: `positive case (isNegativeBoundary=false) must not have decision "rejected"`,
    };
  }

  const wids = collectWorkspaceIds(c.input);
  for (const wid of wids) {
    if (!ALLOWED_WORKSPACE_IDS.has(wid)) {
      return {
        passed: false,
        reason: `unsafe workspaceId "${wid}" found in input (must be tenant-alpha, tenant-beta, or tenant-gamma)`,
      };
    }
  }

  const bvs = exp.boundaryViolations;
  if (Array.isArray(bvs)) {
    for (const bv of bvs) {
      if (!ALLOWED_NO_GO_BOUNDARIES.has(String(bv))) {
        return {
          passed: false,
          reason: `invalid boundaryViolation value "${bv}"`,
        };
      }
    }
  }

  return { passed: true };
}

// ── Dimension-level runner ─────────────────────────────────────────────────────

export function runDimensionValidation(
  dimensionId: string,
  cases: unknown[],
  filePath: string,
): { result: DimensionResult; failures: FailureEntry[] } {
  let passed = 0;
  let failed = 0;
  let boundaryViolations = 0;
  const failures: FailureEntry[] = [];

  for (const c of cases) {
    const v = validateFixtureCase(c, filePath);
    if (v.passed) {
      passed++;
      const exp = (c as Record<string, unknown>)?.expected;
      if (exp && typeof exp === "object") {
        const bvs = (exp as Record<string, unknown>).boundaryViolations;
        if (Array.isArray(bvs)) boundaryViolations += bvs.length;
      }
    } else {
      failed++;
      const id = (c as Record<string, unknown>)?.id
        ? String((c as Record<string, unknown>).id)
        : "unknown";
      failures.push({ file: filePath, id, reason: v.reason });
    }
  }

  return {
    result: {
      dimension: dimensionId,
      total: cases.length,
      passed,
      failed,
      boundaryViolations,
      autoPromoteCount: 0,
      productionWriteCount: 0,
    },
    failures,
  };
}

// ── Report builder ─────────────────────────────────────────────────────────────

export function buildEvalReport(
  dimensionResults: DimensionResult[],
  failures: FailureEntry[],
): EvalReport {
  const total = dimensionResults.reduce((s, d) => s + d.total, 0);
  const totalPassed = dimensionResults.reduce((s, d) => s + d.passed, 0);
  const totalFailed = dimensionResults.reduce((s, d) => s + d.failed, 0);

  return {
    runAt: new Date().toISOString(),
    dimensions: dimensionResults,
    failures,
    summary: {
      total,
      totalPassed,
      totalFailed,
      autoPromoteCount: 0,
      productionWriteCount: 0,
      runtimeAdoptionAllowed: false,
      reviewFirstStatus: "enforced",
    },
  };
}

// ── Top-level eval runner ─────────────────────────────────────────────────────

export type EvalRunOptions = {
  readonly dimension?: IntelligenceDimension;
  readonly inputFile?: string;
  readonly root?: string;
};

export function runEval(
  options: EvalRunOptions = {},
  readFile: (filePath: string) => string = (p) => readFileSync(p, "utf8"),
): EvalReport {
  const root = options.root ?? process.cwd();

  type FileSpec = { dimension: string; filePath: string };
  let specs: FileSpec[];

  if (options.inputFile) {
    const absPath = path.isAbsolute(options.inputFile)
      ? options.inputFile
      : path.join(root, options.inputFile);
    const raw = JSON.parse(readFile(absPath)) as unknown[];
    const dim =
      raw.length > 0
        ? String((raw[0] as Record<string, unknown>).dimension ?? "unknown")
        : "unknown";
    specs = [{ dimension: dim, filePath: absPath }];
  } else if (options.dimension) {
    const rel = DIMENSION_FIXTURE_MAP[options.dimension];
    specs = [{ dimension: options.dimension, filePath: path.join(root, rel) }];
  } else {
    specs = (
      Object.entries(DIMENSION_FIXTURE_MAP) as [IntelligenceDimension, string][]
    ).map(([dim, rel]) => ({
      dimension: dim,
      filePath: path.join(root, rel),
    }));
  }

  const allResults: DimensionResult[] = [];
  const allFailures: FailureEntry[] = [];

  for (const { dimension, filePath } of specs) {
    const cases = JSON.parse(readFile(filePath)) as unknown[];
    const { result, failures } = runDimensionValidation(
      dimension,
      cases,
      filePath,
    );
    allResults.push(result);
    allFailures.push(...failures);
  }

  return buildEvalReport(allResults, allFailures);
}
