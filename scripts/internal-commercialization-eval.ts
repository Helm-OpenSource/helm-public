#!/usr/bin/env tsx

import { runInternalCommercializationEval } from "@/lib/evals/internal-commercialization-evals";

function main() {
  const summary = runInternalCommercializationEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
