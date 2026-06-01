import { runHelmV22ContinuityPilotStabilityReviewEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityPilotStabilityReviewEvalHarness();

console.log(JSON.stringify(summary, null, 2));
