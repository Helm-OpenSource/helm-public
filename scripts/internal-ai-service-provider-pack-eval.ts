#!/usr/bin/env tsx

import { runInternalAIServiceProviderPackEval } from "@/lib/evals/internal-ai-service-provider-pack-evals";

function main() {
  const summary = runInternalAIServiceProviderPackEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
