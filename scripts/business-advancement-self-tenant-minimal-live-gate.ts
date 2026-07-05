import {
  DEFAULT_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT,
  POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT,
  SELF_TENANT_MINIMAL_LIVE_DETECTOR_RUNTIME_ADOPTION,
  SELF_TENANT_MINIMAL_LIVE_GATE_POSTURE,
  SELF_TENANT_MINIMAL_LIVE_GATE_RULE_VERSION,
  evaluateSelfTenantMinimalLiveGate,
} from "../features/business-advancement/self-tenant-minimal-live-gate";

const usePositiveFixture = process.argv.includes("--positive-fixture");
const expectGo = process.argv.includes("--expect-go");

const result = evaluateSelfTenantMinimalLiveGate(
  usePositiveFixture
    ? POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT
    : DEFAULT_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT,
);

console.log("=== Self-Tenant Minimal-Live Usage Gate ===");
console.log(`Rule version                  : ${SELF_TENANT_MINIMAL_LIVE_GATE_RULE_VERSION}`);
console.log(`Posture                       : ${SELF_TENANT_MINIMAL_LIVE_GATE_POSTURE}`);
console.log(`Detector runtime adoption     : ${SELF_TENANT_MINIMAL_LIVE_DETECTOR_RUNTIME_ADOPTION}`);
console.log(`Fixture                       : ${usePositiveFixture ? "positive" : "default"}`);
console.log(`Decision                      : ${result.decision}`);
console.log(`Production query allowed      : ${String(result.productionQueryAdoptionAllowed)}`);
console.log(`Runtime integration allowed   : ${String(result.runtimeIntegrationAllowed)}`);
console.log(`Public trial allowed          : ${String(result.publicTrialAllowed)}`);
console.log(`Approved event classes        : ${result.approvedEventClasses.join(", ") || "none"}`);
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
console.log("--- Forbidden Work ---");
for (const item of result.forbiddenWork) {
  console.log(`  - ${item}`);
}

console.log("");
console.log(`Allowed next step: ${result.allowedNextStep}`);

const invariantViolation =
  result.detectorRuntimeAdoption !== "No-Go" ||
  result.productionQueryAdoptionAllowed ||
  result.runtimeIntegrationAllowed ||
  result.publicTrialAllowed;

if (invariantViolation) {
  console.error(
    "\nSelf-tenant minimal-live gate invariant failed: detector/production/runtime/public adoption must stay blocked.",
  );
  process.exit(1);
}

if (expectGo && result.decision !== "Go-For-Self-Tenant-Minimal-Live-Usage") {
  console.error(
    "\nExpected self-tenant minimal-live gate Go for standard-surface usage.",
  );
  process.exit(1);
}

if (expectGo) {
  console.log(
    "\nSelf-tenant minimal-live gate passed for standard review-first surface usage only.",
  );
} else if (result.decision === "Go-For-Self-Tenant-Minimal-Live-Usage") {
  console.log(
    "\nSelf-tenant minimal-live usage is authorized for standard review-first surfaces only.",
  );
} else {
  console.log(
    "\nSelf-tenant minimal-live gate remains Blocked. Detector production adoption remains No-Go.",
  );
}
