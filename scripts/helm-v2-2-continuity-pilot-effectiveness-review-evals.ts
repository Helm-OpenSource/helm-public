import { runHelmV22ContinuityPilotEffectivenessReviewEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityPilotEffectivenessReviewEvalHarness();

console.log(JSON.stringify(summary, null, 2));
