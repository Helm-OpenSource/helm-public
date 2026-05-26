#!/usr/bin/env tsx
import { runIntelligenceGrowthApprovalReadinessEval } from "@/lib/evals/intelligence-growth-approval-readiness-evals";

function main(): void {
  const summary = runIntelligenceGrowthApprovalReadinessEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
