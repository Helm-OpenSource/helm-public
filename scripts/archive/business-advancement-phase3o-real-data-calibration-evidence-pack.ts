/**
 * Phase 3O real-data calibration evidence pack evaluator.
 *
 * Prints the default synthetic evidence-pack result. It does not read DB,
 * network, files, or wall-clock time, and it does not authorize runtime
 * adoption.
 */

import {
  DEFAULT_PHASE3O_EVALUATION,
  PHASE3O_REAL_DATA_CALIBRATION_POSTURE,
  PHASE3O_RULE_VERSION,
  PHASE3O_RUNTIME_ADOPTION_POSTURE,
} from "../features/business-advancement/phase3o-real-data-calibration-evidence-pack";

const result = DEFAULT_PHASE3O_EVALUATION;

console.log("=== Phase 3O Real-Data Calibration Evidence Pack ===");
console.log(`ruleVersion:                   ${PHASE3O_RULE_VERSION}`);
console.log(`runtimeAdoptionPosture:        ${PHASE3O_RUNTIME_ADOPTION_POSTURE}`);
console.log(`realDataCalibrationPosture:    ${PHASE3O_REAL_DATA_CALIBRATION_POSTURE}`);
console.log(`sampleKind:                    ${result.sampleKind}`);
console.log(`realDataValidated:             ${String(result.realDataValidated)}`);
console.log(
  `productionCalibrationComplete: ${String(result.productionCalibrationComplete)}`,
);
console.log("");

for (const family of [result.tpqr001, result.tpqr003, result.tpqr004]) {
  console.log(
    `${family.tpqrId}: rows=${family.rowCount} included=${family.includedCount} excluded=${family.excludedCount} checksPass=${String(family.checksPass)} calibrated=${String(family.calibrated)}`,
  );
  for (const check of family.checks) {
    const marker = check.pass ? "PASS" : "FAIL";
    console.log(`  [${marker}] ${check.name} — ${check.detail}`);
  }
}

console.log("");
console.log(`blockers (${result.blockers.length}):`);
for (const blocker of result.blockers) {
  console.log(`  - ${blocker}`);
}

console.log("");
console.log(`nextAllowedWork: ${result.nextAllowedWork}`);
console.log("=== CONTRACT CHECK COMPLETE: runtime adoption remains No-Go ===");
