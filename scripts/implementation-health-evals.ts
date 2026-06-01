#!/usr/bin/env tsx
import { runImplementationHealthEval } from "@/lib/evals/implementation-health-evals";

function main() {
  const summary = runImplementationHealthEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
