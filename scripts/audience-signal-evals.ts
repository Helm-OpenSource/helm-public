#!/usr/bin/env tsx
import { runAudienceSignalEval } from "@/lib/evals/audience-signal-evals";

function main() {
  const summary = runAudienceSignalEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
