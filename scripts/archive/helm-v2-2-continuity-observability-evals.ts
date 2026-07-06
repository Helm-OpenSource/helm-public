import { runHelmV22ContinuityObservabilityEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityObservabilityEvalHarness();

console.log(JSON.stringify(summary, null, 2));

if (
  summary.passedCases !== summary.totalCases ||
  summary.replayStatusRate !== 100 ||
  summary.payloadSourceRiskRate !== 100 ||
  summary.riskLevelRate !== 100 ||
  summary.riskSummaryRate !== 100 ||
  summary.operatorActionRate !== 100
) {
  process.exitCode = 1;
}
