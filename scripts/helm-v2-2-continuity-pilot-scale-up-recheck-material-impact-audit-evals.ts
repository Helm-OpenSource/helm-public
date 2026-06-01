import { runHelmV22ContinuityPilotScaleUpRecheckEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityPilotScaleUpRecheckEvalHarness();

console.log(JSON.stringify(summary, null, 2));
