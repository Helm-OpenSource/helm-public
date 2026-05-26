#!/usr/bin/env tsx
import { runIntelligenceGrowthEvalReplaySnapshotEval } from "@/lib/evals/intelligence-growth-eval-replay-snapshot-evals";

function main(): void {
  const summary = runIntelligenceGrowthEvalReplaySnapshotEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
