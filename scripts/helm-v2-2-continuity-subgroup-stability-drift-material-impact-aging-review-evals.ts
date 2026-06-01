import { runHelmV22ContinuitySubgroupStabilityDriftAgingEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuitySubgroupStabilityDriftAgingEvalHarness();

console.log(JSON.stringify(summary, null, 2));
