#!/usr/bin/env tsx
import { runIntelligenceGrowthTenantSignalEval } from "@/lib/evals/intelligence-growth-tenant-signal-evals";

function main(): void {
  const summary = runIntelligenceGrowthTenantSignalEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
