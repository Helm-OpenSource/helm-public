import {
  evaluatePhase3kThresholdCalibrationFixtures,
  tpqr001FamilyResult,
  tpqr003FamilyResult,
  tpqr004FamilyResult,
  PHASE3K_RULE_VERSION,
  PHASE3K_RUNTIME_ADOPTION_POSTURE,
  PHASE3K_FIXTURE_PACK_POSTURE,
} from "../features/business-advancement/phase3k-threshold-calibration-fixtures";

const result = evaluatePhase3kThresholdCalibrationFixtures();

console.log("=== Phase 3K Threshold Calibration Fixtures ===");
console.log(`Rule version : ${PHASE3K_RULE_VERSION}`);
console.log(`Runtime adoption posture : ${PHASE3K_RUNTIME_ADOPTION_POSTURE}`);
console.log(`Fixture pack posture     : ${PHASE3K_FIXTURE_PACK_POSTURE}`);
console.log("");

console.log("--- Evaluator Checks ---");
for (const check of result.checks) {
  const status = check.pass ? "PASS" : "FAIL";
  console.log(`  [${status}] ${check.name}`);
  console.log(`         ${check.detail}`);
}
console.log("");

console.log("--- Family Summaries ---");
console.log(
  `  TPQR-001  realDataValidated=${result.familySummaries.tpqr001.realDataValidated}  productionCalibrationComplete=${result.familySummaries.tpqr001.productionCalibrationComplete}`
);
console.log(`           thresholdCandidates: ${tpqr001FamilyResult.thresholdCandidates.map((c) => c.labelHuman).join(", ")}`);
console.log(`           conservativeDefault: ${tpqr001FamilyResult.conservativeFixtureDefaultHuman} (${tpqr001FamilyResult.conservativeFixtureDefaultMs}ms)`);
console.log(`           syntheticScenarios: ${tpqr001FamilyResult.syntheticLabelledScenarios.length}`);
console.log("");

console.log(
  `  TPQR-003  realDataValidated=${result.familySummaries.tpqr003.realDataValidated}  productionCalibrationComplete=${result.familySummaries.tpqr003.productionCalibrationComplete}`
);
console.log(`           binaryPredicateValidated: ${tpqr003FamilyResult.binaryPredicateValidated}`);
console.log(`           persistedOverdueFlagAuthority: ${tpqr003FamilyResult.persistedOverdueFlagAuthority}`);
console.log(`           syntheticScenarios: ${tpqr003FamilyResult.syntheticScenarios.length}`);
console.log("");

console.log(
  `  TPQR-004  realDataValidated=${result.familySummaries.tpqr004.realDataValidated}  productionCalibrationComplete=${result.familySummaries.tpqr004.productionCalibrationComplete}`
);
console.log(`           dualProducerDedupValidated: ${tpqr004FamilyResult.dualProducerDedupValidated}`);
console.log(`           dedupScenarios: ${tpqr004FamilyResult.dedupScenarios.length}`);
console.log("");

const passCount = result.checks.filter((c) => c.pass).length;
const failCount = result.checks.length - passCount;
console.log(`--- Result: ${passCount}/${result.checks.length} checks passed, ${failCount} failed ---`);
console.log(`allPass: ${result.allPass}`);

if (!result.allPass) {
  console.error("\nFailing checks:");
  for (const check of result.checks.filter((c) => !c.pass)) {
    console.error(`  FAIL: ${check.name} — ${check.detail}`);
  }
  process.exit(1);
}

console.log("\nAll checks passed. Fixture pack posture: Conditional-Go. Runtime adoption: No-Go.");
process.exit(0);
