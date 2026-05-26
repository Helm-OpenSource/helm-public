import { runHelmV21VerifiedCoordinationEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV21VerifiedCoordinationEvalHarness();

console.log(JSON.stringify(summary, null, 2));

if (
  summary.passedCases !== summary.totalCases ||
  summary.verifiedPromotionRate !== 100 ||
  summary.truthConflictVisibilityRate !== 100 ||
  summary.confirmedProblemSpaceRate !== 100 ||
  summary.sourceConsistentBriefRate !== 100 ||
  summary.compositionFailureRate !== 100
) {
  process.exitCode = 1;
}
