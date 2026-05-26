#!/usr/bin/env tsx
import { runIntelligenceGrowthCycleAdvanceEval } from "@/lib/evals/intelligence-growth-cycle-advance-evals";

function main(): void {
  const summary = runIntelligenceGrowthCycleAdvanceEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
