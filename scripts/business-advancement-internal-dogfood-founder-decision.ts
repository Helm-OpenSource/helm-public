import {
  DEFAULT_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT,
  INTERNAL_DOGFOOD_FOUNDER_DECISION_POSTURE,
  INTERNAL_DOGFOOD_FOUNDER_DECISION_RULE_VERSION,
  INTERNAL_DOGFOOD_FOUNDER_DECISION_RUNTIME_ADOPTION,
  POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT,
  evaluateInternalDogfoodFounderDecision,
} from "../features/business-advancement/internal-dogfood-founder-decision";
import {
  POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
  buildInternalDogfoodReviewNotesPacket,
} from "../features/business-advancement/internal-dogfood-review-notes";

const usePositiveFixture = process.argv.includes("--positive-fixture");
const useIssueFixture = process.argv.includes("--issue-fixture");
const expectApprove = process.argv.includes("--expect-approve");

const input = useIssueFixture
  ? buildIssueInput()
  : usePositiveFixture
    ? POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT
    : DEFAULT_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT;

const packet = evaluateInternalDogfoodFounderDecision(input);

console.log("=== Business Advancement Internal Dogfood Founder Decision ===");
console.log(`Rule version                  : ${INTERNAL_DOGFOOD_FOUNDER_DECISION_RULE_VERSION}`);
console.log(`Posture                       : ${INTERNAL_DOGFOOD_FOUNDER_DECISION_POSTURE}`);
console.log(`Runtime adoption              : ${INTERNAL_DOGFOOD_FOUNDER_DECISION_RUNTIME_ADOPTION}`);
console.log(`Fixture                       : ${useIssueFixture ? "issue" : usePositiveFixture ? "positive" : "default"}`);
console.log(`Decision                      : ${packet.decision}`);
console.log(`Source review recommendation  : ${packet.sourceReviewRecommendation}`);
console.log(`Production query allowed      : ${String(packet.productionQueryAdoptionAllowed)}`);
console.log(`Runtime integration allowed   : ${String(packet.runtimeIntegrationAllowed)}`);
console.log(`Public trial allowed          : ${String(packet.publicTrialAllowed)}`);
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
console.log("--- Allowed Next Step ---");
console.log(packet.allowedNextStep);

console.log("");
console.log("--- Forbidden Work ---");
for (const item of packet.forbiddenWork) {
  console.log(`  - ${item}`);
}

const invariantViolation =
  packet.runtimeAdoption !== "No-Go" ||
  packet.productionQueryAdoptionAllowed ||
  packet.runtimeIntegrationAllowed ||
  packet.publicTrialAllowed;

if (invariantViolation) {
  console.error(
    "\nFounder decision invariant failed: production/public/runtime adoption must stay blocked.",
  );
  process.exit(1);
}

if (
  expectApprove &&
  packet.decision !== "Approve-Next-Disabled-Internal-Dogfood-Iteration"
) {
  console.error("\nExpected founder decision to approve only the next disabled iteration.");
  process.exit(1);
}

if (packet.decision === "Approve-Next-Disabled-Internal-Dogfood-Iteration") {
  console.log("\nFounder decision allows only the next disabled internal dogfood iteration.");
} else {
  console.log("\nFounder decision does not allow a disabled iteration to proceed yet.");
}

function buildIssueInput() {
  const notes = [...POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT.notes];
  notes[0] = {
    ...notes[0],
    verdict: "false_positive" as const,
    notes: "One row appears noisy.",
    recommendedNextStep: "revise_packet" as const,
  };
  const reviewNotesPacket = buildInternalDogfoodReviewNotesPacket({
    ...POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
    notes,
  });
  return {
    ...POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT,
    founderDecision: {
      ...POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT.founderDecision,
      approvedRecommendation: "Revise-Before-Next-Internal-Dogfood" as const,
    },
    reviewNotesPacket,
  };
}
