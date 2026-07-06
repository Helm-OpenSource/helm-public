import { runHelmV21BudgetedSessionContinuityEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV21BudgetedSessionContinuityEvalHarness();

console.log(JSON.stringify(summary, null, 2));

if (
  summary.passedCases !== summary.totalCases ||
  summary.payloadExternalizationRate !== 100 ||
  summary.notebookStateRate !== 100 ||
  summary.checkpointResumeRate !== 100 ||
  summary.pruneSafetyRate !== 100 ||
  summary.budgetPostureRate !== 100
) {
  process.exitCode = 1;
}
