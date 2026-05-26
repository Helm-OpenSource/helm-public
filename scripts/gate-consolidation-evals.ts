import { runGateConsolidationEval } from "@/lib/evals/gate-consolidation-evals";

function main() {
  const summary = runGateConsolidationEval();
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
