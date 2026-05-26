#!/usr/bin/env tsx
import { runIntelligenceGrowthDecisionOutcomeEval } from "@/lib/evals/intelligence-growth-decision-outcome-evals";

function main(): void {
  const summary = runIntelligenceGrowthDecisionOutcomeEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
