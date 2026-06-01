import { runExternalAgentIntakeP0Req07BoundaryEval } from "@/lib/evals/external-agent-intake-p0-req-07-boundary-evals";

function main() {
  const summary = runExternalAgentIntakeP0Req07BoundaryEval();
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
