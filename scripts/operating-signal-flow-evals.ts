#!/usr/bin/env tsx
import { runOperatingSignalFlowEval } from "@/lib/evals/operating-signal-flow-evals";

function main() {
  const summary = runOperatingSignalFlowEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
