#!/usr/bin/env npx tsx
/**
 * Phase 3I Runtime Source Review — CLI evaluator script.
 *
 * Runs the deterministic Phase 3I evaluator and prints results.
 * Exits 0 when all checks pass (review is internally consistent).
 * Exits 1 when any check fails (review evidence is incomplete).
 *
 * Usage: npx tsx scripts/business-advancement-phase3i-runtime-source-review.ts
 */

import { evaluatePhase3iRuntimeSourceReview } from "../features/business-advancement/phase3i-runtime-source-review";

const summary = evaluatePhase3iRuntimeSourceReview();

const LINE = "=".repeat(72);
const line = "-".repeat(72);

console.log(`\nPhase 3I Runtime Source Review — ${summary.ruleVersion}`);
console.log(LINE);
console.log(`\nReview posture:     ${summary.runtimeAdoptionPosture}`);
console.log(`Phase 3J allowed:   ${String(summary.phase3jConditionalGo)}`);
console.log(`Checks:             ${summary.passed}/${summary.totalChecks}`);
console.log(`All passed:         ${String(summary.allPassed)}`);

console.log(`\n${line}`);
console.log("Check results:");
console.log(line);

for (const check of summary.checks) {
  const status = check.passed ? "PASS" : "FAIL";
  console.log(`\n[${status}] ${check.checkName}`);
  console.log(`       ${check.detail}`);
}

console.log(`\n${LINE}`);
console.log(`\nForbidden files (${summary.forbiddenFiles.length}):`);
for (const f of summary.forbiddenFiles) {
  console.log(`  - ${f}`);
}

console.log(`\nNext allowed work:`);
console.log(`  ${summary.nextAllowedWork}`);
console.log();

if (!summary.allPassed) {
  const failedNames = summary.checks
    .filter((c) => !c.passed)
    .map((c) => c.checkName);
  console.error(
    `ERROR: ${failedNames.length} check(s) failed: ${failedNames.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `Phase 3I complete: ${summary.passed}/${summary.totalChecks} checks PASS.`,
);
console.log(
  `Runtime adoption posture: ${summary.runtimeAdoptionPosture}. Phase 3J: Conditional-Go (disabled-by-default plan only).`,
);
process.exit(0);
