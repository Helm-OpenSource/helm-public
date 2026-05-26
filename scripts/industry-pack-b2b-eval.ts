#!/usr/bin/env tsx

import { runIndustryPackB2BEval } from "@/lib/evals/industry-pack-b2b-evals";

function main() {
  const summary = runIndustryPackB2BEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
