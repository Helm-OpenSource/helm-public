/**
 * Phase 3R offline production runtime adoption preflight gate.
 *
 * Reads a redacted snapshot JSON from --input <file> or stdin.
 * Accepts either a Phase 3O evidencePack object or a Phase 3P --print-json
 * object by reusing runPhase3qSnapshotIntakeReview. Sensitive or invalid input
 * is rejected through Phase 3Q rejection behavior (exit 1).
 *
 * productionRuntimeAdoptionReviewReady is true only when:
 *   - Phase 3Q intake passes (no sensitive keys, no email-like values, valid shape)
 *   - evidencePack.sampleKind === "redacted_live_db_snapshot"
 *   - evaluation.realDataValidated === true
 *   - evaluation.productionCalibrationComplete === true
 *   - evaluation.blockers.length === 0
 *
 * Even when ready, productionAdoptionAllowed and runtimeIntegrationAllowed remain
 * false always. The allowed next step is manual production runtime adoption review
 * only — no auto-execution, no auto-approve, no direct production adoption.
 *
 * Exit codes:
 *   0 — productionRuntimeAdoptionReviewReady true
 *   1 — invalid/sensitive/input format error
 *   2 — valid input but not ready for production runtime adoption review
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  Phase3qRejectionError,
  runPhase3qSnapshotIntakeReview,
  type Phase3qReviewResult,
} from "./business-advancement-phase3q-snapshot-intake-review";

export const PHASE3R_RULE_VERSION =
  "phase3r-runtime-adoption-preflight/v1" as const;

export const PHASE3R_RUNTIME_ADOPTION_POSTURE = "No-Go" as const;

export const PHASE3R_NEXT_STEP_READY =
  "Manual production runtime adoption review only. No direct production adoption, no auto-execution, no runtimeIntegrationAllowed, no auto-approve." as const;

export const PHASE3R_NEXT_STEP_NOT_READY =
  "Resolve all blockers and provide a clean redacted_live_db_snapshot that passes Phase 3Q intake, then re-run this preflight gate." as const;

export interface Phase3rPreflightResult {
  readonly ruleVersion: typeof PHASE3R_RULE_VERSION;
  readonly runtimeAdoptionPosture: typeof PHASE3R_RUNTIME_ADOPTION_POSTURE;
  readonly productionRuntimeAdoptionReviewReady: boolean;
  readonly productionAdoptionAllowed: false;
  readonly runtimeIntegrationAllowed: false;
  readonly blockedReasons: readonly string[];
  readonly allowedNextStep: string;
}

/**
 * Pure preflight evaluator. Throws Phase3qRejectionError for sensitive input,
 * throws Error for invalid format. Returns Phase3rPreflightResult for valid input.
 *
 * Even a passing result has productionAdoptionAllowed=false always.
 */
export function evaluatePhase3rRuntimeAdoptionPreflight(
  parsed: unknown,
): Phase3rPreflightResult {
  // Delegates Phase 3Q intake (sensitive scan + extraction + Phase 3O evaluation).
  // Throws Phase3qRejectionError for sensitive keys/values; throws Error for invalid shape.
  const phase3qResult: Phase3qReviewResult =
    runPhase3qSnapshotIntakeReview(parsed);

  const { evidencePack, evaluation } = phase3qResult;
  const blockedReasons: string[] = [];

  if (evidencePack.sampleKind !== "redacted_live_db_snapshot") {
    blockedReasons.push(
      `sampleKind is "${evidencePack.sampleKind}"; must be "redacted_live_db_snapshot" for production runtime adoption review.`,
    );
  }

  if (!evaluation.realDataValidated) {
    blockedReasons.push(
      "evaluation.realDataValidated is false; real-data calibration has not been completed.",
    );
  }

  if (!evaluation.productionCalibrationComplete) {
    blockedReasons.push(
      "evaluation.productionCalibrationComplete is false; production calibration has not been completed.",
    );
  }

  for (const blocker of evaluation.blockers) {
    blockedReasons.push(`Phase 3O blocker: ${blocker}`);
  }

  const productionRuntimeAdoptionReviewReady = blockedReasons.length === 0;

  return {
    ruleVersion: PHASE3R_RULE_VERSION,
    runtimeAdoptionPosture: PHASE3R_RUNTIME_ADOPTION_POSTURE,
    productionRuntimeAdoptionReviewReady,
    productionAdoptionAllowed: false,
    runtimeIntegrationAllowed: false,
    blockedReasons,
    allowedNextStep: productionRuntimeAdoptionReviewReady
      ? PHASE3R_NEXT_STEP_READY
      : PHASE3R_NEXT_STEP_NOT_READY,
  };
}

function readInput(argv: readonly string[]): string {
  const idx = argv.indexOf("--input");
  if (idx !== -1) {
    const filePath = argv[idx + 1];
    if (!filePath) {
      throw new Error("--input requires a file path argument.");
    }
    return readFileSync(filePath, "utf-8");
  }
  return readFileSync(0, "utf-8");
}

function printSummary(result: Phase3rPreflightResult): void {
  console.log("=== Phase 3R Production Runtime Adoption Preflight ===");
  console.log(`ruleVersion:                          ${result.ruleVersion}`);
  console.log(`runtimeAdoptionPosture:               ${result.runtimeAdoptionPosture}`);
  console.log(`productionRuntimeAdoptionReviewReady: ${String(result.productionRuntimeAdoptionReviewReady)}`);
  console.log(`productionAdoptionAllowed:            ${String(result.productionAdoptionAllowed)}`);
  console.log(`runtimeIntegrationAllowed:            ${String(result.runtimeIntegrationAllowed)}`);
  console.log("");
  console.log(`blockedReasons (${result.blockedReasons.length}):`);
  for (const reason of result.blockedReasons) {
    console.log(`  - ${reason}`);
  }
  console.log("");
  console.log(`allowedNextStep: ${result.allowedNextStep}`);
  console.log("");
  console.log(
    "No files were written. No DB access. Runtime adoption remains No-Go.",
  );
}

function main(): void {
  const argv = process.argv.slice(2);

  let rawInput: string;
  try {
    rawInput = readInput(argv);
  } catch (error) {
    console.error(
      `Failed to read input: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawInput);
  } catch {
    console.error("Input is not valid JSON.");
    process.exit(1);
  }

  let result: Phase3rPreflightResult;
  try {
    result = evaluatePhase3rRuntimeAdoptionPreflight(parsed);
  } catch (error) {
    if (error instanceof Phase3qRejectionError) {
      console.error(
        "=== Phase 3R Preflight Rejected: Sensitive Input Detected ===",
      );
      for (const err of error.validation.errors) {
        console.error(`  ERROR: ${err}`);
      }
      console.error(
        "Re-run Phase 3P redacted snapshot collector to produce a clean redacted snapshot.",
      );
    } else {
      console.error(
        `Invalid input format: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    process.exit(1);
  }

  const printJson = argv.includes("--print-json");

  if (printJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printSummary(result);
  }

  if (result.productionRuntimeAdoptionReviewReady) {
    process.exit(0);
  } else {
    process.exit(2);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
