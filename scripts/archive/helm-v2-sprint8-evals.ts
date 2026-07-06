import { runHelmV2LimitedAutoPathEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV2LimitedAutoPathEvalHarness();

console.log(JSON.stringify(summary, null, 2));

if (summary.passedCases !== summary.totalCases) {
  process.exitCode = 1;
}
