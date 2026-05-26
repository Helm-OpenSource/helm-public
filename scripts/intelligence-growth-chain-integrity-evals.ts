#!/usr/bin/env tsx
import { runIntelligenceGrowthChainIntegrityEval } from "@/lib/evals/intelligence-growth-chain-integrity-evals";

function main(): void {
  const summary = runIntelligenceGrowthChainIntegrityEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
