import { runHelmV2DraftCommsEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV2DraftCommsEvalHarness();

console.log(JSON.stringify(summary, null, 2));

if (summary.passedCases !== summary.totalCases) {
  process.exitCode = 1;
}
