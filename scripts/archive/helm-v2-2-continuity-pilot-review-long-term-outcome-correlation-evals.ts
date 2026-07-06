import { runHelmV22ContinuityPilotReviewLongTermOutcomeCorrelationEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityPilotReviewLongTermOutcomeCorrelationEvalHarness();

console.log(JSON.stringify(summary, null, 2));
