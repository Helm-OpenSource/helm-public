#!/usr/bin/env tsx
import { runAgenticGovernanceBoundaryStaticEval } from "@/lib/evals/agentic-governance-boundary-static-evals";

function main(): void {
  const summary = runAgenticGovernanceBoundaryStaticEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
