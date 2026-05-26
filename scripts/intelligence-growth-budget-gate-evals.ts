#!/usr/bin/env tsx
import { runIntelligenceGrowthBudgetGateEval } from "@/lib/evals/intelligence-growth-budget-gate-evals";

function main(): void {
  const summary = runIntelligenceGrowthBudgetGateEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
