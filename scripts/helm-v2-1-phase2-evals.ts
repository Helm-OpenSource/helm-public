import { runHelmV21RuntimeSubstrateEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV21RuntimeSubstrateEvalHarness();

console.log(JSON.stringify(summary, null, 2));

if (summary.budgetGovernanceRate !== 100 || summary.passedCases !== summary.totalCases) {
  process.exitCode = 1;
}
