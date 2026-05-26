#!/usr/bin/env tsx
import { runOperatingSignalFlowRuntimeReadinessEval } from "@/lib/evals/operating-signal-flow-runtime-readiness-evals";

function main() {
  const summary = runOperatingSignalFlowRuntimeReadinessEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
