import {
  ASK_HELM_INTERACTION_DEDUPE_MERGE_POSTURE,
  ASK_HELM_INTERACTION_DEDUPE_MERGE_RULE_VERSION,
  ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION,
  evaluateAskHelmInteractionDedupeMergeStrategy,
} from "../features/business-advancement/ask-helm-interaction-dedupe-merge";

const summary = evaluateAskHelmInteractionDedupeMergeStrategy();

console.log("=== Ask Helm Interaction Asset Dedupe / Merge Strategy ===");
console.log(`Rule version     : ${ASK_HELM_INTERACTION_DEDUPE_MERGE_RULE_VERSION}`);
console.log(`Posture          : ${ASK_HELM_INTERACTION_DEDUPE_MERGE_POSTURE}`);
console.log(`Runtime adoption : ${ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION}`);
console.log("");

console.log("--- Evaluator Checks ---");
for (const check of summary.checks) {
  const status = check.pass ? "PASS" : "FAIL";
  console.log(`  [${status}] ${check.name}`);
  console.log(`         ${check.detail}`);
}

console.log("");
console.log("--- Summary ---");
console.log(`  mergedCandidateCount        : ${summary.mergedCandidateCount}`);
console.log(`  newReviewableCandidateCount : ${summary.newReviewableCandidateCount}`);
console.log(`  signalAttachmentCount       : ${summary.signalAttachmentCount}`);
console.log(`  mustPushAttachmentCount     : ${summary.mustPushAttachmentCount}`);
console.log(`  allPass                     : ${summary.allPass}`);

if (!summary.allPass) {
  console.error("\nFailing checks:");
  for (const check of summary.checks.filter((item) => !item.pass)) {
    console.error(`  FAIL: ${check.name} — ${check.detail}`);
  }
  process.exit(1);
}

console.log("\nAll checks passed. Planning-only posture preserved. Runtime adoption: No-Go.");
process.exit(0);
