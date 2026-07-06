import { runHelmV22ContinuityPilotCalibrationEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuityPilotCalibrationEvalHarness();

console.log(JSON.stringify(summary, null, 2));

if (
  summary.passedCases !== summary.totalCases ||
  summary.calibratedStateRate !== 100 ||
  summary.calibrationConfidenceRate !== 100 ||
  summary.latestEffectivenessRate !== 100 ||
  summary.repeatPatternRate !== 100 ||
  summary.evidenceRate !== 100 ||
  summary.runbookTitleRate !== 100
) {
  process.exitCode = 1;
}
