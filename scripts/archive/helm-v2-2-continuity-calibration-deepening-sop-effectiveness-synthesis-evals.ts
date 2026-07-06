import { runHelmV22ContinuityCalibrationDeepeningEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityCalibrationDeepeningEvalHarness();

console.log(JSON.stringify(summary, null, 2));
