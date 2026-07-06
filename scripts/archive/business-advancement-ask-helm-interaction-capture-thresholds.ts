import {
  ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_POSTURE,
  ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RULE_VERSION,
  ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION,
  evaluateAskHelmCaptureThresholdsStrategy,
} from "../features/business-advancement/ask-helm-interaction-capture-thresholds";

const summary = evaluateAskHelmCaptureThresholdsStrategy();

console.log("=== Ask Helm Interaction Asset Capture Thresholds ===");
console.log(`Rule version     : ${ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RULE_VERSION}`);
console.log(`Posture          : ${ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_POSTURE}`);
console.log(`Runtime adoption : ${ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION}`);
console.log("");

console.log("--- Evaluator Checks ---");
for (const check of summary.checks) {
  const status = check.pass ? "PASS" : "FAIL";
  console.log(`  [${status}] ${check.name}`);
  console.log(`         ${check.detail}`);
}

console.log("");
console.log("--- Summary ---");
console.log(`  eligibleCandidateCount : ${summary.eligibleCandidateCount}`);
console.log(`  watchOnlyCount         : ${summary.watchOnlyCount}`);
console.log(`  notEligibleCount       : ${summary.notEligibleCount}`);
console.log(`  allPass                : ${summary.allPass}`);

if (!summary.allPass) {
  console.error("\nFailing checks:");
  for (const check of summary.checks.filter((item) => !item.pass)) {
    console.error(`  FAIL: ${check.name} — ${check.detail}`);
  }
  process.exit(1);
}

console.log("\nAll checks passed. Planning-only posture preserved. Runtime adoption: No-Go.");
process.exit(0);
