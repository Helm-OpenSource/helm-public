import {
  DEFAULT_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT,
  POSITIVE_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT,
  REDACTED_REAL_DATA_CALIBRATION_PACKAGE_POSTURE,
  REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RULE_VERSION,
  REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RUNTIME_ADOPTION,
  evaluateRedactedRealDataCalibrationPackageGate,
} from "../features/business-advancement/redacted-real-data-calibration-package-gate";

const usePositiveFixture = process.argv.includes("--positive-fixture");
const expectReady = process.argv.includes("--expect-ready");

const result = evaluateRedactedRealDataCalibrationPackageGate(
  usePositiveFixture
    ? POSITIVE_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT
    : DEFAULT_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT,
);

console.log("=== Redacted Real-Data Calibration Package Gate ===");
console.log(`Rule version                : ${REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RULE_VERSION}`);
console.log(`Posture                     : ${REDACTED_REAL_DATA_CALIBRATION_PACKAGE_POSTURE}`);
console.log(`Runtime adoption            : ${REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RUNTIME_ADOPTION}`);
console.log(`Fixture                     : ${usePositiveFixture ? "positive" : "default"}`);
console.log(`Expectation                 : ${expectReady ? "ready" : "evaluate"}`);
console.log(`Decision                    : ${result.decision}`);
console.log(`Runtime integration allowed : ${String(result.runtimeIntegrationAllowed)}`);
console.log(`Production adoption allowed : ${String(result.productionAdoptionAllowed)}`);
console.log("");

console.log("--- Package Checks ---");
for (const check of result.checks) {
  const status = check.pass ? "PASS" : "FAIL";
  console.log(`  [${status}] ${check.name}`);
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
console.log("--- Summary ---");
console.log(`  packageReady                       : ${String(result.summary.packageReady)}`);
console.log(`  askHelmInteractionEvidenceReady    : ${String(result.summary.askHelmInteractionEvidenceReady)}`);
console.log(`  productionQueryLiveDbEvidenceReady : ${String(result.summary.productionQueryLiveDbEvidenceReady)}`);
console.log(`  allowedNextStep                    : ${result.allowedNextStep}`);

const invariantViolation =
  result.runtimeIntegrationAllowed ||
  result.productionAdoptionAllowed ||
  result.runtimeAdoption !== "No-Go";

if (invariantViolation) {
  console.error(
    "\nGate invariant failed: runtime integration and production adoption must remain disallowed.",
  );
  process.exit(1);
}

if (expectReady && result.decision !== "Ready-For-Manual-Review") {
  console.log(
    "\nPackage gate did not reach manual-review readiness. Runtime adoption remains No-Go.",
  );
  process.exit(1);
}

if (result.decision === "Ready-For-Manual-Review") {
  console.log(
    "\nCalibration package is ready for manual review only. Runtime adoption remains No-Go.",
  );
} else {
  console.log(
    "\nCalibration package evaluated as No-Go with blockers. Runtime adoption remains No-Go.",
  );
}
process.exit(0);
