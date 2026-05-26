import {
  DEFAULT_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
  POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
  PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_POSTURE,
  PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RULE_VERSION,
  PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RUNTIME_ADOPTION,
  evaluateProductionQueryAdoptionApprovalGate,
} from "../features/business-advancement/production-query-adoption-approval-gate";

const usePositiveFixture = process.argv.includes("--positive-fixture");
const expectReady = process.argv.includes("--expect-ready");

const result = evaluateProductionQueryAdoptionApprovalGate(
  usePositiveFixture
    ? POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT
    : DEFAULT_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
);

console.log("=== Production Query Adoption Approval Gate ===");
console.log(`Rule version                : ${PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RULE_VERSION}`);
console.log(`Posture                     : ${PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_POSTURE}`);
console.log(`Runtime adoption            : ${PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RUNTIME_ADOPTION}`);
console.log(`Fixture                     : ${usePositiveFixture ? "positive" : "default"}`);
console.log(`Expectation                 : ${expectReady ? "ready" : "evaluate"}`);
console.log(`Decision                    : ${result.decision}`);
console.log(`Runtime integration allowed : ${String(result.runtimeIntegrationAllowed)}`);
console.log(`Production adoption allowed : ${String(result.productionAdoptionAllowed)}`);
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
  const approved = result.approvedReviewerRoles.includes(role);
  console.log(`  [${approved ? "x" : " "}] ${role}`);
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
console.log("--- Runtime Gate Summary ---");
console.log(`  requested                   : ${String(result.summary.requested)}`);
console.log(`  approvedByRequiredReviewers : ${String(result.summary.approvedByRequiredReviewers)}`);
console.log(`  implementationPlanPresent   : ${String(result.summary.implementationPlanPresent)}`);
console.log(`  approvalGateDecision        : ${result.summary.approvalGateDecision}`);
console.log(`  approvalGateRuleVersion     : ${result.summary.approvalGateRuleVersion}`);

const invariantViolation =
  result.runtimeIntegrationAllowed ||
  result.productionAdoptionAllowed ||
  result.runtimeAdoption !== "No-Go";

if (invariantViolation) {
  console.error(
    "\nGate invariant failed: production adoption and runtime integration must remain disallowed.",
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
    "\nApproval gate passed for manual-review readiness only. Runtime adoption remains No-Go.",
  );
} else {
  console.log(
    "\nApproval gate evaluated as No-Go with blockers. Runtime adoption remains No-Go.",
  );
}
process.exit(0);
