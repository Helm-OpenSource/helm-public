import { runObjectSignalRemediationEval } from "@/lib/evals/object-signal-validity-evals";

function main() {
  const summary = runObjectSignalRemediationEval();
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
