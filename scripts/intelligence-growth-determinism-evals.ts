#!/usr/bin/env tsx
import { runIntelligenceGrowthDeterminismEval } from "@/lib/evals/intelligence-growth-determinism-evals";

function main(): void {
  const summary = runIntelligenceGrowthDeterminismEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
