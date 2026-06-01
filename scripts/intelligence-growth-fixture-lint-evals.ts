#!/usr/bin/env tsx
import { runIntelligenceGrowthFixtureLintEval } from "@/lib/evals/intelligence-growth-fixture-lint-evals";

function main(): void {
  const summary = runIntelligenceGrowthFixtureLintEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
