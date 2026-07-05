import {
  DEFAULT_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT,
  POSITIVE_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT,
  SELF_TENANT_DIAGNOSTIC_REPORT_POSTURE,
  SELF_TENANT_DIAGNOSTIC_REPORT_RULE_VERSION,
  buildSelfTenantDiagnosticReport,
} from "../features/business-advancement/self-tenant-diagnostic-report";

const usePositiveFixture = process.argv.includes("--positive-fixture");
const expectReady = process.argv.includes("--expect-ready");

const result = buildSelfTenantDiagnosticReport(
  usePositiveFixture
    ? POSITIVE_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT
    : DEFAULT_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT,
);

console.log("=== Self-Tenant Operating Checkup Report ===");
console.log(`Rule version           : ${SELF_TENANT_DIAGNOSTIC_REPORT_RULE_VERSION}`);
console.log(`Posture                : ${SELF_TENANT_DIAGNOSTIC_REPORT_POSTURE}`);
console.log(`Fixture                : ${usePositiveFixture ? "positive" : "default"}`);
console.log(`Decision               : ${result.decision}`);
console.log(`Data posture           : ${result.reportContext.dataPosture}`);
console.log(`Diagnosed gaps         : ${result.diagnosedGaps.length}`);
console.log(`Advisory observations  : ${result.advisoryObservations.length}`);
console.log("");

console.log("--- Checks ---");
for (const check of result.checks) {
  console.log(`  [${check.pass ? "PASS" : "FAIL"}] ${check.name}`);
  console.log(`         ${check.detail}`);
}

console.log("");
console.log("--- Review Packet ---");
console.log(`  Recommendation : ${result.reviewPacket.recommendation}`);
console.log(`  Owner          : ${result.reviewPacket.owner}`);
console.log(`  Boundaries     :`);
for (const boundary of result.reviewPacket.boundaries) {
  console.log(`    - ${boundary}`);
}

console.log("");
console.log("--- Forbidden Outputs ---");
for (const item of result.forbiddenOutputs) {
  console.log(`  - ${item}`);
}

const invariantViolation =
  result.diagnosedGaps.some((gap) => gap.evidenceRefs.length === 0) ||
  result.ladderProposal.startMode !== "observer";

if (invariantViolation) {
  console.error(
    "\nSelf-tenant diagnostic report invariant failed: gaps must carry evidence and the ladder must start at observer.",
  );
  process.exit(1);
}

if (expectReady && result.decision !== "Checkup-Report-Ready") {
  console.error("\nExpected a ready checkup report from the positive fixture.");
  process.exit(1);
}

console.log(
  `\nCheckup report builder finished with decision ${result.decision}. Review-first; no procurement conclusion, no commitment.`,
);
