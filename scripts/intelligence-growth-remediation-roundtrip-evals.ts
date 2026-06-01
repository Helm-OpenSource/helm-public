#!/usr/bin/env tsx
import {
  runIntelligenceGrowthRemediationRoundtripEval,
} from "@/lib/evals/intelligence-growth-remediation-roundtrip-evals";

function main(): void {
  const summary = runIntelligenceGrowthRemediationRoundtripEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
