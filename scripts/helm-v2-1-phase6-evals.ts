import { runHelmV21OperatorSurfaceEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV21OperatorSurfaceEvalHarness();

console.log(JSON.stringify(summary, null, 2));

if (summary.consolidationBoundaryRate !== 100 || summary.passedCases !== summary.totalCases) {
  process.exitCode = 1;
}
