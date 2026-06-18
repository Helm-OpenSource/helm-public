#!/usr/bin/env tsx
import {
  referenceFusionEvalPassed,
  runReferenceFusionHeldoutEval,
} from "@/lib/operating-judgement-fusion/reference-run";

function main() {
  const report = runReferenceFusionHeldoutEval();
  const passed = referenceFusionEvalPassed(report);

  console.log(
    JSON.stringify(
      {
        passed,
        decision: report.decision,
        scoredCaseCount: report.scoredCaseCount,
        fusionAccuracy: report.fusionAccuracy,
        baselineAccuracy: report.baselineAccuracy,
        lift: report.lift,
        calibration: {
          brierScore: report.calibration.brierScore,
          expectedCalibrationError: report.calibration.expectedCalibrationError,
          overconfident: report.calibration.overconfident,
        },
        evidenceCompletenessCorrelation: report.evidenceCompletenessCorrelation,
        preRegistrationOk: report.preRegistrationValidation.ok,
        runValidationOk: report.runValidation.ok,
        hardGateFailures: report.hardGateFailures,
      },
      null,
      2,
    ),
  );

  if (!passed) {
    process.exit(1);
  }
}

main();
