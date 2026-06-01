#!/usr/bin/env tsx
import { runChannelPartnerCollaborationEval } from "@/lib/evals/channel-partner-collaboration-evals";

function main() {
  const summary = runChannelPartnerCollaborationEval();

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
