import {
  DEFAULT_INTERNAL_DOGFOOD_PACKET_INPUT,
  INTERNAL_DOGFOOD_PACKET_POSTURE,
  INTERNAL_DOGFOOD_PACKET_RULE_VERSION,
  INTERNAL_DOGFOOD_PACKET_RUNTIME_ADOPTION,
  POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT,
  buildInternalDogfoodPacket,
} from "../features/business-advancement/internal-dogfood-packet";

const usePositiveFixture = process.argv.includes("--positive-fixture");
const expectReady = process.argv.includes("--expect-ready");

const packet = buildInternalDogfoodPacket(
  usePositiveFixture
    ? POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT
    : DEFAULT_INTERNAL_DOGFOOD_PACKET_INPUT,
);

console.log("=== Business Advancement Internal Dogfood Packet ===");
console.log(`Rule version                  : ${INTERNAL_DOGFOOD_PACKET_RULE_VERSION}`);
console.log(`Posture                       : ${INTERNAL_DOGFOOD_PACKET_POSTURE}`);
console.log(`Runtime adoption              : ${INTERNAL_DOGFOOD_PACKET_RUNTIME_ADOPTION}`);
console.log(`Fixture                       : ${usePositiveFixture ? "positive" : "default"}`);
console.log(`Decision                      : ${packet.decision}`);
console.log(`Production query allowed      : ${String(packet.productionQueryAdoptionAllowed)}`);
console.log(`Runtime integration allowed   : ${String(packet.runtimeIntegrationAllowed)}`);
console.log(`Public trial allowed          : ${String(packet.publicTrialAllowed)}`);
console.log("");

console.log("--- Candidate Groups ---");
for (const group of packet.candidateGroups) {
  console.log(
    `  ${group.familyId} ${group.signalType}: status=${group.status} included=${group.includedCount} excluded=${group.excludedCount}`,
  );
  console.log(`    action:   ${group.reviewOnlyAction}`);
  console.log(`    boundary: ${group.boundaryNote}`);
}

console.log("");
console.log("--- Checks ---");
for (const check of packet.checks) {
  console.log(`  [${check.pass ? "PASS" : "FAIL"}] ${check.name}`);
  console.log(`         ${check.detail}`);
}

console.log("");
console.log("--- Blockers ---");
if (packet.blockers.length === 0) {
  console.log("  none");
} else {
  for (const blocker of packet.blockers) {
    console.log(`  - ${blocker}`);
  }
}

console.log("");
console.log("--- Stop Conditions ---");
for (const item of packet.stopConditions) {
  console.log(`  - ${item}`);
}

const invariantViolation =
  packet.runtimeAdoption !== "No-Go" ||
  packet.productionQueryAdoptionAllowed ||
  packet.runtimeIntegrationAllowed ||
  packet.publicTrialAllowed;

if (invariantViolation) {
  console.error(
    "\nInternal dogfood packet invariant failed: production/public/runtime adoption must stay blocked.",
  );
  process.exit(1);
}

if (expectReady && packet.decision !== "Ready-For-Internal-Dogfooding") {
  console.error("\nExpected packet to be ready for internal dogfooding.");
  process.exit(1);
}

if (packet.decision === "Ready-For-Internal-Dogfooding") {
  console.log("\nInternal dogfood packet is ready for review-only internal use.");
} else {
  console.log("\nInternal dogfood packet is blocked. Production adoption remains No-Go.");
}
