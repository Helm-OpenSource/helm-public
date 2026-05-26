#!/usr/bin/env tsx
import { runIntelligenceGrowthReviewPacketEval } from "@/lib/evals/intelligence-growth-review-packet-evals";

function main(): void {
  const summary = runIntelligenceGrowthReviewPacketEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
