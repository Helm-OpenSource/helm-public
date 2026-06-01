#!/usr/bin/env tsx
import { runIntelligenceGrowthDimensionSaturationEval } from "@/lib/evals/intelligence-growth-dimension-saturation-evals";

function main(): void {
  const summary = runIntelligenceGrowthDimensionSaturationEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
