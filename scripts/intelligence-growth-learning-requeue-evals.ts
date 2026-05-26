#!/usr/bin/env tsx
import { runIntelligenceGrowthLearningRequeueEval } from "@/lib/evals/intelligence-growth-learning-requeue-evals";

function main(): void {
  const summary = runIntelligenceGrowthLearningRequeueEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
