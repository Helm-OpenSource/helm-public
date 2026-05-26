#!/usr/bin/env tsx
import { runIntelligenceGrowthFailureTaxonomyCoverageEval } from "@/lib/evals/intelligence-growth-failure-taxonomy-coverage-evals";

function main(): void {
  const summary = runIntelligenceGrowthFailureTaxonomyCoverageEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
