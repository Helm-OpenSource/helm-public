import {
  DEFAULT_FOUNDER_INTERNAL_GATE_INPUT,
  FOUNDER_INTERNAL_GATE_POSTURE,
  FOUNDER_INTERNAL_GATE_RULE_VERSION,
  FOUNDER_INTERNAL_GATE_RUNTIME_ADOPTION,
  POSITIVE_FOUNDER_INTERNAL_GATE_INPUT,
  evaluateFounderInternalGate,
} from "../features/business-advancement/founder-internal-gate";

const usePositiveFixture = process.argv.includes("--positive-fixture");
const expectGo = process.argv.includes("--expect-go");

const result = evaluateFounderInternalGate(
  usePositiveFixture
    ? POSITIVE_FOUNDER_INTERNAL_GATE_INPUT
    : DEFAULT_FOUNDER_INTERNAL_GATE_INPUT,
);

console.log("=== Founder-Led Business Advancement Internal Gate ===");
console.log(`Rule version                  : ${FOUNDER_INTERNAL_GATE_RULE_VERSION}`);
console.log(`Posture                       : ${FOUNDER_INTERNAL_GATE_POSTURE}`);
console.log(`Runtime adoption              : ${FOUNDER_INTERNAL_GATE_RUNTIME_ADOPTION}`);
console.log(`Fixture                       : ${usePositiveFixture ? "positive" : "default"}`);
console.log(`Decision                      : ${result.decision}`);
console.log(`Production query allowed      : ${String(result.productionQueryAdoptionAllowed)}`);
console.log(`Runtime integration allowed   : ${String(result.runtimeIntegrationAllowed)}`);
console.log(`Public trial allowed          : ${String(result.publicTrialAllowed)}`);
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
  result.runtimeAdoption !== "No-Go" ||
  result.productionQueryAdoptionAllowed ||
  result.runtimeIntegrationAllowed ||
  result.publicTrialAllowed;

if (invariantViolation) {
  console.error(
    "\nFounder internal gate invariant failed: production/public/runtime adoption must stay blocked.",
  );
  process.exit(1);
}

if (expectGo && result.decision !== "Go-For-Disabled-Internal-Dogfooding") {
  console.error("\nExpected founder internal gate Go for disabled internal dogfooding.");
  process.exit(1);
}

if (!expectGo && result.decision === "Go-For-Disabled-Internal-Dogfooding") {
  console.log("\nInternal gate is ready for disabled internal dogfooding only.");
} else if (expectGo) {
  console.log("\nFounder internal gate passed for disabled internal dogfooding only.");
} else {
  console.log("\nFounder internal gate remains Revise. Production adoption remains No-Go.");
}
