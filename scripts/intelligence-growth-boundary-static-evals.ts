#!/usr/bin/env tsx
import { runIntelligenceGrowthBoundaryStaticEval } from "@/lib/evals/intelligence-growth-boundary-static-evals";

function main(): void {
  const summary = runIntelligenceGrowthBoundaryStaticEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
