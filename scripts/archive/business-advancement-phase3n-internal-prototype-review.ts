/**
 * Phase 3N internal prototype review — evaluator script.
 *
 * Runs evaluatePhase3nInternalPrototypeReview, prints all checks and remaining
 * blockers, and exits 0 only if all checks pass. No DB, no network, no wall clock.
 */

import {
  PHASE3N_INTERNAL_PROTOTYPE_REVIEW_POSTURE,
  PHASE3N_RULE_VERSION,
  PHASE3N_RUNTIME_ADOPTION_POSTURE,
  evaluatePhase3nInternalPrototypeReview,
} from "../features/business-advancement/phase3n-internal-prototype-review";

const result = evaluatePhase3nInternalPrototypeReview();

console.log("=== Phase 3N Internal Prototype Review ===");
console.log(`ruleVersion:                    ${PHASE3N_RULE_VERSION}`);
console.log(`runtimeAdoptionPosture:         ${PHASE3N_RUNTIME_ADOPTION_POSTURE}`);
console.log(`internalPrototypeReviewPosture: ${PHASE3N_INTERNAL_PROTOTYPE_REVIEW_POSTURE}`);
console.log("");
console.log(`--- Checks (${result.totalChecks} total) ---`);

for (const check of result.checks) {
  const marker = check.pass ? "PASS" : "FAIL";
  console.log(`  [${marker}] ${check.name}`);
  console.log(`         ${check.detail}`);
}

console.log("");
console.log(`--- Remaining Blockers (${result.remainingBlockers.length}) ---`);
for (const blocker of result.remainingBlockers) {
  console.log(`  - ${blocker}`);
}

console.log("");
console.log(`nextAllowedWork: ${result.nextAllowedWork}`);
console.log("");
console.log(
  `Result: ${result.passedCount}/${result.totalChecks} checks passed. allPass=${String(result.allPass)}`,
);

if (!result.allPass) {
  const failed = result.checks.filter((c) => !c.pass);
  console.error("");
  console.error("=== FAILURES ===");
  for (const f of failed) {
    console.error(`  FAIL: ${f.name} — ${f.detail}`);
  }
  process.exit(1);
} else {
  console.log("=== ALL CHECKS PASSED ===");
  process.exit(0);
}
