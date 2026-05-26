import { runObjectSignalValidityEval } from "@/lib/evals/object-signal-validity-evals";

function main() {
  const summary = runObjectSignalValidityEval();
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
