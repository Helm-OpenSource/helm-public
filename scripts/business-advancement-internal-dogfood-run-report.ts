import {
  DEFAULT_INTERNAL_DOGFOOD_RUN_REPORT_INPUT,
  INTERNAL_DOGFOOD_RUN_REPORT_POSTURE,
  INTERNAL_DOGFOOD_RUN_REPORT_RULE_VERSION,
  INTERNAL_DOGFOOD_RUN_REPORT_RUNTIME_ADOPTION,
  POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT,
  buildInternalDogfoodRunReport,
  type InternalDogfoodRunObservation,
} from "../features/business-advancement/internal-dogfood-run-report";

const usePositiveFixture = process.argv.includes("--positive-fixture");
const useIssueFixture = process.argv.includes("--issue-fixture");
const useStopFixture = process.argv.includes("--stop-fixture");
const expectReady = process.argv.includes("--expect-ready");

const input = useStopFixture
  ? buildStopInput()
  : useIssueFixture
    ? buildIssueInput()
    : usePositiveFixture
      ? POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT
      : DEFAULT_INTERNAL_DOGFOOD_RUN_REPORT_INPUT;

const report = buildInternalDogfoodRunReport(input);

console.log("=== Business Advancement Internal Dogfood Run Report ===");
console.log(`Rule version                  : ${INTERNAL_DOGFOOD_RUN_REPORT_RULE_VERSION}`);
console.log(`Posture                       : ${INTERNAL_DOGFOOD_RUN_REPORT_POSTURE}`);
console.log(`Runtime adoption              : ${INTERNAL_DOGFOOD_RUN_REPORT_RUNTIME_ADOPTION}`);
console.log(
  `Fixture                       : ${useStopFixture ? "stop" : useIssueFixture ? "issue" : usePositiveFixture ? "positive" : "default"}`,
);
console.log(`Decision                      : ${report.decision}`);
console.log(`Recommendation                : ${report.recommendation}`);
console.log(`Production query allowed      : ${String(report.productionQueryAdoptionAllowed)}`);
console.log(`Runtime integration allowed   : ${String(report.runtimeIntegrationAllowed)}`);
console.log(`Public trial allowed          : ${String(report.publicTrialAllowed)}`);
console.log("");

console.log("--- Metrics ---");
console.log(`  reviewed          : ${report.metrics.reviewedCount}`);
console.log(`  accepted          : ${report.metrics.acceptedCount}`);
console.log(`  false positives   : ${report.metrics.falsePositiveCount}`);
console.log(`  missing evidence  : ${report.metrics.missingEvidenceCount}`);
console.log(`  threshold concerns: ${report.metrics.thresholdConcernCount}`);
console.log(`  stop requests     : ${report.metrics.stopRequestCount}`);

console.log("");
console.log("--- Family Coverage ---");
for (const item of report.familyCoverage) {
  console.log(
    `  [${item.covered ? "PASS" : "FAIL"}] ${item.familyId}: observations=${item.observationCount} reviewed=${item.reviewedCount}`,
  );
}

console.log("");
console.log("--- Checks ---");
for (const check of report.checks) {
  console.log(`  [${check.pass ? "PASS" : "FAIL"}] ${check.name}`);
  console.log(`         ${check.detail}`);
}

console.log("");
console.log("--- Blockers ---");
if (report.blockers.length === 0) {
  console.log("  none");
} else {
  for (const blocker of report.blockers) {
    console.log(`  - ${blocker}`);
  }
}

console.log("");
console.log("--- Founder Summary ---");
console.log(report.founderReviewSummary);

console.log("");
console.log("--- Boundary Notes ---");
for (const note of report.boundaryNotes) {
  console.log(`  - ${note}`);
}

const invariantViolation =
  report.runtimeAdoption !== "No-Go" ||
  report.productionQueryAdoptionAllowed ||
  report.runtimeIntegrationAllowed ||
  report.publicTrialAllowed;

if (invariantViolation) {
  console.error(
    "\nInternal dogfood run report invariant failed: production/public/runtime adoption must stay blocked.",
  );
  process.exit(1);
}

if (expectReady && report.decision !== "Run-Report-Ready") {
  console.error("\nExpected internal dogfood run report to be ready.");
  process.exit(1);
}

if (report.decision === "Run-Report-Ready") {
  console.log("\nInternal dogfood run report is ready for founder review only.");
} else {
  console.log("\nInternal dogfood run report is blocked. Production adoption remains No-Go.");
}

function buildIssueInput() {
  const observations = clonePositiveObservations();
  observations[0] = {
    ...observations[0],
    acceptedCount: 0,
    falsePositiveCount: 1,
    notes: "One blocked-decision candidate looked noisy in run review.",
  };
  return { ...POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT, observations };
}

function buildStopInput() {
  const observations = clonePositiveObservations();
  observations[1] = {
    ...observations[1],
    stopRequested: true,
    notes: "Stop and return to calibration before another internal run.",
  };
  return { ...POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT, observations };
}

function clonePositiveObservations(): InternalDogfoodRunObservation[] {
  return [...POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT.observations];
}
