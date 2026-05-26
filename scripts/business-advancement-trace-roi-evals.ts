import { runBusinessAdvancementTraceRoiEval } from "@/lib/evals/business-advancement-trace-roi-evals";

function main() {
  const summary = runBusinessAdvancementTraceRoiEval();
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
