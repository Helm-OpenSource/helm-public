#!/usr/bin/env tsx
import { runIntelligenceGrowthLiveCalibrationPreflightEval } from "@/lib/evals/intelligence-growth-live-calibration-preflight-evals";

function main(): void {
  const summary = runIntelligenceGrowthLiveCalibrationPreflightEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
