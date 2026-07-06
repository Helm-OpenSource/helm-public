import { runHelmV2OfficialSystemIntegrationEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV2OfficialSystemIntegrationEvalHarness();

console.log(JSON.stringify(summary, null, 2));

if (summary.passedCases !== summary.totalCases) {
  process.exitCode = 1;
}
