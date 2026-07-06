import { runHelmV22ContinuityRecoveryEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityRecoveryEvalHarness();

console.log(JSON.stringify(summary, null, 2));

if (
  summary.passedCases !== summary.totalCases ||
  summary.recoveryStateRate !== 100 ||
  summary.taxonomyRate !== 100 ||
  summary.allowedActionsRate !== 100 ||
  summary.rollbackAnchorRate !== 100 ||
  summary.summaryRate !== 100 ||
  summary.operatorActionRate !== 100
) {
  process.exitCode = 1;
}
