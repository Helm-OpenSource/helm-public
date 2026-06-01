#!/usr/bin/env tsx
import { runIntelligenceGrowthDataProtectionManifestEval } from "@/lib/evals/intelligence-growth-data-protection-manifest-evals";

function main(): void {
  const summary = runIntelligenceGrowthDataProtectionManifestEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
