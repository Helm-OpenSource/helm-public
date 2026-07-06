import { runHelmV22ContinuityPilotCalibrationReviewEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityPilotCalibrationReviewEvalHarness();

console.log(JSON.stringify(summary, null, 2));
