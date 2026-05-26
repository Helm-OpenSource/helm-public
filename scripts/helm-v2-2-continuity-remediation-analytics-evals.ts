import { runHelmV22ContinuityRemediationAnalyticsEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityRemediationAnalyticsEvalHarness();

console.log(JSON.stringify(summary, null, 2));

if (
  summary.passedCases !== summary.totalCases ||
  summary.repeatPatternRate !== 100 ||
  summary.analyticsCountRate !== 100 ||
  summary.evidenceRate !== 100 ||
  summary.runbookTitleRate !== 100 ||
  summary.runbookRate !== 100
) {
  process.exitCode = 1;
}
