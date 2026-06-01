import {
  evaluatePhase3lDisabledSeamPrototypeReview,
  PHASE3L_SEAM_REVIEW_PLANS,
} from "../features/business-advancement/phase3l-disabled-seam-prototype-review";

const result = evaluatePhase3lDisabledSeamPrototypeReview();

console.log("=== Phase 3L Disabled Seam Prototype Review ===");
console.log(`Rule version : ${result.ruleVersion}`);
console.log(`Runtime adoption posture     : ${result.runtimeAdoptionPosture}`);
console.log(`Seam prototype review posture: ${result.seamPrototypeReviewPosture}`);
console.log("");

console.log("--- Checks ---");
for (const check of result.checks) {
  const status = check.pass ? "PASS" : "FAIL";
  console.log(`[${status}] ${check.name}`);
  console.log(`       ${check.detail}`);
}

console.log("");
console.log(`Passed: ${result.passedCount} / ${result.totalChecks}`);
console.log("");

console.log("--- Plan Summaries ---");
for (const plan of PHASE3L_SEAM_REVIEW_PLANS) {
  console.log(
    `${plan.tpqrId} | ${plan.sourceFunctionName} | model=${plan.plannedDbModel}` +
      ` | defaultEnabled=${String(plan.defaultEnabled)}` +
      ` | readOnly=${String(plan.readOnly)}` +
      ` | productionIntegrationAllowed=${String(plan.productionIntegrationAllowed)}` +
      ` | workspaceScopeRequired=${String(plan.workspaceScopeRequired)}`,
  );
}

console.log("");
console.log("Next allowed work:");
console.log(result.nextAllowedWork);
console.log("");

if (!result.allPass) {
  const failing = result.checks.filter((c) => !c.pass).map((c) => c.name);
  console.error(`FAILED checks: ${failing.join(", ")}`);
  process.exit(1);
}

console.log("All checks passed. Phase 3L seam prototype review complete.");
process.exit(0);
