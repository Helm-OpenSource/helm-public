#!/usr/bin/env npx tsx
/**
 * Phase 3J Disabled Runtime Source Module Plan — CLI evaluator script.
 *
 * Runs the deterministic Phase 3J evaluator and prints results.
 * Exits 0 when all checks pass (plan is internally consistent).
 * Exits 1 when any check fails (plan evidence is incomplete).
 *
 * Usage: npx tsx scripts/business-advancement-phase3j-disabled-runtime-source-plan.ts
 */

import {
  PHASE3J_FAMILY_PLANS,
  evaluatePhase3jDisabledRuntimeSourcePlan,
} from "../features/business-advancement/phase3j-disabled-runtime-source-plan";

const summary = evaluatePhase3jDisabledRuntimeSourcePlan();

const LINE = "=".repeat(72);
const line = "-".repeat(72);

console.log(`\nPhase 3J Disabled Runtime Source Module Plan — ${summary.ruleVersion}`);
console.log(LINE);
console.log(`\nRuntime adoption posture:  ${summary.runtimeAdoptionPosture}`);
console.log(`Module plan posture:       ${summary.modulePlanPosture}`);
console.log(`Checks:                    ${summary.passed}/${summary.totalChecks}`);
console.log(`All passed:                ${String(summary.allPassed)}`);

console.log(`\n${line}`);
console.log("Check results:");
console.log(line);

for (const check of summary.checks) {
  const status = check.passed ? "PASS" : "FAIL";
  console.log(`\n[${status}] ${check.checkName}`);
  console.log(`       ${check.detail}`);
}

console.log(`\n${LINE}`);
console.log(`\nFamily plan summaries (${PHASE3J_FAMILY_PLANS.length}):`);
console.log(line);

for (const plan of PHASE3J_FAMILY_PLANS) {
  console.log(`\n[${plan.tpqrId}] ${plan.plannedSourceFunctionName}`);
  console.log(`  Read model (internal):  ${plan.plannedReadModelName}`);
  console.log(`  Feature flag:           ${plan.featureFlagName}`);
  console.log(`  Default enabled:        ${String(plan.defaultEnabled)}`);
  console.log(`  DB model:               ${plan.plannedDbModel}`);
  console.log(`  Where shape:            ${plan.plannedWhereShape.slice(0, 120)}...`);
  console.log(`  Threshold status:       ${plan.thresholdStatus}`);
  console.log(`  Calibration required:   ${String(plan.calibrationRequired)}`);
  console.log(`  Test seam required:     ${String(plan.testSeamRequired)}`);
  console.log(`  Prod integration:       ${String(plan.productionIntegrationAllowed)}`);
  console.log(`  Blockers (${plan.blockers.length}):`);
  for (const blocker of plan.blockers) {
    console.log(`    - ${blocker}`);
  }
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
  `Phase 3J complete: ${summary.passed}/${summary.totalChecks} checks PASS.`,
);
console.log(
  `Runtime adoption posture: ${summary.runtimeAdoptionPosture}. Module plan posture: ${summary.modulePlanPosture}.`,
);
process.exit(0);
