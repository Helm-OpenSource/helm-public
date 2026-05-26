/**
 * Phase 3Q offline redacted snapshot intake review.
 *
 * Reads a redacted snapshot JSON from --input <file> or stdin.
 * Accepts either a Phase 3O evidencePack object or a Phase 3P --print-json
 * object (which wraps the evidencePack). Rejects inputs containing raw
 * sensitive keys or raw email-like string values, then runs
 * evaluatePhase3oRealDataCalibrationEvidencePack and prints a summary.
 *
 * Exits nonzero on invalid or sensitive input. No DB, no network, no
 * file writes, no runtime integration.
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  evaluatePhase3oRealDataCalibrationEvidencePack,
  type Phase3oEvidencePackInput,
  type Phase3oEvaluationResult,
} from "../features/business-advancement/phase3o-real-data-calibration-evidence-pack";

export const PHASE3Q_RULE_VERSION =
  "phase3q-snapshot-intake-review/v1" as const;

export const PHASE3Q_RUNTIME_ADOPTION_POSTURE = "No-Go" as const;

export const PHASE3Q_SENSITIVE_KEYS = [
  "title",
  "description",
  "subject",
  "body",
  "email",
  "counterpart",
  "participants",
  "summary",
  "secret",
  "token",
] as const;

const EMAIL_LIKE_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

export function scanSensitiveKeys(value: unknown, path = ""): string[] {
  const found: string[] = [];
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        found.push(...scanSensitiveKeys(value[i], `${path}[${i}]`));
      }
    } else {
      for (const [key, val] of Object.entries(
        value as Record<string, unknown>,
      )) {
        const keyPath = path ? `${path}.${key}` : key;
        if (
          (PHASE3Q_SENSITIVE_KEYS as readonly string[]).includes(
            key.toLowerCase(),
          )
        ) {
          found.push(keyPath);
        }
        found.push(...scanSensitiveKeys(val, keyPath));
      }
    }
  }
  return found;
}

export function scanSensitiveEmailValues(value: unknown, path = ""): string[] {
  const found: string[] = [];
  if (typeof value === "string") {
    if (EMAIL_LIKE_PATTERN.test(value)) {
      found.push(path);
    }
  } else if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        found.push(
          ...scanSensitiveEmailValues(value[i], `${path}[${i}]`),
        );
      }
    } else {
      for (const [key, val] of Object.entries(
        value as Record<string, unknown>,
      )) {
        const keyPath = path ? `${path}.${key}` : key;
        found.push(...scanSensitiveEmailValues(val, keyPath));
      }
    }
  }
  return found;
}

export interface Phase3qValidationResult {
  readonly valid: boolean;
  readonly sensitiveKeys: readonly string[];
  readonly sensitiveEmailValues: readonly string[];
  readonly errors: readonly string[];
}

export function validateSnapshotInput(parsed: unknown): Phase3qValidationResult {
  const sensitiveKeys = scanSensitiveKeys(parsed);
  const sensitiveEmailValues = scanSensitiveEmailValues(parsed);
  const errors: string[] = [];

  if (sensitiveKeys.length > 0) {
    errors.push(
      `Raw sensitive keys found at: ${sensitiveKeys.join(", ")}`,
    );
  }
  if (sensitiveEmailValues.length > 0) {
    errors.push(
      `Raw email-like values found at paths: ${sensitiveEmailValues.join(", ")}`,
    );
  }

  return {
    valid: errors.length === 0,
    sensitiveKeys,
    sensitiveEmailValues,
    errors,
  };
}

export function extractEvidencePack(parsed: unknown): Phase3oEvidencePackInput {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Input JSON must be a non-null object.");
  }

  const obj = parsed as Record<string, unknown>;

  // Phase 3P --print-json format: { evidencePack: {...}, evaluation: {...} }
  if ("evidencePack" in obj) {
    const ep = obj.evidencePack;
    if (ep === null || typeof ep !== "object" || Array.isArray(ep)) {
      throw new Error("evidencePack field must be a non-null object.");
    }
    return ep as Phase3oEvidencePackInput;
  }

  // Phase 3O direct evidencePack object: { sampleKind, workspaceId, referenceClockMs, rows }
  if (
    "sampleKind" in obj &&
    "workspaceId" in obj &&
    "referenceClockMs" in obj &&
    "rows" in obj
  ) {
    return obj as unknown as Phase3oEvidencePackInput;
  }

  throw new Error(
    "Input must be either a Phase 3O evidencePack object " +
      "(with sampleKind/workspaceId/referenceClockMs/rows) " +
      "or a Phase 3P --print-json object (with evidencePack key).",
  );
}

export interface Phase3qReviewResult {
  readonly ruleVersion: typeof PHASE3Q_RULE_VERSION;
  readonly runtimeAdoptionPosture: typeof PHASE3Q_RUNTIME_ADOPTION_POSTURE;
  readonly validation: Phase3qValidationResult;
  readonly evidencePack: Phase3oEvidencePackInput;
  readonly evaluation: Phase3oEvaluationResult;
}

export class Phase3qRejectionError extends Error {
  readonly validation: Phase3qValidationResult;
  constructor(validation: Phase3qValidationResult) {
    super(`Phase 3Q intake rejected: ${validation.errors.join("; ")}`);
    this.name = "Phase3qRejectionError";
    this.validation = validation;
  }
}

export function runPhase3qSnapshotIntakeReview(
  parsed: unknown,
): Phase3qReviewResult {
  const validation = validateSnapshotInput(parsed);
  if (!validation.valid) {
    throw new Phase3qRejectionError(validation);
  }

  const evidencePack = extractEvidencePack(parsed);
  const evaluation =
    evaluatePhase3oRealDataCalibrationEvidencePack(evidencePack);

  return {
    ruleVersion: PHASE3Q_RULE_VERSION,
    runtimeAdoptionPosture: PHASE3Q_RUNTIME_ADOPTION_POSTURE,
    validation,
    evidencePack,
    evaluation,
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
  // Read from stdin (file descriptor 0)
  return readFileSync(0, "utf-8");
}

function printSummary(result: Phase3qReviewResult): void {
  const { evidencePack, evaluation, validation } = result;
  console.log("=== Phase 3Q Snapshot Intake Review ===");
  console.log(`ruleVersion:            ${result.ruleVersion}`);
  console.log(`runtimeAdoptionPosture: ${result.runtimeAdoptionPosture}`);
  console.log(`sampleKind:             ${evidencePack.sampleKind}`);
  console.log(`workspaceId:            ${evidencePack.workspaceId}`);
  console.log(`referenceClockMs:       ${evidencePack.referenceClockMs}`);
  console.log("");
  console.log("--- Validation ---");
  console.log(
    `sensitiveKeys:          ${validation.sensitiveKeys.length > 0 ? validation.sensitiveKeys.join(", ") : "none"}`,
  );
  console.log(
    `sensitiveEmailValues:   ${validation.sensitiveEmailValues.length > 0 ? validation.sensitiveEmailValues.join(", ") : "none"}`,
  );
  console.log(`valid:                  ${String(validation.valid)}`);
  console.log("");
  console.log("--- Phase 3O Evaluation ---");
  console.log(
    `realDataValidated:             ${String(evaluation.realDataValidated)}`,
  );
  console.log(
    `productionCalibrationComplete: ${String(evaluation.productionCalibrationComplete)}`,
  );
  console.log("");
  for (const family of [
    evaluation.tpqr001,
    evaluation.tpqr003,
    evaluation.tpqr004,
  ]) {
    console.log(
      `${family.tpqrId}: rows=${family.rowCount} included=${family.includedCount} excluded=${family.excludedCount} checksPass=${String(family.checksPass)} calibrated=${String(family.calibrated)}`,
    );
  }
  console.log("");
  console.log(`blockers (${evaluation.blockers.length}):`);
  for (const blocker of evaluation.blockers) {
    console.log(`  - ${blocker}`);
  }
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

  const validation = validateSnapshotInput(parsed);
  if (!validation.valid) {
    console.error(
      "=== Phase 3Q Intake Rejected: Sensitive Input Detected ===",
    );
    for (const err of validation.errors) {
      console.error(`  ERROR: ${err}`);
    }
    console.error(
      "Re-run Phase 3P redacted snapshot collector to produce a clean redacted snapshot.",
    );
    process.exit(1);
  }

  let evidencePack: Phase3oEvidencePackInput;
  try {
    evidencePack = extractEvidencePack(parsed);
  } catch (error) {
    console.error(
      `Invalid input format: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  const evaluation =
    evaluatePhase3oRealDataCalibrationEvidencePack(evidencePack);
  const result: Phase3qReviewResult = {
    ruleVersion: PHASE3Q_RULE_VERSION,
    runtimeAdoptionPosture: PHASE3Q_RUNTIME_ADOPTION_POSTURE,
    validation,
    evidencePack,
    evaluation,
  };

  printSummary(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
