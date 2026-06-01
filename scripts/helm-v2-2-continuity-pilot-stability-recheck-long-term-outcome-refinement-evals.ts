import { runHelmV22ContinuityPilotStabilityRecheckEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityPilotStabilityRecheckEvalHarness();

console.log(JSON.stringify(summary, null, 2));
