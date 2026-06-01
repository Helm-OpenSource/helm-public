import {
  ASK_HELM_INTERACTION_REDACTED_CALIBRATION_POSTURE,
  ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RULE_VERSION,
  ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RUNTIME_ADOPTION,
  DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
  LOCAL_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
  POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
  evaluateAskHelmInteractionRedactedCalibration,
} from "../features/business-advancement/ask-helm-interaction-redacted-calibration";

const usePositiveFixture = process.argv.includes("--positive-fixture");
const useLocalFixture = process.argv.includes("--local-fixture");
const expectValidated = process.argv.includes("--expect-validated");

if (usePositiveFixture && useLocalFixture) {
  console.error("Use only one of --positive-fixture or --local-fixture.");
  process.exit(1);
}

const input = usePositiveFixture
  ? POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT
  : useLocalFixture
    ? LOCAL_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT
    : DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT;

const result = evaluateAskHelmInteractionRedactedCalibration(input);

console.log("=== Ask Helm Interaction Redacted Calibration ===");
console.log(`Rule version                 : ${ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RULE_VERSION}`);
console.log(`Posture                      : ${ASK_HELM_INTERACTION_REDACTED_CALIBRATION_POSTURE}`);
console.log(`Runtime adoption             : ${ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RUNTIME_ADOPTION}`);
console.log(`Sample kind                  : ${result.sampleKind}`);
console.log(`Real data validated          : ${String(result.realDataValidated)}`);
console.log(`Production calibration       : ${String(result.productionCalibrationComplete)}`);
console.log(`Eligible candidates          : ${result.eligibleCandidateCount}`);
console.log(`Watch-only outcomes          : ${result.watchOnlyCount}`);
console.log(`Rejected outcomes            : ${result.rejectedCount}`);
console.log(`Merged candidates            : ${result.dedupeMergeResult.mergedCandidates.length}`);
console.log(`Redaction violations         : ${result.redactionViolationCount}`);
console.log(`Boundary rejections          : ${result.boundaryRejectionCount}`);
console.log("");

console.log("--- Checks ---");
for (const check of result.checks) {
  console.log(`  [${check.pass ? "PASS" : "FAIL"}] ${check.name}`);
  console.log(`         ${check.detail}`);
}

console.log("");
console.log("--- Blockers ---");
if (result.blockers.length === 0) {
  console.log("  none");
} else {
  for (const blocker of result.blockers) {
    console.log(`  - ${blocker}`);
  }
}

console.log("");
console.log("--- Redaction Contract ---");
for (const item of result.redactionContract) {
  console.log(`  - ${item}`);
}

console.log("");
console.log("--- Summary ---");
console.log(`  realDataValidated          : ${String(result.realDataValidated)}`);
console.log(`  productionCalibration      : ${String(result.productionCalibrationComplete)}`);
console.log(`  runtimeAdoption            : ${result.runtimeAdoption}`);
console.log(`  nextAllowedWork            : ${result.nextAllowedWork}`);

if (result.runtimeAdoption !== "No-Go") {
  console.error("\nInvariant failed: runtime adoption must remain No-Go.");
  process.exit(1);
}

if (expectValidated && !result.realDataValidated) {
  console.error("\nExpected redacted real interaction snapshot validation to pass.");
  process.exit(1);
}

if (!expectValidated && result.realDataValidated) {
  console.log(
    "\nRedacted calibration validated. This only unlocks manual review planning; runtime adoption remains No-Go.",
  );
} else {
  console.log(
    "\nCalibration evaluated. Runtime adoption remains No-Go.",
  );
}

process.exit(0);
