import { runHelmV22CoordinationTraceEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22CoordinationTraceEvalHarness();

console.log(JSON.stringify(summary, null, 2));

if (
  summary.passedCases !== summary.totalCases ||
  summary.postureRate !== 100 ||
  summary.summaryRate !== 100 ||
  summary.linkageRate !== 100 ||
  summary.boundaryRate !== 100 ||
  summary.humanExecutionVisibilityRate !== 100 ||
  summary.officialFollowThroughVisibilityRate !== 100
) {
  process.exitCode = 1;
}
