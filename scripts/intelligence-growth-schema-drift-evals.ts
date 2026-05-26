#!/usr/bin/env tsx
import { runIntelligenceGrowthSchemaDriftEval } from "@/lib/evals/intelligence-growth-schema-drift-evals";

function main(): void {
  const summary = runIntelligenceGrowthSchemaDriftEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
