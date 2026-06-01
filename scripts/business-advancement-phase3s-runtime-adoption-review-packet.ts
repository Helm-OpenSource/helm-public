/**
 * Phase 3S offline manual production runtime adoption review packet.
 *
 * Reads a redacted snapshot JSON from --input <file> or stdin.
 * Reuses evaluatePhase3rRuntimeAdoptionPreflight from Phase 3R for all
 * input validation, sensitive content rejection, and Phase 3O evaluation.
 * Sensitive or invalid input is rejected through Phase 3R/3Q behavior (exit 1).
 *
 * productionRuntimeAdoptionReviewPacketReady is true only when:
 *   - Phase 3R productionRuntimeAdoptionReviewReady is true
 *
 * Even when packetReady true:
 *   - productionAdoptionAllowed remains false always
 *   - runtimeIntegrationAllowed remains false always
 *   - productionAdoptionDecision remains No-Go always
 *   - Next step is manual production runtime adoption review meeting and
 *     separate implementation plan only — no direct runtime adoption, no
 *     data/queries.ts, no app route/API, no prisma schema, no mobile read
 *     model, no official write path, no auto-send, no auto-approve, no
 *     auto-execution.
 *
 * Exit codes:
 *   0 — productionRuntimeAdoptionReviewPacketReady true
 *   1 — invalid/sensitive/input format error
 *   2 — valid input but not ready for production runtime adoption review
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  evaluatePhase3rRuntimeAdoptionPreflight,
  type Phase3rPreflightResult,
} from "./business-advancement-phase3r-runtime-adoption-preflight";
import { Phase3qRejectionError } from "./business-advancement-phase3q-snapshot-intake-review";

export const PHASE3S_RULE_VERSION =
  "phase3s-runtime-adoption-review-packet/v1" as const;

export const PHASE3S_REVIEW_POSTURE = "Manual-Review-Only" as const;

export const PHASE3S_PRODUCTION_ADOPTION_DECISION = "No-Go" as const;

export const PHASE3S_REVIEWER_ROLES = [
  "Engineering Lead",
  "Product Owner",
  "Security Reviewer",
  "Operations Lead",
  "Data Protection Officer",
] as const;

export const PHASE3S_MANDATORY_CHECKLIST = [
  "Phase 3R preflight confirmed passed (exit 0)",
  "Manual production runtime adoption review meeting scheduled and held",
  "All required reviewer roles present at review meeting",
  "Separate implementation plan drafted before any runtime adoption work begins",
  "Production runtime adoption risks reviewed and documented",
  "Data governance review completed",
  "Security review completed",
  "Implementation plan approved by all required reviewer roles",
  "Governance sign-off obtained before any production path work",
] as const;

export const PHASE3S_FORBIDDEN_WORK = [
  "Direct production runtime adoption without approved implementation plan",
  "Modification of data/queries.ts",
  "Creation of app route or API route for runtime adoption",
  "Modification of prisma schema",
  "Integration with mobile read-model",
  "Creation of official write path",
  "Auto-send functionality",
  "Auto-approve functionality",
  "Auto-execution of any runtime integration",
  "Direct deployment to production",
  "Bypassing mandatory checklist or reviewer roles",
] as const;

export const PHASE3S_ALLOWED_NEXT_STEP_READY =
  "Hold manual production runtime adoption review meeting with all required reviewer roles present. Draft a separate implementation plan. No direct runtime adoption, no data/queries.ts, no app route/API, no prisma schema, no mobile read-model, no official write path, no auto-send, no auto-approve, no auto-execution." as const;

export const PHASE3S_ALLOWED_NEXT_STEP_NOT_READY =
  "Resolve all Phase 3R blockers, provide a clean redacted_live_db_snapshot that passes Phase 3Q intake and Phase 3R preflight (exit 0), then re-run this review packet generator." as const;

export interface Phase3sReviewPacketResult {
  readonly ruleVersion: typeof PHASE3S_RULE_VERSION;
  readonly reviewPosture: typeof PHASE3S_REVIEW_POSTURE;
  readonly productionRuntimeAdoptionReviewPacketReady: boolean;
  readonly productionAdoptionAllowed: false;
  readonly runtimeIntegrationAllowed: false;
  readonly productionAdoptionDecision: typeof PHASE3S_PRODUCTION_ADOPTION_DECISION;
  readonly preflight: Phase3rPreflightResult;
  readonly blockedReasons: readonly string[];
  readonly reviewerRoles: readonly string[];
  readonly mandatoryChecklist: readonly string[];
  readonly forbiddenWork: readonly string[];
  readonly allowedNextStep: string;
}

/**
 * Pure review packet builder. Throws Phase3qRejectionError for sensitive
 * input, throws Error for invalid format. Returns Phase3sReviewPacketResult
 * for valid input.
 *
 * Even a passing result has productionAdoptionAllowed=false and
 * productionAdoptionDecision=No-Go always.
 */
export function buildPhase3sRuntimeAdoptionReviewPacket(
  parsed: unknown,
): Phase3sReviewPacketResult {
  const preflight: Phase3rPreflightResult =
    evaluatePhase3rRuntimeAdoptionPreflight(parsed);

  const productionRuntimeAdoptionReviewPacketReady =
    preflight.productionRuntimeAdoptionReviewReady;

  return {
    ruleVersion: PHASE3S_RULE_VERSION,
    reviewPosture: PHASE3S_REVIEW_POSTURE,
    productionRuntimeAdoptionReviewPacketReady,
    productionAdoptionAllowed: false,
    runtimeIntegrationAllowed: false,
    productionAdoptionDecision: PHASE3S_PRODUCTION_ADOPTION_DECISION,
    preflight,
    blockedReasons: preflight.blockedReasons,
    reviewerRoles: [...PHASE3S_REVIEWER_ROLES],
    mandatoryChecklist: [...PHASE3S_MANDATORY_CHECKLIST],
    forbiddenWork: [...PHASE3S_FORBIDDEN_WORK],
    allowedNextStep: productionRuntimeAdoptionReviewPacketReady
      ? PHASE3S_ALLOWED_NEXT_STEP_READY
      : PHASE3S_ALLOWED_NEXT_STEP_NOT_READY,
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

function printSummary(result: Phase3sReviewPacketResult): void {
  console.log("=== Phase 3S Production Runtime Adoption Review Packet ===");
  console.log(`ruleVersion:                                ${result.ruleVersion}`);
  console.log(`reviewPosture:                              ${result.reviewPosture}`);
  console.log(`productionRuntimeAdoptionReviewPacketReady: ${String(result.productionRuntimeAdoptionReviewPacketReady)}`);
  console.log(`productionAdoptionAllowed:                  ${String(result.productionAdoptionAllowed)}`);
  console.log(`runtimeIntegrationAllowed:                  ${String(result.runtimeIntegrationAllowed)}`);
  console.log(`productionAdoptionDecision:                 ${result.productionAdoptionDecision}`);
  console.log("");
  console.log(`blockedReasons (${result.blockedReasons.length}):`);
  for (const reason of result.blockedReasons) {
    console.log(`  - ${reason}`);
  }
  console.log("");
  console.log(`reviewerRoles (${result.reviewerRoles.length}):`);
  for (const role of result.reviewerRoles) {
    console.log(`  - ${role}`);
  }
  console.log("");
  console.log(`mandatoryChecklist (${result.mandatoryChecklist.length}):`);
  for (const item of result.mandatoryChecklist) {
    console.log(`  [ ] ${item}`);
  }
  console.log("");
  console.log(`forbiddenWork (${result.forbiddenWork.length}):`);
  for (const item of result.forbiddenWork) {
    console.log(`  - ${item}`);
  }
  console.log("");
  console.log(`allowedNextStep: ${result.allowedNextStep}`);
  console.log("");
  console.log(
    "No files were written. No DB access. Production adoption decision: No-Go.",
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

  let result: Phase3sReviewPacketResult;
  try {
    result = buildPhase3sRuntimeAdoptionReviewPacket(parsed);
  } catch (error) {
    if (error instanceof Phase3qRejectionError) {
      console.error(
        "=== Phase 3S Packet Rejected: Sensitive Input Detected ===",
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

  if (result.productionRuntimeAdoptionReviewPacketReady) {
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
