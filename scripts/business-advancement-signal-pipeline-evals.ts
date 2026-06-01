#!/usr/bin/env tsx
import { runBusinessAdvancementSignalPipelineEval } from "@/lib/evals/business-advancement-signal-pipeline-evals";

function main() {
  const summary = runBusinessAdvancementSignalPipelineEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
