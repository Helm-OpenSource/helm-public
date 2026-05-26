import { runLLMContextEval } from "@/lib/evals/llm-context-evals";

function main() {
  const summary = runLLMContextEval();
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
