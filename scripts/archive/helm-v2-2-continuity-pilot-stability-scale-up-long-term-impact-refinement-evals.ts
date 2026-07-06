import { runHelmV22ContinuityPilotStabilityScaleUpEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityPilotStabilityScaleUpEvalHarness();

console.log(JSON.stringify(summary, null, 2));
