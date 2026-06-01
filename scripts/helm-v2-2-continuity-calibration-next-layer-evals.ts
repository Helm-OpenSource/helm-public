import { runHelmV22ContinuityCalibrationNextLayerEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityCalibrationNextLayerEvalHarness();

console.log(JSON.stringify(summary, null, 2));
