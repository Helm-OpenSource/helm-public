import {
  ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_POSTURE,
  ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RULE_VERSION,
  ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RUNTIME_ADOPTION,
  DEFAULT_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
  POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
  evaluateAskHelmInteractionRuntimeAdoptionGate,
} from "../features/business-advancement/ask-helm-interaction-runtime-adoption-gate";

const usePositiveFixture = process.argv.includes("--positive-fixture");
const expectReady = process.argv.includes("--expect-ready");
const result = evaluateAskHelmInteractionRuntimeAdoptionGate(
  usePositiveFixture
    ? POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT
    : DEFAULT_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
);

console.log("=== Ask Helm Interaction Runtime Adoption Gate ===");
console.log(`Rule version                : ${ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RULE_VERSION}`);
console.log(`Posture                     : ${ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_POSTURE}`);
console.log(`Runtime adoption            : ${ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RUNTIME_ADOPTION}`);
console.log(`Fixture                     : ${usePositiveFixture ? "positive" : "default"}`);
console.log(`Expectation                 : ${expectReady ? "ready" : "evaluate"}`);
console.log(`Decision                    : ${result.decision}`);
console.log(`Runtime integration allowed : ${String(result.runtimeIntegrationAllowed)}`);
console.log(`Production adoption allowed : ${String(result.productionAdoptionAllowed)}`);
console.log(
  `Redacted calibration        : ${result.checks.find((check) => check.name === "redacted_real_data_calibration_passes")?.detail ?? "missing"}`,
);
console.log("");

console.log("--- Gate Checks ---");
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
console.log("--- Required Reviewer Roles ---");
for (const role of result.requiredReviewerRoles) {
  console.log(`  - ${role}`);
}

console.log("");
console.log("--- Mandatory Checklist ---");
for (const item of result.mandatoryChecklist) {
  console.log(`  [ ] ${item}`);
}

console.log("");
console.log("--- Forbidden Work ---");
for (const item of result.forbiddenWork) {
  console.log(`  - ${item}`);
}

console.log("");
console.log("--- Summary ---");
console.log(`  decision                   : ${result.decision}`);
console.log(`  blockers                   : ${result.blockers.length}`);
console.log(`  allowedNextStep            : ${result.allowedNextStep}`);
console.log(`  runtimeIntegrationAllowed  : ${String(result.runtimeIntegrationAllowed)}`);
console.log(`  productionAdoptionAllowed  : ${String(result.productionAdoptionAllowed)}`);

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
    "\nGate did not reach manual-review readiness. Planning-only posture preserved. Runtime adoption remains No-Go.",
  );
  process.exit(1);
}

if (result.decision === "Ready-For-Manual-Review") {
  console.log(
    "\nGate passed for manual review packet readiness only. Runtime adoption remains No-Go.",
  );
} else {
  console.log(
    "\nGate evaluated as No-Go with blockers. Planning-only posture preserved. Runtime adoption remains No-Go.",
  );
}
process.exit(0);
