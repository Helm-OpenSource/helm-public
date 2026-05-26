#!/usr/bin/env tsx
import { runIntelligenceGrowthWeeklyScorecardEval } from "@/lib/evals/intelligence-growth-weekly-scorecard-evals";

function main(): void {
  const summary = runIntelligenceGrowthWeeklyScorecardEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
