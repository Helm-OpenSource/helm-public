import { runSelfImprovementEval } from "@/lib/evals/self-improvement-evals";

function main() {
  const summary = runSelfImprovementEval();
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
