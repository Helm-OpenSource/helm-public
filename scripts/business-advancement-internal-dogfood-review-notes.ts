import { readFileSync } from "node:fs";
import path from "node:path";

import {
  DEFAULT_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
  INTERNAL_DOGFOOD_REVIEW_NOTES_POSTURE,
  INTERNAL_DOGFOOD_REVIEW_NOTES_RULE_VERSION,
  INTERNAL_DOGFOOD_REVIEW_NOTES_RUNTIME_ADOPTION,
  POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
  buildInternalDogfoodReviewNotesInputFromJson,
  buildInternalDogfoodReviewNotesPacket,
  type InternalDogfoodReviewNote,
} from "../features/business-advancement/internal-dogfood-review-notes";

const usePositiveFixture = process.argv.includes("--positive-fixture");
const useIssueFixture = process.argv.includes("--issue-fixture");
const expectReady = process.argv.includes("--expect-ready");
const inputFile = readArgValue("--input-file");

const input = usePositiveFixture
  ? POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT
  : DEFAULT_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT;

const packet = buildInternalDogfoodReviewNotesPacket(
  inputFile
    ? loadInputFile(inputFile)
    : useIssueFixture
    ? {
        ...POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
        notes: withIssueNote(POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT.notes),
      }
    : input,
);

console.log("=== Business Advancement Internal Dogfood Review Notes ===");
console.log(`Rule version                  : ${INTERNAL_DOGFOOD_REVIEW_NOTES_RULE_VERSION}`);
console.log(`Posture                       : ${INTERNAL_DOGFOOD_REVIEW_NOTES_POSTURE}`);
console.log(`Runtime adoption              : ${INTERNAL_DOGFOOD_REVIEW_NOTES_RUNTIME_ADOPTION}`);
console.log(
  `Fixture                       : ${inputFile ? `input-file:${inputFile}` : useIssueFixture ? "issue" : usePositiveFixture ? "positive" : "default"}`,
);
console.log(`Decision                      : ${packet.decision}`);
console.log(`Founder recommendation        : ${packet.founderRecommendation}`);
console.log(`Production query allowed      : ${String(packet.productionQueryAdoptionAllowed)}`);
console.log(`Runtime integration allowed   : ${String(packet.runtimeIntegrationAllowed)}`);
console.log(`Public trial allowed          : ${String(packet.publicTrialAllowed)}`);
console.log("");

console.log("--- Metrics ---");
console.log(`  total notes       : ${packet.metrics.totalNotes}`);
console.log(`  accepted          : ${packet.metrics.acceptCount}`);
console.log(`  false positives   : ${packet.metrics.falsePositiveCount}`);
console.log(`  missing evidence  : ${packet.metrics.missingEvidenceCount}`);
console.log(`  threshold concerns: ${packet.metrics.thresholdConcernCount}`);
console.log(`  stop requests     : ${packet.metrics.stopCount}`);

console.log("");
console.log("--- Lens Coverage ---");
for (const item of packet.lensCoverage) {
  console.log(
    `  [${item.covered ? "PASS" : "FAIL"}] ${item.lens}: notes=${item.noteCount}`,
  );
}

console.log("");
console.log("--- Family Coverage ---");
for (const item of packet.familyCoverage) {
  console.log(
    `  [${item.covered ? "PASS" : "FAIL"}] ${item.familyId}: required=${String(item.required)} included=${item.includedCount} notes=${item.noteCount}`,
  );
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
console.log("--- Founder Summary ---");
console.log(packet.founderReviewSummary);

console.log("");
console.log("--- Boundary Notes ---");
for (const note of packet.boundaryNotes) {
  console.log(`  - ${note}`);
}

const invariantViolation =
  packet.runtimeAdoption !== "No-Go" ||
  packet.productionQueryAdoptionAllowed ||
  packet.runtimeIntegrationAllowed ||
  packet.publicTrialAllowed;

if (invariantViolation) {
  console.error(
    "\nInternal dogfood review notes invariant failed: production/public/runtime adoption must stay blocked.",
  );
  process.exit(1);
}

if (expectReady && packet.decision !== "Ready-For-Founder-Review") {
  console.error("\nExpected review notes to be ready for founder review.");
  process.exit(1);
}

if (packet.decision === "Ready-For-Founder-Review") {
  console.log("\nInternal dogfood review notes are ready for founder review only.");
} else {
  console.log("\nInternal dogfood review notes are blocked. Production adoption remains No-Go.");
}

function withIssueNote(
  notes: readonly InternalDogfoodReviewNote[],
): readonly InternalDogfoodReviewNote[] {
  const patched = [...notes];
  patched[0] = {
    ...patched[0],
    verdict: "false_positive",
    notes: "One blocked-decision row appears noisy in internal review.",
    recommendedNextStep: "revise_packet",
  };
  return patched;
}

function readArgValue(flag: string): string | null {
  const eqPrefix = `${flag}=`;
  const eqArg = process.argv.find((arg) => arg.startsWith(eqPrefix));
  if (eqArg) {
    return eqArg.slice(eqPrefix.length);
  }
  const index = process.argv.indexOf(flag);
  if (index >= 0) {
    return process.argv[index + 1] ?? null;
  }
  return null;
}

function loadInputFile(filePath: string) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nFailed to read review notes input file: ${message}`);
    process.exit(1);
  }
  try {
    return buildInternalDogfoodReviewNotesInputFromJson(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nInvalid review notes input file: ${message}`);
    process.exit(1);
  }
}
